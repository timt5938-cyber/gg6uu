import Store from "electron-store";
import type { SettingsState } from "../src/app/types/state";

export const defaultSettings: SettingsState = {
  theme: "dark",
  compactMode: false,
  autoRefresh: true,
  refreshIntervalSec: 30,
  startMinimized: false,
  logLevel: "info",
  preferredProfile: null,
  rememberLastActiveProfile: true,
  autoScanReferenceOnStartup: true,
  diagnosticsVerbosity: "normal",
};

export type SettingsStore = Store<SettingsState>;

export function createSettingsStore(): SettingsStore {
  return new Store<SettingsState>({
    name: "dpi-bypass-settings",
    defaults: defaultSettings,
    clearInvalidConfig: true,
  });
}

export function readSettings(store: SettingsStore): SettingsState {
  return {
    ...defaultSettings,
    ...store.store,
  };
}

export function updateSettings(store: SettingsStore, patch: Partial<SettingsState>): SettingsState {
  const next: SettingsState = {
    ...readSettings(store),
    ...patch,
  };

  store.set(next);
  return next;
}
