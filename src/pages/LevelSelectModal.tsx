import { useState } from 'react';
import { ChevronRight, Plus, X } from 'lucide-react';
import { StarRating } from '../components/StarRating';
import { BUILT_IN_LEVELS } from '../music/builtInLevels';
import { formatStopwatch } from '../music/scoring';
import type { ClefMode, LevelBestRecord, LevelDefinition } from '../music/types';

type TabFilter = ClefMode | 'custom';

interface LevelSelectModalProps {
  selectedLevelId: string;
  customLevels: LevelDefinition[];
  bestRecords: Record<string, LevelBestRecord>;
  onSelectLevel: (level: LevelDefinition) => void;
  onInspectLevel: (level: LevelDefinition) => void;
  onCreateCustom: () => void;
  onClose: () => void;
}

export function LevelSelectModal({
  selectedLevelId,
  customLevels,
  bestRecords,
  onSelectLevel,
  onInspectLevel,
  onCreateCustom,
  onClose,
}: LevelSelectModalProps) {
  const [tab, setTab] = useState<TabFilter>(() => {
    if (customLevels.some((l) => l.id === selectedLevelId)) return 'custom';
    const found = BUILT_IN_LEVELS.find((l) => l.id === selectedLevelId);
    return found?.clef ?? 'grand';
  });

  const displayedLevels =
    tab === 'custom'
      ? customLevels
      : BUILT_IN_LEVELS.filter((l) => l.clef === tab);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6">
      <div className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-slate-50 text-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <h2 className="text-xl font-black uppercase tracking-wide text-slate-900">
              Select Piano Level
            </h2>
            <p className="text-xs font-medium text-slate-500">
              Choose a clef range or design your own note deck
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCreateCustom}
              className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow transition hover:bg-indigo-700"
            >
              <Plus size={16} />
              <span>Custom Level</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close level selector"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Segmented Clef Tabs */}
        <div className="grid grid-cols-4 gap-1.5 bg-slate-200/80 p-2">
          {(
            [
              ['grand', 'Grand Staff'],
              ['treble', 'Treble'],
              ['bass', 'Bass'],
              ['custom', `Custom (${customLevels.length})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-xl py-2 text-xs font-extrabold transition sm:text-sm ${
                tab === key
                  ? 'bg-white text-indigo-700 shadow'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Level List */}
        <div className="flex-1 space-y-2.5 overflow-y-auto p-4">
          {displayedLevels.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white p-10 text-center">
              <p className="text-base font-bold text-slate-700">No custom levels yet</p>
              <p className="mt-1 text-sm text-slate-500">
                Create a custom piano drill with specific notes, sharps, flats, and repeats.
              </p>
              <button
                type="button"
                onClick={onCreateCustom}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-indigo-700"
              >
                <Plus size={18} />
                <span>Open Level Designer</span>
              </button>
            </div>
          ) : (
            displayedLevels.map((level) => {
              const isSelected = level.id === selectedLevelId;
              const best = bestRecords[level.id];
              const totalNotes = level.notes.length * level.repeats;

              return (
                <div
                  key={level.id}
                  className={`flex items-center justify-between gap-3 rounded-2xl border-2 bg-white p-3.5 shadow-sm transition ${
                    isSelected
                      ? 'border-amber-400 ring-2 ring-amber-200'
                      : 'border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectLevel(level)}
                    className="flex min-w-0 flex-1 flex-col text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="truncate text-base font-extrabold text-slate-900">
                        {level.name}
                      </span>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                        {totalNotes} notes
                      </span>
                    </div>
                    <span className="truncate text-xs font-medium text-slate-500">
                      {level.subtitle}
                    </span>
                  </button>

                  <div className="flex shrink-0 items-center gap-3">
                    <div className="flex flex-col items-end">
                      <StarRating
                        stars={best?.bestStars ?? 0}
                        diamondPerfect={best?.diamondPerfect}
                        size="sm"
                      />
                      {best && (
                        <span className="mt-0.5 font-mono text-[11px] font-bold text-slate-500">
                          {formatStopwatch(best.bestTimeSeconds)}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => onInspectLevel(level)}
                      title="View notes & share"
                      aria-label={`Details for ${level.name}`}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-indigo-100 hover:text-indigo-700"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
