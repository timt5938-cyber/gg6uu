import type {
  AppState,
  DiagnosticEntry,
  DpiBypassState,
  IpListReference,
  LogEntry,
  Profile,
  ReferenceSummary,
  SettingsState,
} from "../app/types/state";

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

  proxyStart(altId: string, config: ProxyConfig): Promise<{ success: boolean; pid?: number; error?: string }>;
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

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};


