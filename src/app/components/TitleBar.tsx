import { useState, useEffect, type CSSProperties } from "react";
import { Minus, Square, X, Shield, Activity, Maximize2 } from "lucide-react";
import { minimize, maximize, closeWindow, openMini, isMaximized, isElectron } from "../../lib/electron";
import { useUiData } from "../hooks/useUiData";

export function TitleBar() {
  const [maximized, setMaximized] = useState(false);
  const { activeAlt, runtime } = useUiData();

  useEffect(() => {
    if (!isElectron()) {
      return;
    }

    const check = async () => {
      const next = await isMaximized();
      setMaximized(next);
    };

    void check();
    const interval = setInterval(() => {
      void check();
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="flex items-center justify-between h-10 bg-[#0a0a0a] border-b border-[#1e1e1e] px-0 select-none shrink-0"
      style={{ WebkitAppRegion: "drag" } as CSSProperties}
    >
      <div className="flex items-center gap-3 px-4 h-full">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-white rounded-sm flex items-center justify-center">
            <Shield size={12} className="text-black" />
          </div>
          <span className="text-white tracking-[0.15em] uppercase" style={{ fontSize: "11px", fontFamily: "'Inter', sans-serif", fontWeight: 600 }}>
            AltProxy
          </span>
          <span className="text-[#404040] tracking-[0.1em]" style={{ fontSize: "10px", fontFamily: "'Inter', sans-serif", fontWeight: 400 }}>
            CONTROL CENTER
          </span>
        </div>
        <div className="w-px h-4 bg-[#1e1e1e] mx-1" />
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${runtime.isRunning ? "bg-white animate-pulse" : "bg-[#444444]"}`} />
          <span className="text-[#666666]" style={{ fontSize: "10px", fontFamily: "'JetBrains Mono', monospace" }}>
            {activeAlt ? `${activeAlt.name} • ${activeAlt.status.toUpperCase()}` : "NO ACTIVE ALT"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-6 absolute left-1/2 -translate-x-1/2">
        <div className="flex items-center gap-1.5">
          <Activity size={10} className="text-[#555555]" />
          <span style={{ fontSize: "10px", fontFamily: "'JetBrains Mono', monospace", color: "#888888" }}>
            {runtime.isRunning ? "runtime: on" : "runtime: off"}
          </span>
        </div>
        <div className="w-px h-3 bg-[#1e1e1e]" />
        <div className="flex items-center gap-1.5">
          <span style={{ fontSize: "10px", fontFamily: "'JetBrains Mono', monospace", color: "#888888" }}>
            {runtime.activePid ? `pid ${runtime.activePid}` : "no pid"}
          </span>
        </div>
      </div>

      <div className="flex items-center h-full" style={{ WebkitAppRegion: "no-drag" } as CSSProperties}>
        {isElectron() && (
          <button
            onClick={openMini}
            className="flex items-center justify-center w-10 h-full text-[#333333] hover:text-[#888888] hover:bg-[#141414] transition-colors"
            title="Mini Mode"
          >
            <Maximize2 size={10} />
          </button>
        )}

        <button
          onClick={minimize}
          className="flex items-center justify-center w-12 h-full text-[#555555] hover:text-white hover:bg-[#1a1a1a] transition-colors"
          title="Minimize"
        >
          <Minus size={12} />
        </button>

        <button
          onClick={maximize}
          className="flex items-center justify-center w-12 h-full text-[#555555] hover:text-white hover:bg-[#1a1a1a] transition-colors"
          title={maximized ? "Restore" : "Maximize"}
        >
          {maximized ? (
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <rect x="2" y="0" width="9" height="9" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" />
              <rect x="0" y="2" width="9" height="9" rx="1" stroke="currentColor" strokeWidth="1.2" fill="#0a0a0a" />
              <rect x="0" y="2" width="9" height="9" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" />
            </svg>
          ) : (
            <Square size={11} />
          )}
        </button>

        <button
          onClick={closeWindow}
          className="flex items-center justify-center w-12 h-full text-[#555555] hover:text-white hover:bg-[#3a0000] transition-colors"
          title="Close"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}
