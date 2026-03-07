export type AltStatus = "active" | "online" | "unstable" | "offline" | "error";

export interface AltProfile {
  id: string;
  name: string;
  label: string;
  status: AltStatus;
  isActive: boolean;
  isFavorite: boolean;
  speed: number; // Mbps download
  upload: number; // Mbps upload
  latency: number; // ms
  stability: number; // 0-100
  quality: number; // 0-100
  load: number; // 0-100
  uptime: string;
  lastCheck: string;
  successRate: number; // 0-100
  location: string;
  protocol: string;
  tag?: "best" | "recommended" | "unstable" | "offline";
}

export const altProfiles: AltProfile[] = [
  {
    id: "alt-1",
    name: "ALT-1",
    label: "Primary Route",
    status: "active",
    isActive: true,
    isFavorite: true,
    speed: 487.2,
    upload: 312.8,
    latency: 12,
    stability: 98,
    quality: 97,
    load: 34,
    uptime: "14d 6h 22m",
    lastCheck: "2s ago",
    successRate: 99.7,
    location: "EU-WEST",
    protocol: "SOCKS5",
    tag: "best",
  },
  {
    id: "alt-2",
    name: "ALT-2",
    label: "Backup Alpha",
    status: "online",
    isActive: false,
    isFavorite: true,
    speed: 342.1,
    upload: 198.4,
    latency: 28,
    stability: 91,
    quality: 88,
    load: 21,
    uptime: "7d 14h 05m",
    lastCheck: "8s ago",
    successRate: 97.3,
    location: "US-EAST",
    protocol: "SOCKS5",
    tag: "recommended",
  },
  {
    id: "alt-3",
    name: "ALT-3",
    label: "Secondary Route",
    status: "online",
    isActive: false,
    isFavorite: false,
    speed: 218.9,
    upload: 143.2,
    latency: 54,
    stability: 79,
    quality: 74,
    load: 58,
    uptime: "2d 8h 41m",
    lastCheck: "15s ago",
    successRate: 91.8,
    location: "ASIA-SE",
    protocol: "HTTP",
    tag: undefined,
  },
  {
    id: "alt-4",
    name: "ALT-4",
    label: "Fallback Route",
    status: "unstable",
    isActive: false,
    isFavorite: false,
    speed: 89.4,
    upload: 47.1,
    latency: 142,
    stability: 41,
    quality: 38,
    load: 87,
    uptime: "0d 3h 17m",
    lastCheck: "1m ago",
    successRate: 64.2,
    location: "EU-CENTRAL",
    protocol: "SOCKS5",
    tag: "unstable",
  },
  {
    id: "alt-5",
    name: "ALT-5",
    label: "Reserve Node",
    status: "offline",
    isActive: false,
    isFavorite: false,
    speed: 0,
    upload: 0,
    latency: 0,
    stability: 0,
    quality: 0,
    load: 0,
    uptime: "—",
    lastCheck: "12m ago",
    successRate: 0,
    location: "US-WEST",
    protocol: "HTTP",
    tag: "offline",
  },
  {
    id: "alt-6",
    name: "ALT-6",
    label: "Emergency Exit",
    status: "error",
    isActive: false,
    isFavorite: false,
    speed: 0,
    upload: 0,
    latency: 999,
    stability: 0,
    quality: 0,
    load: 0,
    uptime: "—",
    lastCheck: "5m ago",
    successRate: 12.1,
    location: "ASIA-NE",
    protocol: "SOCKS4",
    tag: "offline",
  },
];

export const speedHistory = Array.from({ length: 60 }, (_, i) => ({
  time: `${60 - i}s`,
  download: Math.max(0, 487 + Math.sin(i * 0.3) * 45 + (Math.random() - 0.5) * 30),
  upload: Math.max(0, 312 + Math.sin(i * 0.4) * 28 + (Math.random() - 0.5) * 20),
  latency: Math.max(8, 12 + Math.sin(i * 0.5) * 5 + (Math.random() - 0.5) * 4),
}));

