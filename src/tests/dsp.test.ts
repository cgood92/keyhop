import { describe, expect, it } from 'vitest';
import { evaluateCalibrationSamples } from '../audio/calibration';
import { NoteTracker, resolvePianoOctave } from '../audio/dspFilters';

function makeSineBuffer(freqHz: number, sampleRate: number, length: number, amp = 0.25): Float32Array {
  const buf = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    buf[i] = amp * Math.sin((2 * Math.PI * freqHz * i) / sampleRate);
  }
  return buf;
}

function makeHarmonicBassBuffer(
  f0Hz: number,
  sampleRate: number,
  length: number
): Float32Array {
  const buf = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    const t = i / sampleRate;
    // Weak fundamental + strong 2nd harmonic + 3rd harmonic (typical upright bass string)
    buf[i] =
      0.08 * Math.sin(2 * Math.PI * f0Hz * t) +
      0.28 * Math.sin(2 * Math.PI * f0Hz * 2 * t) +
      0.12 * Math.sin(2 * Math.PI * f0Hz * 3 * t);
  }
  return buf;
}

describe('audio DSP & calibration', () => {
  const sampleRate = 48000;
  const bufSize = 4096;

  it('rejects quiet room noise below rmsThreshold', () => {
    const tracker = new NoteTracker({ rmsThreshold: 0.02 });
    const quiet = makeSineBuffer(440, sampleRate, bufSize, 0.004);
    const res = tracker.processFrame(quiet, sampleRate, 100);
    expect(res.activeMidi).toBeNull();
    expect(res.emittedMidi).toBeNull();
  });

  it('requires stable frames before emitting, avoids re-trigger on sustain, and honors suppressUntil', () => {
    const tracker = new NoteTracker({
      rmsThreshold: 0.015,
      clarityThreshold: 0.88,
      requiredStableFrames: 3,
      sameNoteCooldownMs: 320,
    });
    const c4 = makeSineBuffer(261.63, sampleRate, bufSize, 0.2);

    expect(tracker.processFrame(c4, sampleRate, 100).emittedMidi).toBeNull();
    expect(tracker.processFrame(c4, sampleRate, 120).emittedMidi).toBeNull();
    expect(tracker.processFrame(c4, sampleRate, 140).emittedMidi).toBe(60); // C4

    // Sustaining same note should NOT re-emit
    expect(tracker.processFrame(c4, sampleRate, 500).emittedMidi).toBeNull();

    // Suppressing during speaker SFX blocks emissions
    tracker.suppressUntil(800);
    const d4 = makeSineBuffer(293.66, sampleRate, bufSize, 0.2);
    expect(tracker.processFrame(d4, sampleRate, 700).emittedMidi).toBeNull();

    // Silence dip followed by re-strike of C4 re-arms and emits
    const silence = new Float32Array(bufSize);
    tracker.processFrame(silence, sampleRate, 850);
    tracker.processFrame(c4, sampleRate, 900);
    tracker.processFrame(c4, sampleRate, 920);
    expect(tracker.processFrame(c4, sampleRate, 940).emittedMidi).toBe(60);
  });

  it('resolves weak-fundamental bass notes accurately and keeps C4..G4 at true octave', () => {
    const g2Hz = 98.0; // G2 = MIDI 43
    const bassBuf = makeHarmonicBassBuffer(g2Hz, sampleRate, bufSize);
    const resolved = resolvePianoOctave(bassBuf, g2Hz * 2, g2Hz, sampleRate);
    expect(resolved).toBeCloseTo(g2Hz, 1);

    const tracker = new NoteTracker({ requiredStableFrames: 3 });
    tracker.processFrame(bassBuf, sampleRate, 100);
    tracker.processFrame(bassBuf, sampleRate, 120);
    const frame3 = tracker.processFrame(bassBuf, sampleRate, 140);
    expect(frame3.emittedMidi).toBe(43);

    // Rich harmonic C4 (261.63 Hz) and G4 (392 Hz) must NEVER drop an octave
    const c4Rich = makeHarmonicBassBuffer(261.63, sampleRate, bufSize);
    expect(resolvePianoOctave(c4Rich, 261.63, 261.63, sampleRate)).toBeCloseTo(261.63, 1);

    const g4Rich = makeHarmonicBassBuffer(392.0, sampleRate, bufSize);
    expect(resolvePianoOctave(g4Rich, 392.0, 392.0, sampleRate)).toBeCloseTo(392.0, 1);
  });

  it('calibrates slightly flat G4, snaps minor <=10c jitter to 0, and guides on wrong note', () => {
    const flatG4 = 392.0 * Math.pow(2, -18 / 1200);
    const outcome = evaluateCalibrationSamples(
      [
        { pitchHz: flatG4, clarity: 0.96 },
        { pitchHz: flatG4 + 0.2, clarity: 0.97 },
        { pitchHz: flatG4 - 0.1, clarity: 0.95 },
      ],
      'G4'
    );
    expect(outcome.matchedTarget).toBe(true);
    expect(outcome.centsOffset).toBe(-18);

    // Minor +-5c jitter snaps to 0 (concert pitch A=440 Hz)
    const cleanG4 = 392.0 * Math.pow(2, 5 / 1200);
    expect(
      evaluateCalibrationSamples([{ pitchHz: cleanG4, clarity: 0.97 }], 'G4').centsOffset
    ).toBe(0);

    const wrong = evaluateCalibrationSamples([{ pitchHz: 261.63, clarity: 0.98 }], 'G4');
    expect(wrong.matchedTarget).toBe(false);
    expect(wrong.heardNoteName).toBe('C4');
  });
});
