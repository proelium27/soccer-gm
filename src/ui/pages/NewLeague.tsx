import { useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CLUBS } from "../../core/teams/clubs.js";
import { createLeagueState, type LeagueStore } from "../../core/leagueState.js";
import { applyTeamIdentities } from "../../core/teams/customize.js";
import { mulberry32 } from "../../engine/rng.js";
import { useLeague } from "../context/LeagueContext.js";
import { NUM_TEAMS, NUM_TEAMS_D2 } from "../../core/constants.js";
import {
  worldCompetitions,
  countryClubRanges,
  countriesOf,
  worldTeamSlots,
} from "../../core/competitions.js";
import {
  parseRosterFile,
  resolveRosterSlots,
  type RosterFile,
  type RosterFileClub,
} from "../../core/teams/rosterFile.js";
import { applyRosterFileToNewLeague } from "../../core/teams/rosterImport.js";
import { takePendingRoster } from "../pendingRoster.js";
import { TeamIdentityEditor, type EditableTeam } from "../components/TeamIdentityEditor.js";
import { ClubCrest } from "../components/ClubCrest.js";
import { CountryFlag } from "../components/CountryFlag.js";
import { trackEvent } from "../analytics.js";

const WORLD_COMPETITIONS = worldCompetitions();
const COUNTRY_RANGES = countryClubRanges(WORLD_COMPETITIONS, NUM_TEAMS, NUM_TEAMS_D2);
const COUNTRIES = countriesOf(WORLD_COMPETITIONS);

/**
 * The slot structure a fresh save will have, so a roster file can be resolved
 * to clubs *before* the world is generated — the picker shows the real club
 * names you're choosing between rather than the fictional ones they replace.
 */
const SLOT_WORLD = {
  competitions: WORLD_COMPETITIONS,
  teams: worldTeamSlots(WORLD_COMPETITIONS, NUM_TEAMS, NUM_TEAMS_D2),
};

interface LoadedRoster {
  file: RosterFile;
  filename: string;
  /** Which club each slot becomes, so the picker can show real names. */
  byTid: Map<number, RosterFileClub>;
  clubs: number;
  squads: number;
  warnings: string[];
}

function describeRoster(file: RosterFile, filename: string): LoadedRoster {
  const { slots, warnings } = resolveRosterSlots(SLOT_WORLD, file);
  return {
    file,
    filename,
    byTid: new Map(slots.map((s) => [s.tid, s.club])),
    clubs: slots.length,
    squads: slots.filter((s) => s.club.players && s.club.players.length > 0).length,
    warnings,
  };
}

