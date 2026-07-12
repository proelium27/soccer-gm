import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listLeagues, deleteLeague, loadLeague } from "../../db/leagueDb.js";
import { useLeague } from "../context/LeagueContext.js";

interface LeagueSummary {
  lid: number;
  name: string;
  created: number;
}

interface EditableTeam {
  tid: number;
  name: string;
  abbrev: string;
  colors: [string, string];
}

interface TeamEditor {
  lid: number;
  leagueName: string;
  userTid: number;
  teams: EditableTeam[];
}

export function Leagues() {
  const [leagues, setLeagues] = useState<LeagueSummary[] | null>(null);
  const [editor, setEditor] = useState<TeamEditor | null>(null);
  const [saving, setSaving] = useState(false);
  const { loadLeagueAction, customizeTeamsAction } = useLeague();
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

  async function handleCustomize(lid: number) {
    const league = await loadLeague(lid);
    if (!league) return;
    setEditor({
      lid,
      leagueName: league.meta.name,
      userTid: league.meta.userTid,
      teams: league.teams.map((t) => ({
        tid: t.tid,
        name: t.name,
        abbrev: t.abbrev,
        colors: [...t.colors] as [string, string],
      })),
    });
  }

  function updateTeam(tid: number, patch: Partial<EditableTeam>) {
    setEditor((ed) =>
      ed && {
        ...ed,
        teams: ed.teams.map((t) => (t.tid === tid ? { ...t, ...patch } : t)),
      },
    );
  }

  const editorValid =
    editor?.teams.every((t) => t.name.trim() !== "" && t.abbrev.trim() !== "") ?? false;

  async function handleSaveTeams() {
    if (!editor || !editorValid) return;
    setSaving(true);
    try {
      await customizeTeamsAction(editor.lid, editor.teams);
      setEditor(null);
      refresh();
    } finally {
      setSaving(false);
    }
  }

  if (editor) {
    return (
      <div className="container py-4" style={{ maxWidth: 700 }}>
        <h2 className="mb-1">Customize Teams</h2>
        <p className="text-muted mb-3">
          {editor.leagueName} — rename any club, change its abbreviation or colors.
        </p>

        <div className="list-group mb-3">
          {editor.teams.map((t) => (
            <div key={t.tid} className="list-group-item d-flex align-items-center gap-2">
              <input
                type="color"
                className="form-control form-control-color"
                title="Primary color"
                value={t.colors[0]}
                onChange={(e) => updateTeam(t.tid, { colors: [e.target.value, t.colors[1]] })}
              />
              <input
                type="color"
                className="form-control form-control-color"
                title="Secondary color"
                value={t.colors[1]}
                onChange={(e) => updateTeam(t.tid, { colors: [t.colors[0], e.target.value] })}
              />
              <input
                type="text"
                className="form-control"
                value={t.name}
                onChange={(e) => updateTeam(t.tid, { name: e.target.value })}
              />
              <input
                type="text"
                className="form-control text-uppercase"
                style={{ width: 80, flex: "0 0 auto" }}
                maxLength={3}
                value={t.abbrev}
                onChange={(e) => updateTeam(t.tid, { abbrev: e.target.value.toUpperCase() })}
              />
              {t.tid === editor.userTid && (
                <span className="badge bg-primary" style={{ flex: "0 0 auto" }}>
                  You
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="d-flex gap-2">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!editorValid || saving}
            onClick={handleSaveTeams}
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary"
            disabled={saving}
            onClick={() => setEditor(null)}
          >
            Cancel
          </button>
        </div>
      </div>
    );
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
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => handleCustomize(l.lid)}
                >
                  Customize Teams
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
