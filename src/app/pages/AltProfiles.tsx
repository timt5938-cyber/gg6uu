import { useMemo, useState } from "react";
import { Star, Play, FlaskConical, Search, ArrowUpDown, RefreshCw } from "lucide-react";
import { useUiData } from "../hooks/useUiData";
import { useAppStore } from "../store/appStore";

type ProfileFilter = "all" | "active" | "working" | "testing" | "not_tested" | "stopped" | "failed";

const statusConfig: Record<ProfileFilter, { label: string; text: string }> = {
  all: { label: "ALL", text: "text-[#666666]" },
  active: { label: "ACTIVE", text: "text-white" },
  working: { label: "WORKING", text: "text-[#88aa88]" },
  testing: { label: "TESTING", text: "text-[#aa7700]" },
  not_tested: { label: "NOT TESTED", text: "text-[#555555]" },
  stopped: { label: "STOPPED", text: "text-[#3a3a3a]" },
  failed: { label: "FAILED", text: "text-[#993333]" },
};

export function AltProfiles() {
  const { altProfiles, profiles, summary } = useUiData();
  const loading = useAppStore((state) => state.loading);
  const setActiveProfile = useAppStore((state) => state.setActiveProfile);
  const setBypassEnabled = useAppStore((state) => state.setBypassEnabled);
  const refresh = useAppStore((state) => state.refresh);

  const [selected, setSelected] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<ProfileFilter>("all");
  const [sortBy, setSortBy] = useState<"launches" | "success" | "fails">("launches");

  const filtered = useMemo(() => {
    const base = altProfiles.filter((alt) => {
      const matchesSearch = alt.name.toLowerCase().includes(searchQuery.toLowerCase()) || alt.label.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = filterStatus === "all" || alt.status === filterStatus;
      return matchesSearch && matchesStatus;
    });

    return base.sort((a, b) => {
      const profileA = profiles.find((item) => item.id === a.id);
      const profileB = profiles.find((item) => item.id === b.id);
      if (sortBy === "launches") {
        return (profileB?.launchCount ?? 0) - (profileA?.launchCount ?? 0);
      }
      if (sortBy === "success") {
        return (profileB?.successCount ?? 0) - (profileA?.successCount ?? 0);
      }
      return (profileB?.failCount ?? 0) - (profileA?.failCount ?? 0);
    });
  }, [altProfiles, searchQuery, filterStatus, sortBy, profiles]);

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
            {summary.profileCount} profiles • {altProfiles.filter((item) => item.status === "active" || item.status === "working").length} working
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
                filterStatus === status ? "bg-white text-black" : `${statusConfig[status].text} hover:text-[#888888] hover:bg-[#141414]`
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
            onClick={() => setSortBy((current) => (current === "launches" ? "success" : current === "success" ? "fails" : "launches"))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[#444444] hover:text-[#888888] hover:bg-[#141414] transition-all"
          >
            <ArrowUpDown size={11} />
            <span style={{ fontSize: "10px", fontFamily: "'Inter', sans-serif" }}>Sort: {sortBy}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto app-scroll">
        <div className="min-w-[980px]">
          <div className="grid grid-cols-[36px_36px_180px_110px_140px_90px_90px_90px_160px_120px] px-6 py-2 border-b border-[#141414] bg-[#090909]">
            {["", "", "NAME", "STATUS", "PROTOCOL", "LAUNCH", "SUCCESS", "FAIL", "LAST TEST", "ACTIONS"].map((header, index) => (
              <span key={`${header}-${index}`} style={{ fontSize: "9px", fontFamily: "'Inter', sans-serif", fontWeight: 600, letterSpacing: "0.12em", color: "#2a2a2a" }}>
                {header}
              </span>
            ))}
          </div>

          {filtered.map((alt) => {
            const profile = profiles.find((item) => item.id === alt.id);
            const disabled = !profile?.isAvailable;
            return (
              <div
                key={alt.id}
                className={`grid grid-cols-[36px_36px_180px_110px_140px_90px_90px_90px_160px_120px] px-6 py-3 border-b border-[#141414] items-center transition-colors ${
                  alt.isActive ? "bg-[#121212]" : "hover:bg-[#0f0f0f]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleSelect(alt.id)}
                  className={`w-3.5 h-3.5 rounded-sm border ${selected.includes(alt.id) ? "border-white bg-white" : "border-[#252525]"}`}
                  aria-label={`Select ${alt.name}`}
                />
                <div className={`w-2 h-2 rounded-full ${alt.status === "active" ? "bg-white" : alt.status === "working" ? "bg-[#6a8a6a]" : alt.status === "testing" ? "bg-[#996600]" : alt.status === "failed" ? "bg-[#882222]" : "bg-[#2a2a2a]"}`} />
                <div className="flex items-center gap-2">
                  <span className="text-white" style={{ fontSize: "12px", fontFamily: "'Inter', sans-serif", fontWeight: alt.isActive ? 600 : 400 }}>{alt.name}</span>
                  {alt.isFavorite && <Star size={10} className="text-[#444444]" />}
                </div>
                <span className={statusConfig[alt.status].text} style={{ fontSize: "9px", fontFamily: "'Inter', sans-serif", fontWeight: 700, letterSpacing: "0.12em" }}>
                  {statusConfig[alt.status].label}
                </span>
                <span style={{ fontSize: "10px", fontFamily: "'JetBrains Mono', monospace", color: "#404040" }}>
                  {alt.protocol} • {alt.location}
                </span>
                <span style={{ fontSize: "10px", fontFamily: "'JetBrains Mono', monospace", color: "#666666" }}>{profile?.launchCount ?? 0}</span>
                <span style={{ fontSize: "10px", fontFamily: "'JetBrains Mono', monospace", color: "#666666" }}>{profile?.successCount ?? 0}</span>
                <span style={{ fontSize: "10px", fontFamily: "'JetBrains Mono', monospace", color: "#666666" }}>{profile?.failCount ?? 0}</span>
                <span style={{ fontSize: "10px", fontFamily: "'JetBrains Mono', monospace", color: "#555555" }}>{profile?.lastTestAt ?? "n/a"}</span>
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
                    onClick={() => {
                      void setActiveProfile(alt.id).then(() => setBypassEnabled(true));
                    }}
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
