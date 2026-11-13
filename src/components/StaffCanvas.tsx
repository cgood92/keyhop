import { AnimatePresence, motion } from 'motion/react';
import { PIANO_LANDMARKS } from '../music/landmarks';
import {
  BASS_TOP_STEP,
  TREBLE_TOP_STEP,
  getLedgerSteps,
  parseNoteTarget,
  resolveStaffSide,
} from '../music/notation';
import { AccidentalGlyph, BassClefGlyph, GrandStaffBrace, TrebleClefGlyph } from '../music/smuflPaths';
import type { ClefMode, NoteTarget, StaffSide, ThemeId } from '../music/types';
import { ThemedNotehead } from '../themes/ThemedNotehead';
import { getThemeConfig } from '../themes/themeRegistry';

const LINE_GAP = 20;
const HALF_STEP = LINE_GAP / 2; // 10 SVG units per diatonic step

interface StaffCanvasProps {
  clefMode: ClefMode;
  activeNote: NoteTarget | null;
  noteKey?: string | number;
  theme: ThemeId;
  showLandmarks: boolean;
  isWrongFeedback?: boolean;
  hitBurstId?: number;
  calibrationPrompt?: string | null;
}

function stepToStaffY(
  diatonicStep: number,
  staffSide: StaffSide,
  trebleTopY: number,
  bassTopY: number
): number {
  if (staffSide === 'treble') {
    return trebleTopY + (TREBLE_TOP_STEP - diatonicStep) * HALF_STEP;
  }
  return bassTopY + (BASS_TOP_STEP - diatonicStep) * HALF_STEP;
}

