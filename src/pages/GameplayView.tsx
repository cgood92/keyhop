import { useCallback, useEffect, useRef, useState } from 'react';
import { Lightbulb, Pause, Play, RotateCcw, Usb, X } from 'lucide-react';
import { Note } from 'tonal';
import { PitchEngine } from '../audio/PitchEngine';
import { playHitSfx, playWrongSfx } from '../audio/sfxSynth';
import { FullscreenButton } from '../components/FullscreenButton';
import { MicMeter } from '../components/MicMeter';
import { StaffCanvas } from '../components/StaffCanvas';
import { midiEngine } from '../midi/MidiEngine';
import { buildRoundDeck, isNoteMatch } from '../music/notation';
import { buildRoundResult, formatStopwatch } from '../music/scoring';
import type {
  CalibrationState,
  GameSettings,
  LevelBestRecord,
  LevelDefinition,
  NoteTarget,
  RoundResult,
  ThemeId,
} from '../music/types';
import { ThemeBackdrop } from '../themes/ThemeBackdrop';
import { getThemeConfig } from '../themes/themeRegistry';

interface GameplayViewProps {
  level: LevelDefinition;
  theme: ThemeId;
  settings: GameSettings;
  calibration: CalibrationState;
  previousBest?: LevelBestRecord;
  isFullscreen: boolean;
  isFullscreenSupported: boolean;
  onToggleFullscreen: () => void;
  onAcquireWakeLock: () => void;
  onReleaseWakeLock: () => void;
  onToggleLandmarks: () => void;
  onComplete: (result: RoundResult) => void;
  onExit: () => void;
}

