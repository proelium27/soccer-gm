import { NavLink, useNavigate } from "react-router-dom";
import { useLeague } from "../context/LeagueContext.js";

export function Sidebar() {
  const { switchLeagueAction } = useLeague();
  const navigate = useNavigate();

  function handleSwitchLeague() {
    switchLeagueAction();
    navigate("/leagues");
  }

  return (
    <nav className="sidebar d-flex flex-column">
      <div className="nav-section">League</div>
      <NavLink to="/dashboard" className="nav-link">Dashboard</NavLink>
      <NavLink to="/standings" className="nav-link">Standings</NavLink>
      <NavLink to="/schedule" className="nav-link">Schedule</NavLink>
      <NavLink to="/leaders" className="nav-link">Stat Leaders</NavLink>
      <NavLink to="/news" className="nav-link">News Feed</NavLink>

      <div className="nav-section">Team</div>
      <NavLink to="/roster" className="nav-link">Roster</NavLink>
      <NavLink to="/transfers" className="nav-link">Transfers</NavLink>
      <NavLink to="/incoming-offers" className="nav-link">Incoming Offers</NavLink>
      <NavLink to="/finance" className="nav-link">Finance</NavLink>
      <NavLink to="/incoming-talent" className="nav-link">Incoming Talent</NavLink>

      <div className="nav-section">Help</div>
      <NavLink to="/manual" className="nav-link">Manual</NavLink>

      <button type="button" className="nav-link btn btn-link text-start mt-auto" onClick={handleSwitchLeague}>
        Switch League
      </button>
    </nav>
  );
}
