import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listLeagues, deleteLeague, loadLeague } from "../../db/leagueDb.js";
import { exportLeagueJSON } from "../../db/exportImport.js";
import { useLeague } from "../context/LeagueContext.js";
import { useSportName } from "../sportName.js";
import { TeamIdentityEditor, type EditableTeam } from "../components/TeamIdentityEditor.js";
import { parseRosterFile, isRosterFileFormat } from "../../core/teams/rosterFile.js";
import { setPendingRoster } from "../pendingRoster.js";

interface LeagueSummary {
  lid: number;
  name: string;
  created: number;
  season: number;
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
  const [importError, setImportError] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const { loadLeagueAction, customizeTeamsAction, importJSON } = useLeague();
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

  /** Download the whole save (the same file the in-game "Export Save" writes). */
  async function handleExportSave(lid: number) {
    const league = await loadLeague(lid);
    if (!league) return;
    exportLeagueJSON(league);
  }

  /**
   * One Import button for both kinds of file the game reads, because two
   * similarly-named import buttons is what made this confusing in the first
   * place. Which one it is is unambiguous from the contents: a roster file
   * declares a `format` the game recognizes (isRosterFileFormat, which also
   * accepts the pre-rename string), an exported save has no such field.
   *
   * They do quite different things — a roster file *starts* a league and hands
   * off to the club picker, a save file restores one — so the button routes
   * rather than tries to unify them.
   */
  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file after an error
    if (!file) return;
    setImportError(null);

    let looksLikeRoster = false;
    try {
      const parsed = JSON.parse(await file.text()) as { format?: unknown };
      looksLikeRoster = isRosterFileFormat(parsed?.format);
    } catch {
      setImportError(`"${file.name}" isn't a valid JSON file.`);
      return;
    }

    try {
      if (looksLikeRoster) {
        // Re-read through the real parser so a malformed roster file reports
        // exactly which field is wrong, the same as it would on /new-league.
        setPendingRoster({ file: parseRosterFile(await file.text()), filename: file.name });
        navigate("/new-league?roster=1");
      } else {
        await importJSON(file);
        navigate("/dashboard");
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    }
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

      {importError && (
        <div className="alert alert-danger py-2" role="alert">
          {importError}
        </div>
      )}

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
                {/* Season first, and the created time rather than just the date:
                    saves are named after the club, so two of the same club are
                    otherwise indistinguishable here. How far each one has got is
                    what actually tells you which is the one you've been playing. */}
                <small className="text-muted">
                  Season {l.season} · started {new Date(l.created).toLocaleString()}
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
                  onClick={() => handleExportSave(l.lid)}
                  title="Download this whole save as a file you can back up or move to another device"
                >
                  Export Save
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
          onClick={() => importInputRef.current?.click()}
          title="Load a roster file to start a league with real clubs, or a save file to restore a backup"
        >
          Import
        </button>
        <input
          ref={importInputRef}
          type="file"
          accept=".json,application/json"
          className="d-none"
          onChange={handleImport}
        />
      </div>

      <p className="text-muted small mt-2 mb-0">
        Import takes either a roster file, which starts a new league with real clubs and
        squads, or a save file from Export Save, which loads that save back.
      </p>
    </div>
  );
}
