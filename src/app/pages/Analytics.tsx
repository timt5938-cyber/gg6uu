import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Activity, Clock, CheckCircle2, XCircle } from "lucide-react";
import { useUiData } from "../hooks/useUiData";

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="bg-[#111111] border border-[#252525] rounded-md p-3 shadow-xl">
      <p style={{ fontSize: "9px", fontFamily: "'JetBrains Mono', monospace", color: "#444444", marginBottom: "4px" }}>{label}</p>
      {payload.map((item) => (
        <div key={item.name} className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color || "white" }} />
          <span style={{ fontSize: "10px", fontFamily: "'JetBrains Mono', monospace", color: "#e0e0e0" }}>
            {item.name}: {typeof item.value === "number" ? item.value.toFixed(0) : item.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function inRange(timestamp: string | null, minTs: number): boolean {
  if (!timestamp) return false;
  const parsed = Date.parse(timestamp);
  return !Number.isNaN(parsed) && parsed >= minTs;
}

export function Analytics() {
  const [timeRange, setTimeRange] = useState<"1h" | "6h" | "24h" | "7d">("24h");
  const [selectedAltId, setSelectedAltId] = useState<string>("all");
  const { profiles, diagnostics, runtime, summary, switchHistory } = useUiData();

  const limitsMs: Record<typeof timeRange, number> = {
    "1h": 1 * 60 * 60 * 1000,
    "6h": 6 * 60 * 60 * 1000,
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
  };

  const minTs = Date.now() - limitsMs[timeRange];

  const filteredProfiles = useMemo(() => {
    if (selectedAltId === "all") {
      return profiles;
    }
    return profiles.filter((profile) => profile.id === selectedAltId);
  }, [profiles, selectedAltId]);

  const metrics = useMemo(() => {
    const tested = filteredProfiles.filter((item) => item.lastTestResult !== "not_tested").length;
    const working = filteredProfiles.filter((item) => item.runtimeStatus === "working" || item.runtimeStatus === "active").length;
    const failed = filteredProfiles.filter((item) => item.runtimeStatus === "failed").length;
    const youtubeWorking = filteredProfiles.filter((item) => item.youtubeStatus === "working").length;
    const discordWorking = filteredProfiles.filter((item) => item.discordStatus === "working").length;
    const bothWorking = filteredProfiles.filter((item) => item.combinedResult === "both").length;

    const launchSuccess = filteredProfiles.reduce((sum, item) => sum + item.successCount, 0);
    const launchFail = filteredProfiles.reduce((sum, item) => sum + item.failCount, 0);

    return {
      totalProfiles: filteredProfiles.length,
      testedProfiles: tested,
      workingProfiles: working,
      failedProfiles: failed,
      youtubeWorking,
      discordWorking,
      bothWorking,
      launchSuccess,
      launchFail,
      switches: switchHistory.filter((entry) => inRange(entry.time, minTs)).length,
      errors: diagnostics.filter((item) => item.severity === "error" && inRange(item.timestamp, minTs)).length,
      warnings: diagnostics.filter((item) => item.severity === "warn" && inRange(item.timestamp, minTs)).length,
    };
  }, [filteredProfiles, diagnostics, switchHistory, minTs]);

  const profileOps = useMemo(() => {
    return filteredProfiles
      .map((profile) => ({
        name: profile.name,
        launches: profile.launchCount,
        success: profile.successCount,
        fail: profile.failCount,
        youtubePass: profile.youtubeStatus === "working" ? 1 : 0,
        discordPass: profile.discordStatus === "working" ? 1 : 0,
      }))
      .sort((a, b) => b.launches - a.launches)
      .slice(0, 12);
  }, [filteredProfiles]);

  const eventsData = useMemo(() => {
    return [
      { key: "launch_success", value: metrics.launchSuccess },
      { key: "launch_fail", value: metrics.launchFail },
      { key: "switches", value: metrics.switches },
      { key: "diag_errors", value: metrics.errors },
      { key: "diag_warnings", value: metrics.warnings },
      { key: "youtube_working", value: metrics.youtubeWorking },
      { key: "discord_working", value: metrics.discordWorking },
      { key: "both_working", value: metrics.bothWorking },
    ];
  }, [metrics]);

  const empty = filteredProfiles.length === 0;

  return (
    <div className="flex flex-col h-full overflow-y-auto app-scroll">
      <div className="flex items-center justify-between px-7 py-5 border-b border-[#151515] shrink-0">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-white" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 300, letterSpacing: "-0.02em", fontSize: "20px" }}>
            Analytics
          </h1>
          <span className="text-[#333333]" style={{ fontSize: "11px", fontFamily: "'JetBrains Mono', monospace" }}>
            Real runtime and test history
          </span>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedAltId}
            onChange={(event) => setSelectedAltId(event.target.value)}
            className="bg-[#0e0e0e] border border-[#1a1a1a] rounded-md px-3 py-1.5 text-[#cccccc]"
            style={{ fontSize: "10px", fontFamily: "'JetBrains Mono', monospace" }}
          >
            <option value="all">all alts</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>{profile.name}</option>
            ))}
          </select>

          <div className="flex items-center gap-1 bg-[#0e0e0e] border border-[#1a1a1a] rounded-md p-1">
            {(["1h", "6h", "24h", "7d"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setTimeRange(value)}
                className={`px-3 py-1.5 rounded transition-all ${timeRange === value ? "bg-white text-black" : "text-[#444444] hover:text-[#888888]"}`}
                style={{ fontSize: "10px", fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-5 p-6">
        {empty ? (
          <div className="px-4 py-3 rounded-lg border border-[#2a2a2a] bg-[#111111] text-[#888888]" style={{ fontSize: "11px" }}>
            No analytics history for selected alt.
          </div>
        ) : null}

        <div className="grid grid-cols-8 gap-3">
          {[
            { label: "Profiles", value: String(metrics.totalProfiles), unit: selectedAltId === "all" ? "total" : "selected", icon: Activity },
            { label: "Tested", value: String(metrics.testedProfiles), unit: "profiles", icon: CheckCircle2 },
            { label: "Working", value: String(metrics.workingProfiles), unit: "profiles", icon: CheckCircle2 },
            { label: "Failed", value: String(metrics.failedProfiles), unit: "profiles", icon: XCircle },
            { label: "YouTube OK", value: String(metrics.youtubeWorking), unit: "profiles", icon: CheckCircle2 },
            { label: "Discord OK", value: String(metrics.discordWorking), unit: "profiles", icon: CheckCircle2 },
            { label: "Both OK", value: String(metrics.bothWorking), unit: "profiles", icon: CheckCircle2 },
            { label: "Runtime", value: runtime.isRunning ? "ON" : "OFF", unit: runtime.activePid ? `pid ${runtime.activePid}` : "no pid", icon: Clock },
          ].map((item) => (
            <div key={item.label} className="flex flex-col gap-2.5 bg-[#0e0e0e] border border-[#1a1a1a] rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-[#333333] uppercase tracking-[0.1em]" style={{ fontSize: "8px", fontFamily: "'Inter', sans-serif", fontWeight: 600 }}>{item.label}</span>
                <item.icon size={11} className="text-[#2a2a2a]" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-white" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 300, fontSize: "20px", letterSpacing: "-0.02em" }}>{item.value}</span>
                <span className="text-[#333333]" style={{ fontSize: "9px", fontFamily: "'JetBrains Mono', monospace" }}>{item.unit}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-5">
          <div className="bg-[#0e0e0e] border border-[#1a1a1a] rounded-xl p-5">
            <div className="mb-5">
              <span className="text-white" style={{ fontSize: "12px", fontFamily: "'Inter', sans-serif", fontWeight: 500 }}>Per-profile test results</span>
            </div>
            {profileOps.length === 0 ? (
              <div className="text-[#444444]" style={{ fontSize: "11px" }}>No analytics data available yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={profileOps} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="#141414" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#2a2a2a", fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: "#2a2a2a", fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="launches" name="launches" fill="#555555" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="success" name="success" fill="#6a8a6a" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="fail" name="fail" fill="#8a2222" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="youtubePass" name="yt pass" fill="#1d4d7a" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="discordPass" name="dc pass" fill="#4a2a7a" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-[#0e0e0e] border border-[#1a1a1a] rounded-xl p-5">
            <div className="mb-5">
              <span className="text-white" style={{ fontSize: "12px", fontFamily: "'Inter', sans-serif", fontWeight: 500 }}>Operational events ({timeRange})</span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={eventsData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="#141414" vertical={false} />
                <XAxis dataKey="key" tick={{ fontSize: 9, fill: "#2a2a2a", fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "#2a2a2a", fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" name="count" fill="#444444" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 text-[#444444]" style={{ fontSize: "10px", fontFamily: "'JetBrains Mono', monospace" }}>
              switches in range: {metrics.switches} | parse errors: {summary.readErrorCount}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
