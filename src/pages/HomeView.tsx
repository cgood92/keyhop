import { ChevronRight, Mic, Music, Play, Settings, SlidersHorizontal, Usb } from 'lucide-react';
import { motion } from 'motion/react';
import { FullscreenButton } from '../components/FullscreenButton';
import { StarRating } from '../components/StarRating';
import { ThemeCarousel } from '../components/ThemeCarousel';
import type { GameSettings, LevelBestRecord, LevelDefinition, ThemeId } from '../music/types';
import { formatStopwatch } from '../music/scoring';
import { ThemeBackdrop } from '../themes/ThemeBackdrop';

interface HomeViewProps {
  theme: ThemeId;
  activeLevel: LevelDefinition;
  bestRecord?: LevelBestRecord;
  settings: GameSettings;
  isFullscreen: boolean;
  isFullscreenSupported: boolean;
  onToggleFullscreen: () => void;
  onSelectTheme: (theme: ThemeId) => void;
  onPlay: () => void;
  onOpenLevels: () => void;
  onOpenLevelDetails: () => void;
  onOpenSettings: () => void;
}

export function HomeView({
  theme,
  activeLevel,
  bestRecord,
  settings,
  isFullscreen,
  isFullscreenSupported,
  onToggleFullscreen,
  onSelectTheme,
  onPlay,
  onOpenLevels,
  onOpenLevelDetails,
  onOpenSettings,
}: HomeViewProps) {
  const totalCards = activeLevel.notes.length * activeLevel.repeats;

  return (
    <div className="relative flex h-[100dvh] w-full flex-col justify-between overflow-hidden p-4 sm:p-6">
      <ThemeBackdrop theme={theme} />

      {/* Top Bar */}
      <header className="relative z-10 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FullscreenButton
            isFullscreen={isFullscreen}
            isSupported={isFullscreenSupported}
            onToggle={onToggleFullscreen}
          />
          <button
            type="button"
            onClick={onOpenSettings}
            className="inline-flex items-center gap-1.5 rounded-full bg-slate-900/55 px-3 py-2 text-xs font-bold text-white backdrop-blur border border-white/20 transition hover:bg-slate-900/75"
          >
            {settings.inputMode === 'midi' ? <Usb size={15} className="text-cyan-300" /> : <Mic size={15} className="text-amber-300" />}
            <span>{settings.inputMode === 'midi' ? 'MIDI' : 'Microphone'}</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Open settings"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-800 shadow-lg transition hover:scale-105 active:scale-95"
        >
          <Settings size={22} />
        </button>
      </header>

      {/* Center Hero: Title + Play CTA */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center gap-5 sm:gap-7">
        <div className="flex flex-col items-center text-center">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/20 px-3.5 py-1 text-xs font-extrabold uppercase tracking-widest text-white backdrop-blur">
            <Music size={14} />
            <span>Piano Sight-Reading</span>
          </div>
          <h1 className="text-5xl font-black tracking-tight text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.45)] sm:text-7xl">
            Key<span className="text-amber-300">Hop</span>
          </h1>
          <p className="mt-1.5 text-sm font-semibold text-white/85 drop-shadow sm:text-base">
            Play the note on your piano to hop to the next!
          </p>
        </div>

        <motion.button
          type="button"
          onClick={onPlay}
          whileHover={{ scale: 1.07 }}
          whileTap={{ scale: 0.94 }}
          aria-label="Start practicing"
          className="group relative flex h-28 w-28 items-center justify-center rounded-full bg-amber-300 shadow-[0_12px_35px_rgba(0,0,0,0.38)] ring-8 ring-white/30 transition sm:h-32 sm:w-32"
        >
          <Play
            size={54}
            className="translate-x-1 fill-emerald-600 text-emerald-700 transition-transform group-hover:scale-105"
          />
        </motion.button>
      </main>

      {/* Bottom: Theme Carousel + Active Level Card */}
      <footer className="relative z-10 flex flex-col items-center gap-3 pb-1">
        <ThemeCarousel selectedTheme={theme} onSelectTheme={onSelectTheme} />

        <div className="flex w-full max-w-xl items-stretch gap-2">
          <button
            type="button"
            onClick={onOpenLevels}
            className="flex flex-1 items-center justify-between gap-3 rounded-2xl bg-white/95 px-4 py-3 text-left text-slate-900 shadow-xl backdrop-blur transition hover:bg-white active:scale-[0.99]"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-base font-extrabold sm:text-lg">
                  {activeLevel.name}
                </span>
                <span className="shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                  {totalCards} notes
                </span>
              </div>
              <p className="truncate text-xs font-medium text-slate-500">
                {activeLevel.subtitle}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <div className="flex flex-col items-end">
                <StarRating
                  stars={bestRecord?.bestStars ?? 0}
                  diamondPerfect={bestRecord?.diamondPerfect}
                  size="sm"
                />
                {bestRecord && (
                  <span className="mt-0.5 font-mono text-[11px] font-bold text-slate-500">
                    Best: {formatStopwatch(bestRecord.bestTimeSeconds)}
                  </span>
                )}
              </div>
              <ChevronRight size={20} className="text-slate-400" />
            </div>
          </button>

          <button
            type="button"
            onClick={onOpenLevelDetails}
            title="Inspect notes, share QR code, or customize"
            aria-label="Level details and sharing"
            className="flex shrink-0 flex-col items-center justify-center rounded-2xl bg-white/90 px-3.5 text-slate-700 shadow-xl transition hover:bg-white active:scale-95"
          >
            <SlidersHorizontal size={20} />
            <span className="mt-1 text-[10px] font-bold uppercase tracking-wide">Notes</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
