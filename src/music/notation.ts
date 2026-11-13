import { Note } from 'tonal';
import type { Accidental, ClefMode, NoteLetter, NoteTarget, StaffSide } from './types';

const LETTER_OFFSET: Record<NoteLetter, number> = {
  C: 0,
  D: 1,
  E: 2,
  F: 3,
  G: 4,
  A: 5,
  B: 6,
};

const LETTERS: NoteLetter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

export interface ParsedNote {
  name: string;
  letter: NoteLetter;
  accidental: Accidental;
  octave: number;
  midi: number;
  freq: number;
  diatonicStep: number;
}

/**
 * Computes an absolute diatonic integer step where C0 = 0, D0 = 1, ..., C4 = 28.
 */
export function getDiatonicStep(letter: NoteLetter, octave: number): number {
  return octave * 7 + LETTER_OFFSET[letter];
}

export function stepToLetterOctave(step: number): { letter: NoteLetter; octave: number } {
  const octave = Math.floor(step / 7);
  const idx = ((step % 7) + 7) % 7;
  return { letter: LETTERS[idx], octave };
}

export function parseNoteTarget(noteStr: string): ParsedNote {
  const info = Note.get(noteStr);
  if (info.empty || info.midi === null || info.freq === null || info.oct === undefined) {
    throw new Error(`Invalid note specification: "${noteStr}"`);
  }
  const letter = info.letter.toUpperCase() as NoteLetter;
  const accidental = (info.acc === '#' || info.acc === 'b' ? info.acc : '') as Accidental;
  const octave = info.oct;

  return {
    name: `${letter}${accidental}${octave}`,
    letter,
    accidental,
    octave,
    midi: info.midi,
    freq: info.freq,
    diatonicStep: getDiatonicStep(letter, octave),
  };
}

/**
 * Resolves which staff ('treble' | 'bass') should display a given note target.
 */
export function resolveStaffSide(target: NoteTarget, clefMode: ClefMode): StaffSide {
  if (clefMode === 'treble') return 'treble';
  if (clefMode === 'bass') return 'bass';
  if (target.staff) return target.staff;
  const parsed = parseNoteTarget(target.note);
  return parsed.diatonicStep >= 28 ? 'treble' : 'bass';
}

/**
 * Staff boundary steps (bottom line to top line):
 * - Treble: E4 (30) to F5 (38)
 * - Bass: G2 (18) to A3 (26)
 */
export const TREBLE_BOTTOM_STEP = 30; // E4
export const TREBLE_TOP_STEP = 38; // F5
export const BASS_BOTTOM_STEP = 18; // G2
export const BASS_TOP_STEP = 26; // A3

/**
 * Returns the diatonic steps where horizontal ledger lines must be drawn
 * for a note on the given staff side.
 */
export function getLedgerSteps(diatonicStep: number, staffSide: StaffSide): number[] {
  const bottom = staffSide === 'treble' ? TREBLE_BOTTOM_STEP : BASS_BOTTOM_STEP;
  const top = staffSide === 'treble' ? TREBLE_TOP_STEP : BASS_TOP_STEP;
  const ledgers: number[] = [];

  if (diatonicStep < bottom - 1) {
    for (let s = bottom - 2; s >= diatonicStep; s -= 2) {
      ledgers.push(s);
    }
  } else if (diatonicStep > top + 1) {
    for (let s = top + 2; s <= diatonicStep; s += 2) {
      ledgers.push(s);
    }
  }

  return ledgers;
}

/**
 * Generates an inclusive list of NoteTargets across a diatonic step range.
 * Useful for building natural-note levels cleanly.
 */
export function naturalRange(
  fromNote: string,
  toNote: string,
  staff?: StaffSide
): NoteTarget[] {
  const start = parseNoteTarget(fromNote).diatonicStep;
  const end = parseNoteTarget(toNote).diatonicStep;
  const out: NoteTarget[] = [];
  for (let step = Math.min(start, end); step <= Math.max(start, end); step += 1) {
    const { letter, octave } = stepToLetterOctave(step);
    out.push({ note: `${letter}${octave}`, ...(staff ? { staff } : {}) });
  }
  return out;
}

/**
 * Converts a detected Hz frequency into the nearest MIDI number and cents deviation,
 * accounting for user calibration offset.
 */
export function frequencyToMidi(
  freqHz: number,
  centsOffset = 0,
  semitoneOffset = 0
): { midi: number; centsError: number; noteName: string } {
  // MIDI 69 = A4 = 440 Hz
  const rawMidiFloat = 69 + 12 * Math.log2(freqHz / 440);
  // Subtract calibration offset so an instrument tuned 15 cents flat shifts up into center
  const calibratedFloat = rawMidiFloat - centsOffset / 100 - semitoneOffset;
  const midi = Math.round(calibratedFloat);
  const centsError = (calibratedFloat - midi) * 100;
  return {
    midi,
    centsError,
    noteName: Note.fromMidi(midi) || '',
  };
}

/**
 * Checks whether a played MIDI integer matches the target NoteTarget.
 */
export function isNoteMatch(
  playedMidi: number,
  target: NoteTarget,
  strictOctave: boolean
): boolean {
  const targetMidi = parseNoteTarget(target.note).midi;
  if (strictOctave) {
    return playedMidi === targetMidi;
  }
  return ((playedMidi % 12) + 12) % 12 === ((targetMidi % 12) + 12) % 12;
}

/**
 * Builds a shuffled deck of notes for a gameplay round, avoiding consecutive
 * identical pitches whenever the pool has >= 2 distinct MIDI notes.
 */
export function buildRoundDeck(notes: NoteTarget[], repeats: number): NoteTarget[] {
  if (notes.length === 0) return [];
  const safeRepeats = Math.max(1, Math.min(20, Math.round(repeats)));

  const deck: NoteTarget[] = [];
  for (let r = 0; r < safeRepeats; r += 1) {
    const chunk = [...notes];
    // Fisher-Yates shuffle
    for (let i = chunk.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [chunk[i], chunk[j]] = [chunk[j], chunk[i]];
    }
    // Avoid boundary duplicate with previous chunk if possible
    if (
      deck.length > 0 &&
      chunk.length > 1 &&
      parseNoteTarget(deck[deck.length - 1].note).midi === parseNoteTarget(chunk[0].note).midi
    ) {
      const swapIdx = chunk.findIndex(
        (n) => parseNoteTarget(n.note).midi !== parseNoteTarget(deck[deck.length - 1].note).midi
      );
      if (swapIdx > 0) {
        [chunk[0], chunk[swapIdx]] = [chunk[swapIdx], chunk[0]];
      }
    }
    deck.push(...chunk);
  }

  // Final pass to eliminate any accidental adjacent duplicate inside a chunk
  const distinctMidis = new Set(notes.map((n) => parseNoteTarget(n.note).midi)).size;
  if (distinctMidis > 1) {
    for (let i = 1; i < deck.length; i += 1) {
      if (parseNoteTarget(deck[i].note).midi === parseNoteTarget(deck[i - 1].note).midi) {
        const alt = deck.findIndex(
          (n, idx) =>
            idx > i &&
            parseNoteTarget(n.note).midi !== parseNoteTarget(deck[i - 1].note).midi
        );
        if (alt !== -1) {
          [deck[i], deck[alt]] = [deck[alt], deck[i]];
        }
      }
    }
  }

  return deck;
}
