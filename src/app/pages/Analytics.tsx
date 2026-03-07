import { useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { Activity, TrendingUp, Zap, Shield, AlertCircle, Clock } from "lucide-react";
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
            {item.name}: {typeof item.value === "number" ? item.value.toFixed(1) : item.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function Analytics() {
  const [timeRange, setTimeRange] = useState<"1h" | "6h" | "24h" | "7d">("1h");
  const { altProfiles, speedHistory, stabilityHistory, diagnostics } = useUiData();

  const chartData = useMemo(() => {
    const limits: Record<typeof timeRange, number> = { "1h": 60, "6h": 360, "24h": 1440, "7d": 10080 };
    const limit = limits[timeRange];
    return speedHistory.slice(0, Math.min(limit, speedHistory.length)).reverse();
  }, [speedHistory, timeRange]);

  const stabilityData = useMemo(() => {
    const limits: Record<typeof timeRange, number> = { "1h": 60, "6h": 360, "24h": 1440, "7d": 10080 };
    const limit = limits[timeRange];
    return stabilityHistory.slice(0, Math.min(limit, stabilityHistory.length)).reverse();
  }, [stabilityHistory, timeRange]);

  const stat = useMemo(() => {
    const online = altProfiles.filter((profile) => profile.status !== "offline" && profile.status !== "error");
    const avg = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);

    return {
      avgDownload: avg(online.map((item) => item.speed)),
      avgUpload: avg(online.map((item) => item.upload)),
      avgLatency: avg(online.map((item) => item.latency)),
      avgStability: avg(online.map((item) => item.stability)),
      errors: diagnostics.filter((item) => item.severity === "error").length,
      warnings: diagnostics.filter((item) => item.severity === "warn").length,
    };
  }, [altProfiles, diagnostics]);

  const eventsData = useMemo(() => {
    const points = [
      { day: "Mon", errors: 0, warnings: 0 },
      { day: "Tue", errors: 0, warnings: 0 },
      { day: "Wed", errors: 0, warnings: 0 },
      { day: "Thu", errors: 0, warnings: 0 },
      { day: "Fri", errors: 0, warnings: 0 },
      { day: "Sat", errors: 0, warnings: 0 },
      { day: "Sun", errors: 0, warnings: 0 },
    ];

    const limitsMs: Record<typeof timeRange, number> = {
      "1h": 1 * 60 * 60 * 1000,
      "6h": 6 * 60 * 60 * 1000,
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
    };

    const now = Date.now();
    const minTs = now - limitsMs[timeRange];

    diagnostics.forEach((diag) => {
      const ts = Date.parse(diag.timestamp);
      if (Number.isNaN(ts) || ts < minTs) {
        return;
      }

      const day = new Date(ts).getDay();
      const index = day === 0 ? 6 : day - 1;
      const bucket = points[index];

      if (diag.severity === "error") {
        bucket.errors += 1;
      } else if (diag.severity === "warn") {
        bucket.warnings += 1;
      }
    });

    return points;
  }, [diagnostics, timeRange]);

  return (
    <div className="flex flex-col h-full overflow-y-auto app-scroll">
      <div className="flex items-center justify-between px-7 py-5 border-b border-[#151515] shrink-0">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-white" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 300, letterSpacing: "-0.02em", fontSize: "20px" }}>
            Analytics
          </h1>
          <span className="text-[#333333]" style={{ fontSize: "11px", fontFamily: "'JetBrains Mono', monospace" }}>
            Performance monitoring Р’В· {altProfiles.length} profiles
          </span>
        </div>

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

      <div className="flex flex-col gap-5 p-6">
        <div className="grid grid-cols-6 gap-3">
          {[
            { label: "Avg Download", value: stat.avgDownload.toFixed(1), unit: "Mbps", icon: TrendingUp },
            { label: "Avg Upload", value: stat.avgUpload.toFixed(1), unit: "Mbps", icon: Activity },
            { label: "Avg Latency", value: stat.avgLatency.toFixed(0), unit: "ms", icon: Zap },
            { label: "Avg Stability", value: stat.avgStability.toFixed(1), unit: "%", icon: Shield },
            { label: "Errors", value: String(stat.errors), unit: "events", icon: AlertCircle },
            { label: "Warnings", value: String(stat.warnings), unit: "events", icon: Clock },
          ].map((item) => (
            <div key={item.label} className="flex flex-col gap-2.5 bg-[#0e0e0e] border border-[#1a1a1a] rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-[#333333] uppercase tracking-[0.1em]" style={{ fontSize: "8px", fontFamily: "'Inter', sans-serif", fontWeight: 600 }}>
                  {item.label}
                </span>
                <item.icon size={11} className="text-[#2a2a2a]" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-white" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 300, fontSize: "20px", letterSpacing: "-0.02em" }}>
                  {item.value}
                </span>
                <span className="text-[#333333]" style={{ fontSize: "9px", fontFamily: "'JetBrains Mono', monospace" }}>{item.unit}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-5">
          <div className="bg-[#0e0e0e] border border-[#1a1a1a] rounded-xl p-5">
            <div className="mb-5">
              <span className="text-white" style={{ fontSize: "12px", fontFamily: "'Inter', sans-serif", fontWeight: 500 }}>Throughput</span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="anDl" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="white" stopOpacity={0.07} />
                    <stop offset="100%" stopColor="white" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="anUl" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#555555" stopOpacity={0.08} />
                    <stop offset="100%" stopColor="#555555" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#141414" vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 9, fill: "#2a2a2a", fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} interval={4} />
                <YAxis tick={{ fontSize: 9, fill: "#2a2a2a", fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="download" name="download" stroke="white" strokeWidth={1.3} fill="url(#anDl)" dot={false} />
                <Area type="monotone" dataKey="upload" name="upload" stroke="#555555" strokeWidth={1} fill="url(#anUl)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-[#0e0e0e] border border-[#1a1a1a] rounded-xl p-5">
            <div className="mb-5">
              <span className="text-white" style={{ fontSize: "12px", fontFamily: "'Inter', sans-serif", fontWeight: 500 }}>Stability</span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={stabilityData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                <CartesianGrid stroke="#141414" vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 9, fill: "#2a2a2a", fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} interval={2} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "#2a2a2a", fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="stability" name="stability" stroke="white" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="quality" name="quality" stroke="#555555" strokeWidth={1} dot={false} strokeDasharray="3 3" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#0e0e0e] border border-[#1a1a1a] rounded-xl p-5">
          <div className="mb-5">
            <span className="text-white" style={{ fontSize: "12px", fontFamily: "'Inter', sans-serif", fontWeight: 500 }}>Events by Day</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={eventsData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="#141414" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 9, fill: "#2a2a2a", fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "#2a2a2a", fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="errors" name="errors" fill="#3a1212" radius={[2, 2, 0, 0]} />
              <Bar dataKey="warnings" name="warnings" fill="#252510" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