export function GameplayView({
  level,
  theme,
  settings,
  calibration,
  previousBest,
  isFullscreen,
  isFullscreenSupported,
  onToggleFullscreen,
  onAcquireWakeLock,
  onReleaseWakeLock,
  onToggleLandmarks,
  onComplete,
  onExit,
}: GameplayViewProps) {
  const [deck, setDeck] = useState<NoteTarget[]>(() =>
    buildRoundDeck(level.notes, level.repeats)
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [isWrongFlash, setIsWrongFlash] = useState(false);
  const [wrongNoteHint, setWrongNoteHint] = useState<string | null>(null);
  const [hitBurstId, setHitBurstId] = useState(0);
  const [rms, setRms] = useState(0);
  const [heardNote, setHeardNote] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);

  const themeCfg = getThemeConfig(theme);

  // Refs for low-latency input handler without stale closures
  const indexRef = useRef(currentIndex);
  const deckRef = useRef(deck);
  const pausedRef = useRef(paused);
  const wrongAttemptsRef = useRef(wrongAttempts);
  useEffect(() => {
    indexRef.current = currentIndex;
    deckRef.current = deck;
    pausedRef.current = paused;
    wrongAttemptsRef.current = wrongAttempts;
  }, [currentIndex, deck, paused, wrongAttempts]);
  const accumulatedMsRef = useRef(0);
  const lastTickRef = useRef<number | null>(null);
  const transitionLockRef = useRef(false);
  const wrongLockUntilRef = useRef(0);
  const lastAdvanceAtRef = useRef(0);
  const pitchEngineRef = useRef<PitchEngine | null>(null);

  // Acquire wake lock during active gameplay
  useEffect(() => {
    if (!paused) {
      onAcquireWakeLock();
    } else {
      onReleaseWakeLock();
    }
    return () => {
      onReleaseWakeLock();
    };
  }, [paused, onAcquireWakeLock, onReleaseWakeLock]);

  // High-precision stopwatch loop
  useEffect(() => {
    if (paused) {
      lastTickRef.current = null;
      return;
    }

    lastTickRef.current = performance.now();
    let rafId = 0;
    const tick = (now: number) => {
      if (lastTickRef.current !== null) {
        accumulatedMsRef.current += now - lastTickRef.current;
        setElapsedSeconds(accumulatedMsRef.current / 1000);
      }
      lastTickRef.current = now;
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [paused]);

  const handleRestart = useCallback(() => {
    setDeck(buildRoundDeck(level.notes, level.repeats));
    setCurrentIndex(0);
    setWrongAttempts(0);
    setIsWrongFlash(false);
    setWrongNoteHint(null);
    setHitBurstId(0);
    accumulatedMsRef.current = 0;
    lastTickRef.current = performance.now();
    setElapsedSeconds(0);
    transitionLockRef.current = false;
    setPaused(false);
  }, [level.notes, level.repeats]);

  const handleNoteInput = useCallback(
    (playedMidi: number) => {
      if (pausedRef.current || transitionLockRef.current) return;
      const activeDeck = deckRef.current;
      const idx = indexRef.current;
      const target = activeDeck[idx];
      if (!target) return;

      if (isNoteMatch(playedMidi, target, settings.strictOctave)) {
        transitionLockRef.current = true;
        if (settings.inputMode === 'mic' && settings.soundEffects) {
          // Suppress mic briefly so speaker chime never feeds back as a wrong note
          pitchEngineRef.current?.suppressFor(300);
        }
        playHitSfx(theme, settings.soundEffects);
        setIsWrongFlash(false);
        setWrongNoteHint(null);
        setHitBurstId((n) => n + 1);

        const nextIdx = idx + 1;
        if (nextIdx >= activeDeck.length) {
          const finalRawSeconds = Math.max(0.05, accumulatedMsRef.current / 1000);
          const result = buildRoundResult({
            levelId: level.id,
            levelName: level.name,
            totalNotes: activeDeck.length,
            rawTimeSeconds: finalRawSeconds,
            wrongAttempts: wrongAttemptsRef.current,
            penalizeWrongNotes: settings.penalizeWrongNotes,
            penaltySecondsPerError: settings.penaltySeconds,
            previousBestTime: previousBest?.bestTimeSeconds,
          });
          setTimeout(() => {
            onComplete(result);
          }, 220);
        } else {
          setTimeout(() => {
            lastAdvanceAtRef.current = performance.now();
            setCurrentIndex(nextIdx);
            transitionLockRef.current = false;
          }, 110);
        }
      } else {
        const now = performance.now();
        // Give previous piano string decay a brief grace period after card advance in mic mode
        if (settings.inputMode === 'mic' && now - lastAdvanceAtRef.current < 420) {
          return;
        }
        if (now < wrongLockUntilRef.current) return;
        wrongLockUntilRef.current = now + 550;

        // Avoid speaker wrong-note audio in Mic mode so it doesn't loop back into mic
        if (settings.inputMode === 'midi') {
          playWrongSfx(settings.soundEffects);
        }
        setWrongAttempts((w) => w + 1);
        setIsWrongFlash(true);
        setWrongNoteHint(`Heard ${Note.fromMidi(playedMidi) || 'wrong key'}`);
        setTimeout(() => setIsWrongFlash(false), 380);
      }
    },
    [
      level.id,
      level.name,
      onComplete,
      previousBest?.bestTimeSeconds,
      settings.inputMode,
      settings.penalizeWrongNotes,
      settings.penaltySeconds,
      settings.soundEffects,
      settings.strictOctave,
      theme,
    ]
  );

  // Microphone pitch engine
  useEffect(() => {
    if (settings.inputMode !== 'mic') return;

    const engine = new PitchEngine({
      rmsThreshold: settings.micSensitivity,
      clarityThreshold: settings.micClarityThreshold,
      requiredStableFrames: 3,
      centsOffset: calibration.centsOffset,
      semitoneOffset: calibration.semitoneOffset,
    });
    pitchEngineRef.current = engine;

    engine
      .start({
        onFrame: (analysis) => {
          setRms(analysis.rms);
          if (analysis.activeMidi !== null) {
            setHeardNote(Note.fromMidi(analysis.activeMidi) || '');
          }
        },
        onNoteDetected: (midi) => {
          handleNoteInput(midi);
        },
        onError: (msg) => setInputError(msg),
      })
      .catch(() => {});

    return () => {
      pitchEngineRef.current = null;
      engine.stop();
    };
  }, [
    settings.inputMode,
    settings.micSensitivity,
    settings.micClarityThreshold,
    calibration.centsOffset,
    calibration.semitoneOffset,
    handleNoteInput,
  ]);

  // Web MIDI listener
  useEffect(() => {
    if (settings.inputMode !== 'midi') return;
    let unsub: (() => void) | undefined;

    midiEngine
      .enable()
      .then(() => {
        setInputError(null);
        unsub = midiEngine.onNoteOn((evt) => {
          setHeardNote(evt.noteName);
          handleNoteInput(evt.midi);
        });
      })
      .catch((err) => {
        setInputError(err instanceof Error ? err.message : 'MIDI error');
      });

    return () => {
      unsub?.();
    };
  }, [settings.inputMode, handleNoteInput]);

  // Keyboard shortcuts: Space/Escape pause
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const currentNote = deck[currentIndex] ?? null;
  const progressPct = Math.round((currentIndex / Math.max(1, deck.length)) * 100);
  const penaltyDisplay = settings.penalizeWrongNotes
    ? wrongAttempts * settings.penaltySeconds
    : 0;

  return (
    <div className="relative flex h-[100dvh] w-full flex-col justify-between overflow-hidden p-3 sm:p-5">
      <ThemeBackdrop theme={theme} />

      {/* Top HUD */}
      <header className="relative z-10 flex items-center justify-between gap-3">
        {/* Left: Timer Pill or Calm Exit */}
        {settings.hideTimer ? (
          <button
            type="button"
            onClick={onExit}
            aria-label="Exit practice"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-lg hover:bg-white"
          >
            <X size={20} />
          </button>
        ) : (
          <div
            className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 shadow-lg backdrop-blur ${themeCfg.hudBg} ${themeCfg.hudText}`}
          >
            <span className="font-mono text-base font-black tabular-nums sm:text-lg">
              {formatStopwatch(elapsedSeconds + penaltyDisplay)}
            </span>
            {penaltyDisplay > 0 && (
              <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                +{penaltyDisplay}s
              </span>
            )}
            <button
              type="button"
              onClick={onExit}
              aria-label="Exit round"
              className="ml-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/20 hover:bg-white/35"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Center: Progress Bar */}
        <div className="flex max-w-md flex-1 flex-col items-center gap-1">
          <div className="h-3 w-full overflow-hidden rounded-full bg-black/30 p-0.5 backdrop-blur">
            <div
              className="h-full rounded-full bg-amber-300 transition-all duration-200"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-[11px] font-extrabold tracking-wide text-white/90 drop-shadow">
            {currentIndex} / {deck.length}
          </span>
        </div>

        {/* Right: Landmarks + Fullscreen + Pause */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleLandmarks}
            title="Toggle Landmark Hints (F, C, G)"
            aria-pressed={settings.landmarkHints}
            className={`flex h-10 w-10 items-center justify-center rounded-full shadow-lg transition ${
              settings.landmarkHints
                ? 'bg-amber-400 text-slate-950 ring-2 ring-white'
                : 'bg-white/85 text-slate-700 hover:bg-white'
            }`}
          >
            <Lightbulb size={19} />
          </button>

          <FullscreenButton
            isFullscreen={isFullscreen}
            isSupported={isFullscreenSupported}
            onToggle={onToggleFullscreen}
            compact
          />

          <button
            type="button"
            onClick={() => setPaused(true)}
            aria-label="Pause round"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-300 text-slate-900 shadow-lg transition hover:scale-105 active:scale-95"
          >
            <Pause size={19} fill="currentColor" />
          </button>
        </div>
      </header>

      {/* Main Musical Staff Stage (~68% viewport height) */}
      <main className="relative z-10 flex flex-1 items-center justify-center overflow-hidden px-2">
        <div className="h-[66dvh] w-full max-w-5xl">
          <StaffCanvas
            clefMode={level.clef}
            activeNote={currentNote}
            noteKey={currentIndex}
            theme={theme}
            showLandmarks={settings.landmarkHints}
            isWrongFeedback={isWrongFlash}
            hitBurstId={hitBurstId}
          />
        </div>
      </main>

      {/* Bottom Subtle Input Status */}
      <footer className="relative z-10 flex flex-col items-center gap-2">
        {wrongNoteHint && (
          <div className="rounded-full bg-rose-600/90 px-4 py-1 text-xs font-extrabold text-white shadow-lg">
            {wrongNoteHint}
          </div>
        )}
        {inputError && (
          <div className="rounded-xl bg-rose-950/90 px-4 py-2 text-xs font-bold text-rose-100">
            {inputError}
          </div>
        )}
        {settings.inputMode === 'mic' ? (
          <MicMeter
            rms={rms}
            threshold={settings.micSensitivity}
            heardNote={heardNote}
          />
        ) : (
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/70 px-4 py-1.5 text-xs font-bold text-cyan-200 backdrop-blur border border-white/15">
            <Usb size={14} />
            <span>MIDI Active {heardNote ? `• Last: ${heardNote}` : ''}</span>
          </div>
        )}
      </footer>

      {/* Pause Overlay */}
      {paused && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-3xl bg-white p-6 text-center text-slate-900 shadow-2xl">
            <h2 className="text-2xl font-black">Paused</h2>
            <p className="mt-1 text-xs font-semibold text-slate-500">{level.name}</p>

            <div className="mt-5 space-y-2.5">
              <button
                type="button"
                onClick={() => setPaused(false)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-300 py-3 font-extrabold text-slate-950 shadow hover:bg-amber-400"
              >
                <Play size={18} fill="currentColor" />
                <span>Resume</span>
              </button>
              <button
                type="button"
                onClick={handleRestart}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-100 py-3 font-bold text-slate-800 hover:bg-slate-200"
              >
                <RotateCcw size={18} />
                <span>Restart Round</span>
              </button>
              <button
                type="button"
                onClick={onExit}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-50 py-3 font-bold text-rose-700 hover:bg-rose-100"
              >
                <X size={18} />
                <span>Exit to Home</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
