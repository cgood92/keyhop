import { useCallback, useEffect, useState } from 'react';
import { useFullscreen } from './hooks/useFullscreen';
import { isWebMidiSupported, midiEngine } from './midi/MidiEngine';
import type { MidiDeviceInfo } from './midi/MidiEngine';
import { decodeLevelFromParam } from './music/levelShare';
import type { LevelDefinition, RoundResult } from './music/types';
import { CalibrationView } from './pages/CalibrationView';
import { GameplayView } from './pages/GameplayView';
import { HomeView } from './pages/HomeView';
import { LevelDesignerView } from './pages/LevelDesignerView';
import { LevelDetailView } from './pages/LevelDetailView';
import { LevelSelectModal } from './pages/LevelSelectModal';
import { ResultsView } from './pages/ResultsView';
import { SettingsModal } from './pages/SettingsModal';
import { findLevelById, useAppStore } from './store/useAppStore';

type Screen = 'home' | 'detail' | 'designer' | 'calibration' | 'playing' | 'results';

function readSharedLevelFromUrl(): LevelDefinition | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const encoded = params.get('level');
  return encoded ? decodeLevelFromParam(encoded) : null;
}

export default function App() {
  const {
    selectedLevelId,
    theme,
    customLevels,
    bestRecords,
    settings,
    calibration,
    setSelectedLevelId,
    setTheme,
    saveCustomLevel,
    deleteCustomLevel,
    recordRoundResult,
    updateSettings,
    setCalibration,
    resetAllProgress,
  } = useAppStore();

  const [initialSharedLevel] = useState<LevelDefinition | null>(() =>
    readSharedLevelFromUrl()
  );
  const [screen, setScreen] = useState<Screen>(() =>
    initialSharedLevel ? 'detail' : 'home'
  );
  const [showLevelSelect, setShowLevelSelect] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [inspectedLevel, setInspectedLevel] = useState<LevelDefinition | null>(
    () => initialSharedLevel
  );
  const [designerSeed, setDesignerSeed] = useState<LevelDefinition | null>(null);
  const [lastResult, setLastResult] = useState<RoundResult | null>(null);
  const [roundNonce, setRoundNonce] = useState(0);
  const [midiDevices, setMidiDevices] = useState<MidiDeviceInfo[]>([]);

  const {
    isFullscreen,
    isSupported: isFullscreenSupported,
    toggleFullscreen,
    acquireWakeLock,
    releaseWakeLock,
  } = useFullscreen();

  const activeLevel = findLevelById(selectedLevelId, customLevels);

  // Persist imported URL level and clean up query string once on mount
  useEffect(() => {
    if (!initialSharedLevel) return;
    saveCustomLevel(initialSharedLevel);
    const params = new URLSearchParams(window.location.search);
    params.delete('level');
    const nextSearch = params.toString();
    const cleanUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`;
    window.history.replaceState({}, '', cleanUrl);
  }, [initialSharedLevel, saveCustomLevel]);

  // Global 'F' shortcut for fullscreen when not typing
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if ((e.key === 'f' || e.key === 'F') && isFullscreenSupported) {
        e.preventDefault();
        void toggleFullscreen();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFullscreenSupported, toggleFullscreen]);

  // Query MIDI devices when settings modal opens with MIDI selected
  useEffect(() => {
    if (!showSettings || settings.inputMode !== 'midi' || !isWebMidiSupported()) return;
    let unsub: (() => void) | undefined;
    midiEngine
      .enable()
      .then((devices) => {
        setMidiDevices(devices);
        unsub = midiEngine.onDevicesChange((next) => setMidiDevices(next));
      })
      .catch(() => {});
    return () => {
      unsub?.();
    };
  }, [showSettings, settings.inputMode]);

  const startPlayFlow = useCallback(() => {
    setRoundNonce((n) => n + 1);
    if (settings.inputMode === 'mic' && !calibration.calibrated) {
      setScreen('calibration');
    } else {
      setScreen('playing');
    }
  }, [settings.inputMode, calibration.calibrated]);

  const handleRoundComplete = useCallback(
    (result: RoundResult) => {
      recordRoundResult(result);
      setLastResult(result);
      setScreen('results');
    },
    [recordRoundResult]
  );

  return (
    <div className="min-h-[100dvh] w-full select-none bg-slate-950">
      {screen === 'home' && (
        <HomeView
          theme={theme}
          activeLevel={activeLevel}
          bestRecord={bestRecords[activeLevel.id]}
          settings={settings}
          isFullscreen={isFullscreen}
          isFullscreenSupported={isFullscreenSupported}
          onToggleFullscreen={() => void toggleFullscreen()}
          onSelectTheme={setTheme}
          onPlay={startPlayFlow}
          onOpenLevels={() => setShowLevelSelect(true)}
          onOpenLevelDetails={() => {
            setInspectedLevel(activeLevel);
            setScreen('detail');
          }}
          onOpenSettings={() => setShowSettings(true)}
        />
      )}

      {screen === 'detail' && (inspectedLevel || activeLevel) && (
        <LevelDetailView
          level={inspectedLevel ?? activeLevel}
          onBack={() => setScreen('home')}
          onPlay={() => {
            const target = inspectedLevel ?? activeLevel;
            setSelectedLevelId(target.id);
            startPlayFlow();
          }}
          onEdit={() => {
            setDesignerSeed(inspectedLevel ?? activeLevel);
            setScreen('designer');
          }}
          onDelete={
            (inspectedLevel ?? activeLevel).category === 'custom'
              ? () => {
                  const target = inspectedLevel ?? activeLevel;
                  deleteCustomLevel(target.id);
                  setInspectedLevel(null);
                  setScreen('home');
                }
              : undefined
          }
        />
      )}

      {screen === 'designer' && (
        <LevelDesignerView
          initialLevel={designerSeed}
          onSave={(saved) => {
            saveCustomLevel(saved);
            setInspectedLevel(saved);
            setScreen('detail');
          }}
          onCancel={() => {
            setScreen(inspectedLevel ? 'detail' : 'home');
          }}
        />
      )}

      {screen === 'calibration' && (
        <CalibrationView
          theme={theme}
          settings={settings}
          onUpdateSettings={updateSettings}
          onCalibrated={(cal) => {
            setCalibration(cal);
            setScreen('playing');
          }}
          onCancel={() => setScreen('home')}
        />
      )}

      {screen === 'playing' && (
        <GameplayView
          key={`${activeLevel.id}-${roundNonce}`}
          level={activeLevel}
          theme={theme}
          settings={settings}
          calibration={calibration}
          previousBest={bestRecords[activeLevel.id]}
          isFullscreen={isFullscreen}
          isFullscreenSupported={isFullscreenSupported}
          onToggleFullscreen={() => void toggleFullscreen()}
          onAcquireWakeLock={() => void acquireWakeLock()}
          onReleaseWakeLock={() => void releaseWakeLock()}
          onToggleLandmarks={() =>
            updateSettings({ landmarkHints: !settings.landmarkHints })
          }
          onComplete={handleRoundComplete}
          onExit={() => setScreen('home')}
        />
      )}

      {screen === 'results' && lastResult && (
        <ResultsView
          theme={theme}
          result={lastResult}
          soundEffects={settings.soundEffects}
          onReplay={() => {
            setRoundNonce((n) => n + 1);
            setScreen('playing');
          }}
          onHome={() => setScreen('home')}
          onOpenLevels={() => {
            setScreen('home');
            setShowLevelSelect(true);
          }}
        />
      )}

      {/* Level Selection Modal */}
      {showLevelSelect && (
        <LevelSelectModal
          selectedLevelId={activeLevel.id}
          customLevels={customLevels}
          bestRecords={bestRecords}
          onSelectLevel={(level) => {
            setSelectedLevelId(level.id);
            setShowLevelSelect(false);
          }}
          onInspectLevel={(level) => {
            setSelectedLevelId(level.id);
            setInspectedLevel(level);
            setShowLevelSelect(false);
            setScreen('detail');
          }}
          onCreateCustom={() => {
            setDesignerSeed(null);
            setShowLevelSelect(false);
            setScreen('designer');
          }}
          onClose={() => setShowLevelSelect(false)}
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          settings={settings}
          calibration={calibration}
          midiDevices={midiDevices}
          onUpdateSettings={updateSettings}
          onResetCalibration={() => {
            setCalibration({ calibrated: false, centsOffset: 0, semitoneOffset: 0 });
            setShowSettings(false);
            setScreen('calibration');
          }}
          onResetProgress={resetAllProgress}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
