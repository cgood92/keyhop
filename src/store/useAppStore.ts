import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { BUILT_IN_LEVELS } from '../music/builtInLevels';
import type {
  CalibrationState,
  GameSettings,
  LevelBestRecord,
  LevelDefinition,
  RoundResult,
  ThemeId,
} from '../music/types';

interface AppState {
  selectedLevelId: string;
  theme: ThemeId;
  customLevels: LevelDefinition[];
  bestRecords: Record<string, LevelBestRecord>;
  settings: GameSettings;
  calibration: CalibrationState;

  setSelectedLevelId: (id: string) => void;
  setTheme: (theme: ThemeId) => void;
  saveCustomLevel: (level: LevelDefinition) => void;
  deleteCustomLevel: (id: string) => void;
  recordRoundResult: (result: RoundResult) => void;
  updateSettings: (partial: Partial<GameSettings>) => void;
  setCalibration: (partial: Partial<CalibrationState>) => void;
  resetAllProgress: () => void;
}

const DEFAULT_SETTINGS: GameSettings = {
  inputMode: 'mic',
  selectedMidiInputId: null,
  hideTimer: false,
  landmarkHints: false,
  penalizeWrongNotes: true,
  penaltySeconds: 2.0,
  strictOctave: true,
  soundEffects: true,
  micSensitivity: 0.008,
  micClarityThreshold: 0.8,
};

const DEFAULT_CALIBRATION: CalibrationState = {
  calibrated: false,
  referenceNote: 'G4',
  centsOffset: 0,
  semitoneOffset: 0,
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      selectedLevelId: BUILT_IN_LEVELS[1].id, // Level 1: Starter
      theme: 'fruit-smash',
      customLevels: [],
      bestRecords: {},
      settings: DEFAULT_SETTINGS,
      calibration: DEFAULT_CALIBRATION,

      setSelectedLevelId: (id) => set({ selectedLevelId: id }),

      setTheme: (theme) => set({ theme }),

      saveCustomLevel: (level) =>
        set((state) => {
          const exists = state.customLevels.some((l) => l.id === level.id);
          const customLevels = exists
            ? state.customLevels.map((l) => (l.id === level.id ? level : l))
            : [level, ...state.customLevels];
          return { customLevels, selectedLevelId: level.id };
        }),

      deleteCustomLevel: (id) =>
        set((state) => {
          const customLevels = state.customLevels.filter((l) => l.id !== id);
          const nextSelected =
            state.selectedLevelId === id ? BUILT_IN_LEVELS[1].id : state.selectedLevelId;
          const { [id]: _removed, ...restRecords } = state.bestRecords;
          return {
            customLevels,
            selectedLevelId: nextSelected,
            bestRecords: restRecords,
          };
        }),

      recordRoundResult: (result) => {
        const existing = get().bestRecords[result.levelId];
        const nextBestTime =
          existing === undefined
            ? result.effectiveTimeSeconds
            : Math.min(existing.bestTimeSeconds, result.effectiveTimeSeconds);
        const nextStars =
          existing === undefined ? result.stars : Math.max(existing.bestStars, result.stars);
        const nextDiamond = (existing?.diamondPerfect ?? false) || result.diamondPerfect;

        set((state) => ({
          bestRecords: {
            ...state.bestRecords,
            [result.levelId]: {
              levelId: result.levelId,
              bestTimeSeconds: nextBestTime,
              bestStars: nextStars,
              diamondPerfect: nextDiamond,
              updatedAt: Date.now(),
            },
          },
        }));
      },

      updateSettings: (partial) =>
        set((state) => ({
          settings: { ...state.settings, ...partial },
        })),

      setCalibration: (partial) =>
        set((state) => ({
          calibration: { ...state.calibration, ...partial },
        })),

      resetAllProgress: () =>
        set({
          bestRecords: {},
          calibration: DEFAULT_CALIBRATION,
        }),
    }),
    {
      name: 'keyhop-storage-v1',
      version: 3,
      migrate: (persistedState: unknown, version: number) => {
        const state = (persistedState ?? {}) as Partial<AppState>;
        if (!state.settings) return state;

        let nextSettings = state.settings;
        if (version < 2) {
          nextSettings = {
            ...DEFAULT_SETTINGS,
            ...nextSettings,
            micSensitivity: 0.008,
            micClarityThreshold: 0.8,
          };
        } else if (version < 3) {
          nextSettings = {
            ...DEFAULT_SETTINGS,
            ...nextSettings,
            micSensitivity:
              nextSettings.micSensitivity <= 0.005
                ? 0.008
                : nextSettings.micSensitivity,
          };
        }
        return {
          ...state,
          settings: nextSettings,
        };
      },
    }
  )
);

export function findLevelById(
  levelId: string,
  customLevels: LevelDefinition[]
): LevelDefinition {
  return (
    customLevels.find((l) => l.id === levelId) ??
    BUILT_IN_LEVELS.find((l) => l.id === levelId) ??
    BUILT_IN_LEVELS[1]
  );
}