export const stabilityHistory = Array.from({ length: 30 }, (_, i) => ({
  time: `${30 - i}m`,
  stability: Math.max(80, 98 - Math.abs(Math.sin(i * 0.4)) * 12 + (Math.random() - 0.5) * 5),
  quality: Math.max(75, 97 - Math.abs(Math.sin(i * 0.3)) * 15 + (Math.random() - 0.5) * 6),
}));

export const switchHistory = [
  { time: "14:32:07", from: "ALT-3", to: "ALT-1", reason: "Performance", duration: "0.3s" },
  { time: "11:18:44", from: "ALT-2", to: "ALT-3", reason: "Manual", duration: "0.5s" },
  { time: "09:05:12", from: "ALT-1", to: "ALT-2", reason: "Stability drop", duration: "0.4s" },
  { time: "Yesterday 22:41", from: "ALT-4", to: "ALT-1", reason: "Auto-recovery", duration: "0.7s" },
  { time: "Yesterday 18:09", from: "ALT-1", to: "ALT-4", reason: "Manual", duration: "0.3s" },
];

export const logEntries = [
  { id: 1, time: "14:47:23.182", level: "INFO", source: "CORE", message: "ALT-1 connection stable — latency 12ms, quality 97%" },
  { id: 2, time: "14:47:21.044", level: "INFO", source: "MONITOR", message: "Health check passed: ALT-1 [OK] ALT-2 [OK] ALT-3 [OK]" },
  { id: 3, time: "14:47:18.901", level: "WARN", source: "MONITOR", message: "ALT-4 latency spike detected: 142ms (threshold: 100ms)" },
  { id: 4, time: "14:47:15.773", level: "INFO", source: "ROUTE", message: "Traffic routed through ALT-1 — 487.2 Mbps downstream" },
  { id: 5, time: "14:47:12.512", level: "ERROR", source: "CONN", message: "ALT-6 connection refused: timeout after 30000ms" },
  { id: 6, time: "14:47:09.234", level: "INFO", source: "CORE", message: "Periodic stability scan completed — 4/6 nodes healthy" },
  { id: 7, time: "14:47:06.088", level: "WARN", source: "MONITOR", message: "ALT-5 unreachable — marking as OFFLINE" },
  { id: 8, time: "14:47:01.401", level: "INFO", source: "SWITCH", message: "Auto-selector evaluated: ALT-1 ranked #1 (score: 97.4)" },
  { id: 9, time: "14:46:58.923", level: "INFO", source: "CONN", message: "ALT-2 handshake complete — SOCKS5 authenticated" },
  { id: 10, time: "14:46:55.177", level: "DEBUG", source: "ROUTE", message: "Load balancer: ALT-1 load 34%, ALT-2 load 21%, ALT-3 load 58%" },
  { id: 11, time: "14:46:51.834", level: "INFO", source: "CORE", message: "System uptime: 14d 6h 22m — all services nominal" },
  { id: 12, time: "14:46:48.290", level: "ERROR", source: "CONN", message: "ALT-6 authentication failed: invalid credentials or endpoint" },
  { id: 13, time: "14:46:45.011", level: "INFO", source: "MONITOR", message: "ALT-3 quality degraded to 74% — still within acceptable range" },
  { id: 14, time: "14:46:41.668", level: "WARN", source: "ROUTE", message: "ALT-4 packet loss: 8.3% — stability score 41" },
  { id: 15, time: "14:46:38.123", level: "INFO", source: "CORE", message: "Configuration loaded — profile: Production, mode: Automatic" },
  { id: 16, time: "14:46:34.890", level: "INFO", source: "SWITCH", message: "Switch event: ALT-3 → ALT-1 completed in 0.3s" },
  { id: 17, time: "14:46:31.445", level: "DEBUG", source: "CONN", message: "TCP keepalive sent to ALT-1 — ACK received in 4ms" },
  { id: 18, time: "14:46:28.102", level: "INFO", source: "MONITOR", message: "Bandwidth test: ALT-1 487.2↓ 312.8↑ Mbps — EXCELLENT" },
  { id: 19, time: "14:46:24.779", level: "WARN", source: "CORE", message: "Memory usage: 847MB / 2048MB — 41% utilization" },
  { id: 20, time: "14:46:21.334", level: "INFO", source: "CONN", message: "ALT-2 speed test: 342.1↓ 198.4↑ Mbps — GOOD" },
];
