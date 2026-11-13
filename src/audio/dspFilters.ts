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
  if (n < 16 || freqHz <= 0 || freqHz >= sampleRate / 2) return 0;
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
 * Custom YIN pitch detector restricted to piano fundamental lag bounds [27.5 .. 4200 Hz].
 * Avoids pitchfinder's tau=1 normalization bug on low-pass filtered audio where smoothed
 * adjacent samples trigger false ~20 kHz detections.
 */
export function detectYinPitch(
  buffer: Float32Array,
  sampleRate: number,
  threshold = 0.14
): number | null {
  const n = Math.min(2048, buffer.length);
  if (n < 64) return null;
  const start = buffer.length - n;
  const yinLen = n >> 1;
  const tauMin = Math.max(2, Math.floor(sampleRate / 4250));
  const tauMax = Math.min(yinLen - 1, Math.ceil(sampleRate / 45));
  if (tauMax <= tauMin) return null;

  const yinBuffer = new Float32Array(tauMax + 1);
  for (let t = 1; t <= tauMax; t += 1) {
    let sum = 0;
    for (let i = 0; i < yinLen; i += 1) {
      const delta = buffer[start + i] - buffer[start + i + t];
      sum += delta * delta;
    }
    yinBuffer[t] = sum;
  }

  yinBuffer[0] = 1;
  let runningSum = 0;
  for (let t = 1; t <= tauMax; t += 1) {
    runningSum += yinBuffer[t];
    yinBuffer[t] = runningSum > 0 ? (yinBuffer[t] * t) / runningSum : 1;
  }

  let tau = -1;
  for (let t = tauMin; t <= tauMax; t += 1) {
    if (yinBuffer[t] < threshold) {
      while (t + 1 <= tauMax && yinBuffer[t + 1] < yinBuffer[t]) {
        t += 1;
      }
      if (1 - yinBuffer[t] >= 0.1) {
        tau = t;
      }
      break;
    }
  }
  if (tau === -1) return null;

  let betterTau = tau;
  if (tau > 0 && tau + 1 <= tauMax) {
    const s0 = yinBuffer[tau - 1];
    const s1 = yinBuffer[tau];
    const s2 = yinBuffer[tau + 1];
    const denom = 2 * (2 * s1 - s2 - s0);
    if (Math.abs(denom) > 1e-12) {
      betterTau = tau + (s2 - s0) / denom;
    }
  }

  const hz = sampleRate / betterTau;
  return Number.isFinite(hz) && hz >= 27.5 && hz <= 4200 ? hz : null;
}

export interface OctaveResolutionDebug {
  pitchHz: number | null;
  reason: string;
  ratio: number | null;
  magF0: number | null;
  magHalf: number | null;
  magHigh: number | null;
  magLow: number | null;
  harmonics?: {
    baseHz: number;
    m1: number;
    m2: number;
    m3: number;
    m4: number;
    m6: number;
  };
}

function goertzelUpTo(
  buffer: Float32Array,
  freqHz: number,
  sampleRate: number,
  maxHz = 4200
): number {
  return freqHz <= maxHz ? windowedGoertzelMagnitude(buffer, freqHz, sampleRate) : 0;
}

/**
 * Resolves octave/subharmonic disagreements between time-domain detectors and verifies
 * piano harmonic structure via Hann-windowed Goertzel magnitudes.
 * Distinguishes attack-thump subharmonics (missing f3 partial) from genuine weak-fundamental
 * bass notes (which retain a strong 3rd partial at 1.5 * candidate).
 */
