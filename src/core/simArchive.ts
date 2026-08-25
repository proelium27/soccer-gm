import type { LeagueStore } from "./leagueState.js";
import type { PowerRankingSnapshot } from "./teams/powerRanking.js";
import type { ArchivedPlayer } from "./players/archive.js";
import type { PlayedMatch } from "./standings.js";
import type { SeasonStats, RatingsSnapshot } from "./players/types.js";
import { POSITION_CHANGE_SEASONS } from "./constants.js";
import { pruneRetireeArchive } from "./players/archive.js";
import { scrubHistoryForCull } from "./players/freeAgentCull.js";

/**
 * History the sim writes but never reads, held back from the worker.
 *
 * **Why this exists: the save crosses the worker boundary twice per sim, and
 * that is what kills a long save on mobile.** `postMessage` structured-clones
 * the whole `LeagueStore` out and the whole result back, so a sim round trip
 * holds at least four copies live at once. Measured on a simmed season-56 world
 * (`scripts/tmpGrowth.ts` shape): the save is **165.6 MB** serialized and
 * **~150 MB** as live objects, so the round trip peaks north of half a gigabyte
 * before the sim's own working set, React and the DOM. A mobile tab is killed
 * well below that — and the same boundary already throws
 * `DataCloneError: ... out of memory` for real users on *desktop*, which is the
 * same failure with more headroom.
 *
 * The fix is to stop sending what the sim does not use. These fields are pure
 * accumulation: the sim appends to them and nothing in `simThrough`,
 * `simOffseason` or `autopilot` ever reads one to make a decision. So the main
 * thread keeps them and hands the worker empty arrays; whatever comes back in
 * them is exactly this run's new entries, because appending to `[]` yields the
 * delta for free.
 *
 * Measured at season 56: `retiredPlayers` 22.4 MB + `powerRankingHistory`
 * 9.0 MB = **31.4 MB off both directions**, on top of what
 * `POWER_SNAPSHOT_INTERVAL` already saves.
 *
 * `newsEvents` and the cup histories are held back too, but they needed more
 * than an empty array because two offseason steps read them — see `detachNews`.
 * **`transfers` and `seasonHistory` can never move here**: they are read for
 * real sim decisions (arrival seasons via `joinedSeasons`, loan returns,
 * `academyForm`, `protectedStars`), not merely accumulated.
 *
 * **The invariant, if you add a field:** it must be append-only across the
 * whole worker-side call graph. A single read of the retained data inside the
 * sim silently sees an empty array — no type error, no crash, just wrong
 * results. `test/core/simArchive.test.ts` is the gate: it asserts a detached
 * round trip is deep-equal to running the offseason on the whole league.
 */
export interface LeagueArchive {
  powerRankingHistory: PowerRankingSnapshot[];
  retiredPlayers: ArchivedPlayer[];
}

/**
 * Split a league into what the worker needs and what it doesn't.
 *
 * The payload keeps the same shape — empty arrays, not missing keys — so the
 * sim needs no branch for it and an old worker build mid-upgrade still runs.
 */
export function detachArchive(league: LeagueStore): {
  payload: LeagueStore;
  archive: LeagueArchive;
} {
  const archive: LeagueArchive = {
    powerRankingHistory: league.powerRankingHistory ?? [],
    retiredPlayers: league.retiredPlayers ?? [],
  };
  return {
    payload: { ...league, powerRankingHistory: [], retiredPlayers: [] },
    archive,
  };
}

/**
 * Fold the worker's result back onto the history the main thread kept.
 *
 * `result`'s two fields hold only this run's new entries (see above), so the
 * retained rows go first and order is preserved exactly as an undetached run
 * would have left it. The retiree cap is applied here rather than in the
 * worker, which never saw enough rows to need it.
 */
export function reattachArchive(result: LeagueStore, archive: LeagueArchive): LeagueStore {
  return {
    ...result,
    powerRankingHistory: [
      ...archive.powerRankingHistory,
      ...(result.powerRankingHistory ?? []),
    ],
    retiredPlayers: pruneRetireeArchive([
      ...archive.retiredPlayers,
      ...(result.retiredPlayers ?? []),
    ]),
  };
}

