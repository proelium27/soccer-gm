import { NavLink } from "react-router-dom";

interface SidebarProps {
  /** Drawer open state (only affects the mobile off-canvas presentation). */
  open: boolean;
  /** Called when a nav link is tapped, so the mobile drawer can close itself. */
  onNavigate: () => void;
}

export function Sidebar({ open, onNavigate }: SidebarProps) {
  return (
    <nav
      className={`sidebar d-flex flex-column${open ? " open" : ""}`}
      aria-label="Primary"
    >
      <div className="nav-section">League</div>
      <NavLink to="/dashboard" className="nav-link" onClick={onNavigate}>Dashboard</NavLink>
      <NavLink to="/standings" className="nav-link" onClick={onNavigate}>Standings</NavLink>
      <NavLink to="/cup" className="nav-link" onClick={onNavigate}>Continental Cup</NavLink>
      <NavLink to="/power-rankings" className="nav-link" onClick={onNavigate}>Power Rankings</NavLink>
      <NavLink to="/schedule" className="nav-link" onClick={onNavigate}>Schedule</NavLink>
      <NavLink to="/leaders" className="nav-link" onClick={onNavigate}>Stat Leaders</NavLink>
      <NavLink to="/awards" className="nav-link" onClick={onNavigate}>Awards</NavLink>
      <NavLink to="/history" className="nav-link" onClick={onNavigate}>Club History</NavLink>
      <NavLink to="/season-preview" className="nav-link" onClick={onNavigate}>Season Preview</NavLink>
      <NavLink to="/news" className="nav-link" onClick={onNavigate}>News Feed</NavLink>

      <div className="nav-section">Team</div>
      <NavLink to="/roster" className="nav-link" onClick={onNavigate}>Roster</NavLink>
      <NavLink to="/transfers" className="nav-link" onClick={onNavigate}>Transfers</NavLink>
      <NavLink to="/incoming-offers" className="nav-link" onClick={onNavigate}>Incoming Offers</NavLink>
      <NavLink to="/loans" className="nav-link" onClick={onNavigate}>Loans</NavLink>
      <NavLink to="/finance" className="nav-link" onClick={onNavigate}>Finance</NavLink>
      <NavLink to="/incoming-talent" className="nav-link" onClick={onNavigate}>Incoming Talent</NavLink>
      <NavLink to="/free-agents" className="nav-link" onClick={onNavigate}>Free Agents</NavLink>
      <NavLink to="/academy" className="nav-link" onClick={onNavigate}>Academy</NavLink>

      <div className="nav-section">Help</div>
      <NavLink to="/manual" className="nav-link" onClick={onNavigate}>Manual</NavLink>
      <NavLink to="/changelog" className="nav-link" onClick={onNavigate}>Changelog</NavLink>
    </nav>
  );
}
