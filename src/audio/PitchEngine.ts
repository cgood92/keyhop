import { NoteTracker } from './dspFilters';
import type { FrameAnalysis, NoteTrackerConfig } from './dspFilters';

export interface PitchListenerCallbacks {
  onNoteDetected: (midi: number, analysis: FrameAnalysis) => void;
  onFrame?: (analysis: FrameAnalysis) => void;
  onPostFilterFrame?: (
    buffer: Float32Array,
    sampleRate: number,
    timestampMs: number,
    analysis: FrameAnalysis
  ) => void;
  onRawAudio?: (samples: Float32Array, sampleRate: number, timestampMs: number) => void;
  onReady?: (info: PitchEngineAudioInfo) => void;
  onError?: (message: string) => void;
}

export interface PitchEngineAudioInfo {
  sampleRate: number;
  fftSize: number;
  highpassFreq: number;
  filterType: string;
  filterFreq: number;
  filterQ: number;
  audioCtxState: AudioContextState;
  baseLatency?: number;
  trackLabel: string;
  trackSettings: MediaTrackSettings | null;
}

export class PitchEngine {
  private audioCtx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private highpassNode: BiquadFilterNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private analyser: AnalyserNode | null = null;
  private rawProcessor: ScriptProcessorNode | null = null;
  private silentGain: GainNode | null = null;
  private buffer: Float32Array<ArrayBuffer> | null = null;
  private rafId: number | null = null;
  private tracker: NoteTracker;
  private callbacks: PitchListenerCallbacks | null = null;
  private running = false;
  private startToken = 0;

  constructor(config: Partial<NoteTrackerConfig> = {}) {
    this.tracker = new NoteTracker(config);
  }

  public updateConfig(config: Partial<NoteTrackerConfig>): void {
    this.tracker.updateConfig(config);
  }

  public resetTracker(): void {
    this.tracker.reset();
  }

  public suppressFor(durationMs: number): void {
    this.tracker.suppressUntil(performance.now() + durationMs);
  }

  public isRunning(): boolean {
    return this.running;
  }

  public async start(callbacks: PitchListenerCallbacks): Promise<void> {
    if (this.running) {
      this.callbacks = callbacks;
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const msg = 'Microphone access is not supported in this browser or requires HTTPS.';
      callbacks.onError?.(msg);
      throw new Error(msg);
    }

    const token = ++this.startToken;
    let acquiredStream: MediaStream | null = null;
    let createdCtx: AudioContext | null = null;

    try {
      this.callbacks = callbacks;
      acquiredStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      if (token !== this.startToken) {
        for (const track of acquiredStream.getTracks()) track.stop();
        return;
      }

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      createdCtx = new AudioCtx();
      if (createdCtx.state === 'suspended') {
        await createdCtx.resume();
      }
      if (token !== this.startToken) {
        for (const track of acquiredStream.getTracks()) track.stop();
        void createdCtx.close();
        return;
      }

      this.stream = acquiredStream;
      this.audioCtx = createdCtx;
      this.sourceNode = this.audioCtx.createMediaStreamSource(this.stream);

      // High-pass attenuates appliance/motor rumble, DC drift, and handling thumps below piano range.
      this.highpassNode = this.audioCtx.createBiquadFilter();
      this.highpassNode.type = 'highpass';
      this.highpassNode.frequency.value = 55;
      this.highpassNode.Q.value = 0.7;

      // Gentle low-pass filter attenuates sharp percussive hammer clicks & room hiss
      // while preserving fundamentals across the entire piano range.
      this.filterNode = this.audioCtx.createBiquadFilter();
      this.filterNode.type = 'lowpass';
      this.filterNode.frequency.value = 2600;
      this.filterNode.Q.value = 0.7;

      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 4096;
      this.analyser.smoothingTimeConstant = 0;

      this.sourceNode.connect(this.highpassNode);
      this.highpassNode.connect(this.filterNode);
      this.filterNode.connect(this.analyser);

      if (this.callbacks?.onRawAudio && typeof this.audioCtx.createScriptProcessor === 'function') {
        try {
          const proc = this.audioCtx.createScriptProcessor(4096, 1, 1);
          const zeroGain = this.audioCtx.createGain();
          zeroGain.gain.value = 0;
          const ctxRef = this.audioCtx;
          proc.onaudioprocess = (ev) => {
            if (!this.running) return;
            const input = ev.inputBuffer.getChannelData(0);
            this.callbacks?.onRawAudio?.(input, ctxRef.sampleRate, performance.now());
          };
          this.sourceNode.connect(proc);
          proc.connect(zeroGain);
          zeroGain.connect(this.audioCtx.destination);
          this.rawProcessor = proc;
          this.silentGain = zeroGain;
        } catch {
          // Ignore if browser disallows ScriptProcessorNode
        }
      }

      const audioTrack = this.stream.getAudioTracks()[0];
      this.callbacks?.onReady?.({
        sampleRate: this.audioCtx.sampleRate,
        fftSize: this.analyser.fftSize,
        highpassFreq: this.highpassNode.frequency.value,
        filterType: this.filterNode.type,
        filterFreq: this.filterNode.frequency.value,
        filterQ: this.filterNode.Q.value,
        audioCtxState: this.audioCtx.state,
        baseLatency: this.audioCtx.baseLatency,
        trackLabel: audioTrack?.label ?? '',
        trackSettings: audioTrack?.getSettings?.() ?? null,
      });

      this.buffer = new Float32Array(new ArrayBuffer(this.analyser.fftSize * 4));
      this.tracker.reset();
      this.running = true;

      const loop = () => {
        if (!this.running || !this.analyser || !this.buffer || !this.audioCtx) return;
        this.analyser.getFloatTimeDomainData(this.buffer);
        const now = performance.now();
        const sampleRate = this.audioCtx.sampleRate;
        const analysis = this.tracker.processFrame(this.buffer, sampleRate, now);
        this.callbacks?.onPostFilterFrame?.(this.buffer, sampleRate, now, analysis);
        this.callbacks?.onFrame?.(analysis);
        if (analysis.emittedMidi !== null) {
          this.callbacks?.onNoteDetected(analysis.emittedMidi, analysis);
        }
        this.rafId = requestAnimationFrame(loop);
      };
      this.rafId = requestAnimationFrame(loop);
    } catch (err) {
      if (token === this.startToken) {
        this.stop();
        const message =
          err instanceof Error
            ? err.message
            : 'Microphone permission denied or no microphone found.';
        callbacks.onError?.(message);
      } else {
        if (acquiredStream) {
          for (const track of acquiredStream.getTracks()) track.stop();
        }
        if (createdCtx) {
          void createdCtx.close();
        }
      }
      throw err;
    }
  }

  public stop(): void {
    this.startToken++;
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.rawProcessor) {
      this.rawProcessor.onaudioprocess = null;
      this.rawProcessor.disconnect();
      this.rawProcessor = null;
    }
    if (this.silentGain) {
      this.silentGain.disconnect();
      this.silentGain = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.highpassNode) {
      this.highpassNode.disconnect();
      this.highpassNode = null;
    }
    if (this.filterNode) {
      this.filterNode.disconnect();
      this.filterNode = null;
    }
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
      this.stream = null;
    }
    if (this.audioCtx) {
      void this.audioCtx.close();
      this.audioCtx = null;
    }
    this.buffer = null;
    this.tracker.reset();
  }
}