/**
 * A box score replaced by a marker, for a match the worker does not need to
 * look at again.
 *
 * **This is the biggest single thing in a save, by a distance.** Every match of
 * the current season sits in `league.played` carrying its full box score, and
 * one box score is ~17.4 KB (25 player lines at 6.6 KB, 181 events at 10.8 KB).
 * Measured by simming a real user's 32-competition / 640-club save forward, the
 * league plays 12,160 matches a season and `played` grows straight through it:
 *
 * | matchday | box scores | whole save | structuredClone |
 * | -------- | ---------- | ---------- | --------------- |
 * | 5        | 26.6 MB    | 44.2 MB    | 480 ms          |
 * | 20       | 107.5 MB   | 132.9 MB   | 1610 ms         |
 * | 38       | 204.7 MB   | 232.8 MB   | 3436 ms         |
 *
 * So by the end of a season **88% of the save is box scores for matches already
 * played**, on a save in its *first* season. The shipped 16-competition world
 * plays 6,080 league matches and so peaks around 106 MB the same way. This is
 * what the reported "crashing at season 56 on mobile" actually is: it is not a
 * function of how many seasons have passed at all — `played` is wiped every
 * offseason and rebuilt every season — which is exactly why a growth curve
 * measured after each offseason never sees it.
 *
 * The sim does not need them. `applyInjuries`, `applySuspensions` and
 * `detectMatchdayNewsEvents` all take the matchday's own results, which the
 * worker has just generated; the markets, `computeStandings` and
 * `computeTeamForm` read scores only. The single exception is
 * `computeTeamSeasonStats` in the offseason, which is why `simOffseason` takes
 * a precomputed `teamStats`.
 *
 * `stub: true` is what makes the round trip safe. It marks a box score as
 * hollow so `reattachPlayed` can tell the worker's real ones from the ones it
 * was handed, without guessing from array positions.
 */
const STUB_BOX_SCORE = { home: [], away: [], events: [], stub: true } as const;

function isStub(m: PlayedMatch): boolean {
  return (m.boxScore as { stub?: boolean }).stub === true;
}

/**
 * Replace the box scores of already-played matches with markers.
 *
 * Scores, possession and matchday all survive, because the sim genuinely reads
 * those. Only the per-player lines and the event timeline go, and those are the
 * whole weight.
 */
export function detachPlayed(league: LeagueStore): {
  payload: LeagueStore;
  played: PlayedMatch[];
} {
  const played = league.played ?? [];
  if (played.length === 0) return { payload: league, played };
  return {
    payload: {
      ...league,
      played: played.map((m) => ({ ...m, boxScore: STUB_BOX_SCORE as unknown as PlayedMatch["boxScore"] })),
    },
    played,
  };
}

/**
 * Put the real box scores back.
 *
 * `simThrough` only ever appends to `played` and the offseason only ever clears
 * it, so the stubs the worker was handed come back as a **leading run** — and
 * counting that run is what makes this exact rather than positional guesswork.
 * A result with no stubs at the front means the offseason wiped the array, so
 * everything in it is the worker's own and is kept verbatim.
 */
/**
 * How much of a player's career the worker is handed, and why exactly this much.
 *
 * Sized from the code rather than picked: the widest consumer is the
 * position-change spell walk, which reads the last `POSITION_CHANGE_SEASONS - 1`
 * ratings snapshots (with their full `ratings`, so they cannot be thinned), and
 * `ovrDuringSeason` — used by the awards and by `archivePlayer`'s `finalOvr` —
 * wants the one stamped season − 1, which sits one further back once progression
 * has appended. `POSITION_CHANGE_SEASONS` covers both with a season to spare.
 *
 * Stats need less still: `accumulateStats` finds-or-creates the current season's
 * row and the awards read that same row, so one would do. Two, for the same
 * reason as above — the margin is a few hundred bytes a player and the failure
 * mode is silent.
 *
 * `test/core/simArchive.test.ts` pins that these are enough by running a whole
 * season and offseason on the window and requiring the same league out.
 */
const RECENT_HIST_SEASONS = POSITION_CHANGE_SEASONS;
const RECENT_STATS_SEASONS = 2;

/**
 * What was cut from one player's career, so it can be put back.
 *
 * The counts are what make the merge exact rather than positional: the worker is
 * handed a **suffix**, and it both appends to it (a new stats row, a new
 * snapshot) and edits inside it (`accumulateStats` updates the current season's
 * row in place on its own copy). So the answer is the retained prefix plus
 * everything the worker now has — never a diff of the two.
 */
interface CutCareer {
  stats: SeasonStats[];
  hist: RatingsSnapshot[];
  statsCut: number;
  histCut: number;
}

/**
 * Hand the worker a window of each career instead of the whole thing.
 *
 * Measured on the reported season-60 save, `stats[]` + `hist[]` are 45.2 MB of a
 * 181.6 MB league — the biggest thing in it after the box scores, and unlike
 * those it is there whatever the matchday. Nothing in the sim reads a whole
 * career any more: `archivePlayer` was the last one and now builds from the
 * stored summary, so what is left wants only the seasons at the end.
 */
