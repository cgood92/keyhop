import type { Accidental } from './types';

/**
 * Clean vector music glyphs calibrated to a 5-line staff with LINE_GAP = 20
 * (total 5-line height = 80 units, from y = 0 top line to y = 80 bottom line).
 */

export function TrebleClefGlyph({
  x,
  topY,
  fill,
}: {
  x: number;
  topY: number;
  fill: string;
}) {
  // G4 line is at y = 60 in local space (topY + 60)
  return (
    <g transform={`translate(${x}, ${topY})`} fill="none" stroke={fill} strokeLinecap="round" strokeLinejoin="round">
      {/* Main G-clef scroll & stem */}
      <path
        d="M 22 66 C 12 66, 7 56, 13 48 C 20 40, 32 45, 32 58 C 32 73, 14 82, 4 72 C -7 60, -2 38, 17 24 C 31 13, 31 -6, 23 -16 C 18 -22, 13 -16, 14 -6 L 21 90 C 22 100, 12 106, 5 101 C 1 98, 2 92, 7 92 C 11 92, 12 96, 9 98"
        strokeWidth="5.4"
      />
      <circle cx="7" cy="96" r="4.2" fill={fill} stroke="none" />
    </g>
  );
}

export function BassClefGlyph({
  x,
  topY,
  fill,
}: {
  x: number;
  topY: number;
  fill: string;
}) {
  // F3 line is at y = 20 in local space (topY + 20)
  return (
    <g transform={`translate(${x}, ${topY})`}>
      <circle cx="8" cy="20" r="6" fill={fill} />
      <path
        d="M 6 20 C 6 4, 34 0, 35 23 C 36 44, 16 62, 1 70"
        fill="none"
        stroke={fill}
        strokeWidth="6.2"
        strokeLinecap="round"
      />
      {/* Two dots straddling F3 line (in spaces y=10 and y=30) */}
      <circle cx="45" cy="10" r="4.1" fill={fill} />
      <circle cx="45" cy="30" r="4.1" fill={fill} />
    </g>
  );
}

export function GrandStaffBrace({
  x,
  trebleTopY,
  bassBottomY,
  stroke,
}: {
  x: number;
  trebleTopY: number;
  bassBottomY: number;
  stroke: string;
}) {
  const midY = (trebleTopY + bassBottomY) / 2;
  const h = bassBottomY - trebleTopY;
  return (
    <path
      d={`M ${x + 12} ${trebleTopY}
          C ${x - 6} ${trebleTopY + h * 0.08}, ${x + 10} ${midY - h * 0.14}, ${x - 8} ${midY}
          C ${x + 10} ${midY + h * 0.14}, ${x - 6} ${bassBottomY - h * 0.08}, ${x + 12} ${bassBottomY}`}
      fill="none"
      stroke={stroke}
      strokeWidth="4.5"
      strokeLinecap="round"
    />
  );
}

export function AccidentalGlyph({
  accidental,
  x,
  y,
  fill,
}: {
  accidental: Accidental;
  x: number;
  y: number;
  fill: string;
}) {
  if (!accidental) return null;

  if (accidental === '#') {
    return (
      <g transform={`translate(${x}, ${y})`} stroke={fill} strokeLinecap="round">
        <line x1="-5" y1="-15" x2="-5" y2="17" strokeWidth="3" />
        <line x1="5" y1="-17" x2="5" y2="15" strokeWidth="3" />
        <line x1="-11" y1="-4" x2="11" y2="-9" strokeWidth="4.4" />
        <line x1="-11" y1="9" x2="11" y2="4" strokeWidth="4.4" />
      </g>
    );
  }

  // Flat (b)
  return (
    <g transform={`translate(${x}, ${y})`} fill="none" stroke={fill} strokeLinecap="round" strokeLinejoin="round">
      <line x1="-5" y1="-22" x2="-5" y2="10" strokeWidth="3.2" />
      <path d="M -5 -2 C 7 -7, 10 4, -5 10" strokeWidth="3.6" />
    </g>
  );
}
