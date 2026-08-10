import { useEffect, useState, type ReactNode } from "react";
import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { useLeague } from "../context/LeagueContext.js";
import { useSportName } from "../sportName.js";
import { TopBar } from "./TopBar.js";
import { Sidebar } from "./Sidebar.js";
import { ErrorBoundary } from "./ErrorBoundary.js";
import { CrestArtProvider } from "./ClubCrest.js";

interface LayoutProps {
  /**
   * Render the page even when no save is loaded, in a stripped-down shell with
   * no sidebar or top bar (both of them read league state). Used by the manual
   * and the changelog, which are just reading material and are the only pages
   * worth reaching without a game in progress.
   */
  allowNoLeague?: boolean;
}

export function Layout({ allowNoLeague = false }: LayoutProps) {
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

  // Reading-material routes render their content straight away, before the save
  // has been read back from IndexedDB. Waiting would flash a "Loading..." at a
  // visitor who has no save to load at all, and would hand a crawler an empty
  // page if it snapshotted mid-read.
  if (allowNoLeague && (loadingActiveLeague || !league)) {
    return (
      <StandaloneShell>
        <Outlet />
      </StandaloneShell>
    );
  }

  if (loadingActiveLeague) {
    return <p className="p-3">Loading...</p>;
  }

  // No league loaded and none is expected to load (e.g. the user switched
  // leagues or navigated here directly) — bounce to the league picker
  // instead of leaving the page stuck on "Loading...".
  if (!league) {
    return <Navigate to="/leagues" replace />;
  }

  // Clubs an imported roster file renamed must not show the built-in crest for
  // their slot — that badge belongs to the fictional club they replaced. Scoped
  // to the whole in-league shell so every surface agrees, rather than each of
  // the fourteen ClubCrest call sites having to remember.
  const importedTids = league.teams.filter((t) => t.importedIdentity).map((t) => t.tid);

  return (
    <CrestArtProvider tids={importedTids}>
      <TopBar onToggleNav={() => setNavOpen((o) => !o)} />
      <div className="app-layout">
        <Sidebar open={navOpen} onNavigate={() => setNavOpen(false)} />
        <div
          className={`nav-backdrop${navOpen ? " show" : ""}`}
          onClick={() => setNavOpen(false)}
          aria-hidden="true"
        />
        <main className="main-content">
          {/* Keyed by route so a crash is scoped to the page that threw:
              navigating anywhere else remounts a clean boundary, and TopBar /
              Sidebar stay mounted so the user can actually leave. */}
          <ErrorBoundary key={location.key} what="this page">
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </CrestArtProvider>
  );
}

/**
 * Chrome for a content page being read without a save loaded. The real TopBar
 * and Sidebar both read league state, so this stands in with just the brand and
 * a way into the game.
 */
function StandaloneShell({ children }: { children: ReactNode }) {
  const { brand } = useSportName();

  return (
    <>
      <nav className="navbar navbar-dark app-topbar px-2 px-md-3">
        <Link to="/leagues" className="navbar-brand mb-0 h1 d-flex align-items-center gap-2">
          <img src="/favicon.png" alt="" width="32" height="32" className="rounded" />
          <span>{brand}</span>
        </Link>
        <div className="d-flex align-items-center gap-2">
          <Link to="/manual" className="btn btn-sm btn-outline-light">
            Manual
          </Link>
          <Link to="/changelog" className="btn btn-sm btn-outline-light">
            Changelog
          </Link>
          <Link to="/leagues" className="btn btn-sm btn-primary">
            Play
          </Link>
        </div>
      </nav>
      <div className="app-layout">
        <main className="main-content">{children}</main>
      </div>
    </>
  );
}