export function resolvePianoOctaveDetailed(
  buffer: Float32Array,
  mpmHz: number,
  yinHz: number | null,
  sampleRate: number
): OctaveResolutionDebug {
  let baseHz = mpmHz;
  let ratio: number | null = null;
  let pairReason = 'yin_null';

  if (yinHz !== null && Number.isFinite(yinHz) && yinHz >= 27.5 && yinHz <= 4200) {
    ratio = mpmHz / yinHz;
    if (ratio > 0.94 && ratio < 1.06) {
      baseHz = (mpmHz + yinHz) / 2;
      pairReason = 'agree';
    } else if (ratio > 1.88 && ratio < 2.12) {
      baseHz = yinHz;
      pairReason = 'octave_mpm2x';
    } else if (ratio > 0.47 && ratio < 0.53) {
      baseHz = mpmHz;
      pairReason = 'octave_yin2x';
    } else if (ratio > 3.76 && ratio < 4.24) {
      baseHz = yinHz;
      pairReason = 'octave_mpm4x';
    } else if (ratio > 0.23 && ratio < 0.27) {
      baseHz = mpmHz;
      pairReason = 'octave_yin4x';
    } else {
      const r = ratio >= 1 ? ratio : 1 / ratio;
      const k = Math.round(r);
      const subMatch = k >= 2 && k <= 8 && Math.abs(r - k) < 0.14;
      if (subMatch) {
        const highHz = ratio >= 1 ? mpmHz : yinHz;
        const lowHz = ratio >= 1 ? yinHz : mpmHz;
        const magHigh = goertzelUpTo(buffer, highHz, sampleRate);
        const magLow = goertzelUpTo(buffer, lowHz, sampleRate);
        if (magHigh > 1e-5 && magHigh > magLow * 2.5) {
          baseHz = highHz;
          pairReason = `subharmonic_fold${k}x`;
        } else {
          return {
            pitchHz: null,
            reason: 'disagree_non_octave_null',
            ratio,
            magF0: null,
            magHalf: null,
            magHigh,
            magLow,
          };
        }
      } else {
        return {
          pitchHz: null,
          reason: 'disagree_non_octave_null',
          ratio,
          magF0: null,
          magHalf: null,
          magHigh: null,
          magLow: null,
        };
      }
    }
  }

  const m1 = goertzelUpTo(buffer, baseHz, sampleRate);
  const m2 = goertzelUpTo(buffer, baseHz * 2, sampleRate);
  const m3 = goertzelUpTo(buffer, baseHz * 3, sampleRate);
  const m4 = goertzelUpTo(buffer, baseHz * 4, sampleRate);
  const m6 = goertzelUpTo(buffer, baseHz * 6, sampleRate);
  const harmonics = { baseHz, m1, m2, m3, m4, m6 };

  // 1) 4x subharmonic fold-up (e.g. G2 -> G4, B1 -> B3 when keybed/room thump locks at 4*T0)
  if (m4 > 1e-5 && m4 > m1 * 1.4 && m2 / m4 < 0.25 && m3 / m4 < 0.2) {
    return {
      pitchHz: baseHz * 4,
      reason: `${pairReason}_fold4x`,
      ratio,
      magF0: m1,
      magHalf: null,
      magHigh: m4,
      magLow: m1,
      harmonics,
    };
  }

  // 2) 2x subharmonic fold-up: genuine bass notes have f1 >= 0.45*f2 or 3rd harmonic f3 >= 0.12*f2
  if (m2 > 1e-5 && m2 > m1 * 1.5 && m1 / m2 < 0.45 && m3 / m2 < 0.12) {
    const cand = baseHz * 2;
    const cm2 = goertzelUpTo(buffer, cand * 2, sampleRate);
    const cm3 = goertzelUpTo(buffer, cand * 3, sampleRate);
    const foldAgain = cm2 > m2 * 1.5 && m2 / cm2 < 0.45 && cm3 / cm2 < 0.12;
    return {
      pitchHz: foldAgain ? cand * 2 : cand,
      reason: foldAgain ? `${pairReason}_fold2x2x` : `${pairReason}_fold2x`,
      ratio,
      magF0: m1,
      magHalf: null,
      magHigh: foldAgain ? cm2 : m2,
      magLow: m1,
      harmonics,
    };
  }

  // 3) 6x subharmonic fold-up (e.g. decaying F4 tail mixing with ~60Hz/120Hz hum into Bb1)
  if (m6 > 1e-5 && m6 > m1 * 2.5 && m2 / m6 < 0.25 && m3 / m6 < 0.2) {
    return {
      pitchHz: baseHz * 6,
      reason: `${pairReason}_fold6x`,
      ratio,
      magF0: m1,
      magHalf: null,
      magHigh: m6,
      magLow: m1,
      harmonics,
    };
  }

  // Reject missing-fundamental ghost periodicities (e.g., 3f + 4f partials with empty 1f and 2f)
  if (
    baseHz >= 65 &&
    Math.max(m3, m4) > 1e-4 &&
    Math.max(m1, m2) < Math.max(m3, m4) * 0.2
  ) {
    return {
      pitchHz: null,
      reason: `${pairReason}_missing_low_harmonics`,
      ratio,
      magF0: m1,
      magHalf: null,
      magHigh: Math.max(m3, m4),
      magLow: Math.max(m1, m2),
      harmonics,
    };
  }

  // 4) Low-bass weak-fundamental check (110..210 Hz -> f/2):
  // Require substantial 2*f_bass energy (m1), genuine f/2 energy, AND the 3rd partial of f/2 (= 1.5 * f)
  // to avoid halving real B2..G#3 notes or dividing tiny noise-floor values.
  if (baseHz >= 110 && baseHz <= 210) {
    const mHalf = goertzelUpTo(buffer, baseHz / 2, sampleRate);
    const m15 = goertzelUpTo(buffer, baseHz * 1.5, sampleRate);
    const dropLow =
      m1 >= 0.001 && mHalf / m1 >= 0.2 && mHalf / m1 <= 2.0 && m15 / m1 >= 0.12;
    return {
      pitchHz: dropLow ? baseHz / 2 : baseHz,
      reason: dropLow ? `${pairReason}_bass_halved` : `${pairReason}_bass_kept`,
      ratio,
      magF0: m1,
      magHalf: mHalf,
      magHigh: m1,
      magLow: mHalf,
      harmonics,
    };
  }

  return {
    pitchHz: baseHz,
    reason: pairReason,
    ratio,
    magF0: m1,
    magHalf: null,
    magHigh: m2,
    magLow: m1,
    harmonics,
  };
}

