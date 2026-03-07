import { useMemo, useRef, useEffect, useState, type ComponentType } from "react";
import {
  Search,
  Download,
  Trash2,
  AlertTriangle,
  Info,
  XCircle,
  Bug,
  RefreshCw,
  Terminal,
  CheckCircle2,
} from "lucide-react";
import { useUiData } from "../hooks/useUiData";
import { useAppStore } from "../store/appStore";

type LogLevel = "ALL" | "INFO" | "WARN" | "ERROR" | "DEBUG";

const levelConfig: Record<Exclude<LogLevel, "ALL">, { icon: ComponentType<{ size?: number; className?: string }>; color: string }> = {
  INFO: { icon: Info, color: "text-[#555555]" },
  WARN: { icon: AlertTriangle, color: "text-[#886600]" },
  ERROR: { icon: XCircle, color: "text-[#883333]" },
  DEBUG: { icon: Bug, color: "text-[#333333]" },
};

function toUiTime(value: string): string {
  if (!value) {
    return "--";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleTimeString();
}

export function Logs() {
  const { logEntries, diagnostics } = useUiData();
  const refresh = useAppStore((state) => state.refresh);
  const clearLogs = useAppStore((state) => state.clearLogs);

  const [level, setLevel] = useState<LogLevel>("ALL");
  const [search, setSearch] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const logsRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    return logEntries.filter((entry) => {
      const matchLevel = level === "ALL" || entry.level.toUpperCase() === level;
      const matchSearch =
        search === "" ||
        entry.message.toLowerCase().includes(search.toLowerCase()) ||
        entry.source.toLowerCase().includes(search.toLowerCase()) ||
        entry.level.toLowerCase().includes(search.toLowerCase());
      return matchLevel && matchSearch;
    });
  }, [logEntries, level, search]);

  useEffect(() => {
    if (autoScroll && logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [filtered, autoScroll]);

  const levelCounts = useMemo(() => ({
    INFO: logEntries.filter((item) => item.level === "INFO").length,
    WARN: logEntries.filter((item) => item.level === "WARN").length,
    ERROR: logEntries.filter((item) => item.level === "ERROR").length,
    DEBUG: logEntries.filter((item) => item.level === "DEBUG").length,
  }), [logEntries]);

  const exportLogs = async () => {
    const payload = filtered
      .map((item) => `[${item.time}] [${item.level}] [${item.source}] ${item.message}`)
      .join("\n");

    await navigator.clipboard.writeText(payload);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-7 py-5 border-b border-[#151515] shrink-0">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-white" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 300, letterSpacing: "-0.02em", fontSize: "20px" }}>
            Logs & Diagnostics
          </h1>
          <span className="text-[#333333]" style={{ fontSize: "11px", fontFamily: "'JetBrains Mono', monospace" }}>
            {logEntries.length} events В· {levelCounts.ERROR} errors В· {levelCounts.WARN} warnings
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void exportLogs()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-[#0e0e0e] border border-[#1a1a1a] text-[#444444] hover:text-white hover:border-[#252525] transition-all"
          >
            <Download size={12} />
            <span style={{ fontSize: "10px", fontFamily: "'Inter', sans-serif" }}>Export</span>
          </button>
          <button
            type="button"
            onClick={() => void clearLogs()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-[#0e0e0e] border border-[#1a1a1a] text-[#444444] hover:text-white hover:border-[#252525] transition-all"
          >
            <Trash2 size={12} />
            <span style={{ fontSize: "10px", fontFamily: "'Inter', sans-serif" }}>Clear</span>
          </button>
          <button
            type="button"
            onClick={() => void refresh()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-[#0e0e0e] border border-[#1a1a1a] text-[#444444] hover:text-white hover:border-[#252525] transition-all"
          >
            <RefreshCw size={12} />
            <span style={{ fontSize: "10px", fontFamily: "'Inter', sans-serif" }}>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => setAutoScroll((value) => !value)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md border transition-all ${
              autoScroll
                ? "bg-white text-black border-white"
                : "bg-[#0e0e0e] border-[#1a1a1a] text-[#444444] hover:text-white hover:border-[#252525]"
            }`}
          >
            <RefreshCw size={12} />
            <span style={{ fontSize: "10px", fontFamily: "'Inter', sans-serif", fontWeight: 500 }}>
              {autoScroll ? "Live" : "Paused"}
            </span>
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-3 border-b border-[#131313] shrink-0 bg-[#090909]">
            <div className="flex items-center gap-2 bg-[#0e0e0e] border border-[#1a1a1a] rounded-md px-3 py-2 w-72 focus-within:border-[#2a2a2a] transition-colors">
              <Search size={11} className="text-[#2a2a2a]" />
              <input
                className="bg-transparent outline-none text-[#777777] placeholder:text-[#252525] flex-1"
                style={{ fontSize: "11px", fontFamily: "'JetBrains Mono', monospace" }}
                placeholder="Filter logs..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <div className="flex items-center gap-1">
              {(["ALL", "INFO", "WARN", "ERROR", "DEBUG"] as LogLevel[]).map((item) => {
                const count = item === "ALL" ? logEntries.length : levelCounts[item as keyof typeof levelCounts];
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setLevel(item)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-all ${
                      level === item
                        ? "bg-white text-black"
                        : "text-[#333333] hover:text-[#777777] hover:bg-[#111111]"
                    }`}
                  >
                    <span style={{ fontSize: "9px", fontFamily: "'Inter', sans-serif", fontWeight: 600, letterSpacing: "0.1em" }}>{item}</span>
                    <span className={level === item ? "text-black/50" : "text-[#2a2a2a]"} style={{ fontSize: "8px", fontFamily: "'JetBrains Mono', monospace" }}>{count}</span>
                  </button>
                );
              })}
            </div>

            <div className="ml-auto">
              <span style={{ fontSize: "9px", fontFamily: "'JetBrains Mono', monospace", color: "#252525" }}>{filtered.length} results</span>
            </div>
          </div>

          <div className="flex items-center gap-0 px-6 py-2 border-b border-[#111111] bg-[#080808] shrink-0">
            <Terminal size={11} className="text-[#252525] mr-2" />
            <span style={{ fontSize: "8px", fontFamily: "'JetBrains Mono', monospace", color: "#252525", letterSpacing: "0.1em" }}>TIME</span>
            <div className="w-28 ml-16 shrink-0"><span style={{ fontSize: "8px", fontFamily: "'JetBrains Mono', monospace", color: "#252525", letterSpacing: "0.1em" }}>LEVEL</span></div>
            <div className="w-24 shrink-0"><span style={{ fontSize: "8px", fontFamily: "'JetBrains Mono', monospace", color: "#252525", letterSpacing: "0.1em" }}>SOURCE</span></div>
            <span style={{ fontSize: "8px", fontFamily: "'JetBrains Mono', monospace", color: "#252525", letterSpacing: "0.1em" }}>MESSAGE</span>
          </div>

          <div ref={logsRef} className="flex-1 overflow-y-auto app-scroll bg-[#080808]">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <Terminal size={24} className="text-[#1e1e1e]" />
                <span style={{ fontSize: "12px", fontFamily: "'JetBrains Mono', monospace", color: "#252525" }}>
                  No events match your filter
                </span>
              </div>
            ) : (
              filtered.map((log, index) => {
                const levelName = (log.level || "INFO") as Exclude<LogLevel, "ALL">;
                const cfg = levelConfig[levelName] || levelConfig.INFO;
                const LevelIcon = cfg.icon;
                return (
                  <div key={log.id ?? `${log.time}-${index}`} className="flex items-start gap-0 px-6 py-2 border-b border-[#0d0d0d] hover:bg-[#0d0d0d] transition-colors group">
                    <span className="text-[#1e1e1e] w-8 shrink-0 mt-0.5 select-none" style={{ fontSize: "9px", fontFamily: "'JetBrains Mono', monospace" }}>
                      {String(filtered.length - index).padStart(2, " ")}
                    </span>
                    <span className="text-[#2a2a2a] w-28 shrink-0" style={{ fontSize: "10px", fontFamily: "'JetBrains Mono', monospace" }}>
                      {toUiTime(log.time)}
                    </span>
                    <div className="flex items-center gap-1.5 w-24 shrink-0">
                      <LevelIcon size={9} className={cfg.color} />
                      <span className={cfg.color} style={{ fontSize: "9px", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, letterSpacing: "0.08em" }}>
                        {levelName}
                      </span>
                    </div>
                    <span className="text-[#2e2e2e] w-20 shrink-0" style={{ fontSize: "9px", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.05em" }}>
                      {log.source}
                    </span>
                    <span className="text-[#4a4a4a]" style={{ fontSize: "10px", fontFamily: "'JetBrains Mono', monospace", lineHeight: "1.5" }}>
                      {log.message}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex items-center gap-4 px-6 py-2 border-t border-[#111111] bg-[#080808] shrink-0">
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${autoScroll ? "bg-white animate-pulse" : "bg-[#2a2a2a]"}`} />
              <span style={{ fontSize: "9px", fontFamily: "'JetBrains Mono', monospace", color: "#2a2a2a" }}>
                {autoScroll ? "LIVE" : "PAUSED"}
              </span>
            </div>
            <span style={{ fontSize: "9px", fontFamily: "'JetBrains Mono', monospace", color: "#2a2a2a" }}>
              Buffer: {logEntries.length}
            </span>
          </div>
        </div>

        <div className="w-[260px] shrink-0 border-l border-[#141414] flex flex-col overflow-y-auto app-scroll bg-[#090909]">
          <div className="px-5 py-4 border-b border-[#141414]">
            <span className="text-[#2a2a2a] uppercase tracking-[0.15em]" style={{ fontSize: "9px", fontFamily: "'Inter', sans-serif", fontWeight: 600 }}>
              Quick Diagnostics
            </span>
          </div>

          <div className="flex flex-col gap-2 p-4">
            {diagnostics.slice(0, 10).map((entry) => {
              const color = entry.severity === "error" ? "text-[#883333]" : entry.severity === "warn" ? "text-[#886600]" : "text-[#555555]";
              const Icon = entry.severity === "error" ? XCircle : entry.severity === "warn" ? AlertTriangle : CheckCircle2;

              return (
                <div key={entry.id} className="flex items-start gap-2 py-2.5 border-b border-[#111111] last:border-0">
                  <Icon size={10} className={`${color} shrink-0 mt-0.5`} />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[#c0c0c0]" style={{ fontSize: "10px", fontFamily: "'Inter', sans-serif" }}>{entry.title}</span>
                    <span style={{ fontSize: "9px", fontFamily: "'JetBrains Mono', monospace", color: "#333333", lineHeight: "1.4" }}>
                      {entry.message}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

