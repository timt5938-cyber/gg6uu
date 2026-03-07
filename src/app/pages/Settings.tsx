import { useMemo, useState, type ReactNode } from "react";
import {
  Settings2,
  Power,
  Palette,
  Database,
  Sliders,
  ChevronRight,
  Monitor,
  RefreshCw,
  FolderOpen,
  RotateCw,
} from "lucide-react";
import { useUiData } from "../hooks/useUiData";
import { useAppStore } from "../store/appStore";
import type { SettingsState } from "../types/state";

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative w-9 h-5 rounded-full transition-all duration-200 ${
        enabled ? "bg-white" : "bg-[#1e1e1e] border border-[#2a2a2a]"
      }`}
    >
      <div
        className={`absolute top-0.5 w-4 h-4 rounded-full transition-all duration-200 ${
          enabled ? "left-4 bg-black" : "left-0.5 bg-[#3a3a3a]"
        }`}
      />
    </button>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-[#131313] last:border-0">
      <div className="flex flex-col gap-0.5 flex-1 pr-8">
        <span className="text-[#c0c0c0]" style={{ fontSize: "12px", fontFamily: "'Inter', sans-serif", fontWeight: 400 }}>
          {label}
        </span>
        {description && (
          <span style={{ fontSize: "10px", fontFamily: "'Inter', sans-serif", color: "#333333" }}>{description}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function NumberInput({ value, onChange, min, max, suffix }: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        min={min}
        max={max}
        className="bg-[#0e0e0e] border border-[#1e1e1e] text-[#777777] rounded-md px-3 py-1.5 w-24 outline-none hover:border-[#2a2a2a] focus:border-[#333333] transition-colors text-right"
        style={{ fontSize: "11px", fontFamily: "'JetBrains Mono', monospace" }}
      />
      {suffix && <span style={{ fontSize: "10px", fontFamily: "'Inter', sans-serif", color: "#2a2a2a" }}>{suffix}</span>}
    </div>
  );
}

const sections = [
  { id: "general", label: "General", icon: Settings2 },
  { id: "startup", label: "Startup", icon: Power },
  { id: "window", label: "Window", icon: Monitor },
  { id: "logging", label: "Logging", icon: Database },
  { id: "interface", label: "Interface", icon: Palette },
  { id: "advanced", label: "Advanced", icon: Sliders },
] as const;

export function Settings() {
  const [activeSection, setActiveSection] = useState<(typeof sections)[number]["id"]>("general");
  const { settings, summary, runtime } = useUiData();

  const loading = useAppStore((state) => state.loading);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const refresh = useAppStore((state) => state.refresh);
  const openReferenceFolder = useAppStore((state) => state.openReferenceFolder);
  const restartAnalysis = useAppStore((state) => state.restartAnalysis);

  const sectionTitle = useMemo(() => {
    const current = sections.find((item) => item.id === activeSection);
    return current?.label || "Settings";
  }, [activeSection]);

  return (
    <div className="flex h-full overflow-hidden">
      <div className="w-[220px] shrink-0 border-r border-[#151515] bg-[#090909] flex flex-col py-4">
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => setActiveSection(section.id)}
            className={`flex items-center gap-3 px-5 py-3 text-left transition-all duration-150 ${
              activeSection === section.id
                ? "text-white bg-[#141414] border-l-2 border-l-white"
                : "text-[#3a3a3a] hover:text-[#888888] hover:bg-[#0d0d0d]"
            }`}
          >
            <section.icon size={13} />
            <span style={{ fontSize: "12px", fontFamily: "'Inter', sans-serif", fontWeight: activeSection === section.id ? 500 : 400 }}>
              {section.label}
            </span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto app-scroll px-10 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex flex-col gap-1">
            <h2 className="text-white" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 300, fontSize: "18px", letterSpacing: "-0.01em" }}>
              {sectionTitle}
            </h2>
            <p style={{ fontSize: "11px", fontFamily: "'Inter', sans-serif", color: "#333333" }}>
              Runtime status: {runtime.referenceAvailable ? "reference connected" : "reference missing"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void refresh()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-[#141414] border border-[#222222] text-[#666666] hover:text-white hover:border-[#333333] transition-all"
            >
              <RefreshCw size={12} />
              <span style={{ fontSize: "10px", fontFamily: "'Inter', sans-serif" }}>{loading ? "Scanning..." : "Scan"}</span>
            </button>
            <button
              type="button"
              onClick={() => void restartAnalysis()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-[#141414] border border-[#222222] text-[#666666] hover:text-white hover:border-[#333333] transition-all"
            >
              <RotateCw size={12} />
              <span style={{ fontSize: "10px", fontFamily: "'Inter', sans-serif" }}>Restart</span>
            </button>
            <button
              type="button"
              onClick={() => void openReferenceFolder()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-[#141414] border border-[#222222] text-[#666666] hover:text-white hover:border-[#333333] transition-all"
            >
              <FolderOpen size={12} />
              <span style={{ fontSize: "10px", fontFamily: "'Inter', sans-serif" }}>Reference</span>
            </button>
          </div>
        </div>

        {activeSection === "general" && (
          <div className="bg-[#0c0c0c] border border-[#181818] rounded-xl p-6 max-w-2xl">
            <SettingRow label="Auto Refresh" description="Automatically rescan reference data">
              <Toggle enabled={settings.autoRefresh} onToggle={() => void updateSettings({ autoRefresh: !settings.autoRefresh })} />
            </SettingRow>
            <SettingRow label="Refresh Interval" description="Minimum 5 seconds">
              <NumberInput
                value={settings.refreshIntervalSec}
                onChange={(value) => void updateSettings({ refreshIntervalSec: Math.max(5, value || 5) })}
                min={5}
                max={300}
                suffix="seconds"
              />
            </SettingRow>
            <SettingRow label="Remember Last Active Profile">
              <Toggle
                enabled={settings.rememberLastActiveProfile}
                onToggle={() => void updateSettings({ rememberLastActiveProfile: !settings.rememberLastActiveProfile })}
              />
            </SettingRow>
            <SettingRow label="Auto Scan on Startup">
              <Toggle
                enabled={settings.autoScanReferenceOnStartup}
                onToggle={() => void updateSettings({ autoScanReferenceOnStartup: !settings.autoScanReferenceOnStartup })}
              />
            </SettingRow>
          </div>
        )}

        {activeSection === "startup" && (
          <div className="bg-[#0c0c0c] border border-[#181818] rounded-xl p-6 max-w-2xl">
            <SettingRow label="Start Minimized" description="Open window minimized to taskbar">
              <Toggle enabled={settings.startMinimized} onToggle={() => void updateSettings({ startMinimized: !settings.startMinimized })} />
            </SettingRow>
            <SettingRow label="Preferred Profile" description="Profile ID from detected list">
              <input
                value={settings.preferredProfile ?? ""}
                onChange={(event) => void updateSettings({ preferredProfile: event.target.value || null })}
                placeholder="profile-id"
                className="bg-[#0e0e0e] border border-[#1e1e1e] text-[#777777] rounded-md px-3 py-1.5 w-56 outline-none hover:border-[#2a2a2a] focus:border-[#333333]"
                style={{ fontSize: "11px", fontFamily: "'JetBrains Mono', monospace" }}
              />
            </SettingRow>
          </div>
        )}

        {activeSection === "window" && (
          <div className="bg-[#0c0c0c] border border-[#181818] rounded-xl p-6 max-w-2xl">
            <SettingRow label="Compact Mode" description="Use compact visuals where supported">
              <Toggle enabled={settings.compactMode} onToggle={() => void updateSettings({ compactMode: !settings.compactMode })} />
            </SettingRow>
            <SettingRow label="Theme">
              <div className="relative">
                <select
                  value={settings.theme}
                  onChange={(event) => void updateSettings({ theme: event.target.value as SettingsState["theme"] })}
                  className="appearance-none bg-[#0e0e0e] border border-[#1e1e1e] text-[#777777] rounded-md px-3 pr-8 py-1.5 outline-none hover:border-[#2a2a2a] focus:border-[#333333] transition-colors cursor-pointer"
                  style={{ fontSize: "11px", fontFamily: "'Inter', sans-serif" }}
                >
                  <option value="dark">dark</option>
                  <option value="darker">darker</option>
                  <option value="graphite">graphite</option>
                </select>
                <ChevronRight size={10} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#333333] rotate-90 pointer-events-none" />
              </div>
            </SettingRow>
          </div>
        )}

        {activeSection === "logging" && (
          <div className="bg-[#0c0c0c] border border-[#181818] rounded-xl p-6 max-w-2xl">
            <SettingRow label="Log Level">
              <div className="relative">
                <select
                  value={settings.logLevel}
                  onChange={(event) => void updateSettings({ logLevel: event.target.value as SettingsState["logLevel"] })}
                  className="appearance-none bg-[#0e0e0e] border border-[#1e1e1e] text-[#777777] rounded-md px-3 pr-8 py-1.5 outline-none hover:border-[#2a2a2a] focus:border-[#333333] transition-colors cursor-pointer"
                  style={{ fontSize: "11px", fontFamily: "'Inter', sans-serif" }}
                >
                  <option value="debug">debug</option>
                  <option value="info">info</option>
                  <option value="warn">warn</option>
                  <option value="error">error</option>
                </select>
                <ChevronRight size={10} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#333333] rotate-90 pointer-events-none" />
              </div>
            </SettingRow>
            <SettingRow label="Diagnostics Verbosity">
              <div className="relative">
                <select
                  value={settings.diagnosticsVerbosity}
                  onChange={(event) => void updateSettings({ diagnosticsVerbosity: event.target.value as SettingsState["diagnosticsVerbosity"] })}
                  className="appearance-none bg-[#0e0e0e] border border-[#1e1e1e] text-[#777777] rounded-md px-3 pr-8 py-1.5 outline-none hover:border-[#2a2a2a] focus:border-[#333333] transition-colors cursor-pointer"
                  style={{ fontSize: "11px", fontFamily: "'Inter', sans-serif" }}
                >
                  <option value="normal">normal</option>
                  <option value="verbose">verbose</option>
                </select>
                <ChevronRight size={10} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#333333] rotate-90 pointer-events-none" />
              </div>
            </SettingRow>
          </div>
        )}

        {activeSection === "interface" && (
          <div className="bg-[#0c0c0c] border border-[#181818] rounded-xl p-6 max-w-2xl">
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Reference Files", value: String(summary.fileCount) },
                { label: "Profiles", value: String(summary.profileCount) },
                { label: "IP Lists", value: String(summary.ipListCount) },
                { label: "Read Errors", value: String(summary.readErrorCount) },
                { label: "Last Analysis", value: runtime.lastAnalysisAt || "n/a" },
                { label: "Watcher", value: runtime.watcherActive ? "on" : "off" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span style={{ fontSize: "10px", fontFamily: "'Inter', sans-serif", color: "#2a2a2a" }}>{item.label}</span>
                  <span style={{ fontSize: "10px", fontFamily: "'JetBrains Mono', monospace", color: "#444444" }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSection === "advanced" && (
          <div className="bg-[#0c0c0c] border border-[#181818] rounded-xl p-6 max-w-2xl">
            <p style={{ fontSize: "11px", fontFamily: "'Inter', sans-serif", color: "#333333" }}>
              Runtime root: {summary.referenceExists ? "C:\\12\\reference" : "reference missing"}
            </p>
            <div className="flex items-center gap-3 mt-4">
              <button
                type="button"
                onClick={() => void updateSettings({
                  theme: "dark",
                  compactMode: false,
                  autoRefresh: true,
                  refreshIntervalSec: 30,
                  startMinimized: false,
                  logLevel: "info",
                  preferredProfile: null,
                  rememberLastActiveProfile: true,
                  autoScanReferenceOnStartup: true,
                  diagnosticsVerbosity: "normal",
                })}
                className="px-4 py-2 rounded-md border border-[#2a1515] text-[#663333] hover:bg-[#160808] hover:border-[#3a1a1a] transition-all"
                style={{ fontSize: "11px", fontFamily: "'Inter', sans-serif" }}
              >
                Reset Settings
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
