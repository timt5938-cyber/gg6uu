import { useMemo, useState } from "react";
import {
  Star,
  Play,
  FlaskConical,
  Search,
  ArrowUpDown,
  RefreshCw,
} from "lucide-react";
import { useUiData } from "../hooks/useUiData";
import { useAppStore } from "../store/appStore";

type ProfileFilter = "all" | "active" | "online" | "unstable" | "offline" | "error";

const statusConfig: Record<ProfileFilter, { label: string; text: string }> = {
  all: { label: "ALL", text: "text-[#666666]" },
  active: { label: "ACTIVE", text: "text-white" },
  online: { label: "ONLINE", text: "text-[#888888]" },
  unstable: { label: "UNSTABLE", text: "text-[#aa7700]" },
  offline: { label: "OFFLINE", text: "text-[#3a3a3a]" },
  error: { label: "ERROR", text: "text-[#993333]" },
};

export function AltProfiles() {
  const { altProfiles, summary } = useUiData();
  const loading = useAppStore((state) => state.loading);
  const setActiveProfile = useAppStore((state) => state.setActiveProfile);
  const setBypassEnabled = useAppStore((state) => state.setBypassEnabled);
  const refresh = useAppStore((state) => state.refresh);

  const [selected, setSelected] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<ProfileFilter>("all");
  const [sortBy, setSortBy] = useState<"quality" | "speed" | "latency">("quality");

  const filtered = useMemo(() => {
    const base = altProfiles.filter((alt) => {
      const matchesSearch =
        alt.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        alt.label.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = filterStatus === "all" || alt.status === filterStatus;
      return matchesSearch && matchesStatus;
    });

    return base.sort((a, b) => {
      if (sortBy === "quality") {
        return b.quality - a.quality;
      }
      if (sortBy === "speed") {
        return b.speed - a.speed;
      }
      return a.latency - b.latency;
    });
  }, [altProfiles, searchQuery, filterStatus, sortBy]);

  const toggleSelect = (id: string): void => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-7 py-5 border-b border-[#151515] shrink-0">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-white" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 300, letterSpacing: "-0.02em", fontSize: "20px" }}>
            Alt Profiles
          </h1>
          <span className="text-[#333333]" style={{ fontSize: "11px", fontFamily: "'JetBrains Mono', monospace" }}>
            {summary.profileCount} profiles Р’В· {altProfiles.filter((item) => item.status === "active" || item.status === "online").length} reachable
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-[#141414] border border-[#222222] text-[#666666] hover:text-white hover:border-[#333333] transition-all"
          >
            <RefreshCw size={11} />
            <span style={{ fontSize: "10px", fontFamily: "'Inter', sans-serif" }}>{loading ? "Scanning..." : "Refresh"}</span>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 px-7 py-3 border-b border-[#131313] shrink-0">
        <div className="flex items-center gap-2 bg-[#0e0e0e] border border-[#1a1a1a] rounded-md px-3 py-2 w-64 focus-within:border-[#2a2a2a]">
          <Search size={12} className="text-[#333333]" />
          <input
            className="bg-transparent outline-none text-[#888888] placeholder:text-[#2a2a2a] flex-1"
            style={{ fontSize: "11px", fontFamily: "'Inter', sans-serif" }}
            placeholder="Search profiles..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>

        <div className="flex items-center gap-1">
          {(Object.keys(statusConfig) as ProfileFilter[]).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1.5 rounded-md transition-all ${
                filterStatus === status
                  ? "bg-white text-black"
                  : `${statusConfig[status].text} hover:text-[#888888] hover:bg-[#141414]`
              }`}
              style={{ fontSize: "10px", fontFamily: "'Inter', sans-serif", fontWeight: 500, letterSpacing: "0.08em" }}
            >
              {statusConfig[status].label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSortBy((current) => (current === "quality" ? "speed" : current === "speed" ? "latency" : "quality"))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[#444444] hover:text-[#888888] hover:bg-[#141414] transition-all"
          >
            <ArrowUpDown size={11} />
            <span style={{ fontSize: "10px", fontFamily: "'Inter', sans-serif" }}>Sort: {sortBy}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto app-scroll">
        <div className="min-w-[900px]">
          <div className="grid grid-cols-[36px_36px_180px_110px_140px_120px_90px_120px_120px_120px] px-6 py-2 border-b border-[#141414] bg-[#090909]">
            {[
              "",
              "",
              "NAME",
              "STATUS",
              "PROTOCOL",
              "SPEED",
              "LATENCY",
              "STABILITY",
              "QUALITY",
              "ACTIONS",
            ].map((header, index) => (
              <span
                key={`${header}-${index}`}
                style={{ fontSize: "9px", fontFamily: "'Inter', sans-serif", fontWeight: 600, letterSpacing: "0.12em", color: "#2a2a2a" }}
              >
                {header}
              </span>
            ))}
          </div>

          {filtered.map((alt) => {
            const disabled = alt.status === "offline" || alt.status === "error";
            return (
              <div
                key={alt.id}
                className={`grid grid-cols-[36px_36px_180px_110px_140px_120px_90px_120px_120px_120px] px-6 py-3 border-b border-[#141414] items-center transition-colors ${
                  alt.isActive ? "bg-[#121212]" : "hover:bg-[#0f0f0f]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleSelect(alt.id)}
                  className={`w-3.5 h-3.5 rounded-sm border ${
                    selected.includes(alt.id) ? "border-white bg-white" : "border-[#252525]"
                  }`}
                  aria-label={`Select ${alt.name}`}
                />
                <div className={`w-2 h-2 rounded-full ${alt.status === "active" ? "bg-white" : alt.status === "online" ? "bg-[#666666]" : alt.status === "unstable" ? "bg-[#996600]" : alt.status === "error" ? "bg-[#882222]" : "bg-[#2a2a2a]"}`} />
                <div className="flex items-center gap-2">
                  <span className="text-white" style={{ fontSize: "12px", fontFamily: "'Inter', sans-serif", fontWeight: alt.isActive ? 600 : 400 }}>{alt.name}</span>
                  {alt.isFavorite && <Star size={10} className="text-[#444444]" />}
                </div>
                <span className={statusConfig[alt.status].text} style={{ fontSize: "9px", fontFamily: "'Inter', sans-serif", fontWeight: 700, letterSpacing: "0.12em" }}>
                  {statusConfig[alt.status].label}
                </span>
                <span style={{ fontSize: "10px", fontFamily: "'JetBrains Mono', monospace", color: "#404040" }}>
                  {alt.protocol} Р’В· {alt.location}
                </span>
                <span style={{ fontSize: "10px", fontFamily: "'JetBrains Mono', monospace", color: disabled ? "#252525" : "#666666" }}>
                  {disabled ? "--" : `РІвЂ вЂњ ${alt.speed.toFixed(1)} / РІвЂ вЂ ${alt.upload.toFixed(1)}`}
                </span>
                <span style={{ fontSize: "10px", fontFamily: "'JetBrains Mono', monospace", color: disabled ? "#252525" : "#666666" }}>
                  {disabled ? "--" : `${alt.latency}ms`}
                </span>
                <span style={{ fontSize: "10px", fontFamily: "'JetBrains Mono', monospace", color: "#555555" }}>
                  {alt.stability.toFixed(0)}%
                </span>
                <span style={{ fontSize: "10px", fontFamily: "'JetBrains Mono', monospace", color: "#555555" }}>
                  {alt.quality.toFixed(0)}%
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={disabled || loading}
                    onClick={() => void setActiveProfile(alt.id)}
                    className="flex items-center gap-1 px-2 py-1 rounded-md bg-[#141414] border border-[#222222] text-[#666666] hover:text-white hover:border-[#333333] disabled:opacity-60"
                  >
                    <Play size={10} />
                    <span style={{ fontSize: "9px", fontFamily: "'Inter', sans-serif" }}>Activate</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { void setActiveProfile(alt.id).then(() => setBypassEnabled(true)); }}
                    className="p-1.5 rounded-md bg-[#141414] border border-[#222222] text-[#444444] hover:text-white hover:border-[#333333]"
                    title="Test"
                  >
                    <FlaskConical size={10} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


