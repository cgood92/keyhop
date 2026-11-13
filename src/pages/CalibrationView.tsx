import { useEffect, useRef, useState } from 'react';
import { HelpCircle, Mic, SkipForward, Usb, X } from 'lucide-react';
import { Note } from 'tonal';
import { PitchEngine } from '../audio/PitchEngine';
import { evaluateCalibrationSamples } from '../audio/calibration';
import type { CalibrationSample } from '../audio/calibration';
import { MicMeter } from '../components/MicMeter';
import { StaffCanvas } from '../components/StaffCanvas';
import { isWebMidiSupported, midiEngine } from '../midi/MidiEngine';
import type { MidiDeviceInfo } from '../midi/MidiEngine';
import type { CalibrationState, GameSettings, ThemeId } from '../music/types';
import { ThemeBackdrop } from '../themes/ThemeBackdrop';

interface CalibrationViewProps {
  theme: ThemeId;
  settings: GameSettings;
  onUpdateSettings: (partial: Partial<GameSettings>) => void;
  onCalibrated: (cal: Partial<CalibrationState>) => void;
  onCancel: () => void;
}

export function CalibrationView({
  theme,
  settings,
  onUpdateSettings,
  onCalibrated,
  onCancel,
}: CalibrationViewProps) {
  const [rms, setRms] = useState(0);
  const [heardNote, setHeardNote] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [midiDevices, setMidiDevices] = useState<MidiDeviceInfo[]>([]);

  const pitchEngineRef = useRef<PitchEngine | null>(null);
  const samplesRef = useRef<CalibrationSample[]>([]);
  const completedRef = useRef(false);

  const midiSupported = isWebMidiSupported();

  // Microphone listener during calibration
  useEffect(() => {
    if (settings.inputMode !== 'mic') {
      pitchEngineRef.current?.stop();
      return;
    }

    completedRef.current = false;
    samplesRef.current = [];

    const engine = new PitchEngine({
      rmsThreshold: settings.micSensitivity,
      clarityThreshold: settings.micClarityThreshold,
      requiredStableFrames: 3,
    });
    pitchEngineRef.current = engine;

    engine
      .start({
        onFrame: (analysis) => {
          setRms(analysis.rms);
          if (analysis.activeMidi !== null) {
            setHeardNote(Note.fromMidi(analysis.activeMidi) || '');
          }
          if (
            !completedRef.current &&
            analysis.activeMidi !== null &&
            analysis.pitchHz !== null &&
            analysis.clarity >= settings.micClarityThreshold
          ) {
            samplesRef.current.push({
              pitchHz: analysis.pitchHz,
              clarity: analysis.clarity,
            });
            if (samplesRef.current.length >= 4) {
              const outcome = evaluateCalibrationSamples(samplesRef.current, 'G4');
              if (outcome.matchedTarget) {
                completedRef.current = true;
                onCalibrated({
                  calibrated: true,
                  referenceNote: 'G4',
                  centsOffset: outcome.centsOffset,
                  semitoneOffset: 0,
                });
              } else {
                if (outcome.heardNoteName) {
                  setStatusMessage(
                    `Heard ${outcome.heardNoteName} — play Treble G4 (2nd line)!`
                  );
                }
                samplesRef.current = [];
              }
            }
          }
        },
        onNoteDetected: () => {},
        onError: (msg) => setErrorMsg(msg),
      })
      .catch(() => {});

    return () => {
      engine.stop();
    };
  }, [
    settings.inputMode,
    settings.micSensitivity,
    settings.micClarityThreshold,
    onCalibrated,
  ]);

  // MIDI listener during calibration
  useEffect(() => {
    if (settings.inputMode !== 'midi') return;

    let unsubNote: (() => void) | undefined;
    let unsubDevices: (() => void) | undefined;

    midiEngine
      .enable()
      .then((devices) => {
        setErrorMsg(null);
        setMidiDevices(devices);
        unsubDevices = midiEngine.onDevicesChange((next) => setMidiDevices(next));
        unsubNote = midiEngine.onNoteOn((evt) => {
          setHeardNote(evt.noteName);
          if (evt.midi === 67) {
            onCalibrated({
              calibrated: true,
              referenceNote: 'G4',
              centsOffset: 0,
              semitoneOffset: 0,
            });
          } else {
            setStatusMessage(`Heard ${evt.noteName} via MIDI — press G4 (or Skip)!`);
          }
        });
      })
      .catch((err) => {
        setErrorMsg(err instanceof Error ? err.message : 'Unable to enable MIDI.');
      });

    return () => {
      unsubNote?.();
      unsubDevices?.();
    };
  }, [settings.inputMode, onCalibrated]);

  const handleSkip = () => {
    onCalibrated({
      calibrated: true,
      referenceNote: 'G4',
      centsOffset: 0,
      semitoneOffset: 0,
    });
  };

  return (
    <div className="relative flex h-[100dvh] w-full flex-col justify-between overflow-hidden p-4 sm:p-6">
      <ThemeBackdrop theme={theme} />

      {/* Top Bar */}
      <header className="relative z-10 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel calibration"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-lg hover:bg-white"
        >
          <X size={20} />
        </button>

        {/* Input Mode Switch */}
        <div className="flex rounded-full bg-slate-900/70 p-1 backdrop-blur border border-white/20">
          <button
            type="button"
            onClick={() => {
              setErrorMsg(null);
              setStatusMessage(null);
              onUpdateSettings({ inputMode: 'mic' });
            }}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-extrabold transition ${
              settings.inputMode === 'mic'
                ? 'bg-amber-300 text-slate-950'
                : 'text-white/80 hover:text-white'
            }`}
          >
            <Mic size={14} />
            <span>Microphone</span>
          </button>
          <button
            type="button"
            disabled={!midiSupported}
            onClick={() => {
              setErrorMsg(null);
              setStatusMessage(null);
              onUpdateSettings({ inputMode: 'midi' });
            }}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-extrabold transition ${
              !midiSupported
                ? 'cursor-not-allowed text-white/35'
                : settings.inputMode === 'midi'
                  ? 'bg-cyan-300 text-slate-950'
                  : 'text-white/80 hover:text-white'
            }`}
          >
            <Usb size={14} />
            <span>MIDI</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowHelp((v) => !v)}
          aria-label="Microphone & MIDI help"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-lg hover:bg-white"
        >
          <HelpCircle size={20} />
        </button>
      </header>

      {/* Center Staff with G4 Bubble */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center gap-3 overflow-hidden">
        <div className="h-[54dvh] w-full max-w-4xl">
          <StaffCanvas
            clefMode="treble"
            activeNote={{ note: 'G4', staff: 'treble' }}
            theme={theme}
            showLandmarks={settings.landmarkHints}
            calibrationPrompt="Play G to Start!"
          />
        </div>

        {statusMessage && (
          <div className="rounded-full bg-amber-300 px-4 py-1.5 text-xs font-extrabold text-slate-950 shadow-lg sm:text-sm">
            {statusMessage}
          </div>
        )}

        {errorMsg && (
          <div className="max-w-md rounded-2xl bg-rose-950/90 px-4 py-3 text-center text-xs font-bold text-rose-100 ring-1 ring-rose-400/40 shadow-xl">
            {errorMsg}
          </div>
        )}
      </main>

      {/* Bottom Meter & Skip Button */}
      <footer className="relative z-10 flex flex-col items-center gap-3 pb-1">
        {settings.inputMode === 'mic' ? (
          <MicMeter
            rms={rms}
            threshold={settings.micSensitivity}
            heardNote={heardNote}
          />
        ) : (
          <div className="rounded-full bg-slate-900/75 px-4 py-2 text-xs font-bold text-cyan-200 backdrop-blur border border-white/20">
            {midiDevices.length > 0
              ? `MIDI Ready: ${midiDevices.map((d) => d.name).join(', ')}`
              : 'Waiting for MIDI keyboard connection...'}
          </div>
        )}

        <button
          type="button"
          onClick={handleSkip}
          className="inline-flex items-center gap-2 rounded-full bg-white/95 px-5 py-2.5 text-xs font-extrabold text-slate-800 shadow-lg transition hover:scale-105 hover:bg-white sm:text-sm"
        >
          <span>Skip Calibration (Use Concert Pitch: A=440 Hz)</span>
          <SkipForward size={16} />
        </button>
      </footer>

      {/* Help Popover */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 text-slate-900 shadow-2xl">
            <h3 className="text-lg font-black">Calibration & Setup Tips</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li>
                <strong>1. Place device near the piano:</strong> On a music stand or piano lid works great.
              </li>
              <li>
                <strong>2. Acoustic pianos:</strong> Playing G4 lets KeyHop check your microphone volume and adjust for slightly sharp or flat tuning automatically.
              </li>
              <li>
                <strong>3. Digital pianos:</strong> Connect via USB MIDI (in Chrome, Edge, or Firefox) for instant, silent practice with headphones.
              </li>
            </ul>
            <button
              type="button"
              onClick={() => setShowHelp(false)}
              className="mt-5 w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white hover:bg-indigo-700"
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
