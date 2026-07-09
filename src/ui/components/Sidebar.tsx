import { NavLink } from "react-router-dom";

export function Sidebar() {
  return (
    <nav className="sidebar d-flex flex-column">
      <div className="nav-section">League</div>
      <NavLink to="/dashboard" className="nav-link">Dashboard</NavLink>
      <NavLink to="/standings" className="nav-link">Standings</NavLink>
      <NavLink to="/schedule" className="nav-link">Schedule</NavLink>
      <NavLink to="/leaders" className="nav-link">Stat Leaders</NavLink>

      <div className="nav-section">Team</div>
      <NavLink to="/roster" className="nav-link">Roster</NavLink>
    </nav>
  );
}
