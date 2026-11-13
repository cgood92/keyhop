import { YIN } from 'pitchfinder';
import { PitchDetector } from 'pitchy';
import { frequencyToMidi } from '../music/notation';

export function computeRms(buffer: Float32Array): number {
  if (buffer.length === 0) return 0;
  let sumSq = 0;
  for (let i = 0; i < buffer.length; i += 1) {
    const v = buffer[i];
    sumSq += v * v;
  }
  return Math.sqrt(sumSq / buffer.length);
}

/**
 * Computes Hann-windowed Goertzel DFT magnitude at an arbitrary frequency (Hz).
 * Hann windowing eliminates rectangular sidelobe leakage into f0 / 2.
 */
function windowedGoertzelMagnitude(
  buffer: Float32Array,
  freqHz: number,
  sampleRate: number
): number {
  const n = buffer.length;
  if (n < 16 || freqHz <= 0) return 0;
  const omega = (2 * Math.PI * freqHz) / sampleRate;
  const coeff = 2 * Math.cos(omega);
  let q1 = 0;
  let q2 = 0;
  const denom = n - 1;
  for (let i = 0; i < n; i += 1) {
    const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / denom));
    const q0 = coeff * q1 - q2 + buffer[i] * w;
    q2 = q1;
    q1 = q0;
  }
  const real = q1 - q2 * Math.cos(omega);
  const imag = q2 * Math.sin(omega);
  return Math.sqrt(real * real + imag * imag) / n;
}

/**
 * Resolves octave disagreements (or weak-fundamental bass piano notes below ~160 Hz)
 * using Hann-windowed spectral verification rather than unwindowed leakage.
 */
export function resolvePianoOctave(
  buffer: Float32Array,
  mpmHz: number,
  yinHz: number | null,
  sampleRate: number
): number | null {
  if (yinHz !== null && Number.isFinite(yinHz) && yinHz >= 27.5 && yinHz <= 4200) {
    const ratio = mpmHz / yinHz;
    // Both detectors agree on the same pitch (within ~6%)
    if (ratio > 0.94 && ratio < 1.06) {
      // For low bass strings (< 196 Hz = G3), verify whether f0/2 is genuinely present
      if (mpmHz >= 110 && mpmHz <= 210) {
        const magF0 = windowedGoertzelMagnitude(buffer, mpmHz, sampleRate);
        const magHalf = windowedGoertzelMagnitude(buffer, mpmHz / 2, sampleRate);
        if (magF0 > 1e-6 && magHalf / magF0 >= 0.2) {
          return mpmHz / 2;
        }
      }
      return (mpmHz + yinHz) / 2;
    }

    // Detectors differ by ~1 octave: check Hann-windowed energy at the lower octave
    if (ratio > 1.88 && ratio < 2.12) {
      const magHigh = windowedGoertzelMagnitude(buffer, mpmHz, sampleRate);
      const magLow = windowedGoertzelMagnitude(buffer, yinHz, sampleRate);
      return magHigh > 1e-6 && magLow / magHigh >= 0.16 ? yinHz : mpmHz;
    }

    if (ratio > 0.47 && ratio < 0.53) {
      const magHigh = windowedGoertzelMagnitude(buffer, yinHz, sampleRate);
      const magLow = windowedGoertzelMagnitude(buffer, mpmHz, sampleRate);
      return magHigh > 1e-6 && magLow / magHigh >= 0.16 ? mpmHz : yinHz;
    }

    // Disagreement across non-octave interval -> noisy transient/polyphonic overlap
    return null;
  }

  // Fallback if YIN returned null (e.g. very low A0/B0 < 47 Hz)
  if (mpmHz >= 110 && mpmHz <= 210) {
    const magF0 = windowedGoertzelMagnitude(buffer, mpmHz, sampleRate);
    const magHalf = windowedGoertzelMagnitude(buffer, mpmHz / 2, sampleRate);
    if (magF0 > 1e-6 && magHalf / magF0 >= 0.2) {
      return mpmHz / 2;
    }
  }
  return mpmHz;
}

export interface NoteTrackerConfig {
  rmsThreshold: number;
  clarityThreshold: number;
  requiredStableFrames: number;
  centsOffset: number;
  semitoneOffset: number;
  sameNoteCooldownMs: number;
}

export interface FrameAnalysis {
  rms: number;
  clarity: number;
  pitchHz: number | null;
  activeMidi: number | null;
  emittedMidi: number | null;
}

export class NoteTracker {
  private config: NoteTrackerConfig;
  private mpmCache = new Map<number, PitchDetector<Float32Array>>();
  private yinCache = new Map<number, (buf: Float32Array) => number | null>();
  private recentMidis: number[] = [];
  private candidateMidi: number | null = null;
  private stableCount = 0;
  private lastEmittedMidi: number | null = null;
  private lastEmitTimestamp = 0;
  private suppressedUntilMs = 0;
  private prevRms = 0;
  private rearmed = true;

  constructor(config: Partial<NoteTrackerConfig> = {}) {
    this.config = {
      rmsThreshold: 0.015,
      clarityThreshold: 0.88,
      requiredStableFrames: 3,
      centsOffset: 0,
      semitoneOffset: 0,
      sameNoteCooldownMs: 340,
      ...config,
    };
  }

