import { NavLink } from "react-router-dom";

export function Sidebar() {
  return (
    <nav className="sidebar d-flex flex-column">
      <div className="nav-section">League</div>
      <NavLink to="/dashboard" className="nav-link">Dashboard</NavLink>
      <NavLink to="/standings" className="nav-link">Standings</NavLink>
      <NavLink to="/cup" className="nav-link">Continental Cup</NavLink>
      <NavLink to="/power-rankings" className="nav-link">Power Rankings</NavLink>
      <NavLink to="/schedule" className="nav-link">Schedule</NavLink>
      <NavLink to="/leaders" className="nav-link">Stat Leaders</NavLink>
      <NavLink to="/awards" className="nav-link">Awards</NavLink>
      <NavLink to="/season-preview" className="nav-link">Season Preview</NavLink>
      <NavLink to="/news" className="nav-link">News Feed</NavLink>

      <div className="nav-section">Team</div>
      <NavLink to="/roster" className="nav-link">Roster</NavLink>
      <NavLink to="/transfers" className="nav-link">Transfers</NavLink>
      <NavLink to="/incoming-offers" className="nav-link">Incoming Offers</NavLink>
      <NavLink to="/loans" className="nav-link">Loans</NavLink>
      <NavLink to="/finance" className="nav-link">Finance</NavLink>
      <NavLink to="/incoming-talent" className="nav-link">Incoming Talent</NavLink>
      <NavLink to="/free-agents" className="nav-link">Free Agents</NavLink>
      <NavLink to="/academy" className="nav-link">Academy</NavLink>

      <div className="nav-section">Help</div>
      <NavLink to="/manual" className="nav-link">Manual</NavLink>
    </nav>
  );
}
