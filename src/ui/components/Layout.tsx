import { Outlet } from "react-router-dom";
import { TopBar } from "./TopBar.js";
import { Sidebar } from "./Sidebar.js";

export function Layout() {
  return (
    <>
      <TopBar />
      <div className="app-layout">
        <Sidebar />
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </>
  );
}
