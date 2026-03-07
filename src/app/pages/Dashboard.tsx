import { useMemo, type ComponentType } from "react";
import {
  Power,
  StopCircle,
  RefreshCw,
  Shuffle,
  FlaskConical,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
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

const statusTextColor: Record<string, string> = {
  active: "text-white",
  working: "text-[#88aa88]",
  testing: "text-[#aa8833]",
  available: "text-[#777777]",
  not_tested: "text-[#555555]",
  stopped: "text-[#444444]",
  failed: "text-[#aa3333]",
};

const statusDotColor: Record<string, string> = {
  active: "bg-white",
  working: "bg-[#6a8a6a]",
  testing: "bg-[#8a6500]",
  available: "bg-[#5a5a5a]",
  not_tested: "bg-[#3a3a3a]",
  stopped: "bg-[#2a2a2a]",
  failed: "bg-[#8a2222]",
};

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

function formatTs(value: string | null): string {
  if (!value) {
    return "n/a";
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return value;
  }
  return new Date(parsed).toLocaleString();
}

export function Dashboard() {
  const { altProfiles, activeAlt, runtime, summary, profiles, diagnostics } = useUiData();
  const loading = useAppStore((state) => state.loading);
  const error = useAppStore((state) => state.error);
  const restartAnalysis = useAppStore((state) => state.restartAnalysis);
  const setActiveProfile = useAppStore((state) => state.setActiveProfile);
  const setBypassEnabled = useAppStore((state) => state.setBypassEnabled);
  const testAllProfiles = useAppStore((state) => state.testAllProfiles);

  const isRunning = runtime.isRunning;

  const stats = useMemo(() => {
    const testedProfiles = profiles.filter((item) => item.lastTestResult !== "not_tested").length;
    const workingProfiles = profiles.filter((item) => item.runtimeStatus === "working" || item.runtimeStatus === "active").length;
    const failedProfiles = profiles.filter((item) => item.runtimeStatus === "failed").length;
    const launchErrors = diagnostics.filter((d) => d.severity === "error").length;

    return [
      { label: "Runtime", value: runtime.isRunning ? "ENABLED" : "DISABLED" },
      { label: "Active ALT", value: activeAlt?.name ?? "n/a" },
      { label: "Last success profile", value: runtime.lastSuccessfulProfileId ?? "n/a" },
      { label: "Last launch", value: formatTs(runtime.lastLaunchAt) },
      { label: "Last stop", value: formatTs(runtime.lastStoppedAt) },
      { label: "Profiles found", value: String(summary.profileCount) },
      { label: "Profiles tested", value: String(testedProfiles) },
      { label: "Profiles working", value: String(workingProfiles) },
      { label: "Profiles failed", value: String(failedProfiles) },
      { label: "IP lists found", value: String(summary.ipListCount) },
      { label: "Reference", value: runtime.referenceAvailable ? "AVAILABLE" : "UNAVAILABLE" },
      { label: "Process", value: runtime.activePid ? `PID ${runtime.activePid}` : "STOPPED" },
      { label: "Launch success", value: String(runtime.launchSuccessCount) },
      { label: "Launch fail", value: String(runtime.launchFailureCount) },
      { label: "Switches", value: String(runtime.switchCount) },
      { label: "Launch errors", value: String(launchErrors) },
      { label: "Last analysis", value: formatTs(runtime.lastAnalysisAt) },
      { label: "Last runtime event", value: runtime.lastRuntimeEvent ?? "n/a" },
    ];
  }, [profiles, runtime, summary.ipListCount, summary.profileCount, diagnostics, activeAlt?.name]);

  const switchToNext = async () => {
    if (!activeAlt || altProfiles.length <= 1) {
      return;
    }
    const currentIndex = altProfiles.findIndex((item) => item.id === activeAlt.id);
    const nextIndex = (currentIndex + 1) % altProfiles.length;
    await setActiveProfile(altProfiles[nextIndex].id);
  };

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 flex flex-col overflow-y-auto app-scroll p-6 gap-5">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <h1 className="text-white" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 300, letterSpacing: "-0.02em", fontSize: "20px" }}>
              Dashboard
            </h1>
            <span className="text-[#333333]" style={{ fontSize: "11px", fontFamily: "'JetBrains Mono', monospace" }}>
              Operational state for DPI runtime and reference analysis
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ActionButton icon={FlaskConical} label="Test All" onClick={() => void testAllProfiles()} disabled={loading || altProfiles.length === 0} />
            <ActionButton icon={Shuffle} label="Switch Alt" onClick={() => void switchToNext()} disabled={loading || altProfiles.length < 2} />
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

        <div className="grid grid-cols-3 gap-3">
          {stats.map((item) => (
            <div key={item.label} className="bg-[#0e0e0e] border border-[#1e1e1e] rounded-lg px-4 py-3">
              <div className="text-[#3a3a3a] uppercase tracking-[0.08em]" style={{ fontSize: "8px", fontFamily: "'Inter', sans-serif", fontWeight: 600 }}>
                {item.label}
              </div>
              <div className="text-white mt-1" style={{ fontSize: "12px", fontFamily: "'JetBrains Mono', monospace" }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>

        <div className="bg-[#0e0e0e] border border-[#1e1e1e] rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-white" style={{ fontSize: "12px", fontFamily: "'Inter', sans-serif", fontWeight: 500, letterSpacing: "0.02em" }}>
              Profile Runtime Results
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {profiles.slice(0, 12).map((profile) => (
              <div key={profile.id} className="flex items-center gap-3 py-2 border-b border-[#161616] last:border-0">
                <div className={`w-1.5 h-1.5 rounded-full ${statusDotColor[profile.isActive ? "active" : profile.runtimeStatus] || "bg-[#2a2a2a]"}`} />
                <span className="text-white" style={{ fontSize: "11px", fontFamily: "'Inter', sans-serif" }}>{profile.name}</span>
                <span className={`${statusTextColor[profile.isActive ? "active" : profile.runtimeStatus] || "text-[#555555]"} ml-auto`} style={{ fontSize: "9px", fontFamily: "'JetBrains Mono', monospace" }}>
                  {statusText[profile.isActive ? "active" : profile.runtimeStatus] || profile.runtimeStatus.toUpperCase()}
                </span>
                <span className="text-[#555555]" style={{ fontSize: "9px", fontFamily: "'JetBrains Mono', monospace" }}>
                  launches: {profile.launchCount} / ok: {profile.successCount} / fail: {profile.failCount}
                </span>
                <span className="text-[#444444]" style={{ fontSize: "9px", fontFamily: "'JetBrains Mono', monospace" }}>
                  last: {formatTs(profile.lastTestAt)}
                </span>
              </div>
            ))}
            {profiles.length === 0 && (
              <div className="text-[#444444]" style={{ fontSize: "11px" }}>No profiles found in reference.</div>
            )}
          </div>
        </div>
      </div>

      <div className="w-[280px] border-l border-[#161616] bg-[#090909] p-4 overflow-y-auto app-scroll shrink-0">
        <div className="mb-4">
          <span className="text-[#2a2a2a] uppercase tracking-[0.12em]" style={{ fontSize: "9px", fontFamily: "'Inter', sans-serif", fontWeight: 600 }}>
            Live Metrics
          </span>
        </div>

        <div className="flex flex-col gap-2.5">
          {altProfiles.map((alt) => (
            <button
              key={alt.id}
              type="button"
              onClick={() => void setActiveProfile(alt.id)}
              className={`w-full text-left rounded-lg border px-3 py-3 transition-all ${alt.isActive ? "border-[#2a2a2a] bg-[#111111]" : "border-[#1a1a1a] bg-[#0b0b0b] hover:border-[#252525]"}`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDotColor[alt.status] || "bg-[#2a2a2a]"}`} />
                  <span className="text-white" style={{ fontSize: "12px", fontFamily: "'Inter', sans-serif", fontWeight: 600 }}>
                    {alt.name}
                  </span>
                </div>
                <span className={statusTextColor[alt.status] || "text-[#555555]"} style={{ fontSize: "8px", fontFamily: "'Inter', sans-serif", fontWeight: 600, letterSpacing: "0.1em" }}>
                  {statusText[alt.status] || alt.status.toUpperCase()}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span style={{ fontSize: "9px", fontFamily: "'JetBrains Mono', monospace", color: "#444444" }}>
                  launches {profiles.find((item) => item.id === alt.id)?.launchCount ?? 0}
                </span>
                <span style={{ fontSize: "9px", fontFamily: "'JetBrains Mono', monospace", color: "#444444" }}>
                  ok {profiles.find((item) => item.id === alt.id)?.successCount ?? 0}
                </span>
                <span style={{ fontSize: "9px", fontFamily: "'JetBrains Mono', monospace", color: "#444444" }}>
                  fail {profiles.find((item) => item.id === alt.id)?.failCount ?? 0}
                </span>
              </div>

              {alt.status === "failed" ? (
                <div className="mt-2 flex items-center gap-1">
                  <AlertTriangle size={9} className="text-[#4a1a1a]" />
                  <span style={{ fontSize: "8px", fontFamily: "'JetBrains Mono', monospace", color: "#5a2a2a" }}>
                    Last test failed
                  </span>
                </div>
              ) : alt.status === "working" || alt.status === "active" ? (
                <div className="mt-2 flex items-center gap-1">
                  <CheckCircle2 size={9} className="text-[#2f4f2f]" />
                  <span style={{ fontSize: "8px", fontFamily: "'JetBrains Mono', monospace", color: "#4c6c4c" }}>
                    Working for current user
                  </span>
                </div>
              ) : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
