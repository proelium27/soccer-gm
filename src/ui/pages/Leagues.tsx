import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listLeagues, deleteLeague, loadLeague } from "../../db/leagueDb.js";
import { useLeague } from "../context/LeagueContext.js";
import { useSportName } from "../sportName.js";
import { TeamIdentityEditor, type EditableTeam } from "../components/TeamIdentityEditor.js";
import { buildRosterFile } from "../../core/teams/rosterFile.js";

interface LeagueSummary {
  lid: number;
  name: string;
  created: number;
}

/** Serialize `data` to pretty JSON and trigger a browser download. */
function downloadJSON(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

interface TeamEditor {
  lid: number;
  leagueName: string;
  userTid: number;
  teams: EditableTeam[];
  competitions: { id: number; name: string }[];
}

/**
 * What a first-time visitor sees instead of an empty save list. Doubles as the
 * site's only real homepage copy, so it's plain prose rather than UI chrome.
 */
function FirstRunIntro({ brand }: { brand: string }) {
  return (
    <header className="mb-4">
      <h1 className="h2 mb-3">{brand}</h1>
      <p>
        A free soccer management game that runs right here in your browser. Take
        over a club, pick the lineup, work the transfer market, and see how far
        you can take them. No account and no download, and your saves stay on
        this device.
      </p>
      <ul className="text-muted">
        <li>12 leagues across 6 countries, 240 clubs, promotion and relegation</li>
        <li>A transfer market where rival clubs value players the same way you do</li>
        <li>A youth academy, scouting reports, contracts, and a budget that has to balance</li>
        <li>A continental cup, and a World Cup on a four year cycle</li>
      </ul>
      <p className="text-muted">
        New to it? The{" "}
        {/* Underlined on purpose: inside muted text the link colour alone
            doesn't carry enough contrast to be distinguishable. */}
        <Link to="/manual" className="text-decoration-underline">
          manual
        </Link>{" "}
        explains how everything works, or just start a league below and find out
        as you go.
      </p>
    </header>
  );
}

export function Leagues() {
  const [leagues, setLeagues] = useState<LeagueSummary[] | null>(null);
  const [editor, setEditor] = useState<TeamEditor | null>(null);
  const [saving, setSaving] = useState(false);
  const { loadLeagueAction, customizeTeamsAction } = useLeague();
  const navigate = useNavigate();
  const { brand } = useSportName();

  // Nobody has a save here yet, so this is somebody's first look at the game
  // (and it's the page search engines land on). Lead with what the game is
  // instead of an empty list. Once there's a save it goes back to being the
  // plain picker.
  const firstRun = leagues !== null && leagues.length === 0;

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
        compId: t.compId,
        name: t.name,
        abbrev: t.abbrev,
        colors: [...t.colors] as [string, string],
      })),
      competitions: league.competitions,
    });
  }

  async function handleExportNames(lid: number) {
    const league = await loadLeague(lid);
    if (!league) return;
    const slug = league.meta.name.trim().replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "league";
    downloadJSON(`soccer-gm-teams-${slug}.json`, buildRosterFile(league));
  }

  async function handleSaveTeams(teams: EditableTeam[]) {
    if (!editor) return;
    setSaving(true);
    try {
      await customizeTeamsAction(editor.lid, teams);
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
        <TeamIdentityEditor
          initialTeams={editor.teams}
          competitions={editor.competitions}
          userTid={editor.userTid}
          saveLabel="Save"
          savingLabel="Saving..."
          saving={saving}
          onSave={handleSaveTeams}
          onCancel={() => setEditor(null)}
        />
      </div>
    );
  }

  return (
    <div className="container py-4" style={{ maxWidth: 720 }}>
      {firstRun ? <FirstRunIntro brand={brand} /> : <h1 className="h2 mb-3">Your Leagues</h1>}

      {leagues === null && <p className="text-muted">Loading...</p>}

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
              <div className="d-flex gap-2 flex-wrap justify-content-end">
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
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => handleExportNames(l.lid)}
                  title="Download this save's clubs as an editable roster template"
                >
                  Export Teams
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

      <div className="d-flex gap-2 flex-wrap">
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={() => navigate("/new-league")}
        >
          Start New League
        </button>
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={() => navigate("/new-league?customize=1")}
        >
          Start Customized League
        </button>
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={() => navigate("/new-league?roster=1")}
          title="Start a new league from a roster file of real clubs and squads"
        >
          Import Custom League
        </button>
      </div>
    </div>
  );
}