  public updateConfig(partial: Partial<NoteTrackerConfig>): void {
    this.config = { ...this.config, ...partial };
  }

  /**
   * Temporarily suppresses pitch emissions (e.g., while app speaker SFX plays)
   * and clears transient candidate history so speaker audio cannot feed back.
   */
  public suppressUntil(timestampMs: number): void {
    this.suppressedUntilMs = Math.max(this.suppressedUntilMs, timestampMs);
    this.candidateMidi = null;
    this.stableCount = 0;
    this.recentMidis = [];
  }

  public reset(): void {
    this.recentMidis = [];
    this.candidateMidi = null;
    this.stableCount = 0;
    this.lastEmittedMidi = null;
    this.lastEmitTimestamp = 0;
    this.suppressedUntilMs = 0;
    this.prevRms = 0;
    this.rearmed = true;
  }

  private getMpmDetector(length: number): PitchDetector<Float32Array> {
    let det = this.mpmCache.get(length);
    if (!det) {
      det = PitchDetector.forFloat32Array(length);
      this.mpmCache.set(length, det);
    }
    return det;
  }

  private getYinDetector(sampleRate: number): (buf: Float32Array) => number | null {
    let det = this.yinCache.get(sampleRate);
    if (!det) {
      det = YIN({ sampleRate, threshold: 0.14, probabilityThreshold: 0.1 });
      this.yinCache.set(sampleRate, det);
    }
    return det;
  }

  public processFrame(
    buffer: Float32Array,
    sampleRate: number,
    timestampMs: number
  ): FrameAnalysis {
    const rms = computeRms(buffer);
    const rmsDipRearm = rms < this.config.rmsThreshold * 1.18;
    const sharpOnset =
      this.prevRms > 0 &&
      rms > this.prevRms * 1.6 &&
      rms > this.config.rmsThreshold * 1.8;

    if (rmsDipRearm) {
      this.rearmed = true;
    } else if (
      sharpOnset &&
      timestampMs - this.lastEmitTimestamp >= this.config.sameNoteCooldownMs
    ) {
      this.rearmed = true;
    }

    this.prevRms = rms;

    if (timestampMs < this.suppressedUntilMs || rms < this.config.rmsThreshold) {
      this.candidateMidi = null;
      this.stableCount = 0;
      this.recentMidis = [];
      if (rms < this.config.rmsThreshold) {
        this.rearmed = true;
      }
      return { rms, clarity: 0, pitchHz: null, activeMidi: null, emittedMidi: null };
    }

    const mpm = this.getMpmDetector(buffer.length);
    const [mpmPitch, clarity] = mpm.findPitch(buffer, sampleRate);

    if (
      !Number.isFinite(mpmPitch) ||
      clarity < this.config.clarityThreshold ||
      mpmPitch < 27.5 ||
      mpmPitch > 4200
    ) {
      this.stableCount = 0;
      return { rms, clarity, pitchHz: null, activeMidi: null, emittedMidi: null };
    }

    // Run pitchfinder YIN on the latest 2049 samples (~43ms) for cross-verification
    const yinSlice =
      buffer.length > 2049 ? buffer.subarray(buffer.length - 2049) : buffer;
    const yinPitch = this.getYinDetector(sampleRate)(yinSlice);

    const pitchHz = resolvePianoOctave(buffer, mpmPitch, yinPitch, sampleRate);
    if (pitchHz === null) {
      this.stableCount = 0;
      return { rms, clarity, pitchHz: null, activeMidi: null, emittedMidi: null };
    }

    const { midi, centsError } = frequencyToMidi(
      pitchHz,
      this.config.centsOffset,
      this.config.semitoneOffset
    );

    if (Math.abs(centsError) > 45 || midi < 21 || midi > 108) {
      return { rms, clarity, pitchHz, activeMidi: null, emittedMidi: null };
    }

    // 3-frame median filter wipes out isolated single-frame glitches
    this.recentMidis.push(midi);
    if (this.recentMidis.length > 3) {
      this.recentMidis.shift();
    }
    const sorted = [...this.recentMidis].sort((a, b) => a - b);
    const smoothedMidi = sorted[Math.floor(sorted.length / 2)];

    if (this.candidateMidi === smoothedMidi) {
      this.stableCount += 1;
    } else {
      this.candidateMidi = smoothedMidi;
      this.stableCount = 1;
    }

    let emittedMidi: number | null = null;
    if (this.stableCount >= this.config.requiredStableFrames) {
      const isNewNote = smoothedMidi !== this.lastEmittedMidi;
      const canRetriggerSame =
        smoothedMidi === this.lastEmittedMidi &&
        this.rearmed &&
        timestampMs - this.lastEmitTimestamp >= this.config.sameNoteCooldownMs;

      if (isNewNote || canRetriggerSame) {
        emittedMidi = smoothedMidi;
        this.lastEmittedMidi = smoothedMidi;
        this.lastEmitTimestamp = timestampMs;
        this.rearmed = false;
      }
    }

    return {
      rms,
      clarity,
      pitchHz,
      activeMidi: smoothedMidi,
      emittedMidi,
    };
  }
}
