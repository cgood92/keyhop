import { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Home, ListMusic, RotateCcw, Sparkles, Trophy } from 'lucide-react';
import { motion } from 'motion/react';
import { playCompleteFanfare } from '../audio/sfxSynth';
import { StarRating } from '../components/StarRating';
import { formatStopwatch } from '../music/scoring';
import type { RoundResult, ThemeId } from '../music/types';
import { ThemeBackdrop } from '../themes/ThemeBackdrop';

interface ResultsViewProps {
  theme: ThemeId;
  result: RoundResult;
  soundEffects: boolean;
  onReplay: () => void;
  onHome: () => void;
  onOpenLevels: () => void;
}

export function ResultsView({
  theme,
  result,
  soundEffects,
  onReplay,
  onHome,
  onOpenLevels,
}: ResultsViewProps) {
  useEffect(() => {
    playCompleteFanfare(result.diamondPerfect, soundEffects);
    if (result.stars >= 3) {
      void confetti({
        particleCount: result.diamondPerfect ? 140 : 75,
        spread: result.diamondPerfect ? 90 : 65,
        origin: { y: 0.55 },
      });
    }
  }, [result.diamondPerfect, result.stars, soundEffects]);

  return (
    <div className="relative flex h-[100dvh] w-full flex-col items-center justify-center overflow-hidden p-4 sm:p-6">
      <ThemeBackdrop theme={theme} />

      <motion.div
        initial={{ scale: 0.88, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="relative z-10 flex w-full max-w-md flex-col items-center rounded-3xl bg-slate-900/80 p-6 text-center text-white shadow-2xl backdrop-blur-md border border-white/20 sm:p-8"
      >
        {/* Ribbon Banner */}
        <div className="-mt-11 mb-5 rounded-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 px-8 py-2 text-2xl font-black tracking-wider text-slate-950 shadow-xl ring-4 ring-white/40">
          COMPLETE!
        </div>

        {/* Stars Arc */}
        <div className="my-2">
          <StarRating
            stars={result.stars}
            diamondPerfect={result.diamondPerfect}
            size="lg"
            arc
          />
        </div>

        {result.diamondPerfect && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-cyan-400/25 px-4 py-1 text-xs font-black uppercase tracking-wider text-cyan-200 ring-1 ring-cyan-300/60">
            <Sparkles size={14} />
            <span>Diamond Perfect!</span>
          </div>
        )}

        {/* Level Pill */}
        <div className="mt-4 rounded-full bg-white/15 px-4 py-1 text-sm font-bold text-white/95">
          {result.levelName}: {result.totalNotes} Notes
        </div>

        {/* Time & High Score */}
        <div className="mt-5 flex items-center justify-center gap-3">
          <Trophy size={32} className="text-amber-300" />
          <span className="font-mono text-4xl font-black tracking-tight tabular-nums">
            {formatStopwatch(result.effectiveTimeSeconds)}
          </span>
        </div>

        <p className="mt-1 text-xs font-semibold text-white/75">
          Avg {result.avgSecondsPerNote.toFixed(2)}s / note
          {result.penaltyTimeSeconds > 0
            ? ` • Includes +${result.penaltyTimeSeconds}s penalty (${result.wrongAttempts} wrong)`
            : result.wrongAttempts === 0
              ? ' • 100% Accuracy!'
              : ` • ${result.wrongAttempts} wrong key${result.wrongAttempts === 1 ? '' : 's'}`}
        </p>

        {result.isNewBest && (
          <div className="mt-3 rounded-full bg-emerald-400 px-4 py-1 text-xs font-black uppercase tracking-wider text-emerald-950 shadow">
            New High Score!!
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-7 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={onHome}
            aria-label="Home"
            title="Home"
            className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-slate-800 shadow-lg transition hover:scale-105 active:scale-95"
          >
            <Home size={24} />
          </button>

          <button
            type="button"
            onClick={onReplay}
            aria-label="Play Again"
            title="Play Again"
            className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-300 text-slate-950 shadow-xl ring-4 ring-white/30 transition hover:scale-105 active:scale-95"
          >
            <RotateCcw size={34} strokeWidth={2.5} />
          </button>

          <button
            type="button"
            onClick={onOpenLevels}
            aria-label="Choose Level"
            title="Choose Level"
            className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-slate-800 shadow-lg transition hover:scale-105 active:scale-95"
          >
            <ListMusic size={24} />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
