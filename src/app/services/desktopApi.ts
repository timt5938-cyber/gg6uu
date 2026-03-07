import type {
  AppState,
  DiagnosticEntry,
  DpiBypassState,
  IpListReference,
  LogEntry,
  Profile,
  ReferenceSummary,
  SettingsState,
} from "../types/state";
import { createFallbackAppState, defaultRendererSettings } from "./fallbackState";

function fallbackWithError(message: string): AppState {
  const base = createFallbackAppState();
  const now = new Date().toISOString();
  return {
    ...base,
    runtime: {
      ...base.runtime,
      error: message,
    },
    diagnostics: [
      {
        id: `diag-${now}`,
        severity: "error",
        title: "Electron bridge unavailable",
        message,
        timestamp: now,
        source: "renderer",
      },
    ],
    logs: [
      {
        id: `log-${now}`,
        timestamp: now,
        level: "error",
        source: "renderer",
        message,
      },
    ],
  };
}

function ensureSettings(settings: Partial<SettingsState> | undefined): SettingsState {
  return {
    ...defaultRendererSettings,
    ...(settings ?? {}),
  };
}

function bridgeMissingMessage(): string {
  return "Electron preload bridge is missing. Run in Electron mode (not browser preview).";
}

export const desktopApi = {
  hasBridge(): boolean {
    return typeof window !== "undefined" && Boolean(window.electronAPI);
  },

  async getAppState(): Promise<AppState> {
    if (!window.electronAPI) {
      return fallbackWithError(bridgeMissingMessage());
    }
    return window.electronAPI.getAppState();
  },

  async scanReference(): Promise<AppState> {
    if (!window.electronAPI) {
      return fallbackWithError(bridgeMissingMessage());
    }
    return window.electronAPI.scanReference();
  },

  async getProfiles(): Promise<Profile[]> {
    if (!window.electronAPI) {
      return [];
    }
    return window.electronAPI.getProfiles();
  },

  async getLogs(): Promise<LogEntry[]> {
    if (!window.electronAPI) {
      return [];
    }
    return window.electronAPI.getLogs();
  },

  async clearLogs(): Promise<LogEntry[]> {
    if (!window.electronAPI) {
      return [];
    }
    return window.electronAPI.clearLogs();
  },

  async getSettings(): Promise<SettingsState> {
    if (!window.electronAPI) {
      return defaultRendererSettings;
    }
    return window.electronAPI.getSettings();
  },

  async setSettings(settings: Partial<SettingsState>): Promise<SettingsState> {
    if (!window.electronAPI) {
      return ensureSettings(settings);
    }
    return window.electronAPI.setSettings(settings);
  },

  async setActiveProfile(profileId: string): Promise<AppState> {
    if (!window.electronAPI) {
      return fallbackWithError(`${bridgeMissingMessage()} Cannot activate profile: ${profileId}`);
    }
    return window.electronAPI.setActiveProfile(profileId);
  },

  async setBypassEnabled(enabled: boolean): Promise<AppState> {
    if (!window.electronAPI) {
      return fallbackWithError(`${bridgeMissingMessage()} Cannot set bypass enabled=${enabled}.`);
    }
    return window.electronAPI.setBypassEnabled(enabled);
  },

  async testAllProfiles(): Promise<AppState> {
    if (!window.electronAPI) {
      return fallbackWithError(`${bridgeMissingMessage()} Cannot run Test All.`);
    }
    return window.electronAPI.testAllProfiles();
  },

  async getRuntimeState(): Promise<AppState["runtime"]> {
    if (!window.electronAPI) {
      return createFallbackAppState().runtime;
    }
    return window.electronAPI.getRuntimeState();
  },

  async restartAnalysis(): Promise<AppState> {
    if (!window.electronAPI) {
      return fallbackWithError(bridgeMissingMessage());
    }
    return window.electronAPI.restartAnalysis();
  },

  async openReferenceFolder(): Promise<string> {
    if (!window.electronAPI) {
      return "";
    }
    return window.electronAPI.openReferenceFolder();
  },

  async getDpiBypassState(): Promise<DpiBypassState> {
    if (!window.electronAPI) {
      return createFallbackAppState().dpiBypassState;
    }
    return window.electronAPI.getDpiBypassState();
  },

  async getDiagnostics(): Promise<DiagnosticEntry[]> {
    if (!window.electronAPI) {
      return createFallbackAppState().diagnostics;
    }
    return window.electronAPI.getDiagnostics();
  },

  async getReferenceSummary(): Promise<ReferenceSummary> {
    if (!window.electronAPI) {
      return createFallbackAppState().referenceSummary;
    }
    return window.electronAPI.getReferenceSummary();
  },

  async getIpLists(): Promise<IpListReference[]> {
    if (!window.electronAPI) {
      return [];
    }
    return window.electronAPI.getIpLists();
  },

  async getServiceStatus(): Promise<{ installed: boolean; running: boolean; rawOutput: string; rawError: string }> {
    if (!window.electronAPI) {
      return { installed: false, running: false, rawOutput: "", rawError: "Bridge unavailable" };
    }
    return window.electronAPI.getServiceStatus();
  },

  async installService(profileId: string): Promise<{ success: boolean; message: string; status: { installed: boolean; running: boolean; rawOutput: string; rawError: string } }> {
    if (!window.electronAPI) {
      return {
        success: false,
        message: bridgeMissingMessage(),
        status: { installed: false, running: false, rawOutput: "", rawError: bridgeMissingMessage() },
      };
    }
    return window.electronAPI.installService(profileId);
  },

  async removeService(): Promise<{ success: boolean; message: string; status: { installed: boolean; running: boolean; rawOutput: string; rawError: string } }> {
    if (!window.electronAPI) {
      return {
        success: false,
        message: bridgeMissingMessage(),
        status: { installed: false, running: false, rawOutput: "", rawError: bridgeMissingMessage() },
      };
    }
    return window.electronAPI.removeService();
  },

  async minimizeWindow(): Promise<void> {
    await window.electronAPI?.minimizeWindow();
  },

  async maximizeWindow(): Promise<boolean> {
    if (!window.electronAPI) {
      return false;
    }
    return window.electronAPI.maximizeWindow();
  },

  async closeWindow(): Promise<void> {
    await window.electronAPI?.closeWindow();
  },

  onStateUpdated(callback: (state: AppState) => void): () => void {
    if (!window.electronAPI) {
      return () => undefined;
    }
    return window.electronAPI.onStateUpdated(callback);
  },
};


