import { useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CLUBS } from "../../core/teams/clubs.js";
import { createLeagueState, type LeagueStore } from "../../core/leagueState.js";
import { applyTeamIdentities } from "../../core/teams/customize.js";
import { mulberry32 } from "../../engine/rng.js";
import { useLeague } from "../context/LeagueContext.js";
import { NUM_TEAMS, NUM_TEAMS_D2 } from "../../core/constants.js";
import { TeamIdentityEditor, type EditableTeam } from "../components/TeamIdentityEditor.js";

export function NewLeague() {
  const [selectedTid, setSelectedTid] = useState<number | null>(null);
  const [pending, setPending] = useState<LeagueStore | null>(null);
  const [saving, setSaving] = useState(false);
  const { setLeague, importJSON } = useLeague();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const customize = searchParams.get("customize") === "1";
  const fileInputRef = useRef<HTMLInputElement>(null);

  function buildLeague(tid: number): LeagueStore {
    const seed = Date.now();
    const rng = mulberry32(seed);
    const league = createLeagueState(tid, rng, seed);
    return {
      ...league,
      meta: { ...league.meta, name: CLUBS[tid].name },
    };
  }

  async function handleStart() {
    if (selectedTid === null) return;
    const league = buildLeague(selectedTid);
    if (customize) {
      // Hold the generated league in memory and let the user edit team
      // identities before anything is persisted.
      setPending(league);
      return;
    }
    await setLeague(league);
    navigate("/dashboard");
  }

  async function handleSaveCustomized(teams: EditableTeam[]) {
    if (!pending) return;
    setSaving(true);
    await setLeague(applyTeamIdentities(pending, teams));
    navigate("/dashboard");
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      await importJSON(file);
      e.target.value = "";
      navigate("/dashboard");
    }
  }

  if (pending) {
    return (
      <div className="container py-4" style={{ maxWidth: 700 }}>
        <h2 className="mb-1">Customize Teams</h2>
        <p className="text-muted mb-3">
          Rename any club, change its abbreviation or colors, then start your league.
        </p>
        <TeamIdentityEditor
          initialTeams={pending.teams.map((t) => ({
            tid: t.tid,
            name: t.name,
            abbrev: t.abbrev,
            colors: [...t.colors] as [string, string],
          }))}
          userTid={pending.meta.userTid}
          saveLabel="Start League"
          savingLabel="Starting..."
          saving={saving}
          onSave={handleSaveCustomized}
          onCancel={() => setPending(null)}
        />
      </div>
    );
  }

  return (
    <div className="container py-4" style={{ maxWidth: 600 }}>
      <h2 className="mb-3">New League</h2>
      <p className="text-muted">
        {customize
          ? "Choose your team, then customize every club before starting."
          : "Choose your team to get started."}
      </p>

      <div className="list-group mb-3">
        {/* CLUBS has 120 entries (England/Spain/Italy) but createLeagueState
            only ever generates the English 40 — offering a Spanish/Italian
            tid here would crash on load. Remove this clamp once a later PR
            wires createLeagueState to generateWorld()/worldCompetitions()
            and replaces this whole picker with a real country step. */}
        {CLUBS.slice(0, NUM_TEAMS + NUM_TEAMS_D2).map((club, i) => (
          <button
            key={club.abbrev}
            type="button"
            className={`list-group-item list-group-item-action d-flex align-items-center${
              selectedTid === i ? " active" : ""
            }`}
            onClick={() => setSelectedTid(i)}
          >
            <span
              className="color-swatch"
              style={{ background: club.colors[0] }}
            />
            <span
              className="color-swatch"
              style={{ background: club.colors[1] }}
            />
            {club.name}
          </button>
        ))}
      </div>

      <div className="d-flex gap-2">
        <button
          className="btn btn-primary"
          disabled={selectedTid === null}
          onClick={handleStart}
        >
          {customize ? "Next: Customize Teams" : "Start League"}
        </button>

        <button className="btn btn-outline-secondary" onClick={handleImportClick}>
          Import League
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="d-none"
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}
