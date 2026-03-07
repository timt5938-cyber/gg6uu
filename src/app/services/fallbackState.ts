import type { AppState, SettingsState } from "../types/state";

const defaultSettings: SettingsState = {
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

export function createFallbackAppState(): AppState {
  const now = new Date().toISOString();

  return {
    profiles: [],
    activeProfileId: null,
    referenceIndex: {
      rootPath: "C:\\12\\reference",
      listsPath: "C:\\12\\reference\\lists",
      exists: false,
      scannedAt: now,
      totalFiles: 0,
      totalDirectories: 0,
      byExtension: {},
      files: [],
      readErrors: [],
    },
    connectionStatus: "unknown",
    trafficStats: {
      downloadMbps: 0,
      uploadMbps: 0,
      latencyMs: 0,
      stabilityScore: 0,
    },
    diagnostics: [
      {
        id: "diag-bridge-unavailable",
        severity: "error",
        title: "Electron bridge unavailable",
        message: "Renderer is running without preload IPC bridge. Real DPI data is unavailable.",
        timestamp: now,
        source: "renderer",
      },
    ],
    logs: [
      {
        id: "log-bridge-unavailable",
        timestamp: now,
        level: "error",
        source: "renderer",
        message: "Electron API bridge is not available.",
      },
    ],
    settings: defaultSettings,
    runtime: {
      loading: false,
      error: "Electron bridge unavailable",
      lastAnalysisAt: null,
      referenceAvailable: false,
      autoRefreshEnabled: defaultSettings.autoRefresh,
      watcherActive: false,
      isRunning: false,
      isTesting: false,
      activeProfileId: null,
      activePid: null,
      activeStartedAt: null,
      lastStoppedAt: null,
      lastExitCode: null,
      stopRequested: false,
      testAllInProgress: false,
      testQueue: [],
      testResults: {},
      lastRuntimeError: "Electron bridge unavailable",
      lastRuntimeEvent: "fallback-mode",
      lastSuccessfulProfileId: null,
      lastLaunchAt: null,
      launchSuccessCount: 0,
      launchFailureCount: 0,
      switchCount: 0,
      activeServiceResults: {
        youtube: "not_tested",
        discord: "not_tested",
      },
    },
    dpiBypassState: {
      enabled: false,
      activeProfileId: null,
      activeBypassMode: null,
      activeRouteType: null,
      availableScenarios: [],
      healthyProfiles: 0,
      unstableProfiles: 0,
    },
    routingProfileState: {
      activeRouteId: null,
      availableRoutes: [],
      fallbackRouteId: null,
      lastSwitchAt: null,
    },
    ipLists: [],
    referenceSummary: {
      referenceExists: false,
      fileCount: 0,
      profileCount: 0,
      ipListCount: 0,
      readErrorCount: 0,
      lastSuccessfulAnalysisAt: null,
      dataAvailable: false,
      warnings: ["Reference data unavailable: IPC bridge missing."],
    },
    speedHistory: [],
    stabilityHistory: [],
    switchHistory: [],
    systemWarnings: ["Fallback mode: no Electron bridge"],
  };
}

export const defaultRendererSettings = defaultSettings;