export function resolvePianoOctave(
  buffer: Float32Array,
  mpmHz: number,
  yinHz: number | null,
  sampleRate: number
): number | null {
  return resolvePianoOctaveDetailed(buffer, mpmHz, yinHz, sampleRate).pitchHz;
}

function computeLowBandRms(buffer: Float32Array, sampleRate: number, cutoffHz = 180): number {
  if (buffer.length === 0) return 0;
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const dt = 1 / sampleRate;
  const alpha = dt / (rc + dt);
  let y = 0;
  let sumSq = 0;
  for (let i = 0; i < buffer.length; i += 1) {
    y = y + alpha * (buffer[i] - y);
    sumSq += y * y;
  }
  return Math.sqrt(sumSq / buffer.length);
}

function computePeakAmp(buffer: Float32Array): number {
  let peak = 0;
  for (let i = 0; i < buffer.length; i += 1) {
    const a = Math.abs(buffer[i]);
    if (a > peak) peak = a;
  }
  return peak;
}

export interface NoteTrackerConfig {
  rmsThreshold: number;
  clarityThreshold: number;
  requiredStableFrames: number;
  minStableMs?: number;
  centsOffset: number;
  semitoneOffset: number;
  sameNoteCooldownMs: number;
  debug?: boolean;
}

export interface FrameDebugInfo {
  timestampMs: number;
  sampleRate: number;
  tailRms: number;
  noiseFloorRms: number;
  effectiveRmsGate: number;
  peakAmp: number;
  lowBandRms180Hz: number;
  suppressed: boolean;
  suppressedRemainingMs: number;
  rearmed: boolean;
  rearmReason: 'none' | 'sharp_onset' | 'below_rms_gate';
  rawMpmPitch: number | null;
  rawMpmClarity: number;
  rawYinPitch: number | null;
  octaveDebug: OctaveResolutionDebug | null;
  rawMidi: number | null;
  rawCentsError: number | null;
  recentMidis: number[];
  candidateMidi: number | null;
  stableCount: number;
  candidateStableMs: number;
  lastEmittedMidi: number | null;
  msSinceLastEmit: number | null;
  gateReason: string;
}

