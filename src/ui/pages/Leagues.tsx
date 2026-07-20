import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listLeagues, deleteLeague, loadLeague } from "../../db/leagueDb.js";
import { useLeague } from "../context/LeagueContext.js";
import { TeamIdentityEditor, type EditableTeam } from "../components/TeamIdentityEditor.js";
import { buildRosterFile, parseRosterFile } from "../../core/teams/rosterFile.js";
import { buildImportPromptText } from "../../core/teams/rosterAiPrompt.js";

interface LeagueSummary {
  lid: number;
  name: string;
  created: number;
}

type StatusMsg = { kind: "ok" | "warn" | "err"; text: string };

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

export function Leagues() {
  const [leagues, setLeagues] = useState<LeagueSummary[] | null>(null);
  const [editor, setEditor] = useState<TeamEditor | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<StatusMsg | null>(null);
  const importLidRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { loadLeagueAction, customizeTeamsAction, importRosterAction } = useLeague();
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
        compId: t.compId,
        name: t.name,
        abbrev: t.abbrev,
        colors: [...t.colors] as [string, string],
      })),
      competitions: league.competitions,
    });
  }

  async function handleExportNames(lid: number) {
    setStatus(null);
    const league = await loadLeague(lid);
    if (!league) return;
    const slug = league.meta.name.trim().replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "league";
    downloadJSON(`soccer-gm-teams-${slug}.json`, buildRosterFile(league));
  }

  async function handleCopyPrompt(lid: number) {
    setStatus(null);
    const league = await loadLeague(lid);
    if (!league) return;
    const prompt = buildImportPromptText(league);
    try {
      await navigator.clipboard.writeText(prompt);
      setStatus({
        kind: "ok",
        text: "Copied an AI prompt to your clipboard. Paste it into ChatGPT/Claude, ask for the leagues you want, save its reply as a .json file, then use Import Teams.",
      });
    } catch {
      // Clipboard can be blocked (permissions/insecure context); fall back to a download.
      const blob = new Blob([prompt], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "soccer-gm-ai-prompt.txt";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus({ kind: "warn", text: "Couldn't copy to the clipboard, so I downloaded the AI prompt as a text file instead." });
    }
  }

  function triggerImport(lid: number) {
    setStatus(null);
    importLidRef.current = lid;
    fileInputRef.current?.click();
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const lid = importLidRef.current;
    e.target.value = ""; // allow re-selecting the same file later
    if (!file || lid === null) return;

    let parsed;
    try {
      parsed = parseRosterFile(await file.text());
    } catch (err) {
      setStatus({ kind: "err", text: err instanceof Error ? err.message : String(err) });
      return;
    }

    const summary = await importRosterAction(lid, parsed);
    refresh();

    if (summary.clubsRenamed === 0 && summary.squadsReplaced === 0) {
      setStatus({
        kind: "warn",
        text: summary.warnings.length
          ? `Nothing applied. ${summary.warnings.join(" ")}`
          : "The file didn't match any teams in this save, so nothing changed.",
      });
      return;
    }

    const parts = [`Imported ${summary.clubsRenamed} team ${summary.clubsRenamed === 1 ? "name" : "names"}`];
    if (summary.squadsReplaced > 0) {
      parts.push(
        `replaced ${summary.squadsReplaced} squad${summary.squadsReplaced === 1 ? "" : "s"} (${summary.playersAdded} players)`,
      );
    }
    const applied = `${parts.join(" and ")}.`;
    setStatus(
      summary.warnings.length
        ? { kind: "warn", text: `${applied} ${summary.warnings.join(" ")}` }
        : { kind: "ok", text: applied },
    );
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
      <h2 className="mb-3">Your Leagues</h2>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="d-none"
        onChange={handleImportFile}
      />

      {status && (
        <div
          className={`alert py-2 ${status.kind === "err" ? "alert-danger" : status.kind === "warn" ? "alert-warning" : "alert-success"}`}
          role="alert"
        >
          {status.text}
        </div>
      )}

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
                  onClick={() => triggerImport(l.lid)}
                  title="Overlay real club names, colors, and (optionally) squads from a roster file"
                >
                  Import Teams
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
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => handleCopyPrompt(l.lid)}
                  title="Copy a paste-ready prompt that teaches an AI this save's import format"
                >
                  Copy AI Prompt
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

      <div className="d-flex gap-2">
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
      </div>
    </div>
  );
}
