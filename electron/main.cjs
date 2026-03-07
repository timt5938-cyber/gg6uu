const { app, BrowserWindow, ipcMain, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { exec, spawn } = require("node:child_process");

const { scanReference } = require("./analysis/engine.cjs");
const { createLogger } = require("./logger.cjs");
const { createSettingsStore, readSettings, updateSettings } = require("./settings.cjs");

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

function resolveReferenceRoot() {
  const envPath = (process.env.REFERENCE_ROOT || "").trim();
  const bundledReference = process.resourcesPath ? path.join(process.resourcesPath, "reference") : null;

  const candidates = isDev
    ? [
        envPath || null,
        "C:\\12\\reference",
        path.join(process.cwd(), "reference"),
        path.resolve(__dirname, "../reference"),
        bundledReference,
        path.join(path.dirname(process.execPath), "reference"),
      ]
    : [
        envPath || null,
        bundledReference,
        path.join(path.dirname(process.execPath), "resources", "reference"),
        path.join(path.dirname(process.execPath), "reference"),
        path.resolve(__dirname, "../reference"),
        "C:\\12\\reference",
        path.join(process.cwd(), "reference"),
      ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
        return candidate;
      }
    } catch {
      // Ignore invalid candidate and continue fallback chain.
    }
  }

  return bundledReference || envPath || "C:\\12\\reference";
}

const REFERENCE_ROOT = resolveReferenceRoot();

const settingsStore = createSettingsStore();
let settings = readSettings(settingsStore);
const logger = createLogger(settings.logLevel);

let mainWindow = null;
let referenceWatcher = null;
let watcherDebounceTimer = null;
let autoRefreshTimer = null;
let activeProfileProcess = null;
let activeProfileProcessId = null;

function emptyState() {
  return {
    profiles: [],
    activeProfileId: null,
    referenceIndex: {
      rootPath: REFERENCE_ROOT,
      listsPath: path.join(REFERENCE_ROOT, "lists"),
      exists: false,
      scannedAt: new Date().toISOString(),
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
    diagnostics: [],
    logs: [],
    settings,
    runtime: {
      loading: false,
      error: null,
      lastAnalysisAt: null,
      referenceAvailable: false,
      autoRefreshEnabled: settings.autoRefresh,
      watcherActive: false,
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
      warnings: ["Analysis not started"],
    },
    speedHistory: [],
    stabilityHistory: [],
    switchHistory: [],
    systemWarnings: [],
  };
}

let appState = emptyState();

function resolveConnectionStatus(activeProfile) {
  if (!activeProfile) {
    return "disconnected";
  }

  if (!activeProfile.isAvailable || activeProfile.status === "offline" || activeProfile.status === "error") {
    return "disconnected";
  }

  if (activeProfile.status === "unstable") {
    return "degraded";
  }

  return "connected";
}

function appendSwitchHistory(fromProfileName, toProfileName, reason) {
  if (!toProfileName || fromProfileName === toProfileName) {
    return;
  }

  const nextHistory = [
    {
      time: new Date().toISOString(),
      from: fromProfileName || "none",
      to: toProfileName,
      reason,
      duration: "0.2s",
    },
    ...appState.switchHistory,
  ];

  appState.switchHistory = nextHistory.slice(0, 20);
}

function commitAnalysis(result, reason) {
  const previousActive = appState.profiles.find((profile) => profile.id === appState.activeProfileId) || null;
  const nextActive = result.profiles.find((profile) => profile.id === result.activeProfileId) || null;

  if (nextActive && previousActive?.id !== nextActive.id) {
    appendSwitchHistory(previousActive?.name || null, nextActive.name, reason);
  } else if (appState.switchHistory.length === 0) {
    appState.switchHistory = result.switchHistory;
  }

  const availableRoutes = result.profiles.map((profile) => profile.id);
  const fallbackRoute = result.profiles.find((profile) => profile.status === "online") || null;

  appState = {
    ...appState,
    profiles: result.profiles,
    activeProfileId: result.activeProfileId,
    referenceIndex: result.referenceIndex,
    diagnostics: result.diagnostics,
    ipLists: result.ipLists,
    referenceSummary: result.referenceSummary,
    speedHistory: result.speedHistory,
    stabilityHistory: result.stabilityHistory,
    systemWarnings: result.warnings,
    settings,
    runtime: {
      loading: false,
      error: null,
      lastAnalysisAt: result.scannedAt,
      referenceAvailable: result.referenceIndex.exists,
      autoRefreshEnabled: settings.autoRefresh,
      watcherActive: Boolean(referenceWatcher),
    },
    dpiBypassState: {
      enabled: Boolean(nextActive),
      activeProfileId: nextActive?.id || null,
      activeBypassMode: nextActive?.bypassMode || null,
      activeRouteType: nextActive?.routeType || null,
      availableScenarios: Array.from(new Set(result.profiles.map((profile) => profile.bypassMode))),
      healthyProfiles: result.profiles.filter((profile) => profile.healthScore >= 70).length,
      unstableProfiles: result.profiles.filter((profile) => profile.status === "unstable").length,
    },
    routingProfileState: {
      activeRouteId: nextActive?.id || null,
      availableRoutes,
      fallbackRouteId: fallbackRoute?.id || null,
      lastSwitchAt: appState.switchHistory[0]?.time || null,
    },
    connectionStatus: resolveConnectionStatus(nextActive),
    trafficStats: {
      downloadMbps: nextActive?.downloadSpeed || 0,
      uploadMbps: nextActive?.uploadSpeed || 0,
      latencyMs: nextActive?.latency || 0,
      stabilityScore: nextActive?.stabilityScore || 0,
    },
  };

  appState.logs = logger.entries();
}

function broadcastState() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  mainWindow.webContents.send("app:stateUpdated", appState);
}

