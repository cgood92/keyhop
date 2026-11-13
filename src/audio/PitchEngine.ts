import { NoteTracker } from './dspFilters';
import type { FrameAnalysis, NoteTrackerConfig } from './dspFilters';

export interface PitchListenerCallbacks {
  onNoteDetected: (midi: number, analysis: FrameAnalysis) => void;
  onFrame?: (analysis: FrameAnalysis) => void;
  onError?: (message: string) => void;
}

export class PitchEngine {
  private audioCtx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private analyser: AnalyserNode | null = null;
  private buffer: Float32Array<ArrayBuffer> | null = null;
  private rafId: number | null = null;
  private tracker: NoteTracker;
  private callbacks: PitchListenerCallbacks | null = null;
  private running = false;

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

    try {
      this.callbacks = callbacks;
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioCtx();
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      this.sourceNode = this.audioCtx.createMediaStreamSource(this.stream);
      // Gentle low-pass filter attenuates sharp percussive hammer clicks & room hiss
      // while preserving fundamentals across the entire piano range.
      this.filterNode = this.audioCtx.createBiquadFilter();
      this.filterNode.type = 'lowpass';
      this.filterNode.frequency.value = 2600;
      this.filterNode.Q.value = 0.7;

      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 4096;
      this.analyser.smoothingTimeConstant = 0;

      this.sourceNode.connect(this.filterNode);
      this.filterNode.connect(this.analyser);

      this.buffer = new Float32Array(new ArrayBuffer(this.analyser.fftSize * 4));
      this.tracker.reset();
      this.running = true;

      const loop = () => {
        if (!this.running || !this.analyser || !this.buffer || !this.audioCtx) return;
        this.analyser.getFloatTimeDomainData(this.buffer);
        const analysis = this.tracker.processFrame(
          this.buffer,
          this.audioCtx.sampleRate,
          performance.now()
        );
        this.callbacks?.onFrame?.(analysis);
        if (analysis.emittedMidi !== null) {
          this.callbacks?.onNoteDetected(analysis.emittedMidi, analysis);
        }
        this.rafId = requestAnimationFrame(loop);
      };
      this.rafId = requestAnimationFrame(loop);
    } catch (err) {
      this.stop();
      const message =
        err instanceof Error
          ? err.message
          : 'Microphone permission denied or no microphone found.';
      callbacks.onError?.(message);
      throw err;
    }
  }

  public stop(): void {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
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
