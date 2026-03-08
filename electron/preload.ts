import { contextBridge, ipcRenderer } from "electron";
import type {
  AppState,
  DiagnosticEntry,
  DpiBypassState,
  IpListReference,
  LogEntry,
  Profile,
  ReferenceSummary,
  SettingsState,
} from "../src/app/types/state";

type WinwsRuntimeDescriptor = {
  rootDir: string;
  exePath: string;
  dllPaths: string[];
  driverPaths: string[];
  payloadFiles: string[];
  exists: boolean;
  isValid: boolean;
  validationErrors: string[];
  resolvedFrom: "env" | "packaged" | "project" | "fallback";
};

type WinwsRuntimeState = {
  isAvailable: boolean;
  isRunning: boolean;
  pid: number | null;
  startedAt: string | null;
  stoppedAt: string | null;
  lastExitCode: number | null;
  lastError: string | null;
  exePath: string | null;
  runtimeRoot: string | null;
  validationErrors: string[];
};

type RemoteControlInfo = {
  enabled: boolean;
  bindMode: "localhost" | "lan";
  port: number;
  isRunning: boolean;
  bindAddress: string;
  networkAddresses: string[];
  pairingCode: string | null;
  pairingExpiresAt: string | null;
  allowNewPairing: boolean;
  pairedDevices: Array<{
    id: string;
    name: string;
    pairedAt: string;
    lastSeenAt: string | null;
  }>;
  activeClients: number;
  authFailures: number;
  lastRemoteAction: string | null;
  lastRemoteConnectionAt: string | null;
  lastError: string | null;
};

export type ProxyConfig = {
  executable: string;
  host: string;
  port: number;
  protocol: "SOCKS5" | "HTTP" | "SOCKS4";
  username?: string;
  password?: string;
  extraArgs?: string[];
};

export type ElectronAPI = {
  getAppState(): Promise<AppState>;
  scanReference(): Promise<AppState>;
  getProfiles(): Promise<Profile[]>;
  getLogs(): Promise<LogEntry[]>;
  clearLogs(): Promise<LogEntry[]>;
  getSettings(): Promise<SettingsState>;
  setSettings(settings: Partial<SettingsState>): Promise<SettingsState>;
  setActiveProfile(profileId: string): Promise<AppState>;
  restartAnalysis(): Promise<AppState>;
  openReferenceFolder(): Promise<string>;
  getDpiBypassState(): Promise<DpiBypassState>;
  setBypassEnabled(enabled: boolean): Promise<AppState>;
  testAllProfiles(): Promise<AppState>;
  getRuntimeState(): Promise<AppState["runtime"]>;
  getDiagnostics(): Promise<DiagnosticEntry[]>;
  getReferenceSummary(): Promise<ReferenceSummary>;
  getIpLists(): Promise<IpListReference[]>;
  getServiceStatus(): Promise<{ installed: boolean; running: boolean; rawOutput: string; rawError: string }>;
  installService(profileId: string): Promise<{ success: boolean; message: string; status: { installed: boolean; running: boolean; rawOutput: string; rawError: string } }>;
  removeService(): Promise<{ success: boolean; message: string; status: { installed: boolean; running: boolean; rawOutput: string; rawError: string } }>;
  getWinwsRuntimeInfo(): Promise<WinwsRuntimeDescriptor>;
  validateWinwsRuntime(): Promise<WinwsRuntimeDescriptor>;
  startWinwsRuntime(args?: string[], cwd?: string): Promise<WinwsRuntimeState>;
  stopWinwsRuntime(): Promise<WinwsRuntimeState>;
  restartWinwsRuntime(args?: string[], cwd?: string): Promise<WinwsRuntimeState>;
  getWinwsRuntimeState(): Promise<WinwsRuntimeState>;

  getRemoteControlInfo(): Promise<RemoteControlInfo | null>;
  updateRemoteControlConfig(patch: {
    enabled?: boolean;
    bindMode?: "localhost" | "lan";
    port?: number;
    allowNewPairing?: boolean;
    pairingExpirationSec?: number;
    remoteLogs?: boolean;
  }): Promise<RemoteControlInfo | null>;
  generateRemotePairingCode(): Promise<{ code: string; expiresAt: string } | null>;
  getRemotePairingCode(): Promise<{ code: string | null; expiresAt: string | null }>;
  unpairRemoteDevice(deviceId: string): Promise<RemoteControlInfo | null>;

  minimizeWindow(): Promise<void>;
  maximizeWindow(): Promise<boolean>;
  closeWindow(): Promise<void>;
  isMaximized(): Promise<boolean>;
  openMini(): void;
  miniMinimize(): void;
  miniClose(): void;

  minimize(): void;
  maximize(): void;
  close(): void;

  onStateUpdated(cb: (state: AppState) => void): () => void;

  proxyStart(
    altId: string,
    config: ProxyConfig,
  ): Promise<{ success: boolean; pid?: number; error?: string }>;
  proxyStop(altId: string): Promise<{ success: boolean; error?: string }>;
  proxyStatus(altId: string): Promise<{ running: boolean }>;
  proxyListRunning(): Promise<string[]>;

  onProxyStdout(cb: (altId: string, data: string) => void): () => void;
  onProxyStderr(cb: (altId: string, data: string) => void): () => void;
  onProxyExit(cb: (altId: string, code: number | null, signal: string | null) => void): () => void;
  onProxyError(cb: (altId: string, message: string) => void): () => void;

  openExternal(url: string): Promise<{ success: boolean; error?: string }>;
  platform: NodeJS.Platform;
};

