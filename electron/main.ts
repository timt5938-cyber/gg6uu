import {
  app,
  BrowserWindow,
  ipcMain,
  nativeTheme,
  Menu,
  Tray,
  nativeImage,
  shell,
} from "electron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ChildProcess, spawn, spawnSync } from "node:child_process";

import { scanReference } from "./analysisEngine";
import { createLogger } from "./logger";
import { createSettingsStore, readSettings, updateSettings } from "./settings";
import type {
  AppState,
  ConnectionStatus,
  LogLevel,
  Profile,
  SettingsState,
  SpeedHistoryPoint,
  StabilityHistoryPoint,
} from "../src/app/types/state";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const isDev = Boolean(VITE_DEV_SERVER_URL);
function resolveReferenceRoot(): string {
  const envPath = process.env.REFERENCE_ROOT?.trim();
  const bundledReference = process.resourcesPath ? path.join(process.resourcesPath, "reference") : null;

  const candidates = isDev
    ? [
        envPath,
        "C:\\12\\reference",
        path.join(process.cwd(), "reference"),
        path.resolve(__dirname, "../reference"),
        bundledReference,
        path.join(path.dirname(process.execPath), "reference"),
      ]
    : [
        envPath,
        bundledReference,
        path.join(path.dirname(process.execPath), "resources", "reference"),
        path.join(path.dirname(process.execPath), "reference"),
        path.resolve(__dirname, "../reference"),
        "C:\\12\\reference",
        path.join(process.cwd(), "reference"),
      ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

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

let mainWindow: BrowserWindow | null = null;
let miniWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

let referenceWatcher: fs.FSWatcher | null = null;
let watcherDebounceTimer: NodeJS.Timeout | null = null;
let autoRefreshTimer: NodeJS.Timeout | null = null;

const proxyProcesses = new Map<string, ChildProcess>();
let activeStrategyProcess: ChildProcess | null = null;
let activeStrategyProfileId: string | null = null;
let testAllCancelRequested = false;

function resolvePreloadPath(): string {
  const cjsPath = path.join(__dirname, "preload.cjs");
  if (fs.existsSync(cjsPath)) {
    return cjsPath;
  }

  const mjsPath = path.join(__dirname, "preload.mjs");
  if (fs.existsSync(mjsPath)) {
    return mjsPath;
  }

  return path.join(__dirname, "preload.js");
}

function createEmptyState(currentSettings: SettingsState): AppState {
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
    settings: currentSettings,
    runtime: {
      loading: false,
      error: null,
      lastAnalysisAt: null,
      referenceAvailable: false,
      autoRefreshEnabled: currentSettings.autoRefresh,
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
      lastRuntimeError: null,
      lastRuntimeEvent: null,
      lastSuccessfulProfileId: null,
      lastLaunchAt: null,
      launchSuccessCount: 0,
      launchFailureCount: 0,
      switchCount: 0,
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

let appState = createEmptyState(settings);

function resolveConnectionStatus(activeProfile: Profile | null, bypassEnabled: boolean): ConnectionStatus {
  if (!bypassEnabled || !activeProfile) {
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

function appendSwitchHistory(fromProfileName: string | null, toProfileName: string | null, reason: string): void {
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

  appState.switchHistory = nextHistory.slice(0, 50);
}

function getProfileById(profileId: string | null): Profile | null {
  if (!profileId) {
    return null;
  }
  return appState.profiles.find((profile) => profile.id === profileId) ?? null;
}

function mergeRuntimeProfile(scanProfile: Profile, previous?: Profile): Profile {
  return {
    ...scanProfile,
    runtimeStatus: previous?.runtimeStatus ?? (scanProfile.isAvailable ? "not_tested" : "failed"),
    lastTestResult: previous?.lastTestResult ?? "not_tested",
    lastTestAt: previous?.lastTestAt ?? null,
    lastSuccessAt: previous?.lastSuccessAt ?? null,
    lastFailureAt: previous?.lastFailureAt ?? null,
    lastExitCode: previous?.lastExitCode ?? null,
    launchCount: previous?.launchCount ?? 0,
    successCount: previous?.successCount ?? 0,
    failCount: previous?.failCount ?? 0,
    isWorkingForCurrentUser: previous?.isWorkingForCurrentUser ?? false,
  };
}

function patchProfile(profileId: string, patch: Partial<Profile>): void {
  appState.profiles = appState.profiles.map((profile) => (profile.id === profileId ? { ...profile, ...patch } : profile));
}
function pushRuntimeTelemetryPoint(): void {
  const timestamp = new Date().toISOString();
  const traffic = appState.trafficStats;
  const active = getProfileById(appState.activeProfileId);

  const speedPoint: SpeedHistoryPoint = {
    time: timestamp,
    download: traffic.downloadMbps,
    upload: traffic.uploadMbps,
    latency: traffic.latencyMs,
  };

  const stabilityPoint: StabilityHistoryPoint = {
    time: timestamp,
    stability: active?.stabilityScore ?? 0,
    quality: active?.healthScore ?? 0,
  };

  appState.speedHistory = [speedPoint, ...appState.speedHistory].slice(0, 200);
  appState.stabilityHistory = [stabilityPoint, ...appState.stabilityHistory].slice(0, 200);
}

function applyActiveProfileSelection(profileId: string, reason: string): Profile {
  const currentActive = appState.profiles.find((profile) => profile.isActive) || null;
  let nextActive: Profile | null = null;

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

  appState.activeProfileId = nextActive.id;
  appState.routingProfileState = {
    ...appState.routingProfileState,
    activeRouteId: nextActive.id,
    lastSwitchAt: new Date().toISOString(),
  };

  appState.dpiBypassState = {
    ...appState.dpiBypassState,
    activeProfileId: nextActive.id,
    activeBypassMode: nextActive.bypassMode,
    activeRouteType: nextActive.routeType,
  };

  appendSwitchHistory(currentActive?.name || null, nextActive.name, reason);
  if (currentActive?.id !== nextActive.id) {
    appState.runtime.switchCount += 1;
  }

  if (settings.rememberLastActiveProfile) {
    settings = updateSettings(settingsStore, { preferredProfile: profileId });
    appState.settings = settings;
  }

  return nextActive;
}

function commitAnalysis(result: ReturnType<typeof scanReference>, reason: string): void {
  const previousActive = getProfileById(appState.activeProfileId);
  const previousProfiles = new Map(appState.profiles.map((profile) => [profile.id, profile]));
  const mergedProfiles = result.profiles.map((profile) => mergeRuntimeProfile(profile, previousProfiles.get(profile.id)));
  const nextActiveFromScan = mergedProfiles.find((profile) => profile.id === result.activeProfileId) || null;

  if (nextActiveFromScan && previousActive?.id !== nextActiveFromScan.id) {
    appendSwitchHistory(previousActive?.name || null, nextActiveFromScan.name, reason);
  } else if (appState.switchHistory.length === 0) {
    appState.switchHistory = result.switchHistory;
  }

  const availableRoutes = mergedProfiles.map((profile) => profile.id);
  const fallbackRoute = mergedProfiles.find((profile) => profile.status === "online") || null;

  const preservedSpeedHistory = appState.speedHistory;
  const preservedStabilityHistory = appState.stabilityHistory;
  const bypassEnabled = appState.dpiBypassState.enabled;
  const previousRuntime = appState.runtime;

  appState = {
    ...appState,
    profiles: mergedProfiles,
    activeProfileId: result.activeProfileId,
    referenceIndex: result.referenceIndex,
    diagnostics: result.diagnostics,
    ipLists: result.ipLists,
    referenceSummary: result.referenceSummary,
    speedHistory: preservedSpeedHistory.length > 0 ? preservedSpeedHistory : result.speedHistory,
    stabilityHistory: preservedStabilityHistory.length > 0 ? preservedStabilityHistory : result.stabilityHistory,
    systemWarnings: result.warnings,
    settings,
    runtime: {
      ...previousRuntime,
      loading: false,
      error: null,
      lastAnalysisAt: result.scannedAt,
      referenceAvailable: result.referenceIndex.exists,
      autoRefreshEnabled: settings.autoRefresh,
      watcherActive: Boolean(referenceWatcher),
      activeProfileId: activeStrategyProfileId,
      activePid: activeStrategyProcess?.pid ?? null,
      isRunning: Boolean(activeStrategyProcess),
      lastRuntimeEvent: `analysis:${reason}`,
    },
    dpiBypassState: {
      enabled: bypassEnabled,
      activeProfileId: result.activeProfileId,
      activeBypassMode: nextActiveFromScan?.bypassMode || null,
      activeRouteType: nextActiveFromScan?.routeType || null,
      availableScenarios: Array.from(new Set(mergedProfiles.map((profile) => profile.bypassMode))),
      healthyProfiles: mergedProfiles.filter((profile) => profile.healthScore >= 70).length,
      unstableProfiles: mergedProfiles.filter((profile) => profile.status === "unstable").length,
    },
    routingProfileState: {
      activeRouteId: result.activeProfileId,
      availableRoutes,
      fallbackRouteId: fallbackRoute?.id || null,
      lastSwitchAt: appState.switchHistory[0]?.time || null,
    },
    connectionStatus: resolveConnectionStatus(nextActiveFromScan, bypassEnabled),
    trafficStats: {
      downloadMbps: bypassEnabled ? nextActiveFromScan?.downloadSpeed || 0 : 0,
      uploadMbps: bypassEnabled ? nextActiveFromScan?.uploadSpeed || 0 : 0,
      latencyMs: bypassEnabled ? nextActiveFromScan?.latency || 0 : 0,
      stabilityScore: nextActiveFromScan?.stabilityScore || 0,
    },
  };

  if (activeStrategyProfileId) {
    appState.profiles = appState.profiles.map((profile) => {
      if (profile.id === activeStrategyProfileId) {
        return { ...profile, isActive: true, status: "active", runtimeStatus: isTestRun ? "testing" : "active" };
      }
      if (profile.isActive) {
        return { ...profile, isActive: false, status: profile.isAvailable ? "online" : profile.status, runtimeStatus: profile.isWorkingForCurrentUser ? "working" : "stopped" };
      }
      return profile;
    });

    const runningProfile = getProfileById(activeStrategyProfileId);
    appState.activeProfileId = activeStrategyProfileId;
    appState.dpiBypassState = {
      ...appState.dpiBypassState,
      enabled: true,
      activeProfileId: activeStrategyProfileId,
      activeBypassMode: runningProfile?.bypassMode || null,
      activeRouteType: runningProfile?.routeType || null,
    };
    appState.connectionStatus = resolveConnectionStatus(runningProfile, true);
    appState.runtime.activeProfileId = activeStrategyProfileId;
    appState.runtime.isRunning = true;
  }

  appState.logs = logger.entries();
}

function broadcastState(): void {
  const targets = [mainWindow, miniWindow].filter(
    (windowRef): windowRef is BrowserWindow => Boolean(windowRef) && !windowRef.isDestroyed(),
  );

  for (const target of targets) {
    target.webContents.send("app:stateUpdated", appState);
  }
}

async function runScan(reason = "manual"): Promise<AppState> {
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
      lastRuntimeError: message,
      lastRuntimeEvent: "analysis:error",
    };
  }

  appState.logs = logger.entries();
  broadcastState();
  return appState;
}

function scheduleWatcherScan(changedPath: string): void {
  if (watcherDebounceTimer) {
    clearTimeout(watcherDebounceTimer);
  }

  watcherDebounceTimer = setTimeout(() => {
    watcherDebounceTimer = null;
    void runScan(`watch:${changedPath || "unknown"}`);
  }, 700);
}

function stopWatcher(): void {
  if (referenceWatcher) {
    referenceWatcher.close();
    referenceWatcher = null;
    appState.runtime.watcherActive = false;
  }
}

function startWatcher(): void {
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

    referenceWatcher.on("error", (error: Error) => {
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

function applyAutoRefresh(): void {
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

function tokenizeCommandLine(commandLine: string): string[] {
  const tokens = commandLine.match(/"[^"]*"|[^\s]+/g) || [];
  return tokens.map((token) => {
    if (token.length >= 2 && token.startsWith('"') && token.endsWith('"')) {
      return token.slice(1, -1);
    }
    return token;
  });
}

function stripWrappingQuotes(value: string): string {
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


function resolveStrategyPath(sourceFile: string): string {
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
function sanitizeWinwsFilterValue(raw: string): string {
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .join(",");
}

function normalizePortFilterArg(arg: string): string | null {
  const prefixes = ["--wf-tcp=", "--wf-udp=", "--filter-tcp=", "--filter-udp="];
  const matched = prefixes.find((prefix) => arg.startsWith(prefix));
  if (!matched) {
    return arg;
  }

  const value = sanitizeWinwsFilterValue(arg.slice(matched.length));
  if (!value) {
    return null;
  }

  return `${matched}${value}`;
}

function resolveGameFilters(scriptRoot: string): { tcp: string; udp: string } {
  const command = `call "${path.join(scriptRoot, "service.bat")}" load_game_filter >nul && echo TCP=%GameFilterTCP% && echo UDP=%GameFilterUDP%`;
  const result = spawnSync("cmd.exe", ["/d", "/s", "/c", command], {
    cwd: scriptRoot,
    shell: false,
    windowsHide: true,
    encoding: "utf8",
  });

  if (result.error) {
    return { tcp: "", udp: "" };
  }

  const stdout = String(result.stdout || "");
  const tcpMatch = stdout.match(/TCP=(.*)/i);
  const udpMatch = stdout.match(/UDP=(.*)/i);

  return {
    tcp: sanitizeWinwsFilterValue((tcpMatch?.[1] || "").trim()),
    udp: sanitizeWinwsFilterValue((udpMatch?.[1] || "").trim()),
  };
}


function trimPairedQuotes(raw: string): string {
  const value = raw.trim();
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }
  return value;
}

function normalizeWinwsArgs(tokens: string[]): string[] {
  const normalized: string[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.startsWith("--")) {
      const eqIndex = token.indexOf("=");
      if (eqIndex > -1) {
        const key = token.slice(0, eqIndex);
        const value = trimPairedQuotes(token.slice(eqIndex + 1));
        normalized.push(`${key}=${value}`);
        continue;
      }

      const next = tokens[index + 1];
      if (next && !next.startsWith("--")) {
        normalized.push(token, trimPairedQuotes(next));
        index += 1;
        continue;
      }
    }

    normalized.push(token);
  }

  return normalized;
}

function parseWinwsDirectSpawn(sourceFile: string): { command: string; args: string[]; cwd: string } | null {
  const ext = path.extname(sourceFile).toLowerCase();
  if (ext !== ".bat" && ext !== ".cmd") {
    return null;
  }

  let script = "";
  try {
    script = fs.readFileSync(sourceFile, "utf8");
  } catch {
    return null;
  }

  const lines = script.split(/\r?\n/);
  const startIndex = lines.findIndex((line) => /start\s+"[^"]*"\s+\/min\s+"%BIN%winws\.exe"/i.test(line));
  if (startIndex < 0) {
    return null;
  }

  const commandLines: string[] = [];
  for (let i = startIndex; i < lines.length; i += 1) {
    const raw = lines[i].trim();
    if (!raw) {
      break;
    }
    commandLines.push(raw.replace(/\^\s*$/, "").trim());
    if (!/\^\s*$/.test(raw)) {
      break;
    }
  }

  if (commandLines.length === 0) {
    return null;
  }

  const scriptRoot = path.dirname(sourceFile);
  const binPath = path.join(scriptRoot, "bin") + path.sep;
  const listsPath = path.join(scriptRoot, "lists") + path.sep;
  const gameFilters = resolveGameFilters(scriptRoot);

  const joined = commandLines
    .join(" ")
    .replace(/^start\s+"[^"]*"\s+\/min\s+/i, "")
    .replace(/%~dp0/gi, `${scriptRoot}${path.sep}`)
    .replace(/%BIN%/gi, binPath)
     .replace(/%LISTS%/gi, listsPath)
    .replace(/%GameFilterTCP%/gi, gameFilters.tcp)
    .replace(/%GameFilterUDP%/gi, gameFilters.udp)
    .trim();

  const tokens = normalizeWinwsArgs(tokenizeCommandLine(joined));
  if (tokens.length === 0) {
    return null;
  }

  const command = tokens[0];
  const args = tokens.slice(1).flatMap((arg) => {
    const normalizedPortFilter = normalizePortFilterArg(arg);
    if (normalizedPortFilter === null) {
      return [];
    }
    return [normalizedPortFilter];
  });
  if (!/winws\.exe$/i.test(command)) {
    return null;
  }

  return {
    command,
    args,
    cwd: scriptRoot,
  };
}
function buildProfileSpawn(profile: Profile): { command: string; args: string[]; cwd: string } {
  const sourceFile = resolveStrategyPath(profile.sourceFile);
  const cwd = path.dirname(sourceFile);
  const ext = path.extname(sourceFile).toLowerCase();

  if (ext === ".bat" || ext === ".cmd") {
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", `call "${sourceFile}"`],
      cwd,
    };
  }

  if (ext === ".ps1") {
    return {
      command: "powershell.exe",
      args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", sourceFile],
      cwd,
    };
  }

  return {
    command: sourceFile,
    args: [],
    cwd,
  };
}

function requiresElevation(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const anyErr = error as Error & { code?: string };
  const message = (anyErr.message || "").toLowerCase();
  return anyErr.code === "EACCES" || message.includes("requires elevation") || message.includes("access is denied");
}

async function startElevatedProcess(command: string, args: string[], cwd: string): Promise<boolean> {
  const escapedArgs = args.map((arg) => `'${arg.replace(/'/g, "''")}'`).join(",");
  const psScript = [
    "$ErrorActionPreference = 'Stop'",
    `$argList = @(${escapedArgs})`,
    `Start-Process -FilePath '${command.replace(/'/g, "''")}' -ArgumentList $argList -WorkingDirectory '${cwd.replace(/'/g, "''")}' -WindowStyle Minimized -Verb RunAs`,
  ].join("; ");

  return await new Promise<boolean>((resolve) => {
    const helper = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", psScript], {
      shell: false,
      windowsHide: false,
      stdio: "ignore",
      detached: true,
    });

    helper.once("error", () => resolve(false));
    helper.once("exit", (code) => resolve(code === 0));
  });
}
async function terminateProcessTree(proc: ChildProcess): Promise<void> {
  if (!proc.pid) {
    return;
  }

  await new Promise<void>((resolve) => {
    const killer = spawn("taskkill", ["/pid", String(proc.pid), "/t", "/f"], {
      shell: false,
      windowsHide: true,
    });
    killer.once("close", () => resolve());
    killer.once("error", () => {
      proc.kill("SIGTERM");
      resolve();
    });
  });
}

function attachStrategyListeners(profile: Profile, proc: ChildProcess, spawnConfig: { command: string; args: string[]; cwd: string }): void {
  proc.stdout?.on("data", (chunk: Buffer) => {
    const text = chunk.toString().trim();
    if (text) {
      logger.info("RUNTIME", `[${profile.name}] ${text}`);
      appState.logs = logger.entries();
      broadcastState();
    }
  });

  proc.stderr?.on("data", (chunk: Buffer) => {
    const text = chunk.toString().trim();
    if (text) {
      logger.warn("RUNTIME", `[${profile.name}] ${text}`);
      appState.logs = logger.entries();
      broadcastState();
    }
  });

  proc.on("error", async (error) => {
    if (requiresElevation(error) && /winws\.exe$/i.test(spawnConfig.command)) {
      logger.warn("RUNTIME", `[${profile.name}] elevation required, requesting UAC`);
      const elevated = await startElevatedProcess(spawnConfig.command, spawnConfig.args, spawnConfig.cwd);
      if (elevated) {
        activeStrategyProcess = null;
        activeStrategyProfileId = profile.id;
        appState.dpiBypassState = {
          ...appState.dpiBypassState,
          enabled: true,
          activeProfileId: profile.id,
          activeBypassMode: profile.bypassMode,
          activeRouteType: profile.routeType,
        };
        appState.connectionStatus = resolveConnectionStatus(profile, true);
        appState.runtime.error = null;
        logger.info("RUNTIME", `[${profile.name}] elevated start requested`);
      } else {
        activeStrategyProcess = null;
        activeStrategyProfileId = null;
        appState.runtime.error = "Elevation was denied or failed";
        logger.error("RUNTIME", `[${profile.name}] elevated start failed`);
      }

      appState.logs = logger.entries();
      broadcastState();
      return;
    }

    logger.error("RUNTIME", `[${profile.name}] process error: ${error.message}`);
    appState.runtime.error = error.message;
    appState.logs = logger.entries();
    broadcastState();
  });

  proc.on("exit", (code) => {
    const now = new Date().toISOString();
    const normalizedExitCode = typeof code === "number" ? code : -1;
    const wasStopRequested = appState.runtime.stopRequested || testAllCancelRequested;
    const isSuccess = normalizedExitCode === 0;

    if (activeStrategyProfileId === profile.id) {
      activeStrategyProcess = null;
      activeStrategyProfileId = null;

      appState.dpiBypassState = {
        ...appState.dpiBypassState,
        enabled: false,
      };
      appState.connectionStatus = "disconnected";
      appState.trafficStats = {
        downloadMbps: 0,
        uploadMbps: 0,
        latencyMs: 0,
        stabilityScore: appState.trafficStats.stabilityScore,
      };
    }

    const previous = getProfileById(profile.id);
    patchProfile(profile.id, {
      isActive: false,
      status: profile.isAvailable ? (isSuccess ? "online" : "error") : "offline",
      runtimeStatus: wasStopRequested ? "stopped" : isSuccess ? "working" : "failed",
      lastTestResult: wasStopRequested ? "stopped" : isSuccess ? "working" : "failed",
      lastTestAt: now,
      lastSuccessAt: isSuccess ? now : previous?.lastSuccessAt ?? null,
      lastFailureAt: !isSuccess && !wasStopRequested ? now : previous?.lastFailureAt ?? null,
      lastExitCode: normalizedExitCode,
      successCount: (previous?.successCount ?? 0) + (isSuccess ? 1 : 0),
      failCount: (previous?.failCount ?? 0) + (!isSuccess && !wasStopRequested ? 1 : 0),
      isWorkingForCurrentUser: isSuccess || Boolean(previous?.isWorkingForCurrentUser),
    });

    appState.runtime.lastExitCode = normalizedExitCode;
    appState.runtime.lastStoppedAt = now;
    appState.runtime.isRunning = false;
    appState.runtime.isTesting = false;
    appState.runtime.activePid = null;
    appState.runtime.activeProfileId = null;
    appState.runtime.lastRuntimeEvent = `[${profile.name}] exit:${normalizedExitCode}`;

    if (isSuccess) {
      appState.runtime.launchSuccessCount += 1;
      appState.runtime.lastSuccessfulProfileId = profile.id;
    } else if (!wasStopRequested) {
      appState.runtime.launchFailureCount += 1;
      appState.runtime.lastRuntimeError = `[${profile.name}] exit:${normalizedExitCode}`;
    }

    appState.runtime.stopRequested = false;

    logger.info("RUNTIME", `[${profile.name}] exited with code ${normalizedExitCode}`);
    appState.logs = logger.entries();
    broadcastState();
  });
}
async function stopActiveProfile(reason = "manual-stop"): Promise<AppState> {
  appState.runtime.stopRequested = true;

  if (activeStrategyProcess) {
    const profileName = getProfileById(activeStrategyProfileId)?.name || activeStrategyProfileId || "unknown";
    logger.info("RUNTIME", `Stopping profile ${profileName} (${reason})`);
    await terminateProcessTree(activeStrategyProcess);
    activeStrategyProcess = null;
    activeStrategyProfileId = null;
  }

  appState.dpiBypassState = {
    ...appState.dpiBypassState,
    enabled: false,
  };
  appState.connectionStatus = "disconnected";
  appState.trafficStats = {
    downloadMbps: 0,
    uploadMbps: 0,
    latencyMs: 0,
    stabilityScore: appState.trafficStats.stabilityScore,
  };

  appState.profiles = appState.profiles.map((profile) => {
    if (profile.id === appState.runtime.activeProfileId || profile.isActive) {
      return {
        ...profile,
        isActive: false,
        status: profile.isAvailable ? "online" : profile.status,
        runtimeStatus: profile.isWorkingForCurrentUser ? "working" : "stopped",
        lastTestResult: "stopped",
      };
    }
    return profile;
  });

  appState.runtime.isRunning = false;
  appState.runtime.isTesting = false;
  appState.runtime.activePid = null;
  appState.runtime.activeProfileId = null;
  appState.runtime.lastStoppedAt = new Date().toISOString();
  appState.runtime.lastRuntimeEvent = `stop:${reason}`;

  appState.logs = logger.entries();
  pushRuntimeTelemetryPoint();
  broadcastState();
  return appState;
}
async function startProfile(profileId?: string, reason = "manual-start"): Promise<AppState> {
  let target = getProfileById(profileId || appState.activeProfileId);
  if (!target) {
    target = appState.profiles.find((profile) => profile.isAvailable) || null;
  }
  if (!target) {
    throw new Error("No available profile to start");
  }

  const rawSourceFile = String(target.sourceFile || "");
  const sourceFile = resolveStrategyPath(rawSourceFile);
  const winwsPath = path.join(REFERENCE_ROOT, "bin", "winws.exe");

  if (!fs.existsSync(sourceFile)) {
    throw new Error(`Strategy file not found: ${sourceFile}`);
  }
  if (!fs.existsSync(winwsPath)) {
    throw new Error(`winws.exe not found: ${winwsPath}`);
  }

  target = applyActiveProfileSelection(target.id, reason);
  target = { ...target, sourceFile };

  if (activeStrategyProcess && activeStrategyProfileId === target.id) {
    logger.info("RUNTIME", `Profile ${target.name} already running`);
    appState.logs = logger.entries();
    broadcastState();
    return appState;
  }

  if (activeStrategyProcess) {
    await stopActiveProfile("switch");
  }

  const spawnConfig = buildProfileSpawn(target);

  logger.info("RUNTIME", `Starting profile ${target.name}: ${path.basename(target.sourceFile)}`);
  logger.info("RUNTIME", `sourceFile(raw): ${rawSourceFile}`);
  logger.info("RUNTIME", `sourceFile(normalized): ${sourceFile}`);
  logger.info("RUNTIME", `Command: ${spawnConfig.command}`);
  logger.info("RUNTIME", `Args: ${JSON.stringify(spawnConfig.args)}`);
  logger.info("RUNTIME", `CWD: ${spawnConfig.cwd}`);
  logger.info("RUNTIME", `winws exists: ${fs.existsSync(winwsPath) ? "yes" : "no"}`);

  try {
    const proc = spawn(spawnConfig.command, spawnConfig.args, {
      cwd: spawnConfig.cwd,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
    });

    activeStrategyProcess = proc;
    activeStrategyProfileId = target.id;

    const startedAt = new Date().toISOString();
    const isTestRun = reason.startsWith("test");
    patchProfile(target.id, {
      launchCount: target.launchCount + 1,
      runtimeStatus: isTestRun ? "testing" : "active",
      lastTestAt: startedAt,
      isActive: true,
    });
    appState.runtime.isRunning = true;
    appState.runtime.isTesting = isTestRun || appState.runtime.testAllInProgress;
    appState.runtime.activePid = proc.pid ?? null;
    appState.runtime.activeProfileId = target.id;
    appState.runtime.activeStartedAt = startedAt;
    appState.runtime.lastLaunchAt = startedAt;
    appState.runtime.lastRuntimeEvent = `start:${target.id}`;

    appState.profiles = appState.profiles.map((profile) => {
      if (profile.id === target?.id) {
        return { ...profile, isActive: true, status: "active", runtimeStatus: isTestRun ? "testing" : "active" };
      }
      if (profile.isActive) {
        return { ...profile, isActive: false, status: profile.isAvailable ? "online" : profile.status, runtimeStatus: profile.isWorkingForCurrentUser ? "working" : "stopped" };
      }
      return profile;
    });

    appState.activeProfileId = target.id;
    appState.dpiBypassState = {
      ...appState.dpiBypassState,
      enabled: true,
      activeProfileId: target.id,
      activeBypassMode: target.bypassMode,
      activeRouteType: target.routeType,
    };
    appState.connectionStatus = resolveConnectionStatus(target, true);
    appState.trafficStats = {
      downloadMbps: target.downloadSpeed,
      uploadMbps: target.uploadSpeed,
      latencyMs: target.latency,
      stabilityScore: target.stabilityScore,
    };

    attachStrategyListeners(target, proc, spawnConfig);
    pushRuntimeTelemetryPoint();
    appState.logs = logger.entries();
    broadcastState();
    return appState;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start profile";
    logger.error("RUNTIME", `${target.name} start error: ${message}`);
    appState.runtime.error = message;
    appState.dpiBypassState.enabled = false;
    appState.connectionStatus = "disconnected";
    appState.logs = logger.entries();
    broadcastState();
    throw error;
  }
}

async function setActiveProfile(profileId: string, reason = "manual"): Promise<AppState> {
  const nextActive = applyActiveProfileSelection(profileId, reason);

  appState.connectionStatus = resolveConnectionStatus(nextActive, appState.dpiBypassState.enabled);
  appState.trafficStats = {
    downloadMbps: appState.dpiBypassState.enabled ? nextActive.downloadSpeed : 0,
    uploadMbps: appState.dpiBypassState.enabled ? nextActive.uploadSpeed : 0,
    latencyMs: appState.dpiBypassState.enabled ? nextActive.latency : 0,
    stabilityScore: nextActive.stabilityScore,
  };

  logger.info("ROUTING", `Active profile set to ${profileId}`);
  appState.runtime.activeProfileId = profileId;
  appState.runtime.lastRuntimeEvent = `route:${profileId}`;

  if (appState.dpiBypassState.enabled) {
    await startProfile(profileId, "switch");
    return appState;
  }

  appState.logs = logger.entries();
  broadcastState();
  return appState;
}


function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function testAllProfiles(): Promise<AppState> {
  if (appState.runtime.testAllInProgress) {
    return appState;
  }

  const queue = appState.profiles.filter((profile) => profile.isAvailable).map((profile) => profile.id);
  testAllCancelRequested = false;
  appState.runtime.testAllInProgress = true;
  appState.runtime.isTesting = true;
  appState.runtime.stopRequested = false;
  appState.runtime.testQueue = [...queue];
  appState.runtime.testResults = {};
  appState.runtime.lastRuntimeEvent = "test-all:start";
  appState.logs = logger.entries();
  broadcastState();

  for (const profileId of queue) {
    if (testAllCancelRequested) {
      break;
    }

    patchProfile(profileId, {
      runtimeStatus: "testing",
      lastTestResult: "not_tested",
      isActive: true,
    });

    appState.runtime.activeProfileId = profileId;
    appState.runtime.testQueue = appState.runtime.testQueue.filter((id) => id !== profileId);
    appState.runtime.lastRuntimeEvent = `test-all:run:${profileId}`;
    broadcastState();

    try {
      await startProfile(profileId, "test-all");
      await sleep(5000);
    } catch (error) {
      logger.warn("RUNTIME", `Test failed to start for ${profileId}: ${error instanceof Error ? error.message : String(error)}`);
      patchProfile(profileId, {
        runtimeStatus: "failed",
        lastTestResult: "failed",
        lastFailureAt: new Date().toISOString(),
        failCount: (getProfileById(profileId)?.failCount ?? 0) + 1,
        isActive: false,
      });
      appState.runtime.testResults[profileId] = "failed";
      continue;
    }

    if (activeStrategyProfileId === profileId) {
      await stopActiveProfile("test-all-step");
    }

    const after = getProfileById(profileId);
    const result = after?.lastTestResult ?? "stopped";
    appState.runtime.testResults[profileId] = result;
    appState.runtime.lastRuntimeEvent = `test-all:done:${profileId}`;
    appState.logs = logger.entries();
    broadcastState();
  }

  appState.runtime.testAllInProgress = false;
  appState.runtime.isTesting = false;
  appState.runtime.testQueue = [];
  appState.runtime.lastRuntimeEvent = testAllCancelRequested ? "test-all:cancelled" : "test-all:finished";

  if (testAllCancelRequested) {
    logger.warn("RUNTIME", "Test All cancelled by user");
  }

  testAllCancelRequested = false;
  appState.logs = logger.entries();
  broadcastState();
  return appState;
}
async function setBypassEnabled(enabled: boolean): Promise<AppState> {
  if (enabled) {
    return startProfile(appState.activeProfileId || undefined, "start-button");
  }

  logger.info("DPI", "Bypass disabled");
  if (appState.runtime.testAllInProgress) {
    testAllCancelRequested = true;
  }
  return stopActiveProfile("stop-button");
}

function clearLogs(): AppState {
  logger.clear();
  logger.info("LOG", "Log buffer cleared");
  appState.logs = logger.entries();
  broadcastState();
  return appState;
}

interface ProxyConfig {
  executable: string;
  host: string;
  port: number;
  protocol: "SOCKS5" | "HTTP" | "SOCKS4";
  username?: string;
  password?: string;
  extraArgs?: string[];
}

function buildProxyArgs(config: ProxyConfig): string[] {
  const args: string[] = [
    "--host",
    config.host,
    "--port",
    String(config.port),
    "--protocol",
    config.protocol.toLowerCase(),
  ];

  if (config.username) {
    args.push("--username", config.username);
  }
  if (config.password) {
    args.push("--password", config.password);
  }
  if (Array.isArray(config.extraArgs)) {
    args.push(...config.extraArgs);
  }

  return args;
}

type ServiceStatus = {
  installed: boolean;
  running: boolean;
  rawOutput: string;
  rawError: string;
};

function getServiceBatPath(): string {
  return path.join(REFERENCE_ROOT, "service.bat");
}

function getServiceStrategyNames(): string[] {
  if (!fs.existsSync(REFERENCE_ROOT)) {
    return [];
  }

  return fs
    .readdirSync(REFERENCE_ROOT)
    .filter((name) => /\.bat$/i.test(name) && !/^service/i.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
}

function queryServiceStatus(): Promise<ServiceStatus> {
  return new Promise((resolve) => {
    const child = spawn("sc", ["query", "zapret"], {
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let out = "";
    let err = "";

    child.stdout.on("data", (chunk: Buffer) => {
      out += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      err += chunk.toString();
    });

    child.on("close", (code) => {
      resolve({
        installed: code === 0 && /SERVICE_NAME:\s+zapret/i.test(out),
        running: /STATE\s*:\s*\d+\s+RUNNING/i.test(out),
        rawOutput: out,
        rawError: err,
      });
    });

    child.on("error", (error) => {
      resolve({
        installed: false,
        running: false,
        rawOutput: out,
        rawError: `${err}\n${error.message}`.trim(),
      });
    });
  });
}

function runServiceMenu(inputs: string[]): Promise<{ success: boolean; code: number | null; output: string; errorOutput: string }> {
  return new Promise((resolve) => {
    const serviceBat = getServiceBatPath();
    const child = spawn("cmd.exe", ["/d", "/c", `call "${serviceBat}" admin`], {
      cwd: REFERENCE_ROOT,
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let out = "";
    let err = "";

    child.stdout.on("data", (chunk: Buffer) => {
      out += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      err += chunk.toString();
    });

    child.on("close", (code) => {
      resolve({ success: code === 0, code, output: out, errorOutput: err });
    });

    child.on("error", (error) => {
      resolve({ success: false, code: null, output: out, errorOutput: `${err}\n${error.message}`.trim() });
    });

    const payload = `${inputs.join("\r\n")}\r\n`;
    child.stdin.write(payload);
    child.stdin.end();
  });
}

async function installServiceForProfile(profileId: string): Promise<{ success: boolean; message: string; status: ServiceStatus }> {
  const profile = appState.profiles.find((item) => item.id === profileId);
  if (!profile) {
    throw new Error("Profile not found");
  }

  const serviceBat = getServiceBatPath();
  if (!fs.existsSync(serviceBat)) {
    throw new Error(`service.bat not found: ${serviceBat}`);
  }

  const strategyNames = getServiceStrategyNames();
  const selected = path.basename(stripWrappingQuotes(profile.sourceFile));
  const selectedIndex = strategyNames.findIndex((name) => name.toLowerCase() === selected.toLowerCase());

  if (selectedIndex < 0) {
    throw new Error(`Selected strategy not found in service menu: ${selected}`);
  }

  logger.info("SERVICE", `Installing service strategy ${selected}`);
  const result = await runServiceMenu(["1", String(selectedIndex + 1), "", "0"]);
  const status = await queryServiceStatus();

  if (!result.success || !status.installed) {
    return {
      success: false,
      message: "Service install command failed",
      status,
    };
  }

  return {
    success: true,
    message: `Service installed with strategy ${selected}`,
    status,
  };
}

async function removeService(): Promise<{ success: boolean; message: string; status: ServiceStatus }> {
  const serviceBat = getServiceBatPath();
  if (!fs.existsSync(serviceBat)) {
    throw new Error(`service.bat not found: ${serviceBat}`);
  }

  logger.info("SERVICE", "Removing zapret service");
  const result = await runServiceMenu(["2", "", "0"]);
  const status = await queryServiceStatus();

  return {
    success: result.success && !status.installed,
    message: result.success ? "Service removed" : "Service remove command failed",
    status,
  };
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    minWidth: 1200,
    minHeight: 720,
    frame: false,
    titleBarStyle: "hidden",
    backgroundColor: "#080808",
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: resolvePreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  nativeTheme.themeSource = "dark";

  mainWindow.once("ready-to-show", () => {
    if (settings.startMinimized) {
      mainWindow?.minimize();
      return;
    }

    mainWindow?.show();
    mainWindow?.maximize();
  });

  if (isDev) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL!);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function createMiniWindow(): void {
  if (miniWindow) {
    miniWindow.focus();
    return;
  }

  miniWindow = new BrowserWindow({
    width: 340,
    height: 430,
    minWidth: 340,
    minHeight: 430,
    maxWidth: 340,
    maxHeight: 430,
    resizable: false,
    maximizable: false,
    minimizable: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    backgroundColor: "#080808",
    webPreferences: {
      preload: resolvePreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const miniUrl = isDev
    ? `${VITE_DEV_SERVER_URL}#/mini`
    : `file://${path.join(__dirname, "../dist/index.html")}#/mini`;

  miniWindow.loadURL(miniUrl);

  miniWindow.on("closed", () => {
    miniWindow = null;
  });
}

function createTray(): void {
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip("AltProxy");

  const contextMenu = Menu.buildFromTemplate([
    { label: "Open Dashboard", click: () => mainWindow?.show() },
    { label: "Mini Mode", click: () => createMiniWindow() },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on("double-click", () => mainWindow?.show());
}

function registerIpc(): void {
  ipcMain.handle("app:getAppState", async () => appState);
  ipcMain.handle("app:scanReference", async () => runScan("ipc-scan"));
  ipcMain.handle("app:getProfiles", async () => appState.profiles);
  ipcMain.handle("app:getLogs", async () => appState.logs);
  ipcMain.handle("app:clearLogs", async () => clearLogs().logs);
  ipcMain.handle("app:getSettings", async () => settings);
  ipcMain.handle("app:setSettings", async (_event, patch: Partial<SettingsState>) => {
    settings = updateSettings(settingsStore, patch);
    logger.setLevel(settings.logLevel as LogLevel);
    applyAutoRefresh();
    appState.settings = settings;
    appState.runtime.autoRefreshEnabled = settings.autoRefresh;
    appState.logs = logger.entries();
    broadcastState();
    return settings;
  });
  ipcMain.handle("app:setActiveProfile", async (_event, profileId: string) => setActiveProfile(profileId, "ui"));
  ipcMain.handle("app:restartAnalysis", async () => runScan("restart"));
  ipcMain.handle("app:openReferenceFolder", async () => shell.openPath(REFERENCE_ROOT));
  ipcMain.handle("app:getDpiBypassState", async () => appState.dpiBypassState);
  ipcMain.handle("app:getRuntimeState", async () => appState.runtime);
  ipcMain.handle("app:setBypassEnabled", async (_event, enabled: boolean) => setBypassEnabled(Boolean(enabled)));
  ipcMain.handle("app:testAllProfiles", async () => testAllProfiles());
  ipcMain.handle("app:getDiagnostics", async () => appState.diagnostics);
  ipcMain.handle("app:getReferenceSummary", async () => appState.referenceSummary);
  ipcMain.handle("app:getIpLists", async () => appState.ipLists);
  ipcMain.handle("app:getServiceStatus", async () => queryServiceStatus());
  ipcMain.handle("app:installService", async (_event, profileId: string) => installServiceForProfile(profileId));
  ipcMain.handle("app:removeService", async () => removeService());

  ipcMain.on("window:minimize", () => mainWindow?.minimize());
  ipcMain.handle("window:minimize", async () => {
    mainWindow?.minimize();
  });

  ipcMain.on("window:maximize", () => {
    if (!mainWindow) {
      return;
    }
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
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

  ipcMain.on("window:close", () => mainWindow?.close());
  ipcMain.handle("window:close", async () => {
    mainWindow?.close();
  });

  ipcMain.on("window:open-mini", () => createMiniWindow());
  ipcMain.handle("window:open-mini", async () => {
    createMiniWindow();
  });

  ipcMain.on("mini:minimize", () => miniWindow?.minimize());
  ipcMain.handle("mini:minimize", async () => {
    miniWindow?.minimize();
  });

  ipcMain.on("mini:close", () => miniWindow?.close());
  ipcMain.handle("mini:close", async () => {
    miniWindow?.close();
  });

  ipcMain.handle("window:is-maximized", async () => mainWindow?.isMaximized() ?? false);

  ipcMain.handle("proxy:start", async (_event, altId: string, config: ProxyConfig) => {
    if (proxyProcesses.has(altId)) {
      return { success: false, error: "Process already running for this alt" };
    }

    try {
      const args = buildProxyArgs(config);
      const proc = spawn(config.executable, args, {
        shell: false,
        detached: false,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });

      proxyProcesses.set(altId, proc);

      proc.stdout?.on("data", (data: Buffer) => {
        mainWindow?.webContents.send("proxy:stdout", altId, data.toString());
      });

      proc.stderr?.on("data", (data: Buffer) => {
        mainWindow?.webContents.send("proxy:stderr", altId, data.toString());
      });

      proc.on("exit", (code, signal) => {
        proxyProcesses.delete(altId);
        mainWindow?.webContents.send("proxy:exit", altId, code, signal);
      });

      proc.on("error", (error) => {
        proxyProcesses.delete(altId);
        mainWindow?.webContents.send("proxy:error", altId, error.message);
      });

      return { success: true, pid: proc.pid };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Failed to start process" };
    }
  });

  ipcMain.handle("proxy:stop", async (_event, altId: string) => {
    const proc = proxyProcesses.get(altId);
    if (!proc) {
      return { success: false, error: "No running process for this alt" };
    }

    proc.kill("SIGTERM");
    proxyProcesses.delete(altId);
    return { success: true };
  });

  ipcMain.handle("proxy:status", async (_event, altId: string) => ({ running: proxyProcesses.has(altId) }));
  ipcMain.handle("proxy:list-running", async () => Array.from(proxyProcesses.keys()));

  ipcMain.handle("shell:open-external", async (_event, url: string) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        return { success: false, error: "Only http/https URLs are allowed" };
      }

      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Invalid URL" };
    }
  });
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
}

app.on("second-instance", () => {
  if (!mainWindow) {
    return;
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
});

app.whenReady().then(async () => {
  registerIpc();
  createMainWindow();
  createTray();

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
  stopWatcher();

  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }

  if (watcherDebounceTimer) {
    clearTimeout(watcherDebounceTimer);
    watcherDebounceTimer = null;
  }

  void stopActiveProfile("app-quit");

  for (const [altId, proc] of proxyProcesses) {
    logger.info("PROXY", `Terminating proxy process for ${altId} (${proc.pid})`);
    proc.kill("SIGTERM");
  }
  proxyProcesses.clear();

  tray?.destroy();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
























































