import type { RoundResult } from './types';

/**
 * Official KeyHop / Note Rush star rating thresholds based on average seconds per note
 * (including any penalty time):
 * - 5 Stars: <= 1.0 s/note (bonus)
 * - 4 Stars: <= 1.5 s/note (bonus)
 * - 3 Stars: <= 2.5 s/note
 * - 2 Stars: <= 3.5 s/note
 * - 1 Star: completed in any time
 *
 * Diamond Perfect: 5 Stars achieved with zero wrong attempts.
 */
export function calculateStars(avgSecondsPerNote: number): number {
  if (avgSecondsPerNote <= 1.0) return 5;
  if (avgSecondsPerNote <= 1.5) return 4;
  if (avgSecondsPerNote <= 2.5) return 3;
  if (avgSecondsPerNote <= 3.5) return 2;
  return 1;
}

export function buildRoundResult(params: {
  levelId: string;
  levelName: string;
  totalNotes: number;
  rawTimeSeconds: number;
  wrongAttempts: number;
  penalizeWrongNotes: boolean;
  penaltySecondsPerError: number;
  previousBestTime?: number;
}): RoundResult {
  const safeTotal = Math.max(1, params.totalNotes);
  const penaltyTimeSeconds = params.penalizeWrongNotes
    ? params.wrongAttempts * params.penaltySecondsPerError
    : 0;
  const effectiveTimeSeconds = Math.max(0.01, params.rawTimeSeconds + penaltyTimeSeconds);
  const avgSecondsPerNote = effectiveTimeSeconds / safeTotal;
  const stars = calculateStars(avgSecondsPerNote);
  const diamondPerfect = stars === 5 && params.wrongAttempts === 0;
  const isNewBest =
    params.previousBestTime === undefined || effectiveTimeSeconds < params.previousBestTime;

  return {
    levelId: params.levelId,
    levelName: params.levelName,
    totalNotes: safeTotal,
    rawTimeSeconds: params.rawTimeSeconds,
    penaltyTimeSeconds,
    effectiveTimeSeconds,
    avgSecondsPerNote,
    wrongAttempts: params.wrongAttempts,
    stars,
    diamondPerfect,
    isNewBest,
  };
}

export function formatStopwatch(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const mins = Math.floor(clamped / 60);
  const rem = clamped - mins * 60;
  if (mins > 0) {
    return `${mins}:${rem.toFixed(2).padStart(5, '0')}`;
  }
  return `${rem.toFixed(2)}s`;
}
