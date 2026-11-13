import type { FrameAnalysis } from './dspFilters';
import type { PitchEngineAudioInfo } from './PitchEngine';

export function isDebugModeEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  if (import.meta.env.VITE_DEBUG_MODE === '1') return true;
  try {
    return new URLSearchParams(window.location.search).get('debug') === '1';
  } catch {
    return false;
  }
}

export interface DebugRecorderStats {
  sessionId: string;
  eventsSent: number;
  audioBytesSent: number;
  snapshotsSent: number;
  connected: boolean;
  lastError: string | null;
}

interface RingFrame {
  timestampMs: number;
  sampleRate: number;
  analysis: FrameAnalysis;
  cardIndex?: number;
  targetNote?: string;
  pcmInt16Base64: string;
}

function float32ToInt16Bytes(samples: Float32Array): Uint8Array {
  const buf = new ArrayBuffer(samples.length * 2);
  const view = new DataView(buf);
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    const int16 = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    view.setInt16(i * 2, int16, true);
  }
  return new Uint8Array(buf);
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

export class DebugSessionRecorder {
  public readonly sessionId: string;
  private eventQueue: Record<string, unknown>[] = [];
  private rawAudioChunks: Uint8Array[] = [];
  private rawAudioBytesQueued = 0;
  private rawAudioSampleRate = 48000;
  private ringBuffer: RingFrame[] = [];
  private readonly maxRingFrames = 15;
  private flushTimer: number | null = null;
  private stopped = false;
  private stats: DebugRecorderStats;
  private statsListener: ((s: DebugRecorderStats) => void) | null = null;

  constructor(screen: 'calibration' | 'gameplay', label: string) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeLabel = label.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 32);
    const rand = Math.random().toString(36).slice(2, 6);
    this.sessionId = `${stamp}_${screen}_${safeLabel}_${rand}`;
    this.stats = {
      sessionId: this.sessionId,
      eventsSent: 0,
      audioBytesSent: 0,
      snapshotsSent: 0,
      connected: false,
      lastError: null,
    };
  }

  public onStatsChange(listener: (s: DebugRecorderStats) => void): void {
    this.statsListener = listener;
    listener({ ...this.stats });
  }

  private emitStats(): void {
    this.statsListener?.({ ...this.stats });
  }

  public start(meta: Record<string, unknown>): void {
    this.stopped = false;
    void this.postJson('/__debug/session', {
      sessionId: this.sessionId,
      startedAtIso: new Date().toISOString(),
      perfOriginEstimateMs: Date.now() - performance.now(),
      userAgent: navigator.userAgent,
      devicePixelRatio: window.devicePixelRatio,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      ...meta,
    });

    if (this.flushTimer === null) {
      this.flushTimer = window.setInterval(() => {
        void this.flush(false);
      }, 450);
    }
  }

  public updateAudioInfo(info: PitchEngineAudioInfo): void {
    this.rawAudioSampleRate = info.sampleRate;
    void this.postJson('/__debug/session', {
      sessionId: this.sessionId,
      audioInfo: info,
    });
  }

  public pushEvent(event: Record<string, unknown>): void {
    if (this.stopped) return;
    this.eventQueue.push({
      epochMs: Date.now(),
      perfMs: performance.now(),
      ...event,
    });
    if (this.eventQueue.length >= 60) {
      void this.flushEvents(false);
    }
  }

  public pushPostFilterFrame(
    buffer: Float32Array,
    sampleRate: number,
    timestampMs: number,
    analysis: FrameAnalysis,
    cardIndex?: number,
    targetNote?: string
  ): void {
    if (this.stopped) return;
    const pcmBytes = float32ToInt16Bytes(buffer);
    this.ringBuffer.push({
      timestampMs,
      sampleRate,
      analysis,
      cardIndex,
      targetNote,
      pcmInt16Base64: uint8ToBase64(pcmBytes),
    });
    if (this.ringBuffer.length > this.maxRingFrames) {
      this.ringBuffer.shift();
    }
  }

  public dumpSnapshot(reason: string, context: Record<string, unknown>): void {
    if (this.stopped) return;
    const frames = [...this.ringBuffer];
    void this.postJson('/__debug/snapshot', {
      sessionId: this.sessionId,
      reason,
      epochMs: Date.now(),
      perfMs: performance.now(),
      context,
      frames,
    }).then((ok) => {
      if (ok) {
        this.stats.snapshotsSent += 1;
        this.emitStats();
      }
    });
  }

  public pushRawAudio(samples: Float32Array, sampleRate: number): void {
    if (this.stopped) return;
    this.rawAudioSampleRate = sampleRate;
    const pcmBytes = float32ToInt16Bytes(samples);
    this.rawAudioChunks.push(pcmBytes);
    this.rawAudioBytesQueued += pcmBytes.byteLength;
    // Flush ~0.5s of 48kHz Int16 (~48KB)
    if (this.rawAudioBytesQueued >= 48000) {
      void this.flushAudio(false);
    }
  }

  public async flush(keepalive = false): Promise<void> {
    await Promise.all([this.flushEvents(keepalive), this.flushAudio(keepalive)]);
  }

  public stop(): void {
    if (this.stopped) return;
    void this.flush(true);
    this.stopped = true;
    if (this.flushTimer !== null) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  private async postJson(url: string, body: unknown, keepalive = false): Promise<boolean> {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        keepalive,
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      this.stats.connected = true;
      this.stats.lastError = null;
      this.emitStats();
      return true;
    } catch (err) {
      this.stats.lastError = err instanceof Error ? err.message : 'Debug post failed';
      this.emitStats();
      return false;
    }
  }

  private async flushEvents(keepalive: boolean): Promise<void> {
    if (this.eventQueue.length === 0) return;
    const batch = this.eventQueue.splice(0, this.eventQueue.length);
    const ndjson = batch.map((e) => JSON.stringify(e)).join('\n') + '\n';
    try {
      const res = await fetch(
        `/__debug/events?sessionId=${encodeURIComponent(this.sessionId)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-ndjson' },
          body: ndjson,
          keepalive,
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.stats.eventsSent += batch.length;
      this.stats.connected = true;
      this.stats.lastError = null;
      this.emitStats();
    } catch (err) {
      this.stats.lastError = err instanceof Error ? err.message : 'Event flush failed';
      this.emitStats();
    }
  }

  private async flushAudio(keepalive: boolean): Promise<void> {
    if (this.rawAudioChunks.length === 0) return;
    const chunks = this.rawAudioChunks.splice(0, this.rawAudioChunks.length);
    const totalBytes = this.rawAudioBytesQueued;
    this.rawAudioBytesQueued = 0;

    const merged = new Uint8Array(totalBytes);
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.byteLength;
    }

    try {
      const res = await fetch(
        `/__debug/audio-raw?sessionId=${encodeURIComponent(this.sessionId)}&sampleRate=${this.rawAudioSampleRate}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: merged,
          keepalive: keepalive && merged.byteLength < 55000,
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.stats.audioBytesSent += merged.byteLength;
      this.stats.connected = true;
      this.stats.lastError = null;
      this.emitStats();
    } catch (err) {
      this.stats.lastError = err instanceof Error ? err.message : 'Audio flush failed';
      this.emitStats();
    }
  }
}