export function StaffCanvas({
  clefMode,
  activeNote,
  noteKey,
  theme,
  showLandmarks,
  isWrongFeedback = false,
  hitBurstId = 0,
  calibrationPrompt = null,
}: StaffCanvasProps) {
  const themeCfg = getThemeConfig(theme);
  const isGrand = clefMode === 'grand';

  const viewBoxHeight = isGrand ? 460 : 280;
  const trebleTopY = isGrand ? 110 : 100;
  const bassTopY = isGrand ? 260 : 100;

  const staffLeft = 72;
  const staffRight = 640;
  const noteX = 395;

  const renderFiveLines = (topY: number, keyPrefix: string) =>
    [0, 1, 2, 3, 4].map((idx) => (
      <line
        key={`${keyPrefix}-${idx}`}
        x1={staffLeft}
        y1={topY + idx * LINE_GAP}
        x2={staffRight}
        y2={topY + idx * LINE_GAP}
        stroke={themeCfg.staffStroke}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    ));

  // Filter landmarks visible for current clefMode
  const visibleLandmarks = showLandmarks
    ? PIANO_LANDMARKS.filter((lm) => {
        if (clefMode === 'grand') return true;
        if (clefMode === 'treble') return lm.staff === 'treble';
        return lm.staff === 'bass' || lm.id === 'middle-c';
      })
    : [];

  let parsed = null;
  let staffSide: StaffSide = clefMode === 'bass' ? 'bass' : 'treble';
  let noteY = trebleTopY + 40;
  let ledgerSteps: number[] = [];

  if (activeNote) {
    parsed = parseNoteTarget(activeNote.note);
    staffSide = resolveStaffSide(activeNote, clefMode);
    noteY = stepToStaffY(parsed.diatonicStep, staffSide, trebleTopY, bassTopY);
    ledgerSteps = getLedgerSteps(parsed.diatonicStep, staffSide);
  }

  return (
    <svg
      viewBox={`0 0 680 ${viewBoxHeight}`}
      className="h-full w-full max-w-4xl select-none overflow-visible drop-shadow-sm"
      role="img"
      aria-label={activeNote ? `Target piano note ${activeNote.note}` : 'Music staff'}
    >
      {/* Layer 1: Landmark Highlight Bands (behind staff lines) */}
      {visibleLandmarks.map((lm) => {
        const targetStaff: StaffSide =
          clefMode === 'bass' && lm.id === 'middle-c' ? 'bass' : lm.staff;
        const y = stepToStaffY(lm.diatonicStep, targetStaff, trebleTopY, bassTopY);
        const bandHeight = lm.isLine ? 12 : 16;
        return (
          <rect
            key={`${lm.id}-band`}
            x={staffLeft + 74}
            y={y - bandHeight / 2}
            width={staffRight - (staffLeft + 84)}
            height={bandHeight}
            rx={bandHeight / 2}
            fill={themeCfg.landmarkColor}
          />
        );
      })}

      {/* Layer 2: Staff Lines & Clefs */}
      {(clefMode === 'treble' || isGrand) && renderFiveLines(trebleTopY, 'treble')}
      {(clefMode === 'bass' || isGrand) && renderFiveLines(bassTopY, 'bass')}

      {/* Left Bar Line & Grand Brace */}
      <line
        x1={staffLeft}
        y1={clefMode === 'bass' ? bassTopY : trebleTopY}
        x2={staffLeft}
        y2={clefMode === 'treble' ? trebleTopY + 80 : bassTopY + 80}
        stroke={themeCfg.staffStroke}
        strokeWidth="3.2"
      />

      {isGrand && (
        <GrandStaffBrace
          x={46}
          trebleTopY={trebleTopY}
          bassBottomY={bassTopY + 80}
          stroke={themeCfg.staffStroke}
        />
      )}

      {/* Clef Glyphs */}
      {(clefMode === 'treble' || isGrand) && (
        <TrebleClefGlyph x={95} topY={trebleTopY} fill={themeCfg.clefFill} />
      )}
      {(clefMode === 'bass' || isGrand) && (
        <BassClefGlyph x={95} topY={bassTopY} fill={themeCfg.clefFill} />
      )}

      {/* Layer 3: Landmark Letter Badges (opaque, painted cleanly ABOVE staff lines) */}
      {visibleLandmarks.map((lm) => {
        const targetStaff: StaffSide =
          clefMode === 'bass' && lm.id === 'middle-c' ? 'bass' : lm.staff;
        const y = stepToStaffY(lm.diatonicStep, targetStaff, trebleTopY, bassTopY);
        return (
          <g key={`${lm.id}-badge`}>
            <circle
              cx={staffLeft + 92}
              cy={y}
              r="11"
              fill="#d97706"
              stroke="#ffffff"
              strokeWidth="1.8"
            />
            <text
              x={staffLeft + 92}
              y={y + 4.5}
              textAnchor="middle"
              fontSize="13"
              fontWeight="800"
              fill="#ffffff"
            >
              {lm.label}
            </text>
          </g>
        );
      })}

      {/* Hit Burst Particles */}
      <AnimatePresence>
        {hitBurstId > 0 && (
          <motion.g
            key={`burst-${hitBurstId}`}
            initial={{ opacity: 0.95, scale: 0.5 }}
            animate={{ opacity: 0, scale: 2.1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.36, ease: 'easeOut' }}
            style={{ originX: `${noteX}px`, originY: `${noteY}px` }}
          >
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
              const rad = (deg * Math.PI) / 180;
              return (
                <circle
                  key={deg}
                  cx={noteX + Math.cos(rad) * 28}
                  cy={noteY + Math.sin(rad) * 24}
                  r="5.5"
                  fill={themeCfg.burstColor}
                />
              );
            })}
          </motion.g>
        )}
      </AnimatePresence>

      {/* Active Note + Ledger Lines + Accidental */}
      <AnimatePresence mode="popLayout">
        {activeNote && parsed && (
          <motion.g
            key={noteKey ?? `${activeNote.note}-${staffSide}`}
            initial={{ scale: 0.72, opacity: 0 }}
            animate={{
              scale: 1,
              opacity: 1,
              x: isWrongFeedback ? [0, -10, 10, -7, 7, 0] : 0,
            }}
            exit={{ scale: 1.25, opacity: 0 }}
            transition={{ duration: isWrongFeedback ? 0.32 : 0.16, ease: 'easeOut' }}
            style={{ originX: `${noteX}px`, originY: `${noteY}px` }}
          >
            {/* Ledger Lines */}
            {ledgerSteps.map((step) => {
              const ly = stepToStaffY(step, staffSide, trebleTopY, bassTopY);
              return (
                <line
                  key={`ledger-${step}`}
                  x1={noteX - 24}
                  y1={ly}
                  x2={noteX + 24}
                  y2={ly}
                  stroke={themeCfg.staffStroke}
                  strokeWidth="2.6"
                  strokeLinecap="round"
                />
              );
            })}

            {/* Accidental */}
            <AccidentalGlyph
              accidental={parsed.accidental}
              x={noteX - 30}
              y={noteY}
              fill={isWrongFeedback ? themeCfg.wrongColor : themeCfg.accidentalFill}
            />

            {/* Themed Notehead */}
            <g transform={`translate(${noteX}, ${noteY})`}>
              <ThemedNotehead theme={theme} isWrong={isWrongFeedback} />
            </g>

            {/* Optional Calibration Speech Bubble */}
            {calibrationPrompt && (
              <g transform={`translate(${noteX}, ${noteY - 46})`}>
                <rect
                  x="-115"
                  y="-24"
                  width="230"
                  height="38"
                  rx="19"
                  fill="#ffffff"
                  stroke="#facc15"
                  strokeWidth="3"
                />
                <polygon points="-8,14 8,14 0,24" fill="#ffffff" />
                <text
                  x="0"
                  y="-1"
                  textAnchor="middle"
                  fontSize="15.5"
                  fontWeight="800"
                  fill="#0f172a"
                >
                  {calibrationPrompt}
                </text>
              </g>
            )}
          </motion.g>
        )}
      </AnimatePresence>
    </svg>
  );
}
