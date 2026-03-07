import { useMemo } from "react";

import { useAppStore } from "../store/appStore";
import type { LogEntry, Profile } from "../types/state";
interface UiAltProfile {
  id: string;
  name: string;
  label: string;
  status: "active" | "online" | "unstable" | "offline" | "error";
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
  const disabled = !profile.isAvailable || profile.status === "offline" || profile.status === "error";
  const normalizedStatus = profile.isActive ? "active" : profile.status;

  const load = clampNumber(Math.round(100 - profile.healthScore + profile.stabilityScore * 0.2), 0, 100);
  const successRate = clampNumber(profile.healthScore, 0, 100);

  const tag: UiAltProfile["tag"] =
    profile.isActive
      ? "best"
      : normalizedStatus === "online" && profile.healthScore >= 80
        ? "recommended"
        : normalizedStatus === "unstable"
          ? "unstable"
          : normalizedStatus === "offline" || normalizedStatus === "error"
            ? "offline"
            : undefined;

  return {
    id: profile.id,
    name: profile.name,
    label: profile.notes[0] ?? profile.profileClass,
    status: normalizedStatus,
    isActive: profile.isActive,
    isFavorite: profile.healthScore >= 85,
    speed: disabled ? 0 : profile.downloadSpeed,
    upload: disabled ? 0 : profile.uploadSpeed,
    latency: disabled ? 0 : profile.latency,
    stability: clampNumber(profile.stabilityScore, 0, 100),
    quality: clampNumber(profile.healthScore, 0, 100),
    load,
    uptime: profile.isAvailable ? "running" : "offline",
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

