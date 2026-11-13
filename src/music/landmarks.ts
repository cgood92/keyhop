import { getDiatonicStep } from './notation';
import type { StaffSide } from './types';

export interface LandmarkDef {
  id: string;
  label: string;
  noteName: string;
  diatonicStep: number;
  staff: StaffSide;
  /** True if the landmark sits on a line, false if it sits in a space */
  isLine: boolean;
}

/**
 * Core piano reading landmarks matching modern intervallic pedagogy:
 * - Bass C (C3, 2nd space of Bass staff)
 * - Bass F (F3, 4th line of Bass staff - F-clef anchor)
 * - Middle C (C4, ledger line between staves)
 * - Treble G (G4, 2nd line of Treble staff - G-clef anchor)
 * - Treble C (C5, 3rd space of Treble staff)
 */
export const PIANO_LANDMARKS: LandmarkDef[] = [
  {
    id: 'bass-c',
    label: 'C',
    noteName: 'C3',
    diatonicStep: getDiatonicStep('C', 3),
    staff: 'bass',
    isLine: false,
  },
  {
    id: 'bass-f',
    label: 'F',
    noteName: 'F3',
    diatonicStep: getDiatonicStep('F', 3),
    staff: 'bass',
    isLine: true,
  },
  {
    id: 'middle-c',
    label: 'C',
    noteName: 'C4',
    diatonicStep: getDiatonicStep('C', 4),
    staff: 'treble',
    isLine: true,
  },
  {
    id: 'treble-g',
    label: 'G',
    noteName: 'G4',
    diatonicStep: getDiatonicStep('G', 4),
    staff: 'treble',
    isLine: true,
  },
  {
    id: 'treble-c',
    label: 'C',
    noteName: 'C5',
    diatonicStep: getDiatonicStep('C', 5),
    staff: 'treble',
    isLine: false,
  },
];
