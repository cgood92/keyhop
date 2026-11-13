import { useMemo, useState } from 'react';
import { Check, Eraser, Sparkles, X } from 'lucide-react';
import {
  BASS_TOP_STEP,
  TREBLE_TOP_STEP,
  getLedgerSteps,
  naturalRange,
  parseNoteTarget,
  resolveStaffSide,
  stepToLetterOctave,
} from '../music/notation';
import { AccidentalGlyph, BassClefGlyph, GrandStaffBrace, TrebleClefGlyph } from '../music/smuflPaths';
import type { Accidental, ClefMode, LevelDefinition, NoteTarget, StaffSide } from '../music/types';

interface LevelDesignerViewProps {
  initialLevel?: LevelDefinition | null;
  onSave: (level: LevelDefinition) => void;
  onCancel: () => void;
}

const ACCIDENTALS: Accidental[] = ['', '#', 'b'];

function getRangeForClef(clef: ClefMode): { from: string; to: string } {
  if (clef === 'treble') return { from: 'A3', to: 'E6' };
  if (clef === 'bass') return { from: 'A1', to: 'E4' };
  return { from: 'C2', to: 'C6' };
}

function makeNoteKey(note: string, staff?: StaffSide): string {
  return staff ? `${note}@${staff}` : note;
}

