import { createHashRouter } from "react-router";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { AltProfiles } from "./pages/AltProfiles";
import { Analytics } from "./pages/Analytics";
import { Logs } from "./pages/Logs";
import { Settings } from "./pages/Settings";
import { MiniMode } from "./pages/MiniMode";
import { PhoneConnect } from "./pages/PhoneConnect";

export const router = createHashRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Dashboard },
      { path: "profiles", Component: AltProfiles },
      { path: "analytics", Component: Analytics },
      { path: "logs", Component: Logs },
      { path: "settings", Component: Settings },
      { path: "phone", Component: PhoneConnect },
    ],
  },
  { path: "/mini", Component: MiniMode },
]);
