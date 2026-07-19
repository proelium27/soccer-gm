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
import { CountryFlag } from "../components/CountryFlag.js";
import { trackEvent } from "../analytics.js";

const WORLD_COMPETITIONS = worldCompetitions();
const COUNTRY_RANGES = countryClubRanges(WORLD_COMPETITIONS, NUM_TEAMS, NUM_TEAMS_D2);
const COUNTRIES = countriesOf(WORLD_COMPETITIONS);

/** Competition name for a country's given tier (e.g. "English Division 1"). */
function divisionName(country: string, tier: 1 | 2): string {
  return (
    WORLD_COMPETITIONS.find((c) => c.country === country && c.tier === tier)?.name ??
    `Division ${tier}`
  );
}

export function NewLeague() {
  const [country, setCountry] = useState<string>(COUNTRIES[0]);
  const [selectedTid, setSelectedTid] = useState<number | null>(null);
  const [pending, setPending] = useState<LeagueStore | null>(null);
  const [saving, setSaving] = useState(false);
  const { setLeague, importJSON } = useLeague();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const customize = searchParams.get("customize") === "1";
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Which tier the chosen club plays in: tier-1 clubs fill the first NUM_TEAMS
  // slots of a country's range, tier-2 the rest (see countryClubRanges).
  function tierForTid(tid: number): 1 | 2 {
    const range = COUNTRY_RANGES.find((r) => tid >= r.start && tid < r.end);
    return range && tid < range.start + NUM_TEAMS ? 1 : 2;
  }

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
    trackEvent("league_created", { country, tier: tierForTid(selectedTid) });
    await setLeague(league);
    navigate("/dashboard");
  }

  async function handleSaveCustomized(teams: EditableTeam[]) {
    if (!pending || selectedTid === null) return;
    setSaving(true);
    trackEvent("league_created", { country, tier: tierForTid(selectedTid) });
    await setLeague(applyTeamIdentities(pending, teams));
    navigate("/dashboard");
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      trackEvent("league_imported");
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

  const range = COUNTRY_RANGES.find((r) => r.country === country)!;
  const countryClubs = CLUBS.slice(range.start, range.end).map((club, i) => ({
    club,
    tid: range.start + i,
  }));
  // Within a country's block, generateWorld() lays out the tier-1 clubs
  // first, then the tier-2 clubs — so the first NUM_TEAMS are Division 1.
  const d1Clubs = countryClubs.slice(0, NUM_TEAMS);
  const d2Clubs = countryClubs.slice(NUM_TEAMS);

  function selectCountry(c: string) {
    setCountry(c);
    setSelectedTid(null);
  }

  return (
    <div className="container py-4" style={{ maxWidth: 600 }}>
      <h2 className="mb-3">New League</h2>
      <p className="text-muted">
        {customize
          ? `Flip through each league to browse its clubs, then choose your ${country} club to customize every club before starting.`
          : `Flip through each league to browse its clubs, then choose your ${country} club to get started.`}
      </p>

      <div className="btn-group mb-3" role="group" aria-label="Choose a league">
        {COUNTRIES.map((c) => (
          <button
            key={c}
            type="button"
            className={`btn btn-outline-secondary d-inline-flex align-items-center gap-2${
              c === country ? " active" : ""
            }`}
            onClick={() => selectCountry(c)}
          >
            <CountryFlag country={c} />
            {c}
          </button>
        ))}
      </div>

      {(
        [
          [divisionName(country, 1), d1Clubs],
          [divisionName(country, 2), d2Clubs],
        ] as const
      ).map(([label, clubs]) => (
        <div key={label} className="mb-3">
          <h6 className="text-muted text-uppercase small fw-semibold mb-2">{label}</h6>
          <div className="list-group">
            {clubs.map(({ club, tid }) => (
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
        </div>
      ))}

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
