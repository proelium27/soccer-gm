import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { clubIdentitiesFor } from "../../core/teams/clubs.js";
import { createLeagueState, type LeagueStore } from "../../core/leagueState.js";
import { applyTeamIdentities } from "../../core/teams/customize.js";
import { mulberry32 } from "../../engine/rng.js";
import { useLeague } from "../context/LeagueContext.js";
import { readLeagueFileText } from "../../db/exportImport.js";
import {
  DIFFICULTIES, DIFFICULTY_ORDER, DEFAULT_DIFFICULTY, INTL_MIN_POOL, type Difficulty,
} from "../../core/constants.js";
import { confederationOf, isEligibleNation } from "../../core/international/index.js";
import { PICKABLE_NATIONALITIES } from "../components/NationalityEditor.js";
import {
  buildCompetitions,
  competitionAbbrev,
  countryClubRanges,
  countriesOf,
  worldTeamSlots,
} from "../../core/competitions.js";
import {
  WorldSetup, defaultWorldEntries, includedSpecs, leagueRosterFiles, type WorldEntry,
} from "../components/WorldSetup.js";
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
import {
  SEASON_START_YEAR, MIN_START_YEAR, MAX_START_YEAR, normalizeStartYear,
} from "../format.js";
import { ROSTER_DOWNLOAD_URL } from "../rosterDownload.js";
import { createGate, yieldToPaint } from "../singleFlight.js";

/**
 * Everything the picker needs to describe a world that doesn't exist yet: the
 * competitions table, the countries in it, each country's block of club slots,
 * and the tid→competition layout a roster file resolves against.
 *
 * Derived from the chosen leagues rather than fixed at module scope, because the
 * world is now the player's to shape — switching a country off or adding one
 * changes every one of these, and a stale COUNTRY_RANGES would point the picker
 * at the wrong clubs.
 */
function describeWorld(specs: ReturnType<typeof includedSpecs>) {
  const competitions = buildCompetitions(specs);
  return {
    competitions,
    countries: countriesOf(competitions),
    ranges: countryClubRanges(competitions),
    slotWorld: {
      competitions,
      teams: worldTeamSlots(competitions),
    },
  };
}

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
function describeRoster(
  sources: NamedRosterFile[],
  slotWorld: ReturnType<typeof describeWorld>["slotWorld"],
): LoadedRoster {
  const { file, warnings: combineWarnings } = combineRosterFiles(sources);
  const { slots, warnings } = resolveRosterSlots(slotWorld, file);
  return {
    sources,
    file,
    byTid: new Map(slots.map((s) => [s.tid, s.club])),
    clubs: slots.length,
    squads: slots.filter((s) => s.club.players && s.club.players.length > 0).length,
    warnings: [...combineWarnings, ...warnings],
  };
}

