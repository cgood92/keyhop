import { describe, expect, it } from 'vitest';
import { evaluateCalibrationSamples } from '../audio/calibration';
import { detectYinPitch, NoteTracker, resolvePianoOctave } from '../audio/dspFilters';

function makeSineBuffer(freqHz: number, sampleRate: number, length: number, amp = 0.25): Float32Array {
  const buf = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    buf[i] = amp * Math.sin((2 * Math.PI * freqHz * i) / sampleRate);
  }
  return buf;
}

function makeMixedBuffer(
  partials: Array<[number, number]>,
  sampleRate: number,
  length: number
): Float32Array {
  const buf = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    const t = i / sampleRate;
    let sum = 0;
    for (const [freqHz, amp] of partials) {
      sum += amp * Math.sin(2 * Math.PI * freqHz * t);
    }
    buf[i] = sum;
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

  it('keeps YIN accurate on filtered audio and folds attack subharmonics up to true pitch', () => {
    const g3Buf = makeMixedBuffer(
      [
        [196.0, 0.08],
        [392.0, 0.03],
        [98.0, 0.006],
      ],
      sampleRate,
      bufSize
    );
    const yin = detectYinPitch(g3Buf, sampleRate);
    expect(yin).not.toBeNull();
    expect(yin!).toBeCloseTo(196.0, 0);

    // G4 attack with 98 Hz keybed thump: must fold 4x (98 -> 392) because 2f and 3f are absent
    const g4WithThump = makeMixedBuffer(
      [
        [98.0, 0.008],
        [392.0, 0.025],
      ],
      sampleRate,
      bufSize
    );
    expect(resolvePianoOctave(g4WithThump, 98.0, 98.0, sampleRate)).toBeCloseTo(392.0, 1);

    // F3 attack locked onto 87.3 Hz subharmonic without 3*87.3=262Hz partial: must fold up to 174.6 Hz
    const f3WithThump = makeMixedBuffer(
      [
        [87.3, 0.004],
        [174.6, 0.064],
        [349.2, 0.046],
      ],
      sampleRate,
      bufSize
    );
    expect(resolvePianoOctave(f3WithThump, 87.3, 87.3, sampleRate)).toBeCloseTo(174.6, 1);

    // B3 (246.9 Hz) must not be halved by 123.5 Hz room noise without 1.5x (370 Hz) partial
    const b3WithHum = makeMixedBuffer(
      [
        [246.94, 0.04],
        [123.47, 0.015],
      ],
      sampleRate,
      bufSize
    );
    expect(resolvePianoOctave(b3WithHum, 123.47, 123.47, sampleRate)).toBeCloseTo(246.94, 1);

    // Missing-fundamental ghost periodicity (466 Hz + 622 Hz with empty 155.5 Hz / 311 Hz) -> null
    const ghost155 = makeMixedBuffer(
      [
        [466.5, 0.015],
        [622.0, 0.015],
      ],
      sampleRate,
      bufSize
    );
    expect(resolvePianoOctave(ghost155, 155.5, 155.5, sampleRate)).toBeNull();
  });

  it('does not re-trigger dying notes near rmsThreshold and rejects <25ms transient chirps', () => {
    const tracker = new NoteTracker({
      rmsThreshold: 0.015,
      clarityThreshold: 0.8,
      requiredStableFrames: 3,
      minStableMs: 55,
      sameNoteCooldownMs: 340,
    });

    const f3Loud = makeSineBuffer(174.61, sampleRate, bufSize, 0.12);
    expect(tracker.processFrame(f3Loud, sampleRate, 100).emittedMidi).toBeNull();
    expect(tracker.processFrame(f3Loud, sampleRate, 125).emittedMidi).toBeNull();
    expect(tracker.processFrame(f3Loud, sampleRate, 160).emittedMidi).toBe(53); // F3

    // Decaying F3 passing just above rmsThreshold (0.015 * 1.1 = 0.0165 RMS) must NEVER re-arm/re-emit
    const f3Dying = makeSineBuffer(174.61, sampleRate, bufSize, 0.0235);
    expect(tracker.processFrame(f3Dying, sampleRate, 600).emittedMidi).toBeNull();
    expect(tracker.processFrame(f3Dying, sampleRate, 630).emittedMidi).toBeNull();
    expect(tracker.processFrame(f3Dying, sampleRate, 660).emittedMidi).toBeNull();

    // Drop below gate to re-arm, then inject a 15ms 1164 Hz click inside the first half of the buffer
    tracker.processFrame(new Float32Array(bufSize), sampleRate, 700);
    const clickBuf = new Float32Array(bufSize);
    for (let i = 1000; i < 1720; i += 1) {
      clickBuf[i] = 0.15 * Math.sin((2 * Math.PI * 1164 * i) / sampleRate);
    }
    expect(tracker.processFrame(clickBuf, sampleRate, 800).emittedMidi).toBeNull();
    expect(tracker.processFrame(clickBuf, sampleRate, 830).emittedMidi).toBeNull();
    expect(tracker.processFrame(clickBuf, sampleRate, 865).emittedMidi).toBeNull();
  });

  it('adapts ambient noise floor to ignore steady ~0.008 background hum', () => {
    const tracker = new NoteTracker({
      rmsThreshold: 0.003,
      clarityThreshold: 0.8,
      requiredStableFrames: 3,
      minStableMs: 55,
    });
    // ~0.0085 RMS steady 110 Hz hum should adapt noiseFloor and remain blocked
    const hum = makeSineBuffer(110, sampleRate, bufSize, 0.012);
    for (let i = 0; i < 20; i += 1) {
      const res = tracker.processFrame(hum, sampleRate, 100 + i * 20);
      if (i >= 5) {
        expect(res.emittedMidi).toBeNull();
      }
    }
  });
});
