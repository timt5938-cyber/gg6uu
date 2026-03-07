import { useMemo, type ComponentType } from "react";
import { Power, StopCircle, RefreshCw, Shuffle, FlaskConical } from "lucide-react";
import { useUiData } from "../hooks/useUiData";
import { useAppStore } from "../store/appStore";

const statusText: Record<string, string> = {
  active: "ACTIVE",
  working: "WORKING",
  testing: "TESTING",
  available: "AVAILABLE",
  not_tested: "NOT TESTED",
  stopped: "STOPPED",
  failed: "FAILED",
};

function ActionButton({ icon: Icon, label, variant = "default", onClick, disabled }: { icon: ComponentType<{ size?: number }>; label: string; variant?: "default" | "primary" | "danger"; onClick?: () => void; disabled?: boolean }) {
  const styles = {
    default: "bg-[#141414] border border-[#222222] text-[#888888] hover:text-white hover:border-[#333333] hover:bg-[#1a1a1a]",
    primary: "bg-white text-black hover:bg-[#e0e0e0]",
    danger: "bg-[#141414] border border-[#222222] text-[#555555] hover:text-[#cc4444] hover:border-[#3a1a1a] hover:bg-[#1a0f0f]",
  };

  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed ${styles[variant]}`}>
      <Icon size={13} />
      <span style={{ fontSize: "11px", fontFamily: "'Inter', sans-serif", fontWeight: 500, letterSpacing: "0.05em" }}>{label}</span>
    </button>
  );
}

function formatTs(value: string | null): string {
  if (!value) return "not available";
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? value : new Date(parsed).toLocaleString();
}

function serviceBadge(value: "not_tested" | "working" | "failed") {
  if (value === "working") return "text-[#88aa88]";
  if (value === "failed") return "text-[#aa4444]";
  return "text-[#555555]";
}

export function Dashboard() {
  const { altProfiles, activeAlt, runtime, summary, profiles, diagnostics, switchHistory } = useUiData();
  const loading = useAppStore((state) => state.loading);
  const error = useAppStore((state) => state.error);
  const restartAnalysis = useAppStore((state) => state.restartAnalysis);
  const setActiveProfile = useAppStore((state) => state.setActiveProfile);
  const setBypassEnabled = useAppStore((state) => state.setBypassEnabled);
  const testAllProfiles = useAppStore((state) => state.testAllProfiles);

  const activeProfile = useMemo(() => profiles.find((profile) => profile.id === runtime.activeProfileId) ?? profiles.find((profile) => profile.id === activeAlt?.id) ?? null, [profiles, runtime.activeProfileId, activeAlt?.id]);

  const totals = useMemo(() => {
    const tested = profiles.filter((item) => item.lastTestResult !== "not_tested").length;
    const working = profiles.filter((item) => item.runtimeStatus === "working" || item.runtimeStatus === "active").length;
    const failed = profiles.filter((item) => item.runtimeStatus === "failed").length;
    const youtubeWorking = profiles.filter((item) => item.youtubeStatus === "working").length;
    const discordWorking = profiles.filter((item) => item.discordStatus === "working").length;
    const bothWorking = profiles.filter((item) => item.combinedResult === "both").length;
    const launchErrors = diagnostics.filter((item) => item.severity === "error").length;

    return {
      tested,
      working,
      failed,
      youtubeWorking,
      discordWorking,
      bothWorking,
      launchErrors,
    };
  }, [profiles, diagnostics]);

  const recommendations = useMemo(() => {
    if (profiles.length === 0) {
      return [] as Array<{ label: string; profileName: string }>;
    }

    const byScore = [...profiles]
      .filter((p) => p.lastTestResult !== "not_tested")
      .map((p) => {
        const total = p.successCount + p.failCount;
        const ratio = total > 0 ? p.successCount / total : 0;
        const serviceBonus = p.combinedResult === "both" ? 0.3 : p.combinedResult === "youtube_only" || p.combinedResult === "discord_only" ? 0.15 : 0;
        return { p, score: ratio + serviceBonus + p.successCount * 0.01 };
      })
      .sort((a, b) => b.score - a.score);

    const bestOverall = byScore[0]?.p;
    const bestYoutube = byScore.find((x) => x.p.youtubeStatus === "working")?.p;
    const bestDiscord = byScore.find((x) => x.p.discordStatus === "working")?.p;
    const mostStable = [...profiles]
      .filter((p) => p.lastTestResult !== "not_tested")
      .sort((a, b) => (b.successCount - b.failCount) - (a.successCount - a.failCount))[0];

    return [
      { label: "best overall", profileName: bestOverall?.name ?? "not available" },
      { label: "best for YouTube", profileName: bestYoutube?.name ?? "not available" },
      { label: "best for Discord", profileName: bestDiscord?.name ?? "not available" },
      { label: "most stable", profileName: mostStable?.name ?? "not available" },
    ];
  }, [profiles]);

  const isRunning = runtime.isRunning;

  const switchToNext = async () => {
    if (!activeAlt || altProfiles.length <= 1) return;
    const currentIndex = altProfiles.findIndex((item) => item.id === activeAlt.id);
    const nextIndex = (currentIndex + 1) % altProfiles.length;
    await setActiveProfile(altProfiles[nextIndex].id);
  };

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 flex flex-col overflow-y-auto app-scroll p-6 gap-5">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <h1 className="text-white" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 300, letterSpacing: "-0.02em", fontSize: "20px" }}>Dashboard</h1>
            <span className="text-[#333333]" style={{ fontSize: "11px", fontFamily: "'JetBrains Mono', monospace" }}>Operational state for DPI runtime and test history</span>
          </div>
          <div className="flex items-center gap-2">
            <ActionButton icon={FlaskConical} label="Test All" onClick={() => void testAllProfiles()} disabled={loading || altProfiles.length === 0} />
            <ActionButton icon={Shuffle} label="Switch Alt" onClick={() => void switchToNext()} disabled={loading || altProfiles.length < 2} />
            <ActionButton icon={RefreshCw} label="Restart" onClick={() => void restartAnalysis()} disabled={loading} />
            {isRunning ? <ActionButton icon={StopCircle} label="Stop" variant="danger" onClick={() => void setBypassEnabled(false)} disabled={loading} /> : <ActionButton icon={Power} label="Start" variant="primary" onClick={() => void setBypassEnabled(true)} disabled={loading} />}
          </div>
        </div>

        {(error || !runtime.referenceAvailable) && (
          <div className="px-4 py-3 rounded-lg border border-[#2a1616] bg-[#140c0c] text-[#a97c7c]" style={{ fontSize: "11px" }}>
            {error || summary.warnings[0] || `Reference folder is not available: ${summary.referenceExists ? "pending" : "missing"}`}
          </div>
        )}

        <div className="bg-[#0e0e0e] border border-[#1e1e1e] rounded-xl p-5">
          <div className="text-[#3a3a3a] uppercase tracking-[0.08em]" style={{ fontSize: "8px", fontFamily: "'Inter', sans-serif", fontWeight: 600 }}>Active Profile</div>
          <div className="mt-2 text-white" style={{ fontSize: "22px", fontFamily: "'Inter', sans-serif", fontWeight: 500 }}>{activeProfile?.name ?? "not available"}</div>
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="text-[#777777]" style={{ fontSize: "11px" }}>type: {activeProfile?.type ?? "not available"}</div>
            <div className="text-[#777777]" style={{ fontSize: "11px" }}>route: {activeProfile?.routeType ?? "not available"}</div>
            <div className="text-[#777777]" style={{ fontSize: "11px" }}>mode: {activeProfile?.bypassMode ?? "not available"}</div>
            <div className="text-[#777777]" style={{ fontSize: "11px" }}>runtime: {runtime.isRunning ? "running" : "stopped"}</div>
            <div className="text-[#777777]" style={{ fontSize: "11px" }}>pid: {runtime.activePid ?? "not available"}</div>
            <div className="text-[#777777]" style={{ fontSize: "11px" }}>working for user: {activeProfile?.isWorkingForCurrentUser ? "yes" : "no"}</div>
            <div className="text-[#777777]" style={{ fontSize: "11px" }}>last success profile: {runtime.lastSuccessfulProfileId ?? "not available"}</div>
            <div className="text-[#777777]" style={{ fontSize: "11px" }}>launch count: {activeProfile?.launchCount ?? 0}</div>
            <div className="text-[#777777]" style={{ fontSize: "11px" }}>success/fail: {(activeProfile?.successCount ?? 0)}/{(activeProfile?.failCount ?? 0)}</div>
            <div className="text-[#777777]" style={{ fontSize: "11px" }}>last launch: {formatTs(runtime.lastLaunchAt)}</div>
            <div className="text-[#777777]" style={{ fontSize: "11px" }}>last stop: {formatTs(runtime.lastStoppedAt)}</div>
            <div className="text-[#777777]" style={{ fontSize: "11px" }}>last success: {formatTs(activeProfile?.lastSuccessAt ?? null)}</div>
            <div className="text-[#777777]" style={{ fontSize: "11px" }}>last failure: {formatTs(activeProfile?.lastFailureAt ?? null)}</div>
            <div className={`text-[11px] ${serviceBadge(activeProfile?.youtubeStatus ?? "not_tested")}`}>youtube: {activeProfile?.youtubeStatus ?? "not_tested"}</div>
            <div className={`text-[11px] ${serviceBadge(activeProfile?.discordStatus ?? "not_tested")}`}>discord: {activeProfile?.discordStatus ?? "not_tested"}</div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "runtime", value: runtime.isRunning ? "enabled" : "disabled" },
            { label: "active alt", value: activeAlt?.name ?? "not available" },
            { label: "last success profile", value: runtime.lastSuccessfulProfileId ?? "not available" },
            { label: "profiles found", value: String(summary.profileCount) },
            { label: "profiles tested", value: String(totals.tested) },
            { label: "profiles working", value: String(totals.working) },
            { label: "profiles failed", value: String(totals.failed) },
            { label: "ip lists", value: String(summary.ipListCount) },
            { label: "reference", value: runtime.referenceAvailable ? "available" : "unavailable" },
            { label: "process", value: runtime.activePid ? "running" : "stopped" },
            { label: "launch success", value: String(runtime.launchSuccessCount) },
            { label: "launch failure", value: String(runtime.launchFailureCount) },
            { label: "launch errors", value: String(totals.launchErrors) },
            { label: "switch count", value: String(runtime.switchCount) },
            { label: "last analysis", value: formatTs(runtime.lastAnalysisAt) },
            { label: "last runtime event", value: runtime.lastRuntimeEvent ?? "not available" },
            { label: "current pid", value: runtime.activePid ? String(runtime.activePid) : "not available" },
            { label: "YouTube working", value: String(totals.youtubeWorking) },
            { label: "Discord working", value: String(totals.discordWorking) },
            { label: "both working", value: String(totals.bothWorking) },
          ].map((item) => (
            <div key={item.label} className="bg-[#0e0e0e] border border-[#1e1e1e] rounded-lg px-4 py-3">
              <div className="text-[#3a3a3a] uppercase tracking-[0.08em]" style={{ fontSize: "8px", fontFamily: "'Inter', sans-serif", fontWeight: 600 }}>{item.label}</div>
              <div className="text-white mt-1" style={{ fontSize: "11px", fontFamily: "'JetBrains Mono', monospace" }}>{item.value}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-5">
          <div className="bg-[#0e0e0e] border border-[#1e1e1e] rounded-xl p-5">
            <div className="text-white mb-3" style={{ fontSize: "12px", fontWeight: 500 }}>Switch History</div>
            <div className="flex flex-col gap-2">
              {switchHistory.slice(0, 8).map((entry, index) => (
                <div key={`${entry.time}-${index}`} className="text-[#777777]" style={{ fontSize: "10px", fontFamily: "'JetBrains Mono', monospace" }}>
                  {entry.time} | {entry.from}{" -> "}{entry.to} | {entry.reason}
                </div>
              ))}
              {switchHistory.length === 0 && <div className="text-[#555555]" style={{ fontSize: "11px" }}>No switch history yet.</div>}
            </div>
          </div>

          <div className="bg-[#0e0e0e] border border-[#1e1e1e] rounded-xl p-5">
            <div className="text-white mb-3" style={{ fontSize: "12px", fontWeight: 500 }}>Recommendations</div>
            <div className="flex flex-col gap-2">
              {recommendations.map((item) => {
                const recommendedProfile = profiles.find((profile) => profile.name === item.profileName);
                const isSelected = Boolean(recommendedProfile && recommendedProfile.id === activeProfile?.id);
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => (recommendedProfile ? void setActiveProfile(recommendedProfile.id) : undefined)}
                    className={`text-left rounded-md border px-3 py-2 transition-all duration-200 ${isSelected ? "border-[#2b2b2b] bg-[#131313] shadow-[0_0_0_1px_rgba(255,255,255,0.04)]" : "border-[#1b1b1b] bg-[#0b0b0b] hover:border-[#2a2a2a]"}`}
                  >
                    <div className="text-[#777777]" style={{ fontSize: "10px", fontFamily: "'JetBrains Mono', monospace" }}>
                      {item.label}: <span className="text-white">{item.profileName}</span>
                    </div>
                  </button>
                );
              })}
              {recommendations.length === 0 && <div className="text-[#555555]" style={{ fontSize: "11px" }}>Not enough test data for recommendations.</div>}
            </div>
          </div>
        </div>
      </div>

      <div className="w-[320px] border-l border-[#161616] bg-[#090909] p-4 overflow-y-auto app-scroll shrink-0">
        <div className="mb-4">
          <span className="text-[#2a2a2a] uppercase tracking-[0.12em]" style={{ fontSize: "9px", fontFamily: "'Inter', sans-serif", fontWeight: 600 }}>ALT Status</span>
        </div>
        <div className="flex flex-col gap-2.5">
          {altProfiles.map((alt) => {
            const profile = profiles.find((p) => p.id === alt.id);
            return (
              <button key={alt.id} type="button" onClick={() => void setActiveProfile(alt.id)} className={`w-full text-left rounded-lg border px-3 py-3 transition-all ${alt.isActive ? "border-[#2a2a2a] bg-[#111111]" : "border-[#1a1a1a] bg-[#0b0b0b] hover:border-[#252525]"}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-white" style={{ fontSize: "12px", fontWeight: 600 }}>{alt.name}</span>
                  <span className="text-[#666666]" style={{ fontSize: "8px", letterSpacing: "0.1em" }}>{statusText[alt.status] || alt.status.toUpperCase()}</span>
                </div>
                <div className="text-[#666666]" style={{ fontSize: "9px", fontFamily: "'JetBrains Mono', monospace" }}>
                  launch {profile?.launchCount ?? 0} | ok {profile?.successCount ?? 0} | fail {profile?.failCount ?? 0}
                </div>
                <div className="text-[#666666]" style={{ fontSize: "9px", fontFamily: "'JetBrains Mono', monospace" }}>
                  yt: {profile?.youtubeStatus ?? "not_tested"} | ds: {profile?.discordStatus ?? "not_tested"} | {profile?.combinedResult ?? "not_tested"}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

