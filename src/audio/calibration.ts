import { frequencyToMidi, parseNoteTarget } from '../music/notation';

export interface CalibrationSample {
  pitchHz: number;
  clarity: number;
}

export interface CalibrationOutcome {
  matchedTarget: boolean;
  heardNoteName: string;
  centsOffset: number;
  semitoneOffset: number;
}

export function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Evaluates a burst of calibration pitch samples against a target reference note (default G4).
 * Snaps small <= 10 cent deviations to 0 (standard A=440 Hz) so digital/well-tuned pianos
 * are never skewed by mic jitter, and clamps real acoustic detuning to +-35 cents.
 */
export function evaluateCalibrationSamples(
  samples: CalibrationSample[],
  referenceNote = 'G4'
): CalibrationOutcome {
  const valid = samples.filter((s) => Number.isFinite(s.pitchHz) && s.pitchHz > 27.5);
  if (valid.length === 0) {
    return {
      matchedTarget: false,
      heardNoteName: '',
      centsOffset: 0,
      semitoneOffset: 0,
    };
  }

  const medianHz = computeMedian(valid.map((s) => s.pitchHz));
  const target = parseNoteTarget(referenceNote);
  const { midi, centsError, noteName } = frequencyToMidi(medianHz, 0, 0);

  if (midi === target.midi) {
    const rounded = Math.round(centsError);
    const safeCents = Math.abs(rounded) <= 10 ? 0 : Math.max(-35, Math.min(35, rounded));
    return {
      matchedTarget: true,
      heardNoteName: noteName,
      centsOffset: safeCents,
      semitoneOffset: 0,
    };
  }

  return {
    matchedTarget: false,
    heardNoteName: noteName,
    centsOffset: 0,
    semitoneOffset: 0,
  };
}
