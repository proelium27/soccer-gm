import { useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CLUBS } from "../../core/teams/clubs.js";
import { createLeagueState, type LeagueStore } from "../../core/leagueState.js";
import { applyTeamIdentities } from "../../core/teams/customize.js";
import { mulberry32 } from "../../engine/rng.js";
import { useLeague } from "../context/LeagueContext.js";
import { NUM_TEAMS, NUM_TEAMS_D2 } from "../../core/constants.js";
import { worldCompetitions, countryClubRanges, countriesOf } from "../../core/competitions.js";
import { TeamIdentityEditor, type EditableTeam } from "../components/TeamIdentityEditor.js";
import { ClubCrest } from "../components/ClubCrest.js";

const COUNTRY_RANGES = countryClubRanges(worldCompetitions(), NUM_TEAMS, NUM_TEAMS_D2);
const COUNTRIES = countriesOf(worldCompetitions());

export function NewLeague() {
  const [country, setCountry] = useState<string | null>(null);
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
            compId: t.compId,
            name: t.name,
            abbrev: t.abbrev,
            colors: [...t.colors] as [string, string],
          }))}
          competitions={pending.competitions}
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

  if (country === null) {
    return (
      <div className="container py-4" style={{ maxWidth: 600 }}>
        <h2 className="mb-3">New League</h2>
        <p className="text-muted">Choose a country to play in.</p>
        <div className="list-group mb-3">
          {COUNTRIES.map((c) => (
            <button
              key={c}
              type="button"
              className="list-group-item list-group-item-action"
              onClick={() => setCountry(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const range = COUNTRY_RANGES.find((r) => r.country === country)!;
  const countryClubs = CLUBS.slice(range.start, range.end).map((club, i) => ({
    club,
    tid: range.start + i,
  }));

  return (
    <div className="container py-4" style={{ maxWidth: 600 }}>
      <h2 className="mb-3">New League</h2>
      <p className="text-muted">
        {customize
          ? `Choose your ${country} club, then customize every club before starting.`
          : `Choose your ${country} club to get started.`}
      </p>

      <div className="list-group mb-3">
        {countryClubs.map(({ club, tid }) => (
          <button
            key={club.abbrev}
            type="button"
            className={`list-group-item list-group-item-action d-flex align-items-center${
              selectedTid === tid ? " active" : ""
            }`}
            onClick={() => setSelectedTid(tid)}
          >
            <ClubCrest tid={tid} colors={club.colors} size={28} />
            {club.name}
          </button>
        ))}
      </div>

      <div className="d-flex gap-2">
        <button className="btn btn-outline-secondary" onClick={() => { setCountry(null); setSelectedTid(null); }}>
          Back
        </button>
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
