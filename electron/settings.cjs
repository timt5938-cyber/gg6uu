const ElectronStoreModule = require("electron-store");
const Store = ElectronStoreModule.default || ElectronStoreModule;

const defaultSettings = {
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

function createSettingsStore() {
  return new Store({
    name: "dpi-bypass-settings",
    defaults: defaultSettings,
    clearInvalidConfig: true,
  });
}

function readSettings(store) {
  return {
    ...defaultSettings,
    ...store.store,
  };
}

function updateSettings(store, patch) {
  const next = {
    ...readSettings(store),
    ...(patch || {}),
  };

  store.set(next);
  return next;
}

module.exports = {
  createSettingsStore,
  defaultSettings,
  readSettings,
  updateSettings,
};