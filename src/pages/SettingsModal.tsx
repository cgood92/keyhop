import { Mic, RotateCcw, Usb, X } from 'lucide-react';
import type { MidiDeviceInfo } from '../midi/MidiEngine';
import { isWebMidiSupported } from '../midi/MidiEngine';
import type { CalibrationState, GameSettings } from '../music/types';

interface SettingsModalProps {
  settings: GameSettings;
  calibration: CalibrationState;
  midiDevices: MidiDeviceInfo[];
  onUpdateSettings: (partial: Partial<GameSettings>) => void;
  onResetCalibration: () => void;
  onResetProgress: () => void;
  onClose: () => void;
}

export function SettingsModal({
  settings,
  calibration,
  midiDevices,
  onUpdateSettings,
  onResetCalibration,
  onResetProgress,
  onClose,
}: SettingsModalProps) {
  const midiSupported = isWebMidiSupported();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-3 backdrop-blur-sm sm:p-6">
      <div className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white text-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-xl font-black">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {/* Input Source */}
          <section className="space-y-2">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
              Piano Input Method
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onUpdateSettings({ inputMode: 'mic' })}
                className={`flex items-center justify-center gap-2 rounded-2xl border-2 py-3 text-sm font-bold transition ${
                  settings.inputMode === 'mic'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Mic size={18} />
                <span>Microphone</span>
              </button>
              <button
                type="button"
                disabled={!midiSupported}
                onClick={() => onUpdateSettings({ inputMode: 'midi' })}
                className={`flex items-center justify-center gap-2 rounded-2xl border-2 py-3 text-sm font-bold transition ${
                  !midiSupported
                    ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                    : settings.inputMode === 'midi'
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Usb size={18} />
                <span>MIDI Cable</span>
              </button>
            </div>
            {!midiSupported && (
              <p className="text-xs font-medium text-amber-700">
                Web MIDI requires Chrome, Edge, or Firefox on desktop (or Chrome on Android). Safari/iOS supports Microphone mode natively.
              </p>
            )}
            {settings.inputMode === 'midi' && midiSupported && (
              <div className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
                {midiDevices.length > 0
                  ? `Connected MIDI: ${midiDevices.map((d) => d.name).join(', ')}`
                  : 'No MIDI keyboard detected yet. Plug in USB MIDI and press Play.'}
              </div>
            )}
          </section>

          {/* Gameplay Toggles */}
          <section className="space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
              Practice & Scoring
            </h3>

            {[
              {
                key: 'landmarkHints' as const,
                label: 'Show Landmark Hints',
                desc: 'Highlight Bass C, Bass F, Middle C, Treble G, and Treble C on the staff',
              },
              {
                key: 'hideTimer' as const,
                label: 'Hide Timer (Relax Mode)',
                desc: 'Practice calmly without a visible stopwatch',
              },
              {
                key: 'penalizeWrongNotes' as const,
                label: 'Penalize Incorrect Guesses',
                desc: 'Add time penalty when a wrong piano key is played',
              },
              {
                key: 'strictOctave' as const,
                label: 'Require Exact Octave',
                desc: 'Enforce playing the right octave (turn off only for tiny 25-key keyboards)',
              },
              {
                key: 'soundEffects' as const,
                label: 'Theme Sound Effects',
                desc: 'Play chimes, pops, and celebration fanfare',
              },
            ].map((item) => (
              <label
                key={item.key}
                className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-slate-200 p-3 hover:bg-slate-50"
              >
                <div>
                  <div className="text-sm font-bold text-slate-800">{item.label}</div>
                  <div className="text-xs text-slate-500">{item.desc}</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings[item.key]}
                  onChange={(e) => onUpdateSettings({ [item.key]: e.target.checked })}
                  className="h-5 w-5 accent-indigo-600"
                />
              </label>
            ))}

            {settings.penalizeWrongNotes && (
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-2.5">
                <span className="text-xs font-bold text-slate-700">Penalty per wrong note</span>
                <div className="flex gap-1.5">
                  {[1, 2, 3].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => onUpdateSettings({ penaltySeconds: sec })}
                      className={`rounded-lg px-3 py-1 text-xs font-bold ${
                        settings.penaltySeconds === sec
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white text-slate-600 ring-1 ring-slate-200'
                      }`}
                    >
                      +{sec}s
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Microphone Sensitivity */}
          <section className="space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
              Microphone Tuning
            </h3>
            <div className="rounded-2xl border border-slate-200 p-3.5 space-y-3">
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700">
                  <span>Noise Gate (Lower = hears softer playing)</span>
                  <span>{Math.round(settings.micSensitivity * 1000)}</span>
                </div>
                <input
                  type="range"
                  min={0.001}
                  max={0.025}
                  step={0.0005}
                  value={settings.micSensitivity}
                  onChange={(e) =>
                    onUpdateSettings({ micSensitivity: Number(e.target.value) })
                  }
                  className="mt-1.5 w-full accent-indigo-600"
                />
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-600">
                  Calibration:{' '}
                  {calibration.calibrated
                    ? `${calibration.centsOffset >= 0 ? '+' : ''}${calibration.centsOffset} cents`
                    : 'Default A=440 Hz'}
                </span>
                <button
                  type="button"
                  onClick={onResetCalibration}
                  className="inline-flex items-center gap-1 font-bold text-indigo-600 hover:underline"
                >
                  <RotateCcw size={13} />
                  <span>Recalibrate</span>
                </button>
              </div>
            </div>
          </section>

          {/* Reset Progress */}
          <div className="pt-1 text-center">
            <button
              type="button"
              onClick={onResetProgress}
              className="text-xs font-bold text-rose-600 hover:underline"
            >
              Reset All Stars & Best Times
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
