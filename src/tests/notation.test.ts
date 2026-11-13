import { describe, expect, it } from 'vitest';
import {
  buildRoundDeck,
  frequencyToMidi,
  getDiatonicStep,
  getLedgerSteps,
  isNoteMatch,
  parseNoteTarget,
} from '../music/notation';

describe('notation & music math', () => {
  it('computes diatonic steps cleanly across octaves', () => {
    expect(getDiatonicStep('C', 4)).toBe(28);
    expect(getDiatonicStep('D', 4)).toBe(29);
    expect(getDiatonicStep('E', 4)).toBe(30);
    expect(getDiatonicStep('F', 5)).toBe(38);
    expect(getDiatonicStep('G', 2)).toBe(18);
  });

  it('computes ledger lines above and below treble and bass staves', () => {
    expect(getLedgerSteps(getDiatonicStep('E', 4), 'treble')).toEqual([]);
    expect(getLedgerSteps(getDiatonicStep('C', 4), 'treble')).toEqual([28]);
    expect(getLedgerSteps(getDiatonicStep('A', 3), 'treble')).toEqual([28, 26]);
    expect(getLedgerSteps(getDiatonicStep('C', 6), 'treble')).toEqual([40, 42]);
    expect(getLedgerSteps(getDiatonicStep('C', 2), 'bass')).toEqual([16, 14]);
  });

  it('matches enharmonic notes by MIDI pitch and respects strictOctave', () => {
    expect(isNoteMatch(61, { note: 'Db4' }, true)).toBe(true);
    expect(isNoteMatch(61, { note: 'C#4' }, true)).toBe(true);
    expect(isNoteMatch(73, { note: 'Db4' }, true)).toBe(false);
    expect(isNoteMatch(73, { note: 'Db4' }, false)).toBe(true);
  });

  it('applies calibration centsOffset accurately', () => {
    // Piano 20 cents flat on A4 (434.95 Hz instead of 440 Hz)
    const flatA4 = 440 * Math.pow(2, -20 / 1200);
    const calibrated = frequencyToMidi(flatA4, -20, 0);
    expect(calibrated.midi).toBe(69);
    expect(Math.abs(calibrated.centsError)).toBeLessThan(1.5);
  });

  it('avoids adjacent identical pitches in shuffled decks when >= 2 notes exist', () => {
    const pool = [{ note: 'C4' }, { note: 'E4' }, { note: 'G4' }];
    const deck = buildRoundDeck(pool, 5);
    expect(deck).toHaveLength(15);
    for (let i = 1; i < deck.length; i += 1) {
      expect(parseNoteTarget(deck[i].note).midi).not.toBe(
        parseNoteTarget(deck[i - 1].note).midi
      );
    }
  });
});