const loadRoster = (text: string, filename: string): LoadedRoster =>
  describeRoster(parseRosterFile(text), filename);

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
  // A file handed over by the Leagues page's Import button is picked up on the
  // first render, so arriving here skips straight to the club picker. useState's
  // initializer (not an effect) because takePendingRoster clears as it reads,
  // and an effect would run twice under StrictMode and lose it.
  const [roster, setRoster] = useState<LoadedRoster | null>(() => {
    const handed = takePendingRoster();
    return handed ? describeRoster(handed.file, handed.filename) : null;
  });
  const [rosterError, setRosterError] = useState<string | null>(null);
  const { setLeague, importJSON } = useLeague();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const customize = searchParams.get("customize") === "1";
  // Roster mode is reachable only from the Leagues page's "Import Custom
  // League" button. A roster file can *only* be applied here, at creation:
  // importing real squads into a save in progress would delete the careers,
  // stats and transfer history of everyone it replaced.
  const rosterMode = searchParams.get("roster") === "1";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rosterInputRef = useRef<HTMLInputElement>(null);

  // Which tier the chosen club plays in: tier-1 clubs fill the first NUM_TEAMS
  // slots of a country's range, tier-2 the rest (see countryClubRanges).
  function tierForTid(tid: number): 1 | 2 {
    const range = COUNTRY_RANGES.find((r) => tid >= r.start && tid < r.end);
    return range && tid < range.start + NUM_TEAMS ? 1 : 2;
  }

  function buildLeague(tid: number): LeagueStore {
    const seed = Date.now();
    const rng = mulberry32(seed);
    const generated = createLeagueState(tid, rng, seed);
    const league = roster
      ? applyRosterFileToNewLeague(generated, roster.file, tid).league
      : generated;
    return {
      ...league,
      // Name the save after whatever the user's club ended up being called —
      // the imported name when a roster replaced it, else the fictional one.
      meta: {
        ...league.meta,
        name: league.teams.find((t) => t.tid === tid)?.name ?? CLUBS[tid].name,
      },
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
    trackEvent("league_created", { country, tier: tierForTid(selectedTid), roster: !!roster });
    await setLeague(league);
    navigate("/dashboard");
  }

  async function handleSaveCustomized(teams: EditableTeam[]) {
    if (!pending || selectedTid === null) return;
    setSaving(true);
    trackEvent("league_created", { country, tier: tierForTid(selectedTid), roster: !!roster });
    await setLeague(applyTeamIdentities(pending, teams));
    navigate("/dashboard");
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleRosterFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file after an error
    if (!file) return;
    setRosterError(null);
    try {
      setRoster(loadRoster(await file.text(), file.name));
      setSelectedTid(null);
    } catch (err) {
      setRoster(null);
      setRosterError(err instanceof Error ? err.message : String(err));
    }
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

  if (rosterMode && !roster) {
    return (
      <div className="container py-4" style={{ maxWidth: 600 }}>
        <h2 className="mb-3">Import Custom League</h2>
        <p>
          Load a roster file to start a league with real clubs and squads in place of the
          fictional ones. You'll pick your club from the imported teams on the next step.
        </p>
        <p className="text-muted">
          A roster file is a plain text (JSON) file listing clubs by league, each one
          optionally carrying a squad. You can write one yourself, or generate one with
          the "Copy AI Prompt to Customize" button in the top bar of any save, which hands
          you a ready-made prompt to paste into ChatGPT or Claude.
        </p>
        <p className="text-muted">
          This is the only place a roster file can be loaded. Bringing real squads into a
          save already in progress would wipe out the careers and stats of everyone they
          replaced, so imports happen at creation and nowhere else.
        </p>

        {rosterError && (
          <div className="alert alert-danger py-2" role="alert">
            {rosterError}
          </div>
        )}

        <div className="d-flex gap-2">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => rosterInputRef.current?.click()}
          >
            Choose Roster File
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => navigate("/leagues")}
          >
            Cancel
          </button>
          <input
            ref={rosterInputRef}
            type="file"
            accept=".json,application/json"
            className="d-none"
            onChange={handleRosterFile}
          />
        </div>
      </div>
    );
  }

  const range = COUNTRY_RANGES.find((r) => r.country === country)!;
  const countryClubs = CLUBS.slice(range.start, range.end).map((club, i) => {
    const tid = range.start + i;
    const imported = roster?.byTid.get(tid);
    // An imported club takes over the slot's identity outright, so the picker
    // shows what the club will actually be called once the save exists.
    return {
      tid,
      name: imported?.name ?? club.name,
      colors: (imported?.colors ?? club.colors) as [string, string],
      squad: imported?.players?.length ?? 0,
    };
  });
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
      <h2 className="mb-3">{roster ? "Import Custom League" : "New League"}</h2>
      <p className="text-muted">
        {roster
          ? `Flip through each league to browse its clubs, then choose your ${country} club to get started. Every club the file didn't cover keeps its original name and squad.`
          : customize
            ? `Flip through each league to browse its clubs, then choose your ${country} club to customize every club before starting.`
            : `Flip through each league to browse its clubs, then choose your ${country} club to get started.`}
      </p>

      {roster && (
        <div className="alert alert-secondary py-2">
          <div>
            Loaded <strong>{roster.filename}</strong> — {roster.clubs}{" "}
            {roster.clubs === 1 ? "club" : "clubs"}, {roster.squads} with a full squad.
          </div>
          {roster.warnings.map((w) => (
            <div key={w} className="small text-muted mt-1">
              {w}
            </div>
          ))}
          <button
            type="button"
            className="btn btn-link btn-sm p-0 mt-1"
            onClick={() => {
              setRoster(null);
              setSelectedTid(null);
            }}
          >
            Choose a different file
          </button>
        </div>
      )}

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
            {clubs.map(({ tid, name, colors, squad }) => (
              <button
                key={tid}
                type="button"
                className={`list-group-item list-group-item-action d-flex align-items-center${
                  selectedTid === tid ? " active" : ""
                }`}
                onClick={() => setSelectedTid(tid)}
              >
                <ClubCrest tid={tid} colors={colors} size={28} />
                {name}
                {squad > 0 && (
                  <small className="ms-auto opacity-75">{squad} players</small>
                )}
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

        {/* Loading a previously exported save, which has nothing to do with the
            roster file already loaded — hidden in roster mode to keep the two
            kinds of "import" from sitting side by side. */}
        {!roster && (
          <button className="btn btn-outline-secondary" onClick={handleImportClick}>
            Import League
          </button>
        )}
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
