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
  combineRosterFiles,
  type NamedRosterFile,
  type RosterFile,
  type RosterFileClub,
} from "../../core/teams/rosterFile.js";
import { applyRosterFileToNewLeague } from "../../core/teams/rosterImport.js";
import { takePendingRoster } from "../pendingRoster.js";
import { TeamIdentityEditor, type EditableTeam } from "../components/TeamIdentityEditor.js";
import { ClubCrest, CrestArtProvider } from "../components/ClubCrest.js";
import { CountryFlag } from "../components/CountryFlag.js";
import { trackEvent } from "../analytics.js";
import { createGate, yieldToPaint } from "../singleFlight.js";

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
  /** Every file loaded so far, in load order, so more can be added to them. */
  sources: NamedRosterFile[];
  /** The sources folded into the one file the importer applies. */
  file: RosterFile;
  /** Which club each slot becomes, so the picker can show real names. */
  byTid: Map<number, RosterFileClub>;
  clubs: number;
  squads: number;
  warnings: string[];
}

/**
 * Fold the loaded files into one world and work out what it will look like.
 * Files are combined rather than replacing each other because a world is
 * normally authored a league at a time, so loading england.json and spain.json
 * has to mean both leagues, not whichever was picked last.
 */
function describeRoster(sources: NamedRosterFile[]): LoadedRoster {
  const { file, warnings: combineWarnings } = combineRosterFiles(sources);
  const { slots, warnings } = resolveRosterSlots(SLOT_WORLD, file);
  return {
    sources,
    file,
    byTid: new Map(slots.map((s) => [s.tid, s.club])),
    clubs: slots.length,
    squads: slots.filter((s) => s.club.players && s.club.players.length > 0).length,
    warnings: [...combineWarnings, ...warnings],
  };
}

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
  // Every path on this page that writes a save goes through one gate. Building a
  // world is ~3 seconds of blocking work with no way to interrupt it, so the page
  // freezes; the browser queues the clicks that land on it and delivers them all
  // once it thaws, and each one used to create another league. That's where the
  // duplicate saves came from: four impatient clicks, four identical leagues.
  const gate = useRef(createGate()).current;
  // A file handed over by the Leagues page's Import button is picked up on the
  // first render, so arriving here skips straight to the club picker. useState's
  // initializer (not an effect) because takePendingRoster clears as it reads,
  // and an effect would run twice under StrictMode and lose it.
  const [roster, setRoster] = useState<LoadedRoster | null>(() => {
    const handed = takePendingRoster();
    return handed ? describeRoster(handed.files) : null;
  });
  const [rosterError, setRosterError] = useState<string | null>(null);
  // Failures from "Import League" (a whole exported save), kept separate from
  // rosterError: they surface on different screens and mean different things.
  const [importError, setImportError] = useState<string | null>(null);
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
    await gate.run(async () => {
      setSaving(true);
      // Let the button repaint as disabled before the world generation locks the
      // thread, so the wait looks like the game working rather than a dead page.
      await yieldToPaint();
      try {
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
      } finally {
        setSaving(false);
      }
    });
  }

  async function handleSaveCustomized(teams: EditableTeam[]) {
    if (!pending || selectedTid === null) return;
    await gate.run(async () => {
      setSaving(true);
      try {
        trackEvent("league_created", { country, tier: tierForTid(selectedTid), roster: !!roster });
        await setLeague(applyTeamIdentities(pending, teams));
        navigate("/dashboard");
      } finally {
        setSaving(false);
      }
    });
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  /**
   * Load one or more roster files, adding them to any already loaded so a world
   * can be built up a league at a time (either by selecting every file at once
   * or by coming back for the next one).
   *
   * A file that won't parse takes only itself out: the rest still load and the
   * error names the offending file, because re-picking eleven good files to fix
   * a twelfth is the exact tedium this is meant to remove.
   */
  async function handleRosterFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = ""; // allow re-picking the same file after an error
    if (picked.length === 0) return;
    setRosterError(null);

    const loaded: NamedRosterFile[] = [];
    const errors: string[] = [];
    for (const file of picked) {
      try {
        loaded.push({ name: file.name, file: parseRosterFile(await file.text()) });
      } catch (err) {
        errors.push(`${file.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (loaded.length > 0) {
      setRoster((prev) => describeRoster([...(prev?.sources ?? []), ...loaded]));
      setSelectedTid(null);
    }
    setRosterError(errors.length > 0 ? errors.join(" ") : null);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset so the same file can be picked again after a fix
    if (!file) return;
    setImportError(null);
    // Through the same gate as creation: an import also lands as a brand new
    // save, so a second one arriving while the first is still writing would be
    // a second copy of it.
    await gate.run(async () => {
      try {
        await importJSON(file);
      } catch (err) {
        // Without this the whole import was a silent no-op: the error went to the
        // browser console, the navigate below never ran, and the page just sat
        // there looking like the button did nothing.
        setImportError(err instanceof Error ? err.message : String(err));
        return;
      }
      trackEvent("league_imported");
      navigate("/dashboard");
    });
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
          You can pick several files at once, or add more after the first, and they'll all
          go into the same league. That's the easy way to do a whole world: one file per
          league is a much more manageable thing to ask an AI for than every league at
          once.
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
            Choose Roster Files
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
            multiple
            className="d-none"
            onChange={handleRosterFiles}
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
    // The picker previews the world the import will produce, so it has to hide
    // the same crests the league itself will — otherwise a club shows a badge
    // here and a colour swatch the moment the save opens.
    <CrestArtProvider tids={roster ? [...roster.byTid.keys()] : []}>
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
            Loaded <strong>{roster.sources.map((s) => s.name).join(", ")}</strong> —{" "}
            {roster.clubs} {roster.clubs === 1 ? "club" : "clubs"}, {roster.squads} with a
            full squad.
          </div>
          {roster.warnings.map((w) => (
            <div key={w} className="small text-muted mt-1">
              {w}
            </div>
          ))}
          {rosterError && (
            <div className="small text-danger mt-1">{rosterError}</div>
          )}
          <div className="d-flex gap-3 mt-1">
            <button
              type="button"
              className="btn btn-link btn-sm p-0"
              onClick={() => rosterInputRef.current?.click()}
            >
              Add another file
            </button>
            <button
              type="button"
              className="btn btn-link btn-sm p-0"
              onClick={() => {
                setRoster(null);
                setRosterError(null);
                setSelectedTid(null);
              }}
            >
              Start over
            </button>
          </div>
          <input
            ref={rosterInputRef}
            type="file"
            accept=".json,application/json"
            multiple
            className="d-none"
            onChange={handleRosterFiles}
          />
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

      {importError && (
        <div className="alert alert-danger py-2" role="alert">
          <div>Couldn't import that file.</div>
          <div className="small">{importError}</div>
        </div>
      )}

      <div className="d-flex gap-2 align-items-center">
        <button
          className="btn btn-primary"
          disabled={selectedTid === null || saving}
          onClick={handleStart}
        >
          {saving
            ? "Building your world..."
            : customize
              ? "Next: Customize Teams"
              : "Start League"}
        </button>

        {/* Loading a previously exported save, which has nothing to do with the
            roster file already loaded — hidden in roster mode to keep the two
            kinds of "import" from sitting side by side. */}
        {!roster && (
          <button
            className="btn btn-outline-secondary"
            onClick={handleImportClick}
            title="Load a saved game you downloaded with Export"
          >
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

      {/* Generating 240 clubs and their squads blocks the browser for a few
          seconds, and a frozen page with no explanation reads as a broken one.
          Extra clicks are dropped either way (see the gate above), so this is
          about the wait making sense, not about preventing anything. */}
      {saving && (
        <p className="text-muted small mt-2 mb-0">
          Filling 240 clubs with players. This takes a few seconds, and the page
          will sit still while it happens.
        </p>
      )}
    </div>
    </CrestArtProvider>
  );
}
