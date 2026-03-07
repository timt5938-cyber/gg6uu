import { useMemo } from "react";

import { useAppStore } from "../store/appStore";
import type { LogEntry, Profile } from "../types/state";

interface UiAltProfile {
  id: string;
  name: string;
  label: string;
  status: "available" | "not_tested" | "testing" | "working" | "failed" | "active" | "stopped";
  isActive: boolean;
  isFavorite: boolean;
  speed: number;
  upload: number;
  latency: number;
  stability: number;
  quality: number;
  load: number;
  uptime: string;
  lastCheck: string;
  successRate: number;
  location: string;
  protocol: string;
  tag?: "best" | "recommended" | "unstable" | "offline";
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toAltProfile(profile: Profile): UiAltProfile {
  const normalizedStatus = profile.isActive ? "active" : profile.runtimeStatus;
  const canShowLive = normalizedStatus === "active";
  const totalRuns = profile.successCount + profile.failCount;
  const successRate = totalRuns > 0 ? clampNumber((profile.successCount / totalRuns) * 100, 0, 100) : 0;
  const load = clampNumber(profile.launchCount * 5, 0, 100);

  const tag: UiAltProfile["tag"] =
    profile.isActive
      ? "best"
      : normalizedStatus === "working" && successRate >= 80
        ? "recommended"
        : normalizedStatus === "failed"
          ? "unstable"
          : normalizedStatus === "stopped" || normalizedStatus === "failed" || normalizedStatus === "not_tested"
            ? "offline"
            : undefined;

  return {
    id: profile.id,
    name: profile.name,
    label: profile.notes[0] ?? profile.profileClass,
    status: normalizedStatus,
    isActive: profile.isActive,
    isFavorite: profile.successCount > 0 && profile.failCount === 0,
    speed: canShowLive ? profile.downloadSpeed : 0,
    upload: canShowLive ? profile.uploadSpeed : 0,
    latency: canShowLive ? profile.latency : 0,
    stability: successRate,
    quality: successRate,
    load,
    uptime: profile.lastSuccessAt ?? "not available",
    lastCheck: profile.lastCheckedAt,
    successRate,
    location: profile.routeType.toUpperCase(),
    protocol: profile.bypassMode.toUpperCase(),
    tag,
  };
}

function toUiLogEntry(entry: LogEntry): { id: number; time: string; level: string; source: string; message: string } {
  const numericId = Number(entry.id);
  return {
    id: Number.isFinite(numericId) ? numericId : Math.floor(Date.now() / 1000),
    time: entry.timestamp,
    level: entry.level.toUpperCase(),
    source: entry.source,
    message: entry.message,
  };
}

export function useUiData() {
  const appState = useAppStore((state) => state.appState);

  return useMemo(() => {
    const altProfiles = appState.profiles.map(toAltProfile);
    const activeAlt = altProfiles.find((item) => item.isActive) ?? altProfiles[0] ?? null;

    const logEntries = appState.logs.map(toUiLogEntry);

    return {
      altProfiles,
      activeAlt,
      logEntries,
      profiles: appState.profiles,
      speedHistory: appState.speedHistory,
      stabilityHistory: appState.stabilityHistory,
      switchHistory: appState.switchHistory,
      diagnostics: appState.diagnostics,
      ipLists: appState.ipLists,
      settings: appState.settings,
      runtime: appState.runtime,
      summary: appState.referenceSummary,
      connectionStatus: appState.connectionStatus,
      trafficStats: appState.trafficStats,
      dpiBypassState: appState.dpiBypassState,
      systemWarnings: appState.systemWarnings,
    };
  }, [appState]);
}
