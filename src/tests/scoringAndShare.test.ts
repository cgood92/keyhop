import { describe, expect, it } from 'vitest';
import { decodeLevelFromParam, encodeLevelToParam } from '../music/levelShare';
import { buildRoundResult, calculateStars } from '../music/scoring';
import type { LevelDefinition } from '../music/types';

describe('scoring & level sharing', () => {
  it('applies official 1-5 star thresholds', () => {
    expect(calculateStars(0.95)).toBe(5);
    expect(calculateStars(1.0)).toBe(5);
    expect(calculateStars(1.4)).toBe(4);
    expect(calculateStars(2.3)).toBe(3);
    expect(calculateStars(3.4)).toBe(2);
    expect(calculateStars(5.0)).toBe(1);
  });

  it('awards Diamond Perfect only for 5 stars with zero wrong attempts', () => {
    const perfect = buildRoundResult({
      levelId: 'test',
      levelName: 'Test',
      totalNotes: 10,
      rawTimeSeconds: 8.5,
      wrongAttempts: 0,
      penalizeWrongNotes: true,
      penaltySecondsPerError: 2,
    });
    expect(perfect.stars).toBe(5);
    expect(perfect.diamondPerfect).toBe(true);

    const imperfect = buildRoundResult({
      levelId: 'test',
      levelName: 'Test',
      totalNotes: 10,
      rawTimeSeconds: 7.0,
      wrongAttempts: 1,
      penalizeWrongNotes: true,
      penaltySecondsPerError: 2,
    });
    // 7 + 2 = 9s / 10 = 0.9 s/note -> still 5 stars, NOT diamond perfect
    expect(imperfect.stars).toBe(5);
    expect(imperfect.diamondPerfect).toBe(false);
  });

  it('round-trips custom levels through lz-string URL encoding', () => {
    const level: LevelDefinition = {
      id: 'custom-1',
      name: 'D Major Drill',
      subtitle: 'Treble: 4 notes × 2',
      clef: 'treble',
      category: 'custom',
      repeats: 2,
      notes: [
        { note: 'D4', staff: 'treble' },
        { note: 'F#4', staff: 'treble' },
        { note: 'A4', staff: 'treble' },
        { note: 'C#5', staff: 'treble' },
      ],
    };

    const encoded = encodeLevelToParam(level);
    const decoded = decodeLevelFromParam(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded?.name).toBe('D Major Drill');
    expect(decoded?.clef).toBe('treble');
    expect(decoded?.repeats).toBe(2);
    expect(decoded?.notes).toHaveLength(4);
    expect(decoded?.notes[1].note).toBe('F#4');
  });
});
