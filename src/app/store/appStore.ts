import { create } from "zustand";
import type { AppState, SettingsState } from "../types/state";
import { desktopApi } from "../services/desktopApi";
import { createFallbackAppState } from "../services/fallbackState";

interface AppStore {
  appState: AppState;
  loading: boolean;
  error: string | null;
  initialized: boolean;
  initialize: () => Promise<void>;
  refresh: () => Promise<void>;
  setActiveProfile: (profileId: string) => Promise<void>;
  setBypassEnabled: (enabled: boolean) => Promise<void>;
  testAllProfiles: () => Promise<void>;
  restartAnalysis: () => Promise<void>;
  updateSettings: (settings: Partial<SettingsState>) => Promise<void>;
  clearLogs: () => Promise<void>;
  openReferenceFolder: () => Promise<void>;
}

const fallbackState = createFallbackAppState();
let stopListener: (() => void) | null = null;

export const useAppStore = create<AppStore>((set, get) => ({
  appState: fallbackState,
  loading: false,
  error: null,
  initialized: false,

  async initialize() {
    if (get().initialized) {
      return;
    }

    set({ loading: true, error: null });
    if (!desktopApi.hasBridge()) {
      const state = createFallbackAppState();
      set({ appState: state, initialized: true, loading: false, error: state.runtime.error || "Electron bridge unavailable" });
      return;
    }
    try {
      const state = await desktopApi.getAppState();
      set({ appState: state, initialized: true, loading: false, error: null });

      if (!stopListener) {
        stopListener = desktopApi.onStateUpdated((nextState) => {
          set({ appState: nextState, loading: false, error: null });
        });
      }

      if (state.profiles.length === 0 && desktopApi.hasBridge()) {
        const scanned = await desktopApi.scanReference();
        set({ appState: scanned, loading: false, error: null });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to initialize application state";
      set({ loading: false, error: message, initialized: true });
    }
  },

  async refresh() {
    set({ loading: true, error: null });
    if (!desktopApi.hasBridge()) {
      const state = createFallbackAppState();
      set({ appState: state, initialized: true, loading: false, error: state.runtime.error || "Electron bridge unavailable" });
      return;
    }
    try {
      const state = await desktopApi.scanReference();
      set({ appState: state, loading: false, error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to scan reference folder";
      set({ loading: false, error: message });
    }
  },

  async setActiveProfile(profileId: string) {
    set({ loading: true, error: null });
    if (!desktopApi.hasBridge()) {
      const state = createFallbackAppState();
      set({ appState: state, initialized: true, loading: false, error: state.runtime.error || "Electron bridge unavailable" });
      return;
    }
    try {
      const state = await desktopApi.setActiveProfile(profileId);
      set({ appState: state, loading: false, error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to set active profile";
      set({ loading: false, error: message });
    }
  },

  async setBypassEnabled(enabled: boolean) {
    set({ loading: true, error: null });
    if (!desktopApi.hasBridge()) {
      const state = createFallbackAppState();
      set({ appState: state, initialized: true, loading: false, error: state.runtime.error || "Electron bridge unavailable" });
      return;
    }
    try {
      const state = await desktopApi.setBypassEnabled(enabled);
      set({ appState: state, loading: false, error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to change bypass state";
      set({ loading: false, error: message });
    }
  },

  async testAllProfiles() {
    set({ loading: true, error: null });
    if (!desktopApi.hasBridge()) {
      const state = createFallbackAppState();
      set({ appState: state, initialized: true, loading: false, error: state.runtime.error || "Electron bridge unavailable" });
      return;
    }
    try {
      const state = await desktopApi.testAllProfiles();
      set({ appState: state, loading: false, error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to run Test All";
      set({ loading: false, error: message });
    }
  },

  async restartAnalysis() {
    set({ loading: true, error: null });
    if (!desktopApi.hasBridge()) {
      const state = createFallbackAppState();
      set({ appState: state, initialized: true, loading: false, error: state.runtime.error || "Electron bridge unavailable" });
      return;
    }
    try {
      const state = await desktopApi.restartAnalysis();
      set({ appState: state, loading: false, error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to restart analysis";
      set({ loading: false, error: message });
    }
  },

  async updateSettings(settingsPatch) {
    try {
      const nextSettings = await desktopApi.setSettings(settingsPatch);
      set((state) => ({
        appState: {
          ...state.appState,
          settings: nextSettings,
          runtime: {
            ...state.appState.runtime,
            autoRefreshEnabled: nextSettings.autoRefresh,
          },
        },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save settings";
      set({ error: message });
    }
  },

  async clearLogs() {
    try {
      const logs = await desktopApi.clearLogs();
      set((state) => ({
        appState: {
          ...state.appState,
          logs,
        },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to clear logs";
      set({ error: message });
    }
  },

  async openReferenceFolder() {
    try {
      await desktopApi.openReferenceFolder();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to open reference folder";
      set({ error: message });
    }
  },
}));

export function stopAppStoreListener(): void {
  if (stopListener) {
    stopListener();
    stopListener = null;
  }
}




