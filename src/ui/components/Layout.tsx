import { Navigate, Outlet } from "react-router-dom";
import { useLeague } from "../context/LeagueContext.js";
import { TopBar } from "./TopBar.js";
import { Sidebar } from "./Sidebar.js";

export function Layout() {
  const { league, loadingActiveLeague } = useLeague();

  if (loadingActiveLeague) {
    return <p className="p-3">Loading...</p>;
  }

  // No league loaded and none is expected to load (e.g. the user switched
  // leagues or navigated here directly) — bounce to the league picker
  // instead of leaving the page stuck on "Loading...".
  if (!league) {
    return <Navigate to="/leagues" replace />;
  }

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
