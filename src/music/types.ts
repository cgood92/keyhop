export type ClefMode = 'treble' | 'bass' | 'grand';

export type StaffSide = 'treble' | 'bass';

export type Accidental = '' | '#' | 'b';

export type NoteLetter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';

export interface NoteTarget {
  /** Scientific pitch notation, e.g. "C4", "F#4", "Bb3" */
  note: string;
  /** Which staff renders this note when ClefMode === 'grand' */
  staff?: StaffSide;
}

export interface LevelDefinition {
  id: string;
  name: string;
  subtitle: string;
  clef: ClefMode;
  category: 'built-in' | 'custom';
  notes: NoteTarget[];
  /** How many times each note appears in the shuffled deck */
  repeats: number;
  /** Optional time penalty in seconds per wrong note (if penalties enabled) */
  penaltySeconds?: number;
  createdAt?: number;
}

export interface LevelBestRecord {
  levelId: string;
  bestTimeSeconds: number;
  bestStars: number; // 1..5
  diamondPerfect: boolean;
  updatedAt: number;
}

export type ThemeId =
  | 'classic'
  | 'fruit-smash'
  | 'cute-bird'
  | 'space'
  | 'chalkboard'
  | 'ladybug'
  | 'basketball'
  | 'soccer'
  | 'spooky'
  | 'pastel';

export type InputMode = 'mic' | 'midi';

export interface GameSettings {
  inputMode: InputMode;
  selectedMidiInputId: string | null;
  hideTimer: boolean;
  landmarkHints: boolean;
  penalizeWrongNotes: boolean;
  penaltySeconds: number;
  strictOctave: boolean;
  soundEffects: boolean;
  /** Mic RMS threshold (0.005 .. 0.08) */
  micSensitivity: number;
  /** Minimum clarity (0.80 .. 0.97) */
  micClarityThreshold: number;
}

export interface CalibrationState {
  calibrated: boolean;
  referenceNote: string;
  /** Fine pitch offset in cents (-50 .. +50) */
  centsOffset: number;
  /** Whole semitone offset if instrument is transposed */
  semitoneOffset: number;
}

export interface RoundResult {
  levelId: string;
  levelName: string;
  totalNotes: number;
  rawTimeSeconds: number;
  penaltyTimeSeconds: number;
  effectiveTimeSeconds: number;
  avgSecondsPerNote: number;
  wrongAttempts: number;
  stars: number; // 1..5
  diamondPerfect: boolean;
  isNewBest: boolean;
}
