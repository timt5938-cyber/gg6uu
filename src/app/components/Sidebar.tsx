import { NavLink, useNavigate } from "react-router";
import {
  LayoutDashboard,
  Layers,
  BarChart2,
  ScrollText,
  Settings,
  Minimize2,
  Circle,
  ChevronRight,
} from "lucide-react";
import { useUiData } from "../hooks/useUiData";
import { isElectron, openMini } from "../../lib/electron";

const navItems = [
  { path: "/", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/profiles", icon: Layers, label: "Alt Profiles" },
  { path: "/analytics", icon: BarChart2, label: "Analytics" },
  { path: "/logs", icon: ScrollText, label: "Logs" },
  { path: "/settings", icon: Settings, label: "Settings" },
];

export function Sidebar() {
  const navigate = useNavigate();
  const { altProfiles, diagnostics } = useUiData();

  const activeProfile = altProfiles.find((profile) => profile.isActive) ?? altProfiles[0] ?? null;
  const onlineCount = altProfiles.filter((profile) => profile.status === "active" || profile.status === "working" || profile.status === "testing").length;

  return (
    <div className="flex flex-col w-[72px] bg-[#080808] border-r border-[#181818] h-full shrink-0 overflow-hidden transition-all duration-300 hover:w-[220px] group">
      <nav className="flex-1 flex flex-col gap-0.5 pt-3 px-2">
        {navItems.map((item) => {
          const badge =
            item.path === "/profiles"
              ? String(altProfiles.length)
              : item.path === "/logs"
                ? String(diagnostics.filter((diag) => diag.severity === "error").length)
                : null;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-200 relative overflow-hidden cursor-pointer ${
                  isActive
                    ? "bg-white text-black"
                    : "text-[#505050] hover:text-[#c0c0c0] hover:bg-[#141414]"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={16} className="shrink-0" />
                  <span
                    className="whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    style={{
                      fontSize: "12px",
                      fontFamily: "'Inter', sans-serif",
                      fontWeight: isActive ? 600 : 500,
                      letterSpacing: "0.05em",
                    }}
                  >
                    {item.label}
                  </span>
                  {badge && (
                    <span
                      className={`ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 px-1.5 py-0.5 rounded-sm ${
                        isActive ? "bg-black text-white" : "bg-[#1e1e1e] text-[#666666]"
                      }`}
                      style={{ fontSize: "9px", fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="flex flex-col gap-0.5 p-2 border-t border-[#181818]">
        <div className="flex items-center gap-3 px-3 py-2.5">
          <div className="relative shrink-0">
            <Circle size={16} className="text-[#252525]" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className={`w-2 h-2 rounded-full ${onlineCount > 0 ? "bg-white" : "bg-[#663333]"}`} />
            </div>
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col min-w-0">
            <span
              className="text-white whitespace-nowrap"
              style={{ fontSize: "11px", fontFamily: "'Inter', sans-serif", fontWeight: 600 }}
            >
              {activeProfile?.name || "NO ALT"}
            </span>
            <span
              className="text-[#404040] whitespace-nowrap"
              style={{ fontSize: "9px", fontFamily: "'JetBrains Mono', monospace" }}
            >
              {activeProfile?.status?.toUpperCase() || "OFFLINE"}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            if (isElectron()) {
              openMini();
              return;
            }
            navigate("/mini");
          }}
          className="flex items-center gap-3 px-3 py-2.5 rounded-md text-[#404040] hover:text-[#888888] hover:bg-[#141414] transition-all duration-200"
        >
          <Minimize2 size={16} className="shrink-0" />
          <span
            className="whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            style={{ fontSize: "12px", fontFamily: "'Inter', sans-serif", fontWeight: 500, letterSpacing: "0.05em" }}
          >
            Mini Mode
          </span>
          <ChevronRight
            size={10}
            className="ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-[#333333]"
          />
        </button>
      </div>
    </div>
  );
}