export interface FrameAnalysis {
  rms: number;
  clarity: number;
  pitchHz: number | null;
  activeMidi: number | null;
  emittedMidi: number | null;
  debug?: FrameDebugInfo;
}

export class NoteTracker {
  private config: NoteTrackerConfig;
  private mpmCache = new Map<number, PitchDetector<Float32Array>>();
  private recentMidis: number[] = [];
  private candidateMidi: number | null = null;
  private candidateStartTimestampMs = 0;
  private stableCount = 0;
  private lastEmittedMidi: number | null = null;
  private lastEmitTimestamp = 0;
  private suppressedUntilMs = 0;
  private prevTailRms = 0;
  private noiseFloor = 0;
  private hasNoiseFloor = false;
  private rearmed = true;

  constructor(config: Partial<NoteTrackerConfig> = {}) {
    this.config = {
      rmsThreshold: 0.015,
      clarityThreshold: 0.88,
      requiredStableFrames: 3,
      minStableMs: 0,
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
    this.candidateStartTimestampMs = 0;
    this.stableCount = 0;
    this.recentMidis = [];
  }

  public reset(): void {
    this.recentMidis = [];
    this.candidateMidi = null;
    this.candidateStartTimestampMs = 0;
    this.stableCount = 0;
    this.lastEmittedMidi = null;
    this.lastEmitTimestamp = 0;
    this.suppressedUntilMs = 0;
    this.prevTailRms = 0;
    this.noiseFloor = 0;
    this.hasNoiseFloor = false;
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

  public processFrame(
    buffer: Float32Array,
    sampleRate: number,
    timestampMs: number
  ): FrameAnalysis {
    const debugEnabled = Boolean(this.config.debug);
    const rms = computeRms(buffer);
    const tailSamples = Math.min(buffer.length, Math.max(1, Math.round(sampleRate * 0.032)));
    const tailRms =
      tailSamples === buffer.length
        ? rms
        : computeRms(buffer.subarray(buffer.length - tailSamples));

    // Track ambient room floor only from sub-0.02 low-energy audio so real notes
    // or fixed-amplitude test buffers do not inflate the adaptive threshold.
    if (rms > 0 && rms < 0.02) {
      if (!this.hasNoiseFloor) {
        this.noiseFloor = rms;
        this.hasNoiseFloor = true;
      } else if (rms < this.noiseFloor * 1.5) {
        this.noiseFloor = this.noiseFloor * 0.92 + rms * 0.08;
      } else {
        this.noiseFloor =
          this.noiseFloor * 0.998 + Math.min(rms, this.noiseFloor * 2) * 0.002;
      }
    }
    const effectiveRmsGate = Math.min(
      0.035,
      Math.max(this.config.rmsThreshold, this.noiseFloor * 1.85)
    );

    const sharpOnset =
      this.prevTailRms > 0 &&
      tailRms > this.prevTailRms * 1.55 &&
      tailRms > effectiveRmsGate * 1.6;

    let rearmReason: FrameDebugInfo['rearmReason'] = 'none';
    if (rms < effectiveRmsGate || tailRms < effectiveRmsGate) {
      this.rearmed = true;
      rearmReason = 'below_rms_gate';
    } else if (
      sharpOnset &&
      timestampMs - this.lastEmitTimestamp >= this.config.sameNoteCooldownMs
    ) {
      this.rearmed = true;
      rearmReason = 'sharp_onset';
    }

    this.prevTailRms = tailRms;

    const suppressed = timestampMs < this.suppressedUntilMs;
    const suppressedRemainingMs = suppressed ? this.suppressedUntilMs - timestampMs : 0;
    const candidateStableMs =
      this.candidateMidi !== null ? Math.max(0, timestampMs - this.candidateStartTimestampMs) : 0;

    const buildDebug = (
      gateReason: string,
      rawMpmPitch: number | null,
      rawMpmClarity: number,
      rawYinPitch: number | null,
      octaveDebug: OctaveResolutionDebug | null,
      rawMidi: number | null,
      rawCentsError: number | null
    ): FrameDebugInfo | undefined => {
      if (!debugEnabled) return undefined;
      return {
        timestampMs,
        sampleRate,
        tailRms,
        noiseFloorRms: this.noiseFloor,
        effectiveRmsGate,
        peakAmp: computePeakAmp(buffer),
        lowBandRms180Hz: computeLowBandRms(buffer, sampleRate, 180),
        suppressed,
        suppressedRemainingMs,
        rearmed: this.rearmed,
        rearmReason,
        rawMpmPitch:
          rawMpmPitch !== null && Number.isFinite(rawMpmPitch) ? rawMpmPitch : null,
        rawMpmClarity: Number.isFinite(rawMpmClarity) ? rawMpmClarity : 0,
        rawYinPitch:
          rawYinPitch !== null && Number.isFinite(rawYinPitch) ? rawYinPitch : null,
        octaveDebug,
        rawMidi,
        rawCentsError,
        recentMidis: [...this.recentMidis],
        candidateMidi: this.candidateMidi,
        stableCount: this.stableCount,
        candidateStableMs,
        lastEmittedMidi: this.lastEmittedMidi,
        msSinceLastEmit:
          this.lastEmitTimestamp > 0 ? timestampMs - this.lastEmitTimestamp : null,
        gateReason,
      };
    };

    const gatedByLevel = rms < effectiveRmsGate || tailRms < effectiveRmsGate;
    if (suppressed || gatedByLevel) {
      this.candidateMidi = null;
      this.candidateStartTimestampMs = 0;
      this.stableCount = 0;
      this.recentMidis = [];

      let rawMpmPitch: number | null = null;
      let rawMpmClarity = 0;
      let rawYinPitch: number | null = null;
      let octaveDebug: OctaveResolutionDebug | null = null;
      let rawMidi: number | null = null;
      let rawCentsError: number | null = null;

      if (debugEnabled && buffer.length >= 64) {
        const [mp, cl] = this.getMpmDetector(buffer.length).findPitch(buffer, sampleRate);
        rawMpmPitch = mp;
        rawMpmClarity = cl;
        rawYinPitch = detectYinPitch(buffer, sampleRate);
        if (Number.isFinite(mp) && mp >= 27.5 && mp <= 4200) {
          octaveDebug = resolvePianoOctaveDetailed(buffer, mp, rawYinPitch, sampleRate);
          if (octaveDebug.pitchHz !== null) {
            const conv = frequencyToMidi(
              octaveDebug.pitchHz,
              this.config.centsOffset,
              this.config.semitoneOffset
            );
            rawMidi = conv.midi;
            rawCentsError = conv.centsError;
          }
        }
      }

      return {
        rms,
        clarity: 0,
        pitchHz: null,
        activeMidi: null,
        emittedMidi: null,
        debug: buildDebug(
          suppressed ? 'suppressed' : tailRms < effectiveRmsGate ? 'below_tail_rms' : 'below_rms',
          rawMpmPitch,
          rawMpmClarity,
          rawYinPitch,
          octaveDebug,
          rawMidi,
          rawCentsError
        ),
      };
    }

    const mpm = this.getMpmDetector(buffer.length);
    const [mpmPitch, clarity] = mpm.findPitch(buffer, sampleRate);

    if (
      !Number.isFinite(mpmPitch) ||
      clarity < this.config.clarityThreshold ||
      mpmPitch < 27.5 ||
      mpmPitch > 4200
    ) {
      let rawYinPitch: number | null = null;
      let octaveDebug: OctaveResolutionDebug | null = null;
      let rawMidi: number | null = null;
      let rawCentsError: number | null = null;
      if (debugEnabled) {
        rawYinPitch = detectYinPitch(buffer, sampleRate);
        if (Number.isFinite(mpmPitch) && mpmPitch >= 27.5 && mpmPitch <= 4200) {
          octaveDebug = resolvePianoOctaveDetailed(buffer, mpmPitch, rawYinPitch, sampleRate);
          if (octaveDebug.pitchHz !== null) {
            const conv = frequencyToMidi(
              octaveDebug.pitchHz,
              this.config.centsOffset,
              this.config.semitoneOffset
            );
            rawMidi = conv.midi;
            rawCentsError = conv.centsError;
          }
        }
      }
      this.candidateMidi = null;
      this.candidateStartTimestampMs = 0;
      this.stableCount = 0;
      return {
        rms,
        clarity,
        pitchHz: null,
        activeMidi: null,
        emittedMidi: null,
        debug: buildDebug(
          !Number.isFinite(mpmPitch) || mpmPitch < 27.5 || mpmPitch > 4200
            ? 'mpm_out_of_range'
            : 'low_clarity',
          mpmPitch,
          clarity,
          rawYinPitch,
          octaveDebug,
          rawMidi,
          rawCentsError
        ),
      };
    }

    const yinPitch = detectYinPitch(buffer, sampleRate);
    const octaveDebug = resolvePianoOctaveDetailed(buffer, mpmPitch, yinPitch, sampleRate);
    const pitchHz = octaveDebug.pitchHz;
    if (pitchHz === null) {
      this.candidateMidi = null;
      this.candidateStartTimestampMs = 0;
      this.stableCount = 0;
      return {
        rms,
        clarity,
        pitchHz: null,
        activeMidi: null,
        emittedMidi: null,
        debug: buildDebug(
          'octave_disagree_null',
          mpmPitch,
          clarity,
          yinPitch,
          octaveDebug,
          null,
          null
        ),
      };
    }

    const { midi, centsError } = frequencyToMidi(
      pitchHz,
      this.config.centsOffset,
      this.config.semitoneOffset
    );

    if (Math.abs(centsError) > 45 || midi < 21 || midi > 108) {
      this.candidateMidi = null;
      this.candidateStartTimestampMs = 0;
      this.stableCount = 0;
      return {
        rms,
        clarity,
        pitchHz,
        activeMidi: null,
        emittedMidi: null,
        debug: buildDebug(
          'cents_or_midi_out_of_range',
          mpmPitch,
          clarity,
          yinPitch,
          octaveDebug,
          midi,
          centsError
        ),
      };
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
      this.candidateStartTimestampMs = timestampMs;
      this.stableCount = 1;
    }

    const minStableMs = this.config.minStableMs ?? 0;
    const stableDurationMs = Math.max(0, timestampMs - this.candidateStartTimestampMs);
    let emittedMidi: number | null = null;
    let gateReason = 'stabilizing';
    if (
      this.stableCount >= this.config.requiredStableFrames &&
      stableDurationMs >= minStableMs
    ) {
      const isNewNote = smoothedMidi !== this.lastEmittedMidi;
      const cooldownOk =
        timestampMs - this.lastEmitTimestamp >= this.config.sameNoteCooldownMs;
      const canRetriggerSame =
        smoothedMidi === this.lastEmittedMidi && this.rearmed && cooldownOk;

      if (isNewNote || canRetriggerSame) {
        emittedMidi = smoothedMidi;
        this.lastEmittedMidi = smoothedMidi;
        this.lastEmitTimestamp = timestampMs;
        this.rearmed = false;
        gateReason = isNewNote ? 'emitted_new_note' : 'emitted_retrigger_same';
      } else {
        gateReason = !this.rearmed ? 'same_note_not_rearmed' : 'same_note_cooldown';
      }
    }

    return {
      rms,
      clarity,
      pitchHz,
      activeMidi: smoothedMidi,
      emittedMidi,
      debug: buildDebug(
        gateReason,
        mpmPitch,
        clarity,
        yinPitch,
        octaveDebug,
        midi,
        centsError
      ),
    };
  }
}