export function detachCareer(league: LeagueStore): {
  payload: LeagueStore;
  careers: Map<number, CutCareer>;
} {
  const careers = new Map<number, CutCareer>();
  const players = league.players.map((p) => {
    const statsCut = Math.max(0, p.stats.length - RECENT_STATS_SEASONS);
    const histCut = Math.max(0, p.hist.length - RECENT_HIST_SEASONS);
    if (statsCut === 0 && histCut === 0) return p;
    careers.set(p.pid, { stats: p.stats, hist: p.hist, statsCut, histCut });
    return { ...p, stats: p.stats.slice(statsCut), hist: p.hist.slice(histCut) };
  });
  return { payload: { ...league, players }, careers };
}

/**
 * Put the rest of each career back in front of what the worker returned.
 *
 * A player the worker invented (youth intake) has no entry and is kept as-is; a
 * player it deleted (retirement, the cull) simply never comes up.
 */
export function reattachCareer(
  result: LeagueStore,
  careers: Map<number, CutCareer>,
): LeagueStore {
  if (careers.size === 0) return result;
  return {
    ...result,
    players: result.players.map((p) => {
      const cut = careers.get(p.pid);
      if (!cut) return p;
      return {
        ...p,
        stats: cut.statsCut === 0 ? p.stats : [...cut.stats.slice(0, cut.statsCut), ...p.stats],
        hist: cut.histCut === 0 ? p.hist : [...cut.hist.slice(0, cut.histCut), ...p.hist],
      };
    }),
  };
}

/** The append-only history the sim only appends to and prunes. */
export interface LeagueNews {
  newsEvents: LeagueStore["newsEvents"];
  cupHistory: LeagueStore["cupHistory"];
  shieldHistory: LeagueStore["shieldHistory"];
  domesticCupHistory: LeagueStore["domesticCupHistory"];
}

/**
 * Hold back the news feed and the archived cups.
 *
 * Measured on the reported season-60 save: `newsEvents` 11.6 MB, `cupHistory`
 * 4.5, `domesticCupHistory` 4.3, `shieldHistory` ~2.9 — **~23 MB**, all of it
 * append-only from the sim's point of view. Like `powerRankingHistory` it goes
 * out empty and comes back holding exactly this run's new entries.
 *
 * These took longer than the others because they were not *purely* append-only:
 * two offseason steps read them, and both now take the answer as an input or
 * report their side of it back.
 *
 * - `cullFreeAgentPool` scrubs a culled player's rows out of them. The worker
 *   cannot do that to arrays it does not have, so it reports the pids it culled
 *   and `reattachNews` applies the same scrub here, through the very same
 *   function (`scrubHistoryForCull`) so the two cannot drift.
 * - `extendPlayerNames` walks them to decide which retirees are still
 *   referenced. That set is precomputed here and handed in — a few hundred
 *   thousand numbers against ~23 MB of history.
 *
 * **Do not shortcut the scrub.** A culled player's surviving rows render as
 * "Player 4821", which is the exact bug `playerNames` exists to fix.
 */
export function detachNews(league: LeagueStore): {
  payload: LeagueStore;
  news: LeagueNews;
} {
  const news: LeagueNews = {
    newsEvents: league.newsEvents ?? [],
    cupHistory: league.cupHistory ?? [],
    shieldHistory: league.shieldHistory ?? [],
    domesticCupHistory: league.domesticCupHistory ?? [],
  };
  return {
    payload: {
      ...league,
      newsEvents: [],
      cupHistory: [],
      shieldHistory: [],
      domesticCupHistory: [],
    },
    news,
  };
}

/**
 * Fold this run's new entries onto the retained history, scrubbing first.
 *
 * Order matters: the scrub runs against the retained rows *before* the new ones
 * are appended, exactly as it would have inside the offseason — a player culled
 * this run cannot appear in entries this run just created, so scrubbing after
 * would be the same answer done more expensively, and scrubbing the appended
 * rows as well would be wrong the day that stops being true.
 */
export function reattachNews(
  result: LeagueStore,
  news: LeagueNews,
  culledPids: Set<number>,
): LeagueStore {
  const kept = scrubHistoryForCull(news, culledPids);
  return {
    ...result,
    newsEvents: [...kept.newsEvents, ...(result.newsEvents ?? [])],
    cupHistory: [...kept.cupHistory, ...(result.cupHistory ?? [])],
    shieldHistory: [...kept.shieldHistory, ...(result.shieldHistory ?? [])],
    domesticCupHistory: [...kept.domesticCupHistory, ...(result.domesticCupHistory ?? [])],
  };
}

export function reattachPlayed(result: LeagueStore, played: PlayedMatch[]): LeagueStore {
  const out = result.played ?? [];
  let stubs = 0;
  while (stubs < out.length && isStub(out[stubs])) stubs++;
  if (stubs === 0) return result;
  // Defensive: never invent matches we were not holding.
  const restored = played.slice(0, Math.min(stubs, played.length));
  return { ...result, played: [...restored, ...out.slice(stubs)] };
}