export function LevelDesignerView({
  initialLevel,
  onSave,
  onCancel,
}: LevelDesignerViewProps) {
  const [name, setName] = useState(
    initialLevel
      ? initialLevel.category === 'custom'
        ? initialLevel.name
        : `${initialLevel.name} (Custom)`
      : 'My Custom Drill'
  );
  const [clef, setClef] = useState<ClefMode>(initialLevel?.clef ?? 'grand');
  const [repeats, setRepeats] = useState<number>(initialLevel?.repeats ?? 2);

  const [selectedMap, setSelectedMap] = useState<Record<string, NoteTarget>>(() => {
    const map: Record<string, NoteTarget> = {};
    if (initialLevel) {
      for (const nt of initialLevel.notes) {
        const staff = resolveStaffSide(nt, initialLevel.clef);
        map[makeNoteKey(nt.note, initialLevel.clef === 'grand' ? staff : undefined)] = {
          note: nt.note,
          ...(initialLevel.clef === 'grand' ? { staff } : {}),
        };
      }
    } else {
      for (const nt of naturalRange('C4', 'G4', 'treble')) {
        map[makeNoteKey(nt.note, 'treble')] = nt;
      }
    }
    return map;
  });

  const diatonicSteps = useMemo(() => {
    const { from, to } = getRangeForClef(clef);
    const start = parseNoteTarget(from).diatonicStep;
    const end = parseNoteTarget(to).diatonicStep;
    const list: Array<{ step: number; label: string; defaultStaff: StaffSide }> = [];
    for (let s = start; s <= end; s += 1) {
      const { letter, octave } = stepToLetterOctave(s);
      const defaultStaff: StaffSide =
        clef === 'treble' ? 'treble' : clef === 'bass' ? 'bass' : s >= 28 ? 'treble' : 'bass';
      list.push({
        step: s,
        label: `${letter}${octave}`,
        defaultStaff,
      });
    }
    return list;
  }, [clef]);

  const toggleNote = (baseLabel: string, acc: Accidental, defaultStaff: StaffSide) => {
    const { letter, octave } = parseNoteTarget(baseLabel);
    const noteStr = `${letter}${acc}${octave}`;
    const staff = clef === 'grand' ? defaultStaff : undefined;
    const key = makeNoteKey(noteStr, staff);

    setSelectedMap((prev) => {
      if (prev[key]) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return {
        ...prev,
        [key]: { note: noteStr, ...(staff ? { staff } : {}) },
      };
    });
  };

  const applyPreset = (kind: 'clear' | 'landmarks' | 'all-naturals') => {
    if (kind === 'clear') {
      setSelectedMap({});
      return;
    }
    if (kind === 'landmarks') {
      const lm: NoteTarget[] =
        clef === 'treble'
          ? [
              { note: 'C4', staff: 'treble' },
              { note: 'G4', staff: 'treble' },
              { note: 'C5', staff: 'treble' },
            ]
          : clef === 'bass'
            ? [
                { note: 'C3', staff: 'bass' },
                { note: 'F3', staff: 'bass' },
                { note: 'C4', staff: 'bass' },
              ]
            : [
                { note: 'C3', staff: 'bass' },
                { note: 'F3', staff: 'bass' },
                { note: 'C4', staff: 'treble' },
                { note: 'G4', staff: 'treble' },
                { note: 'C5', staff: 'treble' },
              ];
      const next: Record<string, NoteTarget> = {};
      for (const nt of lm) {
        const key = makeNoteKey(nt.note, clef === 'grand' ? nt.staff : undefined);
        next[key] = clef === 'grand' ? nt : { note: nt.note };
      }
      setSelectedMap(next);
      return;
    }
    // all-naturals
    const next: Record<string, NoteTarget> = {};
    for (const item of diatonicSteps) {
      const staff = clef === 'grand' ? item.defaultStaff : undefined;
      next[makeNoteKey(item.label, staff)] = {
        note: item.label,
        ...(staff ? { staff } : {}),
      };
    }
    setSelectedMap(next);
  };

  const selectedList = Object.values(selectedMap);
  const canSave = selectedList.length > 0 && name.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    const clefLabel =
      clef === 'grand' ? 'Grand Staff' : clef === 'treble' ? 'Treble' : 'Bass';

    const level: LevelDefinition = {
      id:
        initialLevel && initialLevel.category === 'custom'
          ? initialLevel.id
          : `custom-${Date.now().toString(36)}`,
      name: name.trim(),
      subtitle: `${clefLabel}: ${selectedList.length} note${selectedList.length === 1 ? '' : 's'} × ${repeats}`,
      clef,
      category: 'custom',
      notes: selectedList,
      repeats,
      createdAt: initialLevel?.createdAt ?? Date.now(),
    };
    onSave(level);
  };

  // Blueprint SVG layout
  const isGrand = clef === 'grand';
  const trebleTopY = isGrand ? 95 : 85;
  const bassTopY = isGrand ? 245 : 85;
  const colSpacing = 44;
  const startX = 148;
  const svgWidth = Math.max(760, startX + diatonicSteps.length * colSpacing + 40);
  const svgHeight = isGrand ? 430 : 260;

  const stepToY = (diatonicStep: number, side: StaffSide) =>
    side === 'treble'
      ? trebleTopY + (TREBLE_TOP_STEP - diatonicStep) * 10
      : bassTopY + (BASS_TOP_STEP - diatonicStep) * 10;

  return (
    <div
      className="relative flex h-[100dvh] w-full flex-col overflow-hidden text-white"
      style={{
        backgroundColor: '#0c4a6e',
        backgroundImage:
          'linear-gradient(rgba(125,211,252,0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(125,211,252,0.14) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }}
    >
      {/* Top Bar */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-sky-300/20 bg-sky-950/55 px-4 py-3 backdrop-blur">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={50}
            placeholder="Level Name"
            aria-label="Custom level name"
            className="w-56 rounded-xl border border-sky-300/35 bg-sky-900/60 px-3.5 py-2 text-sm font-extrabold text-white placeholder-sky-300/60 focus:border-amber-300 focus:outline-none sm:w-64"
          />

          <div className="flex rounded-xl bg-sky-900/70 p-1">
            {(['grand', 'treble', 'bass'] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setClef(c);
                  setSelectedMap({});
                }}
                className={`rounded-lg px-3 py-1 text-xs font-extrabold capitalize transition ${
                  clef === c
                    ? 'bg-sky-300 text-slate-950'
                    : 'text-sky-100 hover:bg-sky-800/70'
                }`}
              >
                {c === 'grand' ? 'Grand' : c}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 rounded-xl bg-sky-900/70 px-3 py-1.5 text-xs font-bold">
            <span className="text-sky-200">Repeats:</span>
            {[1, 2, 3, 5].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRepeats(r)}
                className={`rounded-md px-2 py-0.5 font-extrabold ${
                  repeats === r ? 'bg-amber-300 text-slate-950' : 'text-sky-100 hover:bg-sky-800'
                }`}
              >
                ×{r}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel level designer"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
        >
          <X size={20} />
        </button>
      </header>

      {/* Quick Presets Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-300/15 bg-sky-950/30 px-4 py-2 text-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => applyPreset('landmarks')}
            className="inline-flex items-center gap-1 rounded-full bg-sky-500/30 px-3 py-1 font-bold hover:bg-sky-500/45"
          >
            <Sparkles size={13} />
            <span>Landmarks</span>
          </button>
          <button
            type="button"
            onClick={() => applyPreset('all-naturals')}
            className="rounded-full bg-sky-500/30 px-3 py-1 font-bold hover:bg-sky-500/45"
          >
            All Naturals
          </button>
          <button
            type="button"
            onClick={() => applyPreset('clear')}
            className="inline-flex items-center gap-1 rounded-full bg-rose-500/25 px-3 py-1 font-bold text-rose-100 hover:bg-rose-500/40"
          >
            <Eraser size={13} />
            <span>Clear</span>
          </button>
        </div>
        <span className="font-bold text-amber-200">
          Selected: {selectedList.length} note{selectedList.length === 1 ? '' : 's'} ({selectedList.length * repeats} cards)
        </span>
      </div>

      {/* Interactive Blueprint Staff + 3-Accidental Columns */}
      <div className="flex-1 overflow-x-auto overflow-y-auto px-4 py-4">
        <div className="mx-auto inline-block min-w-full">
          <svg
            width={svgWidth}
            height={svgHeight}
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="select-none"
          >
            {(clef === 'treble' || isGrand) &&
              [0, 1, 2, 3, 4].map((i) => (
                <line
                  key={`bt-${i}`}
                  x1={60}
                  y1={trebleTopY + i * 20}
                  x2={svgWidth - 20}
                  y2={trebleTopY + i * 20}
                  stroke="rgba(224,242,254,0.65)"
                  strokeWidth="2"
                />
              ))}
            {(clef === 'bass' || isGrand) &&
              [0, 1, 2, 3, 4].map((i) => (
                <line
                  key={`bb-${i}`}
                  x1={60}
                  y1={bassTopY + i * 20}
                  x2={svgWidth - 20}
                  y2={bassTopY + i * 20}
                  stroke="rgba(224,242,254,0.65)"
                  strokeWidth="2"
                />
              ))}
            <line
              x1={60}
              y1={clef === 'bass' ? bassTopY : trebleTopY}
              x2={60}
              y2={clef === 'treble' ? trebleTopY + 80 : bassTopY + 80}
              stroke="rgba(224,242,254,0.8)"
              strokeWidth="3"
            />
            {isGrand && (
              <GrandStaffBrace
                x={36}
                trebleTopY={trebleTopY}
                bassBottomY={bassTopY + 80}
                stroke="rgba(224,242,254,0.85)"
              />
            )}
            {(clef === 'treble' || isGrand) && (
              <TrebleClefGlyph x={78} topY={trebleTopY} fill="#e0f2fe" />
            )}
            {(clef === 'bass' || isGrand) && (
              <BassClefGlyph x={78} topY={bassTopY} fill="#e0f2fe" />
            )}

            {diatonicSteps.map((item, idx) => {
              const x = startX + idx * colSpacing;
              const y = stepToY(item.step, item.defaultStaff);
              const ledgers = getLedgerSteps(item.step, item.defaultStaff);

              const activeNat = Boolean(
                selectedMap[
                  makeNoteKey(item.label, clef === 'grand' ? item.defaultStaff : undefined)
                ]
              );
              const { letter, octave } = parseNoteTarget(item.label);
              const sharpStr = `${letter}#${octave}`;
              const flatStr = `${letter}b${octave}`;
              const activeSharp = Boolean(
                selectedMap[
                  makeNoteKey(sharpStr, clef === 'grand' ? item.defaultStaff : undefined)
                ]
              );
              const activeFlat = Boolean(
                selectedMap[
                  makeNoteKey(flatStr, clef === 'grand' ? item.defaultStaff : undefined)
                ]
              );
              const anyActive = activeNat || activeSharp || activeFlat;

              return (
                <g key={item.label}>
                  {/* Subtle vertical column guide */}
                  <line
                    x1={x}
                    y1={20}
                    x2={x}
                    y2={svgHeight - 15}
                    stroke="rgba(186,230,253,0.12)"
                    strokeDasharray="4 4"
                  />

                  {/* Ledger lines for out-of-staff notes */}
                  {ledgers.map((ls) => {
                    const ly = stepToY(ls, item.defaultStaff);
                    return (
                      <line
                        key={ls}
                        x1={x - 16}
                        y1={ly}
                        x2={x + 16}
                        y2={ly}
                        stroke={anyActive ? '#ffffff' : 'rgba(186,230,253,0.4)'}
                        strokeWidth="2"
                      />
                    );
                  })}

                  {/* Clickable Natural Notehead directly on the staff */}
                  <g
                    onClick={() => toggleNote(item.label, '', item.defaultStaff)}
                    className="cursor-pointer"
                  >
                    <rect x={x - 18} y={y - 12} width={36} height={24} fill="transparent" />
                    <ellipse
                      cx={x}
                      cy={y}
                      rx="11"
                      ry="8"
                      transform={`rotate(-14 ${x} ${y})`}
                      fill={anyActive ? '#ffffff' : 'transparent'}
                      stroke={anyActive ? '#facc15' : 'rgba(186,230,253,0.5)'}
                      strokeWidth={anyActive ? '2.6' : '1.5'}
                      strokeDasharray={anyActive ? undefined : '3 2'}
                    />
                    {activeSharp && (
                      <AccidentalGlyph accidental="#" x={x - 17} y={y} fill="#fde047" />
                    )}
                    {activeFlat && !activeSharp && (
                      <AccidentalGlyph accidental="b" x={x - 16} y={y} fill="#7dd3fc" />
                    )}
                  </g>
                </g>
              );
            })}
          </svg>

          {/* 3-Row Matrix (Natural / Sharp / Flat) Aligned Directly Under Each Pitch Column */}
          <div
            className="mt-1 flex items-start"
            style={{ paddingLeft: `${startX - colSpacing / 2}px` }}
          >
            {diatonicSteps.map((item) => {
              const { letter, octave } = parseNoteTarget(item.label);
              return (
                <div
                  key={`matrix-${item.label}`}
                  className="flex shrink-0 flex-col items-center gap-1"
                  style={{ width: `${colSpacing}px` }}
                >
                  {ACCIDENTALS.map((acc) => {
                    const noteStr = `${letter}${acc}${octave}`;
                    const key = makeNoteKey(
                      noteStr,
                      clef === 'grand' ? item.defaultStaff : undefined
                    );
                    const isOn = Boolean(selectedMap[key]);
                    const label = acc === '' ? item.label : acc === '#' ? `${letter}♯` : `${letter}♭`;

                    return (
                      <button
                        key={noteStr}
                        type="button"
                        onClick={() => toggleNote(item.label, acc, item.defaultStaff)}
                        aria-pressed={isOn}
                        className={`w-9 rounded-lg py-1 text-[11px] font-extrabold transition ${
                          isOn
                            ? 'bg-amber-300 text-slate-950 shadow'
                            : 'bg-sky-900/60 text-sky-200/75 hover:bg-sky-800 hover:text-white'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Save Button */}
      <footer className="flex items-center justify-between border-t border-sky-300/20 bg-sky-950/60 px-5 py-3 backdrop-blur">
        <p className="text-xs font-semibold text-sky-200">
          Tap any outline note on the staff or use the Natural / ♯ / ♭ matrix below.
        </p>
        <button
          type="button"
          disabled={!canSave}
          onClick={handleSave}
          aria-label="Save custom level"
          className={`flex h-14 w-14 items-center justify-center rounded-full shadow-xl transition ${
            canSave
              ? 'bg-amber-300 text-emerald-700 hover:scale-105 active:scale-95'
              : 'cursor-not-allowed bg-slate-600 text-slate-400'
          }`}
        >
          <Check size={28} strokeWidth={3} />
        </button>
      </footer>
    </div>
  );
}