export function NewLeague() {
  // The shape of the world, chosen before it is generated — in every mode,
  // roster import included. A roster file names the competitions it fills and
  // its clubs are mapped onto them again from scratch whenever the world moves
  // (see activeRoster below), so reshaping the world under a loaded file re-aims
  // it rather than misaiming it. Adding the league your file was written for is
  // the whole point: without it, the file's competition is simply "not in this
  // world" and everything in it is skipped.
  const [worldEntries, setWorldEntries] = useState<WorldEntry[]>(defaultWorldEntries);
  const world = useMemo(() => describeWorld(includedSpecs(worldEntries)), [worldEntries]);

  /** Competition name for a country's given tier (e.g. "English Division 1"). */
  function divisionName(countryName: string, tier: number): string {
    return (
      world.competitions.find((c) => c.country === countryName && c.tier === tier)?.name ??
      `Division ${tier}`
    );
  }

  const [country, setCountry] = useState<string>(() => countriesOf(buildCompetitions(includedSpecs(defaultWorldEntries())))[0]);
  const [selectedTid, setSelectedTid] = useState<number | null>(null);
  // Fixed for the save's lifetime once it's created, so it is chosen here and
  // nowhere else (see the DIFFICULTIES block in core/constants.ts).
  const [difficulty, setDifficulty] = useState<Difficulty>(DEFAULT_DIFFICULTY);
  // The country you'll manage alongside your club, or null for club football
  // only — which is the default, and not a lesser save. Can be changed later by
  // taking a federation's offer, so this is a starting point rather than a
  // decision for the save's lifetime the way difficulty is.
  const [userNation, setUserNation] = useState<string | null>(null);
  // A chosen country the generated world turned out not to be able to field a
  // squad for. Reported rather than silently dropped — see handleStart.
  const [nationError, setNationError] = useState<string | null>(null);
  // Filter box for the country list. 108 countries is too many to scroll for a
  // specific one, and too few to be worth paginating.
  const [nationFilter, setNationFilter] = useState("");
  // The world's generation seed, drawn once and reused — see buildLeague.
  const seedRef = useRef<number | null>(null);
  // Which year season 1 gets labelled as. Purely cosmetic (the sim counts
  // seasons from 1 either way), so it's held as raw text and only turned into a
  // number once it reads as a usable year, letting the field go empty mid-edit.
  const [startYear, setStartYear] = useState(String(SEASON_START_YEAR));
  // Name and colour every club before the save is written. The editor itself
  // already existed behind the Leagues page's Customize Teams button; this just
  // offers the same step from the ordinary flow, which is where someone who has
  // just invented a league actually is.
  const [nameClubs, setNameClubs] = useState(false);
  // Whether Continental Cup places are re-earned each season on a rolling
  // country coefficient, or stay as the world was built. Fixed for the save's
  // lifetime like the difficulty above, because turning it off mid-dynasty
  // would freeze an allocation the league had already earned its way into.
  const [rollingCoefficients, setRollingCoefficients] = useState(true);
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
  //
  // Only the FILES are kept, never the slots they resolved to. The world can be
  // reshaped after they are loaded, and a stored resolution would go stale the
  // moment it was — which is precisely why the world editor used to be hidden
  // on this path.
  const [rosterSources, setRosterSources] = useState<NamedRosterFile[]>(
    () => takePendingRoster()?.files ?? [],
  );
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

  /**
   * The world-wide files on their own, resolved against the world as it stands.
   * Drives the "Loaded x, y, z" panel, which speaks about those files and must
   * not fold in per-league ones the world editor already lists beside their own
   * league.
   */
  const worldRoster = useMemo(
    () => (rosterSources.length > 0 ? describeRoster(rosterSources, world.slotWorld) : null),
    [rosterSources, world],
  );

  /**
   * The roster actually applied: the world-wide files plus the ones attached to
   * individual added leagues, folded together and resolved as one. Both kinds
   * used to be mutually exclusive because the world editor vanished as soon as a
   * world-wide file was loaded; now that it doesn't, they are combined. Per-league
   * files come last, so a league carrying its own file wins the competition it
   * names — it is the more specific of the two.
   */
  const activeRoster = useMemo((): LoadedRoster | null => {
    const { files, warnings } = leagueRosterFiles(worldEntries, world.competitions);
    const sources = [...rosterSources, ...files];
    if (sources.length === 0) return null;
    const described = describeRoster(sources, world.slotWorld);
    return { ...described, warnings: [...warnings, ...described.warnings] };
  }, [rosterSources, worldEntries, world]);

  /**
   * Reshaping the world can move, remove or re-letter the slot the chosen club
   * sits in, so a selection only survives a change that leaves the slot layout
   * alone — renaming a country, or retuning one, rather than adding or dropping
   * clubs. Without this you could pick a club in the picker and start a save as
   * a different one.
   */
  function changeWorld(next: WorldEntry[]) {
    const after = worldTeamSlots(buildCompetitions(includedSpecs(next)));
    const before = world.slotWorld.teams;
    const sameLayout =
      before.length === after.length && before.every((t, i) => t.compId === after[i].compId);
    setWorldEntries(next);
    if (!sameLayout) setSelectedTid(null);
  }

  const parsedStartYear = normalizeStartYear(startYear);

  // Countries that can be managed: anything the game ships names for that also
  // belongs to a confederation, since no confederation means no competition to
  // enter. One flat alphabetical list, deliberately — whether a country happens
  // to host one of this world's leagues is not the question being asked here,
  // and splitting on it implied a distinction the player has no use for. What
  // actually decides eligibility is how many of its players get generated, which
  // no grouping can promise and the check at Start reports honestly.
  const manageableNations = useMemo(
    () => PICKABLE_NATIONALITIES.filter((n) => confederationOf(n) !== null),
    [],
  );
  const shownNations = useMemo(() => {
    const q = nationFilter.trim().toLowerCase();
    return q ? manageableNations.filter((n) => n.toLowerCase().includes(q)) : manageableNations;
  }, [manageableNations, nationFilter]);

  // Keep the chosen country on screen. The list is 108 rows in a 260px box, so
  // typing a filter and then clearing it leaves the selection scrolled far out
  // of view and the list looks like nothing is picked.
  //
  // Scrolls the list box itself rather than calling `scrollIntoView`, which
  // scrolls EVERY scrollable ancestor including the window. This picker sits
  // below the fold, so on mount the row genuinely is not visible in the page
  // and "nearest" dutifully scrolled the whole screen down to it — the page
  // opened at its own bottom. Moving `scrollTop` by hand cannot reach past the
  // one element it is given, and it still leaves an already-visible row alone,
  // so it can't fight a scroll the user is in the middle of either.
  const nationListRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const list = nationListRef.current;
    const row = list?.querySelector<HTMLElement>(".active");
    if (!list || !row) return;
    const listBox = list.getBoundingClientRect();
    const rowBox = row.getBoundingClientRect();
    if (rowBox.top < listBox.top) list.scrollTop -= listBox.top - rowBox.top;
    else if (rowBox.bottom > listBox.bottom) list.scrollTop += rowBox.bottom - listBox.bottom;
  }, [shownNations, userNation]);

  /** The country's code, for the flag stand-in on its tab. */
  function abbrevForCountry(countryName: string): string {
    const comp = world.competitions.find((c) => c.country === countryName);
    return comp ? competitionAbbrev(comp) : "";
  }

  // Which tier the chosen club plays in. Read off the slot layout rather than
  // assumed from position in the country's block, because divisions can be
  // different sizes and a country can have only one of them.
  function tierForTid(tid: number): number {
    const compId = world.slotWorld.teams.find((t) => t.tid === tid)?.compId;
    return world.competitions.find((c) => c.id === compId)?.tier ?? 1;
  }

  function buildLeague(tid: number): LeagueStore {
    // Fixed for the life of the page, not re-rolled per attempt. If a chosen
    // country turns out not to be able to field a squad, the advice is "pick
    // another one" — which is only true if pressing Start again builds the same
    // world. A fresh Date.now() would answer a different question each time, so
    // the same country could fail and then succeed.
    const seed = (seedRef.current ??= Date.now());
    const rng = mulberry32(seed);
    const generated = createLeagueState(
      tid, rng, seed, difficulty, world.competitions, rollingCoefficients, userNation,
    );
    const league = activeRoster
      ? applyRosterFileToNewLeague(generated, activeRoster.file, tid).league
      : generated;
    return {
      ...league,
      // Name the save after whatever the user's club ended up being called —
      // the imported name when a roster replaced it, else the fictional one.
      // Every tid in the world has a team, so the fallback is only a guard.
      meta: {
        ...league.meta,
        name: league.teams.find((t) => t.tid === tid)?.name ?? `Club ${tid}`,
        // Display only: seasons stay a 1-based counter, this just decides which
        // year the UI calls season 1. The Start button is disabled while the
        // field is unusable, so the fallback only keeps the type honest.
        startYear: parsedStartYear ?? SEASON_START_YEAR,
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
        // Whether a country can enter international football at all depends on
        // the world that just got generated (INTL_MIN_POOL players and a
        // keeper), and there is no way to know before building it. A pick that
        // doesn't clear the bar is reported rather than silently dropped — a
        // save that quietly ignored the country you chose is worse than being
        // told to choose again.
        if (userNation && !isEligibleNation(userNation, league.players.filter((p) => p.nationality === userNation))) {
          setNationError(userNation);
          return;
        }
        setNationError(null);
        if (customize || nameClubs) {
          // Hold the generated league in memory and let the user edit team
          // identities before anything is persisted.
          setPending(league);
          return;
        }
        trackEvent("league_created", { country, tier: tierForTid(selectedTid), roster: !!activeRoster, difficulty, rollingCoefficients });
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
        trackEvent("league_created", { country, tier: tierForTid(selectedTid), roster: !!activeRoster, difficulty, rollingCoefficients });
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
        // Roster files are hand-written or AI-authored and so never compressed,
        // but every picked file goes through one reader so a gzipped one can't
        // read as garbage on this screen alone.
        loaded.push({
          name: file.name,
          file: parseRosterFile(await readLeagueFileText(file)),
        });
      } catch (err) {
        errors.push(`${file.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (loaded.length > 0) {
      setRosterSources((prev) => [...prev, ...loaded]);
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

  if (rosterMode && !worldRoster) {
    return (
      <div className="container py-4" style={{ maxWidth: 600 }}>
        <h2 className="mb-3">Import Custom League</h2>
        <p>
          Load a roster file to start a league with real clubs and squads in place of the
          fictional ones. You'll pick your club from the imported teams on the next step.
        </p>

        {ROSTER_DOWNLOAD_URL && (
          <div className="border rounded p-3 mb-3">
            <div className="fw-semibold mb-1">Don't have one yet?</div>
            <p className="text-muted small mb-2">
              Grab the ready-made file covering every league in the game, save it
              somewhere you'll find it, then load it below. It's a separate download
              rather than part of the game itself.
            </p>
            <a
              className="btn btn-outline-primary btn-sm"
              href={ROSTER_DOWNLOAD_URL}
              target="_blank"
              rel="noopener noreferrer"
              download
            >
              Download roster file
            </a>
          </div>
        )}

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
          Roster files can only be loaded while a league is being created, here or on the
          New League screen. Bringing real squads into a save already in progress would
          wipe out the careers and stats of everyone they replaced.
        </p>
        <p className="text-muted">
          On the next step you can also reshape the world itself: rename a league, add one
          of your own, or switch one off. If your file names a league this world hasn't
          got, adding it there is what makes the file apply.
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

  // Switching a country off can leave the picker pointing at one the world no
  // longer has, so fall back rather than crash on the missing range.
  const activeCountry = world.countries.includes(country) ? country : world.countries[0];
  const range = world.ranges.find((r) => r.country === activeCountry);
  const countryClubs = (range ? clubIdentitiesFor(activeCountry, range.end - range.start) : []).map((club, i) => {
    const tid = range!.start + i;
    const imported = activeRoster?.byTid.get(tid);
    // An imported club takes over the slot's identity outright, so the picker
    // shows what the club will actually be called once the save exists.
    return {
      tid,
      name: imported?.name ?? club.name,
      colors: (imported?.colors ?? club.colors) as [string, string],
      squad: imported?.players?.length ?? 0,
    };
  });
  // Split by the tier each slot actually belongs to. A country can have one
  // division or two, and they need not be the same size.
  const d1Clubs = countryClubs.filter((c) => tierForTid(c.tid) === 1);
  const d2Clubs = countryClubs.filter((c) => tierForTid(c.tid) === 2);

  function selectCountry(c: string) {
    setCountry(c);
    setSelectedTid(null);
  }

  return (
    // The picker previews the world the import will produce, so it has to hide
    // the same crests the league itself will — otherwise a club shows a badge
    // here and a colour swatch the moment the save opens.
    <CrestArtProvider tids={activeRoster ? [...activeRoster.byTid.keys()] : []}>
    <div className="container py-4" style={{ maxWidth: 600 }}>
      <h2 className="mb-3">{rosterMode ? "Import Custom League" : "New League"}</h2>
      {/*
        The country is deliberately not named here. It used to read "choose your
        England club", which is clumsy on its own and ambiguous now that this
        page also asks which *country* you want to manage — and the adjectival
        form ("your English club") is not available, since a league the player
        added has whatever name they typed and no demonym to derive.
      */}
      <p className="text-muted">
        Flip through each league to browse its clubs, then pick the club you want to manage.
        {worldRoster
          ? " Every club the file didn't cover keeps its original name and squad."
          : customize
            ? " You'll get to customize every club before the save starts."
            : ""}
      </p>

      {worldRoster && (
        <div className="alert alert-secondary py-2">
          <div>
            Loaded <strong>{worldRoster.sources.map((s) => s.name).join(", ")}</strong> —{" "}
            {worldRoster.clubs} {worldRoster.clubs === 1 ? "club" : "clubs"},{" "}
            {worldRoster.squads} with a full squad.
          </div>
          {worldRoster.warnings.map((w) => (
            <div key={w} className="small text-muted mt-1">
              {w}
            </div>
          ))}
          {rosterError && (
            <div className="small text-danger mt-1">{rosterError}</div>
          )}
          {/* The commonest reason a file lands nowhere is that the world hasn't
              got the league it was written for, which the editor below can fix —
              so say so here, next to the warning that reports it. */}
          <div className="small text-muted mt-1">
            A league your file names that this world hasn't got is skipped. Rename a
            league to match it, or add one, in World setup below.
          </div>
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
                setRosterSources([]);
                setRosterError(null);
                setSelectedTid(null);
              }}
            >
              Start over
            </button>
          </div>
        </div>
      )}

      {/* Loading roster files is offered on the ordinary New League screen too,
          so the two ways in differ only in where they start you: the world
          editor and the file loader are the same on both. */}
      {!worldRoster && !rosterMode && (
        <div className="mb-3">
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => rosterInputRef.current?.click()}
          >
            Load roster files
          </button>
          <p className="text-muted small mt-2 mb-0">
            Optional. Roster files put real (or invented) clubs and squads into the
            leagues they name, in place of the fictional ones.
          </p>
          {rosterError && <div className="small text-danger mt-1">{rosterError}</div>}
        </div>
      )}

      {/* One input for both entry points above. */}
      <input
        ref={rosterInputRef}
        type="file"
        accept=".json,application/json"
        multiple
        className="d-none"
        onChange={handleRosterFiles}
      />

      {/*
        Shown in roster mode too. Slots are resolved from the loaded files
        against the world as it currently stands (see activeRoster), so a file
        follows the world when it moves — and adding the league a file was
        written for is the only way to make that file apply at all.
      */}
      <WorldSetup entries={worldEntries} onChange={changeWorld} />

      <div className="btn-group mb-3 flex-wrap" role="group" aria-label="Choose a league">
        {world.countries.map((c) => (
          <button
            key={c}
            type="button"
            className={`btn btn-outline-secondary d-inline-flex align-items-center gap-2${
              c === activeCountry ? " active" : ""
            }`}
            onClick={() => selectCountry(c)}
          >
            <CountryFlag country={c} fallback={abbrevForCountry(c)} />
            {c}
          </button>
        ))}
      </div>

      {(
        [
          [divisionName(activeCountry, 1), d1Clubs],
          [divisionName(activeCountry, 2), d2Clubs],
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

      <div className="mb-3">
        <h6 className="text-muted text-uppercase small fw-semibold mb-2">Difficulty</h6>
        <div className="btn-group w-100" role="group" aria-label="Choose a difficulty">
          {DIFFICULTY_ORDER.map((d) => (
            <button
              key={d}
              type="button"
              className={`btn btn-outline-secondary${d === difficulty ? " active" : ""}`}
              onClick={() => setDifficulty(d)}
            >
              {DIFFICULTIES[d].label}
            </button>
          ))}
        </div>
        <p className="text-muted small mt-2 mb-0">
          {DIFFICULTIES[difficulty].blurb} It only changes things for your club, and you
          can't change it later, so pick one you'll want to live with.
        </p>
      </div>

      <div className="mb-3">
        <h6 className="text-muted text-uppercase small fw-semibold mb-2">National team</h6>
        <p className="text-muted small mb-2">
          {userNation
            ? `You'll pick ${userNation}'s squad and their eleven for qualifying, the World Cup and their continental championship, on top of your club job. The federation judges you every campaign.`
            : "Managing a country is optional, and you can still take a job later if one comes in. A country needs enough players born into your world to enter anything, so you'll be told if the one you pick can't field a squad."}
        </p>
        <input
          type="search"
          className="form-control form-control-sm mb-2"
          style={{ maxWidth: 340 }}
          placeholder="Search countries"
          aria-label="Search countries"
          value={nationFilter}
          onChange={(e) => setNationFilter(e.target.value)}
        />
        {/*
          A list rather than a <select>, because an <option> cannot hold the
          flag SVG. Same list-group the club picker above uses, so the two
          choices on this page look like the same kind of choice.
        */}
        <div
          className="list-group"
          ref={nationListRef}
          style={{ maxWidth: 340, maxHeight: 260, overflowY: "auto" }}
        >
          <button
            type="button"
            className={`list-group-item list-group-item-action py-1${userNation === null ? " active" : ""}`}
            onClick={() => { setUserNation(null); setNationError(null); }}
          >
            None &mdash; club football only
          </button>
          {shownNations.map((n) => (
            <button
              type="button"
              key={n}
              className={`list-group-item list-group-item-action py-1 d-flex align-items-center gap-2${userNation === n ? " active" : ""}`}
              onClick={() => { setUserNation(n); setNationError(null); }}
            >
              <CountryFlag country={n} fallback={n.slice(0, 2).toUpperCase()} />
              {n}
            </button>
          ))}
          {shownNations.length === 0 && (
            <div className="list-group-item text-muted small">No country by that name.</div>
          )}
        </div>
        {nationError && (
          <div className="alert alert-warning py-2 mt-2 mb-0" role="alert">
            {nationError} can't field a squad in this world — there aren't {INTL_MIN_POOL} of
            their players in it, or no goalkeeper among them. Pick another country, or start
            with none and wait for an offer.
          </div>
        )}
      </div>

      <div className="mb-3">
        <h6 className="text-muted text-uppercase small fw-semibold mb-2">Continental Cup places</h6>
        <div className="form-check">
          <input
            type="checkbox"
            className="form-check-input"
            id="rolling-coefficients"
            checked={rollingCoefficients}
            onChange={(e) => setRollingCoefficients(e.target.checked)}
          />
          <label className="form-check-label" htmlFor="rolling-coefficients">
            Cup places can move between countries
          </label>
        </div>
        <p className="text-muted small mt-2 mb-0">
          {rollingCoefficients
            ? "How many clubs each country sends to the Continental Cup depends on how its clubs have done in Europe over the last few seasons. Do well and your league sends more; go out early for years and it sends fewer. The Shield gives every league the same two either way."
            : "Every country keeps the same number of Cup places forever, however its clubs do in Europe."}{" "}
          This is fixed once the save is created.
        </p>
      </div>

      <div className="mb-3">
        <h6 className="text-muted text-uppercase small fw-semibold mb-2">Start year</h6>
        <div className="d-flex align-items-center gap-2">
          <input
            type="number"
            className={`form-control${parsedStartYear === null ? " is-invalid" : ""}`}
            style={{ maxWidth: 140 }}
            value={startYear}
            min={MIN_START_YEAR}
            max={MAX_START_YEAR}
            aria-label="Start year"
            onChange={(e) => setStartYear(e.target.value)}
          />
          {parsedStartYear !== null && (
            <span className="text-muted small">
              Your first season is {parsedStartYear}-
              {String((parsedStartYear + 1) % 100).padStart(2, "0")}.
            </span>
          )}
        </div>
        <p className="text-muted small mt-2 mb-0">
          {parsedStartYear === null
            ? `Pick a year between ${MIN_START_YEAR} and ${MAX_START_YEAR}.`
            : "Just for looks. It's the year the game puts on your first season, and every season after counts up from there."}
        </p>
      </div>

      {importError && (
        <div className="alert alert-danger py-2" role="alert">
          <div>Couldn't import that file.</div>
          <div className="small">{importError}</div>
        </div>
      )}

      {/* Redundant when you arrived through Customize Teams, which always
          opens the editor. */}
      {!customize && (
        <div className="form-check mb-3">
          <input
            type="checkbox"
            className="form-check-input"
            id="name-clubs"
            checked={nameClubs}
            onChange={(e) => setNameClubs(e.target.checked)}
          />
          <label className="form-check-label" htmlFor="name-clubs">
            Name the clubs yourself
            <span className="text-muted small d-block">
              Opens an editor after the world is built, where you can rename any club
              and set its colours. Nothing is saved until you're done.
            </span>
          </label>
        </div>
      )}

      <div className="d-flex gap-2 align-items-center">
        <button
          className="btn btn-primary"
          disabled={selectedTid === null || saving || parsedStartYear === null}
          onClick={handleStart}
        >
          {saving
            ? "Building your world..."
            : customize || nameClubs
              ? "Next: Name Your Clubs"
              : "Start League"}
        </button>

        {/* Loading a previously exported save, which has nothing to do with the
            roster file already loaded — hidden once one is, to keep the two
            kinds of "import" from sitting side by side. */}
        {!worldRoster && (
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
