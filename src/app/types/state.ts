export type ProfileStatus = "active" | "online" | "unstable" | "offline" | "error";
export type ProfileRuntimeStatus = "available" | "not_tested" | "testing" | "working" | "failed" | "active" | "stopped";
export type ProfileLastTestResult = "not_tested" | "working" | "failed" | "stopped";
export type ConnectionStatus = "connected" | "degraded" | "disconnected" | "unknown";
export type DiagnosticSeverity = "info" | "warn" | "error";
export type LogLevel = "info" | "warn" | "error" | "debug";
export type ServiceCheckStatus = "not_tested" | "working" | "failed";
export type CombinedServiceResult = "not_tested" | "both" | "youtube_only" | "discord_only" | "none";

export interface ReferenceFile {
  id: string;
  name: string;
  ext: string;
  absolutePath: string;
  relativePath: string;
  directory: string;
  size: number;
  modifiedAt: string;
  isText: boolean;
  isSupportedConfig: boolean;
  parseStatus: "indexed" | "parsed" | "skipped" | "error";
  parseWarnings: string[];
}

export interface ReferenceIndex {
  rootPath: string;
  listsPath: string;
  exists: boolean;
  scannedAt: string;
  totalFiles: number;
  totalDirectories: number;
  byExtension: Record<string, number>;
  files: ReferenceFile[];
  readErrors: string[];
}

export interface Profile {
  id: string;
  name: string;
  sourceFile: string;
  type: string;
  status: ProfileStatus;
  isActive: boolean;
  isAvailable: boolean;
  latency: number;
  downloadSpeed: number;
  uploadSpeed: number;
  stabilityScore: number;
  healthScore: number;
  lastCheckedAt: string;
  notes: string[];
  bypassMode: string;
  routeType: string;
  detectionHints: string[];
  profileClass: string;
  linkedIpLists: string[];
  runtimeStatus: ProfileRuntimeStatus;
  lastTestResult: ProfileLastTestResult;
  lastTestAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastExitCode: number | null;
  launchCount: number;
  successCount: number;
  failCount: number;
  isWorkingForCurrentUser: boolean;
  youtubeStatus: ServiceCheckStatus;
  discordStatus: ServiceCheckStatus;
  combinedResult: CombinedServiceResult;
}

export interface TrafficStats {
  downloadMbps: number;
  uploadMbps: number;
  latencyMs: number;
  stabilityScore: number;
}

export interface DiagnosticEntry {
  id: string;
  severity: DiagnosticSeverity;
  title: string;
  message: string;
  timestamp: string;
  source: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  source: string;
  message: string;
}

export interface SettingsState {
  theme: "dark" | "darker" | "graphite";
  compactMode: boolean;
  autoRefresh: boolean;
  refreshIntervalSec: number;
  startMinimized: boolean;
  logLevel: LogLevel;
  preferredProfile: string | null;
  rememberLastActiveProfile: boolean;
  autoScanReferenceOnStartup: boolean;
  diagnosticsVerbosity: "normal" | "verbose";
}

export interface RuntimeState {
  loading: boolean;
  error: string | null;
  lastAnalysisAt: string | null;
  referenceAvailable: boolean;
  autoRefreshEnabled: boolean;
  watcherActive: boolean;
  isRunning: boolean;
  isTesting: boolean;
  activeProfileId: string | null;
  activePid: number | null;
  activeStartedAt: string | null;
  lastStoppedAt: string | null;
  lastExitCode: number | null;
  stopRequested: boolean;
  testAllInProgress: boolean;
  testQueue: string[];
  testResults: Record<string, ProfileLastTestResult>;
  lastRuntimeError: string | null;
  lastRuntimeEvent: string | null;
  lastSuccessfulProfileId: string | null;
  lastLaunchAt: string | null;
  launchSuccessCount: number;
  launchFailureCount: number;
  switchCount: number;
  activeServiceResults: {
    youtube: ServiceCheckStatus;
    discord: ServiceCheckStatus;
  };
}

export interface DpiBypassState {
  enabled: boolean;
  activeProfileId: string | null;
  activeBypassMode: string | null;
  activeRouteType: string | null;
  availableScenarios: string[];
  healthyProfiles: number;
  unstableProfiles: number;
}

export interface RoutingProfileState {
  activeRouteId: string | null;
  availableRoutes: string[];
  fallbackRouteId: string | null;
  lastSwitchAt: string | null;
}

export interface IpListReference {
  id: string;
  name: string;
  sourceFile: string;
  totalEntries: number;
  validEntries: number;
  invalidEntries: number;
  ipList: string[];
  parsedAt: string;
  notes: string[];
  linkedProfiles: string[];
  parseWarnings: string[];
}

export interface ReferenceSummary {
  referenceExists: boolean;
  fileCount: number;
  profileCount: number;
  ipListCount: number;
  readErrorCount: number;
  lastSuccessfulAnalysisAt: string | null;
  dataAvailable: boolean;
  warnings: string[];
}

export interface SpeedHistoryPoint {
  time: string;
  download: number;
  upload: number;
  latency: number;
}

export interface StabilityHistoryPoint {
  time: string;
  stability: number;
  quality: number;
}

export interface SwitchHistoryEntry {
  time: string;
  from: string;
  to: string;
  reason: string;
  duration: string;
}

export interface AppState {
  profiles: Profile[];
  activeProfileId: string | null;
  referenceIndex: ReferenceIndex;
  connectionStatus: ConnectionStatus;
  trafficStats: TrafficStats;
  diagnostics: DiagnosticEntry[];
  logs: LogEntry[];
  settings: SettingsState;
  runtime: RuntimeState;
  dpiBypassState: DpiBypassState;
  routingProfileState: RoutingProfileState;
  ipLists: IpListReference[];
  referenceSummary: ReferenceSummary;
  speedHistory: SpeedHistoryPoint[];
  stabilityHistory: StabilityHistoryPoint[];
  switchHistory: SwitchHistoryEntry[];
  systemWarnings: string[];
}
