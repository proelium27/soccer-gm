import { NavLink } from "react-router-dom";
import { useLeague } from "../context/LeagueContext.js";

interface SidebarProps {
  /** Drawer open state (only affects the mobile off-canvas presentation). */
  open: boolean;
  /** Called when a nav link is tapped, so the mobile drawer can close itself. */
  onNavigate: () => void;
}

export function Sidebar({ open, onNavigate }: SidebarProps) {
  const { league } = useLeague();
  return (
    <nav
      className={`sidebar d-flex flex-column${open ? " open" : ""}`}
      aria-label="Primary"
    >
      <div className="nav-section">League</div>
      <NavLink to="/dashboard" className="nav-link" onClick={onNavigate}>Dashboard</NavLink>
      <NavLink to="/standings" className="nav-link" onClick={onNavigate}>Standings</NavLink>
      <NavLink to="/cup" className="nav-link" onClick={onNavigate}>Continental Cup</NavLink>
      <NavLink to="/shield" className="nav-link" onClick={onNavigate}>Continental Shield</NavLink>
      <NavLink to="/domestic-cup" className="nav-link" onClick={onNavigate}>Domestic Cup</NavLink>
      <NavLink to="/promotion-playoffs" className="nav-link" onClick={onNavigate}>Promotion Playoffs</NavLink>
      <NavLink to="/power-rankings" className="nav-link" onClick={onNavigate}>Power Rankings</NavLink>
      <NavLink to="/schedule" className="nav-link" onClick={onNavigate}>Schedule</NavLink>
      <NavLink to="/leaders" className="nav-link" onClick={onNavigate}>Stat Leaders</NavLink>
      <NavLink to="/awards" className="nav-link" onClick={onNavigate}>Awards</NavLink>
      <NavLink to="/history" className="nav-link" onClick={onNavigate}>Club History</NavLink>
      <NavLink to="/frivolities" className="nav-link" onClick={onNavigate}>Frivolities</NavLink>
      <NavLink to="/season-preview" className="nav-link" onClick={onNavigate}>Season Preview</NavLink>
      <NavLink to="/news" className="nav-link" onClick={onNavigate}>News Feed</NavLink>

      <div className="nav-section">Team</div>
      <NavLink to="/manager" className="nav-link" onClick={onNavigate}>Manager</NavLink>
      <NavLink to="/roster" className="nav-link" onClick={onNavigate}>Roster</NavLink>
      <NavLink to="/transfers" className="nav-link" onClick={onNavigate}>Transfers</NavLink>
      <NavLink to="/incoming-offers" className="nav-link" onClick={onNavigate}>Incoming Offers</NavLink>
      <NavLink to="/loans" className="nav-link" onClick={onNavigate}>Loans</NavLink>
      <NavLink to="/finance" className="nav-link" onClick={onNavigate}>Finance</NavLink>
      <NavLink to="/incoming-talent" className="nav-link" onClick={onNavigate}>Incoming Talent</NavLink>
      <NavLink to="/free-agents" className="nav-link" onClick={onNavigate}>Free Agents</NavLink>
      <NavLink to="/academy" className="nav-link" onClick={onNavigate}>Academy</NavLink>

      <div className="nav-section">National Teams</div>
      <NavLink to="/national-teams/world-cup" className="nav-link" onClick={onNavigate}>World Cup</NavLink>
      <NavLink to="/national-teams/qualifying" className="nav-link" onClick={onNavigate}>Qualifying</NavLink>
      <NavLink to="/national-teams/confederation-cups" className="nav-link" onClick={onNavigate}>Confederation Cups</NavLink>
      <NavLink to="/national-teams/rosters" className="nav-link" onClick={onNavigate}>Rosters</NavLink>
      <NavLink to="/national-teams/schedule" className="nav-link" onClick={onNavigate}>Schedule</NavLink>
      <NavLink to="/national-teams/power-rankings" className="nav-link" onClick={onNavigate}>Power Rankings</NavLink>
      <NavLink to="/national-teams/leaders" className="nav-link" onClick={onNavigate}>Stat Leaders</NavLink>
      <NavLink to="/national-teams/history" className="nav-link" onClick={onNavigate}>History</NavLink>

      {league?.godMode && (
        <>
          <div className="nav-section">God Mode</div>
          <NavLink to="/god-mode" className="nav-link" onClick={onNavigate}>Sandbox Tools</NavLink>
        </>
      )}

      <div className="nav-section">Help</div>
      <NavLink to="/manual" className="nav-link" onClick={onNavigate}>Manual</NavLink>
      <NavLink to="/changelog" className="nav-link" onClick={onNavigate}>Changelog</NavLink>
      <a
        href="https://discord.gg/6nHkCZn3Mp"
        className="nav-link"
        target="_blank"
        rel="noopener noreferrer"
        onClick={onNavigate}
      >
        Join the Discord
      </a>
    </nav>
  );
}
