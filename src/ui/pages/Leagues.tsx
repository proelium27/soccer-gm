import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listLeagues, deleteLeague } from "../../db/leagueDb.js";
import { useLeague } from "../context/LeagueContext.js";

interface LeagueSummary {
  lid: number;
  name: string;
  created: number;
}

export function Leagues() {
  const [leagues, setLeagues] = useState<LeagueSummary[] | null>(null);
  const { loadLeagueAction } = useLeague();
  const navigate = useNavigate();

  useEffect(() => {
    refresh();
  }, []);

  function refresh() {
    listLeagues().then(setLeagues);
  }

  async function handleEnter(lid: number) {
    await loadLeagueAction(lid);
    navigate("/dashboard");
  }

  async function handleDelete(lid: number) {
    if (!confirm("Delete this league? This cannot be undone.")) return;
    await deleteLeague(lid);
    refresh();
  }

  return (
    <div className="container py-4" style={{ maxWidth: 600 }}>
      <h2 className="mb-3">Your Leagues</h2>

      {leagues === null && <p className="text-muted">Loading...</p>}

      {leagues !== null && leagues.length === 0 && (
        <p className="text-muted">You don't have any leagues yet.</p>
      )}

      {leagues !== null && leagues.length > 0 && (
        <div className="list-group mb-3">
          {leagues.map((l) => (
            <div
              key={l.lid}
              className="list-group-item d-flex align-items-center justify-content-between"
            >
              <div>
                <div>{l.name}</div>
                <small className="text-muted">
                  Created {new Date(l.created).toLocaleDateString()}
                </small>
              </div>
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => handleEnter(l.lid)}
                >
                  Enter
                </button>
                <button
                  type="button"
                  className="btn btn-outline-danger btn-sm"
                  onClick={() => handleDelete(l.lid)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        className="btn btn-outline-secondary"
        onClick={() => navigate("/new-league")}
      >
        Start New League
      </button>
    </div>
  );
}
