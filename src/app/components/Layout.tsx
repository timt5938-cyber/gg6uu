import { Outlet } from "react-router";
import { TitleBar } from "./TitleBar";
import { Sidebar } from "./Sidebar";

export function Layout() {
  return (
    <div
      className="flex flex-col w-screen h-screen bg-[#0a0a0a] overflow-hidden"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-hidden bg-[#0d0d0d]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
