import { useState, type CSSProperties } from "react";
import { Power, StopCircle, ChevronDown, Minus, X, Shield, Activity } from "lucide-react";
import { miniMinimize, miniClose } from "../../lib/electron";
import { useUiData } from "../hooks/useUiData";
import { useAppStore } from "../store/appStore";

export function MiniMode() {
  const [showProfiles, setShowProfiles] = useState(false);

  const { altProfiles, summary, runtime, profiles } = useUiData();
  const setActiveProfile = useAppStore((state) => state.setActiveProfile);
  const setBypassEnabled = useAppStore((state) => state.setBypassEnabled);

  const isRunning = runtime.isRunning;
  const availableAlts = altProfiles;
  const currentAlt = altProfiles.find((item) => item.isActive) ?? altProfiles[0] ?? null;
  const currentProfile = profiles.find((item) => item.id === currentAlt?.id) ?? null;

  return (
    <div className="w-screen h-screen bg-[#080808] flex items-center justify-center overflow-hidden">
      <div
        className="flex flex-col bg-[#0a0a0a] select-none overflow-hidden"
        style={{
          width: "320px",
          fontFamily: "'Inter', sans-serif",
          border: "1px solid #1e1e1e",
          borderRadius: "10px",
        }}
      >
        <div className="flex items-center justify-between h-8 px-3 bg-[#080808] border-b border-[#151515] rounded-t-[10px]" style={{ WebkitAppRegion: "drag" } as CSSProperties}>
          <div className="flex items-center gap-2">
            <Shield size={10} className="text-[#333333]" />
            <span className="text-[#3a3a3a] tracking-[0.15em] uppercase" style={{ fontSize: "9px", fontWeight: 600 }}>
              AltProxy
            </span>
          </div>
          <div className="flex items-center gap-0" style={{ WebkitAppRegion: "no-drag" } as CSSProperties}>
            <button
              type="button"
              onClick={miniMinimize}
              className="flex items-center justify-center w-8 h-8 text-[#2a2a2a] hover:text-white hover:bg-[#141414] transition-colors rounded-sm"
            >
              <Minus size={10} />
            </button>
            <button
              type="button"
              onClick={miniClose}
              className="flex items-center justify-center w-8 h-8 text-[#2a2a2a] hover:text-white hover:bg-[#2a0808] transition-colors rounded-sm"
            >
              <X size={10} />
            </button>
          </div>
        </div>

        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-white" style={{ boxShadow: isRunning ? "0 0 6px rgba(255,255,255,0.55)" : "none" }} />
              <span className="text-white" style={{ fontSize: "16px", fontWeight: 300, letterSpacing: "-0.02em" }}>
                {currentAlt?.name || "N/A"}
              </span>
            </div>
            <div className={`px-2 py-0.5 rounded-sm ${isRunning ? "bg-white" : "bg-[#1a1a1a] border border-[#252525]"}`}>
              <span style={{ fontSize: "8px", fontFamily: "'Inter', sans-serif", fontWeight: 700, letterSpacing: "0.12em", color: isRunning ? "#000" : "#333333" }}>
                {isRunning ? "ACTIVE" : "STOPPED"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="flex flex-col gap-1 bg-[#0e0e0e] border border-[#181818] rounded-md p-2.5">
              <span style={{ fontSize: "8px", fontFamily: "'Inter', sans-serif", fontWeight: 600, letterSpacing: "0.08em", color: "#2a2a2a" }}>
                LAUNCHES
              </span>
              <span className="text-white" style={{ fontSize: "15px", fontWeight: 300, letterSpacing: "-0.02em" }}>{currentProfile?.launchCount ?? 0}</span>
            </div>
            <div className="flex flex-col gap-1 bg-[#0e0e0e] border border-[#181818] rounded-md p-2.5">
              <span style={{ fontSize: "8px", fontFamily: "'Inter', sans-serif", fontWeight: 600, letterSpacing: "0.08em", color: "#2a2a2a" }}>
                LAST TEST
              </span>
              <span className="text-white" style={{ fontSize: "12px", fontWeight: 300, letterSpacing: "-0.02em" }}>{currentProfile?.lastTestResult ?? "n/a"}</span>
            </div>
            <div className="flex flex-col gap-1 bg-[#0e0e0e] border border-[#181818] rounded-md p-2.5">
              <span style={{ fontSize: "8px", fontFamily: "'Inter', sans-serif", fontWeight: 600, letterSpacing: "0.08em", color: "#2a2a2a" }}>
                SUCCESS
              </span>
              <span className="text-white" style={{ fontSize: "15px", fontWeight: 300, letterSpacing: "-0.02em" }}>{currentProfile?.successCount ?? 0}</span>
            </div>
            <div className="flex flex-col gap-1 bg-[#0e0e0e] border border-[#181818] rounded-md p-2.5">
              <span style={{ fontSize: "8px", fontFamily: "'Inter', sans-serif", fontWeight: 600, letterSpacing: "0.08em", color: "#2a2a2a" }}>
                FAIL
              </span>
              <span className="text-white" style={{ fontSize: "15px", fontWeight: 300, letterSpacing: "-0.02em" }}>{currentProfile?.failCount ?? 0}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center gap-1">
              <Activity size={9} className="text-[#252525]" />
              <span style={{ fontSize: "8px", fontFamily: "'Inter', sans-serif", color: "#252525", letterSpacing: "0.08em", fontWeight: 600 }}>
                RUNTIME STATUS
              </span>
            </div>
            <div className="flex-1 h-px bg-[#151515] rounded-full" />
            <span style={{ fontSize: "9px", fontFamily: "'JetBrains Mono', monospace", color: "#3a3a3a" }}>
              {currentProfile?.runtimeStatus ?? "n/a"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 px-4 pb-3">
          {isRunning ? (
            <button
              type="button"
              onClick={() => void setBypassEnabled(false)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md flex-1 justify-center bg-[#141414] border border-[#222222] text-[#555555] hover:text-[#cc4444] hover:border-[#3a1515] hover:bg-[#120808] transition-all"
            >
              <StopCircle size={12} />
              <span style={{ fontSize: "10px", fontWeight: 500 }}>Stop</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void setBypassEnabled(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md flex-1 justify-center bg-white text-black hover:bg-[#e0e0e0] transition-all"
            >
              <Power size={12} />
              <span style={{ fontSize: "10px", fontWeight: 600 }}>Start</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowProfiles((value) => !value)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md flex-1 justify-center bg-[#141414] border border-[#222222] text-[#555555] hover:text-white hover:border-[#2a2a2a] transition-all"
          >
            <span style={{ fontSize: "10px", fontWeight: 500 }}>Switch Alt</span>
            <ChevronDown size={10} className={`transition-transform duration-200 ${showProfiles ? "rotate-180" : ""}`} />
          </button>
        </div>

        {showProfiles && (
          <div className="border-t border-[#151515] mx-0 max-h-[150px] overflow-y-auto app-scroll">
            <div className="px-3 py-2">
              <span className="text-[#252525] uppercase tracking-[0.12em]" style={{ fontSize: "8px", fontFamily: "'Inter', sans-serif", fontWeight: 600 }}>
                Select Profile
              </span>
            </div>
            {availableAlts.map((alt) => {
              const profile = profiles.find((item) => item.id === alt.id);
              return (
                <button
                  key={alt.id}
                  type="button"
                  onClick={() => {
                    void setActiveProfile(alt.id);
                    setShowProfiles(false);
                  }}
                  className={`flex items-center gap-3 w-full px-4 py-2.5 text-left transition-all hover:bg-[#111111] ${
                    alt.id === currentAlt?.id ? "bg-[#0e0e0e]" : ""
                  }`}
                >
                  <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-white" />
                  <span className="text-white flex-1" style={{ fontSize: "11px", fontWeight: alt.id === currentAlt?.id ? 500 : 400 }}>{alt.name}</span>
                  <span style={{ fontSize: "9px", fontFamily: "'JetBrains Mono', monospace", color: "#333333" }}>
                    {profile?.runtimeStatus ?? "n/a"}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between px-4 py-2 border-t border-[#131313] rounded-b-[10px]">
          <span style={{ fontSize: "8px", fontFamily: "'JetBrains Mono', monospace", color: "#252525" }}>
            {runtime.activePid ? `pid ${runtime.activePid}` : "no process"}
          </span>
          <span style={{ fontSize: "8px", fontFamily: "'JetBrains Mono', monospace", color: "#252525" }}>
            {summary.profileCount} profiles
          </span>
        </div>
      </div>
    </div>
  );
}
