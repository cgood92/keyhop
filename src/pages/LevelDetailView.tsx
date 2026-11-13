import { useState } from 'react';
import { ArrowLeft, Check, Copy, Pencil, Play, QrCode, Share2, Trash2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { buildLevelShareUrl } from '../music/levelShare';
import {
  BASS_TOP_STEP,
  TREBLE_TOP_STEP,
  getLedgerSteps,
  parseNoteTarget,
  resolveStaffSide,
} from '../music/notation';
import { AccidentalGlyph, BassClefGlyph, GrandStaffBrace, TrebleClefGlyph } from '../music/smuflPaths';
import type { LevelDefinition, StaffSide } from '../music/types';

interface LevelDetailViewProps {
  level: LevelDefinition;
  onBack: () => void;
  onPlay: () => void;
  onEdit: () => void;
  onDelete?: () => void;
}

export function LevelDetailView({
  level,
  onBack,
  onPlay,
  onEdit,
  onDelete,
}: LevelDetailViewProps) {
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = buildLevelShareUrl(level);
  const clefLabel =
    level.clef === 'grand' ? 'Grand Staff' : level.clef === 'treble' ? 'Treble Clef' : 'Bass Clef';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked in non-HTTPS context
    }
  };

  // Multi-note horizontal preview geometry
  const isGrand = level.clef === 'grand';
  const trebleTopY = isGrand ? 90 : 85;
  const bassTopY = isGrand ? 240 : 85;
  const noteCount = level.notes.length;
  const stepX = Math.max(36, Math.min(54, 520 / Math.max(1, noteCount)));
  const svgWidth = Math.max(680, 170 + noteCount * stepX + 40);
  const svgHeight = isGrand ? 420 : 250;

  const stepToY = (diatonicStep: number, side: StaffSide) =>
    side === 'treble'
      ? trebleTopY + (TREBLE_TOP_STEP - diatonicStep) * 10
      : bassTopY + (BASS_TOP_STEP - diatonicStep) * 10;

  return (
    <div className="flex h-[100dvh] w-full flex-col bg-slate-900 text-white">
      {/* Top Bar */}
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-2 text-sm font-bold hover:bg-white/20"
        >
          <ArrowLeft size={18} />
          <span>Back</span>
        </button>

        <button
          type="button"
          onClick={() => setShowQr((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/30 px-3.5 py-2 text-sm font-bold text-indigo-100 ring-1 ring-indigo-300/40 hover:bg-indigo-500/45"
        >
          <QrCode size={18} />
          <span>QR Share</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 flex-col items-center justify-center gap-4 overflow-hidden p-4 sm:p-6">
        <div className="text-center">
          <h1 className="text-2xl font-black sm:text-4xl">{level.name}</h1>
          <div className="mt-2 inline-flex flex-wrap items-center justify-center gap-2 rounded-full bg-white/10 px-4 py-1 text-xs font-bold text-amber-200 sm:text-sm">
            <span>{clefLabel}</span>
            <span>•</span>
            <span>
              {level.notes.length} note{level.notes.length === 1 ? '' : 's'}
            </span>
            <span>•</span>
            <span>×{level.repeats} repeats</span>
          </div>
        </div>

        {/* Multi-note Staff Inventory Preview */}
        <div className="w-full max-w-4xl flex-1 overflow-x-auto rounded-3xl bg-amber-50/95 p-4 shadow-2xl">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="mx-auto h-full min-h-[200px] w-full"
          >
            {(level.clef === 'treble' || isGrand) &&
              [0, 1, 2, 3, 4].map((i) => (
                <line
                  key={`t-${i}`}
                  x1={56}
                  y1={trebleTopY + i * 20}
                  x2={svgWidth - 30}
                  y2={trebleTopY + i * 20}
                  stroke="#3b2f2f"
                  strokeWidth="2"
                />
              ))}
            {(level.clef === 'bass' || isGrand) &&
              [0, 1, 2, 3, 4].map((i) => (
                <line
                  key={`b-${i}`}
                  x1={56}
                  y1={bassTopY + i * 20}
                  x2={svgWidth - 30}
                  y2={bassTopY + i * 20}
                  stroke="#3b2f2f"
                  strokeWidth="2"
                />
              ))}
            <line
              x1={56}
              y1={level.clef === 'bass' ? bassTopY : trebleTopY}
              x2={56}
              y2={level.clef === 'treble' ? trebleTopY + 80 : bassTopY + 80}
              stroke="#3b2f2f"
              strokeWidth="3"
            />
            {isGrand && (
              <GrandStaffBrace
                x={32}
                trebleTopY={trebleTopY}
                bassBottomY={bassTopY + 80}
                stroke="#3b2f2f"
              />
            )}
            {(level.clef === 'treble' || isGrand) && (
              <TrebleClefGlyph x={76} topY={trebleTopY} fill="#292020" />
            )}
            {(level.clef === 'bass' || isGrand) && (
              <BassClefGlyph x={76} topY={bassTopY} fill="#292020" />
            )}

            {level.notes.map((nt, idx) => {
              const parsed = parseNoteTarget(nt.note);
              const side = resolveStaffSide(nt, level.clef);
              const x = 165 + idx * stepX;
              const y = stepToY(parsed.diatonicStep, side);
              const ledgers = getLedgerSteps(parsed.diatonicStep, side);

              return (
                <g key={`${nt.note}-${idx}`}>
                  {ledgers.map((ls) => {
                    const ly = stepToY(ls, side);
                    return (
                      <line
                        key={ls}
                        x1={x - 16}
                        y1={ly}
                        x2={x + 16}
                        y2={ly}
                        stroke="#3b2f2f"
                        strokeWidth="2"
                      />
                    );
                  })}
                  <AccidentalGlyph accidental={parsed.accidental} x={x - 20} y={y} fill="#1e293b" />
                  <ellipse
                    cx={x}
                    cy={y}
                    rx="10"
                    ry="7.5"
                    transform={`rotate(-14 ${x} ${y})`}
                    fill="#1c1917"
                  />
                  <ellipse
                    cx={x}
                    cy={y}
                    rx="4.2"
                    ry="2.5"
                    transform={`rotate(24 ${x} ${y})`}
                    fill="#fefce8"
                  />
                </g>
              );
            })}
          </svg>
        </div>

        {/* Bottom Action Toolbar */}
        <div className="flex items-center justify-center gap-4 pt-1">
          <button
            type="button"
            onClick={onEdit}
            title={level.category === 'custom' ? 'Edit level' : 'Customize a copy'}
            className="flex h-12 items-center gap-2 rounded-full bg-white/15 px-5 font-bold hover:bg-white/25"
          >
            <Pencil size={18} />
            <span>{level.category === 'custom' ? 'Edit' : 'Customize Copy'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowQr(true)}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
            title="Share level link & QR code"
            aria-label="Share level"
          >
            <Share2 size={18} />
          </button>

          {level.category === 'custom' && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/20 text-rose-300 hover:bg-rose-500/35"
              title="Delete custom level"
              aria-label="Delete custom level"
            >
              <Trash2 size={18} />
            </button>
          )}

          <button
            type="button"
            onClick={onPlay}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-300 text-emerald-700 shadow-xl ring-4 ring-white/25 transition hover:scale-105 active:scale-95"
            aria-label="Play this level"
          >
            <Play size={30} className="translate-x-0.5 fill-emerald-600" />
          </button>
        </div>
      </main>

      {/* QR Share Modal */}
      {showQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center text-slate-900 shadow-2xl">
            <h3 className="text-xl font-black">Share "{level.name}"</h3>
            <p className="mt-1 text-xs font-medium text-slate-500">
              Scan this QR code on another device or send the link to students!
            </p>
            <div className="my-5 flex justify-center rounded-2xl bg-slate-50 p-4">
              <QRCodeSVG value={shareUrl} size={200} level="M" includeMargin />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white hover:bg-indigo-700"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                <span>{copied ? 'Link Copied!' : 'Copy Share Link'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowQr(false)}
                className="rounded-xl bg-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