function on<TArgs extends unknown[]>(channel: string, listener: (...args: TArgs) => void): () => void {
  const wrapped = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => {
    listener(...(args as TArgs));
  };

  ipcRenderer.on(channel, wrapped);
  return () => ipcRenderer.removeListener(channel, wrapped);
}

const electronApi: ElectronAPI = {
  getAppState: () => ipcRenderer.invoke("app:getAppState"),
  scanReference: () => ipcRenderer.invoke("app:scanReference"),
  getProfiles: () => ipcRenderer.invoke("app:getProfiles"),
  getLogs: () => ipcRenderer.invoke("app:getLogs"),
  clearLogs: () => ipcRenderer.invoke("app:clearLogs"),
  getSettings: () => ipcRenderer.invoke("app:getSettings"),
  setSettings: (settings) => ipcRenderer.invoke("app:setSettings", settings),
  setActiveProfile: (profileId) => ipcRenderer.invoke("app:setActiveProfile", profileId),
  restartAnalysis: () => ipcRenderer.invoke("app:restartAnalysis"),
  openReferenceFolder: () => ipcRenderer.invoke("app:openReferenceFolder"),
  getDpiBypassState: () => ipcRenderer.invoke("app:getDpiBypassState"),
  setBypassEnabled: (enabled) => ipcRenderer.invoke("app:setBypassEnabled", enabled),
  testAllProfiles: () => ipcRenderer.invoke("app:testAllProfiles"),
  getRuntimeState: () => ipcRenderer.invoke("app:getRuntimeState"),
  getDiagnostics: () => ipcRenderer.invoke("app:getDiagnostics"),
  getReferenceSummary: () => ipcRenderer.invoke("app:getReferenceSummary"),
  getIpLists: () => ipcRenderer.invoke("app:getIpLists"),
  getServiceStatus: () => ipcRenderer.invoke("app:getServiceStatus"),
  installService: (profileId) => ipcRenderer.invoke("app:installService", profileId),
  removeService: () => ipcRenderer.invoke("app:removeService"),
  getWinwsRuntimeInfo: () => ipcRenderer.invoke("app:getWinwsRuntimeInfo"),
  validateWinwsRuntime: () => ipcRenderer.invoke("app:validateWinwsRuntime"),
  startWinwsRuntime: (args, cwd) => ipcRenderer.invoke("app:startWinwsRuntime", args, cwd),
  stopWinwsRuntime: () => ipcRenderer.invoke("app:stopWinwsRuntime"),
  restartWinwsRuntime: (args, cwd) => ipcRenderer.invoke("app:restartWinwsRuntime", args, cwd),
  getWinwsRuntimeState: () => ipcRenderer.invoke("app:getWinwsRuntimeState"),

  getRemoteControlInfo: () => ipcRenderer.invoke("app:getRemoteControlInfo"),
  updateRemoteControlConfig: (patch) => ipcRenderer.invoke("app:updateRemoteControlConfig", patch),
  generateRemotePairingCode: () => ipcRenderer.invoke("app:generateRemotePairingCode"),
  getRemotePairingCode: () => ipcRenderer.invoke("app:getRemotePairingCode"),
  unpairRemoteDevice: (deviceId) => ipcRenderer.invoke("app:unpairRemoteDevice", deviceId),

  minimizeWindow: () => ipcRenderer.invoke("window:minimize"),
  maximizeWindow: () => ipcRenderer.invoke("window:maximize"),
  closeWindow: () => ipcRenderer.invoke("window:close"),
  isMaximized: () => ipcRenderer.invoke("window:is-maximized"),
  openMini: () => ipcRenderer.send("window:open-mini"),
  miniMinimize: () => ipcRenderer.send("mini:minimize"),
  miniClose: () => ipcRenderer.send("mini:close"),

  minimize: () => ipcRenderer.send("window:minimize"),
  maximize: () => ipcRenderer.send("window:maximize"),
  close: () => ipcRenderer.send("window:close"),

  onStateUpdated: (cb) => on("app:stateUpdated", cb),

  proxyStart: (altId, config) => ipcRenderer.invoke("proxy:start", altId, config),
  proxyStop: (altId) => ipcRenderer.invoke("proxy:stop", altId),
  proxyStatus: (altId) => ipcRenderer.invoke("proxy:status", altId),
  proxyListRunning: () => ipcRenderer.invoke("proxy:list-running"),

  onProxyStdout: (cb) => on("proxy:stdout", cb),
  onProxyStderr: (cb) => on("proxy:stderr", cb),
  onProxyExit: (cb) => on("proxy:exit", cb),
  onProxyError: (cb) => on("proxy:error", cb),

  openExternal: (url) => ipcRenderer.invoke("shell:open-external", url),
  platform: process.platform,
};

contextBridge.exposeInMainWorld("electronAPI", electronApi);
