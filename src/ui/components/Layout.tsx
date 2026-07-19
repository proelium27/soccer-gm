import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useLeague } from "../context/LeagueContext.js";
import { TopBar } from "./TopBar.js";
import { Sidebar } from "./Sidebar.js";

export function Layout() {
  const { league, loadingActiveLeague } = useLeague();
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();

  // Close the mobile drawer whenever the route changes (tapping a link, or a
  // programmatic navigation) so it never lingers over the new page.
  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  // Lock body scroll while the drawer is open so the page behind it stays put.
  useEffect(() => {
    document.body.classList.toggle("nav-drawer-open", navOpen);
    return () => document.body.classList.remove("nav-drawer-open");
  }, [navOpen]);

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
      <TopBar onToggleNav={() => setNavOpen((o) => !o)} />
      <div className="app-layout">
        <Sidebar open={navOpen} onNavigate={() => setNavOpen(false)} />
        <div
          className={`nav-backdrop${navOpen ? " show" : ""}`}
          onClick={() => setNavOpen(false)}
          aria-hidden="true"
        />
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </>
  );
}
