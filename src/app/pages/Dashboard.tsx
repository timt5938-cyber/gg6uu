import { useMemo, type ComponentType } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  Power,
  StopCircle,
  RefreshCw,
  Shuffle,
  FlaskConical,
  ChevronRight,
  TrendingUp,
  Zap,
  Shield,
  Activity,
  ArrowDown,
  ArrowUp,
  Clock,
  Star,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { useUiData } from "../hooks/useUiData";
import { useAppStore } from "../store/appStore";

const statusText: Record<string, string> = {
  active: "ACTIVE",
  online: "ONLINE",
  unstable: "UNSTABLE",
  offline: "OFFLINE",
  error: "ERROR",
};

const statusTextColor: Record<string, string> = {
  active: "text-white",
  online: "text-[#888888]",
  unstable: "text-[#aa6600]",
  offline: "text-[#333333]",
  error: "text-[#aa3333]",
};

const statusDotColor: Record<string, string> = {
  active: "bg-white",
  online: "bg-[#555555]",
  unstable: "bg-[#8a6500]",
  offline: "bg-[#2a2a2a]",
  error: "bg-[#8a2222]",
};

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number }> }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#111111] border border-[#252525] rounded-md p-3">
        {payload.map((item) => (
          <div key={item.name} className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-white" />
            <span style={{ fontSize: "10px", fontFamily: "'JetBrains Mono', monospace", color: "#888888" }}>
              {item.name}:
            </span>
            <span style={{ fontSize: "10px", fontFamily: "'JetBrains Mono', monospace", color: "#e0e0e0" }}>
              {item.value.toFixed(1)} {item.name === "latency" ? "ms" : "Mbps"}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

function ActionButton({
  icon: Icon,
  label,
  variant = "default",
  onClick,
  disabled,
}: {
  icon: ComponentType<{ size?: number }>;
  label: string;
  variant?: "default" | "primary" | "danger";
  onClick?: () => void;
  disabled?: boolean;
}) {
  const styles = {
    default: "bg-[#141414] border border-[#222222] text-[#888888] hover:text-white hover:border-[#333333] hover:bg-[#1a1a1a]",
    primary: "bg-white text-black hover:bg-[#e0e0e0]",
    danger: "bg-[#141414] border border-[#222222] text-[#555555] hover:text-[#cc4444] hover:border-[#3a1a1a] hover:bg-[#1a0f0f]",
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed ${styles[variant]}`}
    >
      <Icon size={13} />
      <span style={{ fontSize: "11px", fontFamily: "'Inter', sans-serif", fontWeight: 500, letterSpacing: "0.05em" }}>
        {label}
      </span>
    </button>
  );
}

export function Dashboard() {
  const { altProfiles, activeAlt, speedHistory, switchHistory, diagnostics, ipLists, runtime, summary } = useUiData();
  const loading = useAppStore((state) => state.loading);
  const error = useAppStore((state) => state.error);
  const refresh = useAppStore((state) => state.refresh);
  const restartAnalysis = useAppStore((state) => state.restartAnalysis);
  const setActiveProfile = useAppStore((state) => state.setActiveProfile);
  const setBypassEnabled = useAppStore((state) => state.setBypassEnabled);

  const chartData = useMemo(() => speedHistory.slice(0, 30).reverse(), [speedHistory]);
  const onlineProfiles = useMemo(
    () => altProfiles.filter((item) => item.status === "active" || item.status === "online" || item.status === "unstable"),
    [altProfiles],
  );

  const isRunning = Boolean(activeAlt) && summary.dataAvailable;

  const testActiveAlt = async () => {
    if (!activeAlt) {
      return;
    }
    await setActiveProfile(activeAlt.id);
    await setBypassEnabled(true);
  };

  const switchToNext = async () => {
    if (!activeAlt || onlineProfiles.length <= 1) {
      return;
    }
    const currentIndex = onlineProfiles.findIndex((item) => item.id === activeAlt.id);
    const nextIndex = (currentIndex + 1) % onlineProfiles.length;
    await setActiveProfile(onlineProfiles[nextIndex].id);
  };

  const recommendationList = useMemo(() => {
    return [...altProfiles]
      .filter((profile) => profile.status !== "offline" && profile.status !== "error")
      .sort((a, b) => b.quality + b.stability - (a.quality + a.stability))
      .slice(0, 3);
  }, [altProfiles]);

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 flex flex-col overflow-y-auto app-scroll p-6 gap-5">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <h1
              className="text-white"
              style={{ fontFamily: "'Inter', sans-serif", fontWeight: 300, letterSpacing: "-0.02em", fontSize: "20px" }}
            >
              Dashboard
            </h1>
            <span className="text-[#333333]" style={{ fontSize: "11px", fontFamily: "'JetBrains Mono', monospace" }}>
              {runtime.referenceAvailable ? "Reference linked" : "Reference unavailable"} Р’В· Last update: {runtime.lastAnalysisAt || "n/a"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ActionButton icon={FlaskConical} label="Test Alt" onClick={() => void testActiveAlt()} disabled={loading || !activeAlt} />
            <ActionButton icon={Shuffle} label="Switch Alt" onClick={() => void switchToNext()} disabled={loading || onlineProfiles.length < 2} />
            <ActionButton icon={RefreshCw} label="Restart" onClick={() => void restartAnalysis()} disabled={loading} />
            {isRunning ? (
              <ActionButton icon={StopCircle} label="Stop" variant="danger" onClick={() => void setBypassEnabled(false)} disabled={loading} />
            ) : (
              <ActionButton icon={Power} label="Start" variant="primary" onClick={() => void setBypassEnabled(true)} disabled={loading} />
            )}
          </div>
        </div>

        {(error || !runtime.referenceAvailable) && (
          <div className="px-4 py-3 rounded-lg border border-[#2a1616] bg-[#140c0c] text-[#a97c7c]" style={{ fontSize: "11px" }}>
            {error || summary.warnings[0] || `Reference folder is not available: ${summary.referenceExists ? "pending" : "missing"}`}
          </div>
        )}

        <div className="relative bg-[#0e0e0e] border border-[#1e1e1e] rounded-xl p-6 overflow-hidden">
          <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: "radial-gradient(circle at 100% 0%, white 0%, transparent 50%)" }} />
          <div className="flex items-start gap-8 relative">
            <div className="flex flex-col gap-2 min-w-[240px]">
              <span className="text-[#333333] uppercase tracking-[0.15em]" style={{ fontSize: "9px", fontFamily: "'Inter', sans-serif", fontWeight: 600 }}>
                Active Profile
              </span>
              <div className="flex items-baseline gap-3">
                <span className="text-white" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 200, letterSpacing: "-0.03em", fontSize: "52px", lineHeight: 1 }}>
                  {activeAlt?.name || "N/A"}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm ${isRunning ? "bg-white" : "bg-[#1a1a1a] border border-[#2a2a2a]"}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${isRunning ? "bg-black animate-pulse" : "bg-[#333333]"}`} />
                  <span
                    style={{
                      fontSize: "9px",
                      fontFamily: "'Inter', sans-serif",
                      fontWeight: 700,
                      letterSpacing: "0.15em",
                      color: isRunning ? "#000" : "#444444",
                    }}
                  >
                    {isRunning ? "ACTIVE" : "STOPPED"}
                  </span>
                </div>
                <span className="text-[#333333]" style={{ fontSize: "10px", fontFamily: "'JetBrains Mono', monospace" }}>
                  {activeAlt?.protocol || "-"} Р’В· {activeAlt?.location || "-"}
                </span>
              </div>
            </div>

            <div className="w-px h-24 bg-[#1a1a1a] self-center" />

            <div className="grid grid-cols-3 gap-6 flex-1">
              {[
                { label: "Download", value: activeAlt?.speed ?? 0, unit: "Mbps", icon: ArrowDown, max: 1000 },
                { label: "Upload", value: activeAlt?.upload ?? 0, unit: "Mbps", icon: ArrowUp, max: 600 },
                { label: "Latency", value: activeAlt?.latency ?? 0, unit: "ms", icon: Zap, max: 250 },
                { label: "Stability", value: activeAlt?.stability ?? 0, unit: "%", icon: Shield, max: 100 },
                { label: "Quality", value: activeAlt?.quality ?? 0, unit: "%", icon: Activity, max: 100 },
                { label: "Load", value: activeAlt?.load ?? 0, unit: "%", icon: TrendingUp, max: 100 },
              ].map((metric) => (
                <div key={metric.label} className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <metric.icon size={10} className="text-[#333333]" />
                    <span className="text-[#3a3a3a] uppercase tracking-[0.1em]" style={{ fontSize: "8px", fontFamily: "'Inter', sans-serif", fontWeight: 600 }}>
                      {metric.label}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-white" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 300, fontSize: "20px", letterSpacing: "-0.02em" }}>
                      {metric.value.toFixed(metric.unit === "ms" ? 0 : 1)}
                    </span>
                    <span className="text-[#333333]" style={{ fontSize: "9px", fontFamily: "'JetBrains Mono', monospace" }}>
                      {metric.unit}
                    </span>
                  </div>
                  <div className="h-px bg-[#1a1a1a] rounded-full overflow-hidden">
                    <div className="h-full bg-white rounded-full" style={{ width: `${Math.max(0, Math.min(100, (metric.value / metric.max) * 100))}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col items-center justify-center gap-2 pl-4">
              <div className="relative w-20 h-20">
                <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="#1a1a1a" strokeWidth="4" />
                  <circle
                    cx="40"
                    cy="40"
                    r="34"
                    fill="none"
                    stroke="white"
                    strokeWidth="4"
                    strokeDasharray={`${2 * Math.PI * 34}`}
                    strokeDashoffset={`${2 * Math.PI * 34 * (1 - (activeAlt?.successRate || 0) / 100)}`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-white" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 300, fontSize: "16px" }}>
                    {(activeAlt?.successRate || 0).toFixed(0)}%
                  </span>
                </div>
              </div>
              <span className="text-[#333333] uppercase tracking-[0.1em] text-center" style={{ fontSize: "8px", fontFamily: "'Inter', sans-serif", fontWeight: 600 }}>
                Success
                <br />Rate
              </span>
            </div>
          </div>
        </div>

        <div className="bg-[#0e0e0e] border border-[#1e1e1e] rounded-xl p-5">
          <div className="flex items-center justify-between mb-5">
            <div className="flex flex-col gap-0.5">
              <span className="text-white" style={{ fontSize: "12px", fontFamily: "'Inter', sans-serif", fontWeight: 500, letterSpacing: "0.02em" }}>
                Connection Activity
              </span>
              <span className="text-[#333333]" style={{ fontSize: "10px", fontFamily: "'JetBrains Mono', monospace" }}>
                Real-time throughput Р’В· {activeAlt?.name || "N/A"}
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="dlGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="white" stopOpacity={0.08} />
                  <stop offset="100%" stopColor="white" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="ulGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#555555" stopOpacity={0.1} />
                  <stop offset="100%" stopColor="#555555" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#141414" strokeDasharray="0" vertical={false} />
              <XAxis dataKey="time" tick={{ fontSize: 9, fill: "#333333", fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} interval={4} />
              <YAxis tick={{ fontSize: 9, fill: "#333333", fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="download" name="download" stroke="white" strokeWidth={1} fill="url(#dlGrad)" dot={false} />
              <Area type="monotone" dataKey="upload" name="upload" stroke="#555555" strokeWidth={1} fill="url(#ulGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-2 gap-5">
          <div className="bg-[#0e0e0e] border border-[#1e1e1e] rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-white" style={{ fontSize: "12px", fontFamily: "'Inter', sans-serif", fontWeight: 500, letterSpacing: "0.02em" }}>
                Switch History
              </span>
              <Clock size={12} className="text-[#2a2a2a]" />
            </div>
            <div className="flex flex-col gap-0">
              {switchHistory.slice(0, 6).map((entry, index) => (
                <div key={`${entry.time}-${index}`} className="flex items-center gap-3 py-2.5 border-b border-[#141414] last:border-0">
                  <span className="text-[#2a2a2a] w-28 shrink-0" style={{ fontSize: "9px", fontFamily: "'JetBrains Mono', monospace" }}>
                    {entry.time}
                  </span>
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-[#444444]" style={{ fontSize: "10px", fontFamily: "'JetBrains Mono', monospace" }}>{entry.from}</span>
                    <ChevronRight size={9} className="text-[#2a2a2a]" />
                    <span className="text-white" style={{ fontSize: "10px", fontFamily: "'JetBrains Mono', monospace" }}>{entry.to}</span>
                    <span className="ml-auto text-[#2a2a2a]" style={{ fontSize: "9px", fontFamily: "'JetBrains Mono', monospace" }}>{entry.reason}</span>
                  </div>
                  <span className="text-[#2a2a2a] w-8 text-right shrink-0" style={{ fontSize: "9px", fontFamily: "'JetBrains Mono', monospace" }}>
                    {entry.duration}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#0e0e0e] border border-[#1e1e1e] rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-white" style={{ fontSize: "12px", fontFamily: "'Inter', sans-serif", fontWeight: 500, letterSpacing: "0.02em" }}>
                Recommendations
              </span>
              <CheckCircle2 size={12} className="text-[#2a2a2a]" />
            </div>
            <div className="flex flex-col gap-2">
              {recommendationList.map((profile, index) => (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => void setActiveProfile(profile.id)}
                  className="flex items-center gap-4 bg-[#0e0e0e] border border-[#1a1a1a] rounded-md px-4 py-3 hover:border-[#252525] transition-colors text-left"
                >
                  <div className="flex flex-col items-center gap-0.5 w-10">
                    <span className="text-[#333333] uppercase" style={{ fontSize: "8px", fontFamily: "'Inter', sans-serif", fontWeight: 600, letterSpacing: "0.1em" }}>
                      {index === 0 ? "BEST" : index === 1 ? "FAST" : "STABLE"}
                    </span>
                    <span className="text-white" style={{ fontSize: "14px", fontFamily: "'Inter', sans-serif", fontWeight: 600 }}>
                      {profile.name}
                    </span>
                  </div>
                  <div className="w-px h-8 bg-[#1e1e1e]" />
                  <div className="flex flex-col gap-0.5 flex-1">
                    <span style={{ fontSize: "10px", fontFamily: "'JetBrains Mono', monospace", color: "#666666" }}>
                      {profile.speed.toFixed(1)} Mbps Р’В· {profile.latency}ms Р’В· {profile.stability}% stable
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="w-[260px] shrink-0 border-l border-[#151515] bg-[#090909] flex flex-col overflow-y-auto app-scroll">
        <div className="p-5 border-b border-[#151515]">
          <span className="text-[#2a2a2a] uppercase tracking-[0.15em]" style={{ fontSize: "9px", fontFamily: "'Inter', sans-serif", fontWeight: 600 }}>
            Live Metrics
          </span>
        </div>

        <div className="flex flex-col p-4 gap-2">
          {altProfiles.map((alt) => (
            <button
              key={alt.id}
              type="button"
              onClick={() => void setActiveProfile(alt.id)}
              className={`flex flex-col gap-2 p-3 rounded-md border transition-colors text-left ${
                alt.isActive
                  ? "border-[#252525] bg-[#111111]"
                  : "border-[#141414] bg-[#0c0c0c] hover:border-[#1e1e1e]"
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDotColor[alt.status] || "bg-[#2a2a2a]"}`} />
                <span className="text-white flex-1" style={{ fontSize: "11px", fontFamily: "'Inter', sans-serif", fontWeight: alt.isActive ? 600 : 400 }}>
                  {alt.name}
                </span>
                <span className={statusTextColor[alt.status] || "text-[#555555]"} style={{ fontSize: "8px", fontFamily: "'Inter', sans-serif", fontWeight: 600, letterSpacing: "0.1em" }}>
                  {statusText[alt.status] || alt.status.toUpperCase()}
                </span>
              </div>
              {alt.status !== "offline" && alt.status !== "error" ? (
                <div className="flex items-center gap-3 pl-3.5">
                  <span style={{ fontSize: "9px", fontFamily: "'JetBrains Mono', monospace", color: "#383838" }}>
                    РІвЂ вЂњ{alt.speed.toFixed(0)}
                  </span>
                  <span style={{ fontSize: "9px", fontFamily: "'JetBrains Mono', monospace", color: "#2e2e2e" }}>
                    РІвЂ вЂ{alt.upload.toFixed(0)}
                  </span>
                  <span style={{ fontSize: "9px", fontFamily: "'JetBrains Mono', monospace", color: "#2e2e2e" }}>
                    {alt.latency}ms
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 pl-3.5">
                  <AlertTriangle size={9} className={alt.status === "error" ? "text-[#4a1a1a]" : "text-[#2a2a2a]"} />
                  <span style={{ fontSize: "9px", fontFamily: "'JetBrains Mono', monospace", color: "#2e2e2e" }}>
                    {alt.lastCheck}
                  </span>
                </div>
              )}
            </button>
          ))}
        </div>

        <div className="mt-auto p-5 border-t border-[#151515]">
          <div className="flex flex-col gap-3">
            <span className="text-[#2a2a2a] uppercase tracking-[0.15em]" style={{ fontSize: "9px", fontFamily: "'Inter', sans-serif", fontWeight: 600 }}>
              Diagnostics
            </span>
            <div className="flex items-center justify-between">
              <span style={{ fontSize: "10px", fontFamily: "'Inter', sans-serif", color: "#333333" }}>Profiles</span>
              <span style={{ fontSize: "10px", fontFamily: "'JetBrains Mono', monospace", color: "#555555" }}>{summary.profileCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span style={{ fontSize: "10px", fontFamily: "'Inter', sans-serif", color: "#333333" }}>IP Lists</span>
              <span style={{ fontSize: "10px", fontFamily: "'JetBrains Mono', monospace", color: "#555555" }}>{summary.ipListCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span style={{ fontSize: "10px", fontFamily: "'Inter', sans-serif", color: "#333333" }}>Read Errors</span>
              <span style={{ fontSize: "10px", fontFamily: "'JetBrains Mono', monospace", color: "#555555" }}>{summary.readErrorCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span style={{ fontSize: "10px", fontFamily: "'Inter', sans-serif", color: "#333333" }}>List Warnings</span>
              <span style={{ fontSize: "10px", fontFamily: "'JetBrains Mono', monospace", color: "#555555" }}>
                {ipLists.reduce((acc, item) => acc + item.parseWarnings.length, 0)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span style={{ fontSize: "10px", fontFamily: "'Inter', sans-serif", color: "#333333" }}>Critical Diagnostics</span>
              <span style={{ fontSize: "10px", fontFamily: "'JetBrains Mono', monospace", color: "#555555" }}>
                {diagnostics.filter((diag) => diag.severity === "error").length}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}