async function runScan(reason = "manual") {
  logger.info("ANALYSIS", `Reference scan started (${reason})`);
  appState.runtime.loading = true;
  appState.logs = logger.entries();
  broadcastState();

  try {
    const preferredProfileId = settings.rememberLastActiveProfile
      ? appState.activeProfileId || settings.preferredProfile
      : settings.preferredProfile;

    const result = scanReference(REFERENCE_ROOT, {
      preferredProfileId,
      previousActiveProfileId: appState.activeProfileId,
      previousSwitchHistory: appState.switchHistory,
    });

    commitAnalysis(result, reason);
    logger.info("ANALYSIS", `Reference scan finished. Profiles: ${result.profiles.length}, lists: ${result.ipLists.length}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown scan failure";
    logger.error("ANALYSIS", message);
    appState.runtime = {
      ...appState.runtime,
      loading: false,
      error: message,
    };
  }

  appState.logs = logger.entries();
  broadcastState();
  return appState;
}

function scheduleWatcherScan(changedPath) {
  if (watcherDebounceTimer) {
    clearTimeout(watcherDebounceTimer);
  }

  watcherDebounceTimer = setTimeout(() => {
    watcherDebounceTimer = null;
    void runScan(`watch:${changedPath || "unknown"}`);
  }, 700);
}

function stopWatcher() {
  if (referenceWatcher) {
    referenceWatcher.close();
    referenceWatcher = null;
    appState.runtime.watcherActive = false;
  }
}

function startWatcher() {
  stopWatcher();

  if (!fs.existsSync(REFERENCE_ROOT)) {
    logger.warn("WATCHER", `Reference path not found: ${REFERENCE_ROOT}`);
    appState.runtime.watcherActive = false;
    return;
  }

  try {
    referenceWatcher = fs.watch(REFERENCE_ROOT, { recursive: true }, (_eventType, fileName) => {
      scheduleWatcherScan(fileName || "unknown");
    });

    referenceWatcher.on("error", (error) => {
      logger.error("WATCHER", error.message);
    });

    appState.runtime.watcherActive = true;
    logger.info("WATCHER", `Watching reference folder: ${REFERENCE_ROOT}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start watcher";
    logger.error("WATCHER", message);
    appState.runtime.watcherActive = false;
  }
}

function stripWrappingQuotes(value) {
  let normalized = String(value || "").trim();

  for (let i = 0; i < 6; i += 1) {
    const before = normalized;
    normalized = normalized
      .replace(/^\\+"+/, "")
      .replace(/\\+"+$/, "")
      .replace(/^\\+'+/, "")
      .replace(/\\+'+$/, "")
      .replace(/^"+/, "")
      .replace(/"+$/, "")
      .replace(/^'+/, "")
      .replace(/'+$/, "")
      .trim();

    if (before === normalized) {
      break;
    }
  }

  return normalized.replace(/\\+"/g, '"').replace(/\\+'/g, "'");
}

function resolveStrategyPath(sourceFile) {
  const raw = String(sourceFile || "").trim().replace(/\\+"/g, '"');
  const normalized = path.normalize(stripWrappingQuotes(raw).replace(/["']+/g, ""));

  if (path.isAbsolute(normalized) && fs.existsSync(normalized)) {
    return normalized;
  }

  const baseName = path.basename(normalized).replace(/^"+|"+$/g, "");
  const fromReference = path.join(REFERENCE_ROOT, baseName);
  if (fs.existsSync(fromReference)) {
    return fromReference;
  }

  return normalized;
}

function applyAutoRefresh() {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }

  if (!settings.autoRefresh) {
    return;
  }

  const intervalMs = Math.max(5, Number(settings.refreshIntervalSec || 30)) * 1000;
  autoRefreshTimer = setInterval(() => {
    void runScan("timer");
  }, intervalMs);
}

function setActiveProfile(profileId, reason = "manual") {
  const currentActive = appState.profiles.find((profile) => profile.isActive) || null;
  let nextActive = null;

  appState.profiles = appState.profiles.map((profile) => {
    if (profile.id === profileId && profile.isAvailable) {
      nextActive = { ...profile, isActive: true, status: "active" };
      return nextActive;
    }

    if (profile.isActive) {
      return {
        ...profile,
        isActive: false,
        status: profile.isAvailable ? "online" : profile.status,
      };
    }

    return profile;
  });

  if (!nextActive) {
    throw new Error(`Profile is unavailable or not found: ${profileId}`);
  }

  appState.activeProfileId = profileId;
  appState.connectionStatus = resolveConnectionStatus(nextActive);
  appState.trafficStats = {
    downloadMbps: nextActive.downloadSpeed,
    uploadMbps: nextActive.uploadSpeed,
    latencyMs: nextActive.latency,
    stabilityScore: nextActive.stabilityScore,
  };
  appState.dpiBypassState = {
    ...appState.dpiBypassState,
    enabled: true,
    activeProfileId: nextActive.id,
    activeBypassMode: nextActive.bypassMode,
    activeRouteType: nextActive.routeType,
  };
  appState.routingProfileState = {
    ...appState.routingProfileState,
    activeRouteId: nextActive.id,
    lastSwitchAt: new Date().toISOString(),
  };

  appendSwitchHistory(currentActive?.name || null, nextActive.name, reason);

  if (settings.rememberLastActiveProfile) {
    settings = updateSettings(settingsStore, { preferredProfile: profileId });
    appState.settings = settings;
  }

  logger.info("ROUTING", `Active profile set to ${profileId}`);
  appState.logs = logger.entries();
  broadcastState();
  return appState;
}

async function stopBypassRuntime(reason = "manual") {
  if (activeProfileProcess) {
    try {
      if (activeProfileProcess.pid) {
        const killer = spawn("taskkill", ["/pid", String(activeProfileProcess.pid), "/t", "/f"], {
          shell: false,
          windowsHide: true,
        });
        await new Promise((resolve) => {
          killer.once("close", () => resolve());
          killer.once("error", () => resolve());
        });
      }
    } catch {
      // Best-effort process stop.
    }
  }

  activeProfileProcess = null;
  activeProfileProcessId = null;

  appState.dpiBypassState = {
    ...appState.dpiBypassState,
    enabled: false,
  };

  appState.connectionStatus = "disconnected";
  appState.trafficStats = {
    ...appState.trafficStats,
    downloadMbps: 0,
    uploadMbps: 0,
    latencyMs: 0,
  };

  appState.profiles = appState.profiles.map((profile) => ({
    ...profile,
    isActive: false,
    status: profile.isAvailable ? "online" : profile.status,
  }));

  logger.info("RUNTIME", `Bypass stopped (${reason})`);
  appState.logs = logger.entries();
  broadcastState();
  return appState;
}

async function startBypassRuntime(profileId) {
  const profile = appState.profiles.find((item) => item.id === (profileId || appState.activeProfileId)) || appState.profiles.find((item) => item.isAvailable);
  if (!profile) {
    throw new Error("No available profile to start");
  }

  setActiveProfile(profile.id, "start");

  if (activeProfileProcess && activeProfileProcessId === profile.id) {
    return appState;
  }

  if (activeProfileProcess) {
    await stopBypassRuntime("switch");
    setActiveProfile(profile.id, "start");
  }

  const sourceFileRaw = String(profile.sourceFile || "");
  const rawSourceFile = resolveStrategyPath(sourceFileRaw);
  const ext = path.extname(rawSourceFile).toLowerCase();
  const cwd = path.dirname(rawSourceFile);
  const winwsPath = path.join(REFERENCE_ROOT, "bin", "winws.exe");

  if (!fs.existsSync(rawSourceFile)) {
    throw new Error(`Strategy file not found: ${rawSourceFile}`);
  }
  if (!fs.existsSync(winwsPath)) {
    throw new Error(`winws.exe not found: ${winwsPath}`);
  }

  let command = rawSourceFile;
  let args = [];
  const isBatchProfile = ext === ".bat" || ext === ".cmd";

  logger.info("RUNTIME", `Starting strategy: ${profile.name}`);
  logger.info("RUNTIME", `sourceFile(raw): ${sourceFileRaw}`);
  logger.info("RUNTIME", `sourceFile(normalized): ${rawSourceFile}`);
  logger.info("RUNTIME", `Command: ${isBatchProfile ? "cmd.exe (exec)" : command}`);
  logger.info("RUNTIME", `Args: ${isBatchProfile ? "[]" : JSON.stringify(args)}`);
  logger.info("RUNTIME", `CWD: ${cwd}`);
  logger.info("RUNTIME", `winws exists: ${fs.existsSync(winwsPath) ? "yes" : "no"}`);

  const proc = isBatchProfile
    ? exec(`"${rawSourceFile}"`, {
        cwd,
        windowsHide: true,
        shell: "cmd.exe",
      })
    : spawn(command, args, {
        cwd,
        shell: false,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });

  activeProfileProcess = proc;
  activeProfileProcessId = profile.id;

  appState.dpiBypassState = {
    ...appState.dpiBypassState,
    enabled: true,
    activeProfileId: profile.id,
    activeBypassMode: profile.bypassMode,
    activeRouteType: profile.routeType,
  };

  appState.connectionStatus = resolveConnectionStatus(profile);

  proc.stdout?.on("data", (chunk) => {
    const text = chunk.toString().trim();
    if (text) {
      logger.info("RUNTIME", `[${profile.name}] ${text}`);
      appState.logs = logger.entries();
      broadcastState();
    }
  });

  proc.stderr?.on("data", (chunk) => {
    const text = chunk.toString().trim();
    if (text) {
      logger.warn("RUNTIME", `[${profile.name}] ${text}`);
      appState.logs = logger.entries();
      broadcastState();
    }
  });

  proc.on("exit", (code) => {
    if (activeProfileProcessId === profile.id) {
      activeProfileProcess = null;
      activeProfileProcessId = null;
      appState.dpiBypassState = { ...appState.dpiBypassState, enabled: false };
      appState.connectionStatus = "disconnected";
    }

    logger.info("RUNTIME", `[${profile.name}] exited with code ${code ?? -1}`);
    appState.logs = logger.entries();
    broadcastState();
  });

  proc.on("error", (error) => {
    logger.error("RUNTIME", `[${profile.name}] ${error.message}`);
    appState.runtime.error = error.message;
    appState.logs = logger.entries();
    broadcastState();
  });

  appState.logs = logger.entries();
  broadcastState();
  return appState;
}
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 960,
    minWidth: 1200,
    minHeight: 720,
    frame: false,
    backgroundColor: "#080808",
    show: false,
    title: "AltProxy",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      devTools: true,
    },
  });

  mainWindow.once("ready-to-show", () => {
    if (settings.startMinimized) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function registerIpc() {
  ipcMain.handle("app:getAppState", async () => appState);
  ipcMain.handle("app:scanReference", async () => runScan("ipc-scan"));
  ipcMain.handle("app:getProfiles", async () => appState.profiles);
  ipcMain.handle("app:getLogs", async () => appState.logs);
  ipcMain.handle("app:clearLogs", async () => {
    logger.clear();
    logger.info("LOG", "Log buffer cleared");
    appState.logs = logger.entries();
    broadcastState();
    return appState.logs;
  });
  ipcMain.handle("app:getSettings", async () => settings);
  ipcMain.handle("app:setSettings", async (_event, patch) => {
    settings = updateSettings(settingsStore, patch);
    logger.setLevel(settings.logLevel);
    applyAutoRefresh();
    appState.settings = settings;
    appState.runtime.autoRefreshEnabled = settings.autoRefresh;
    appState.logs = logger.entries();
    broadcastState();
    return settings;
  });
  ipcMain.handle("app:setActiveProfile", async (_event, profileId) => setActiveProfile(profileId, "ui"));
  ipcMain.handle("app:restartAnalysis", async () => runScan("restart"));
  ipcMain.handle("app:openReferenceFolder", async () => shell.openPath(REFERENCE_ROOT));
  ipcMain.handle("app:getDpiBypassState", async () => appState.dpiBypassState);
  ipcMain.handle("app:setBypassEnabled", async (_event, enabled) => {
    if (enabled) {
      return startBypassRuntime(appState.activeProfileId);
    }
    return stopBypassRuntime("stop-button");
  });
  ipcMain.handle("app:getDiagnostics", async () => appState.diagnostics);
  ipcMain.handle("app:getReferenceSummary", async () => appState.referenceSummary);
  ipcMain.handle("app:getIpLists", async () => appState.ipLists);

  ipcMain.handle("window:minimize", async () => {
    if (mainWindow) {
      mainWindow.minimize();
    }
  });

  ipcMain.handle("window:maximize", async () => {
    if (!mainWindow) {
      return false;
    }

    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
      return false;
    }

    mainWindow.maximize();
    return true;
  });

  ipcMain.handle("window:close", async () => {
    if (mainWindow) {
      mainWindow.close();
    }
  });

  ipcMain.handle("window:is-maximized", async () => {
    if (!mainWindow) {
      return false;
    }
    return mainWindow.isMaximized();
  });
}

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) {
  app.quit();
}

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  logger.info("BOOT", "Application started");
  registerIpc();
  createMainWindow();
  startWatcher();
  applyAutoRefresh();

  if (settings.autoScanReferenceOnStartup) {
    await runScan("startup");
  } else {
    appState.logs = logger.entries();
    broadcastState();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("before-quit", () => {
  void stopBypassRuntime("app-quit");
  stopWatcher();
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
  }
  if (watcherDebounceTimer) {
    clearTimeout(watcherDebounceTimer);
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});











