import type { LeagueStore } from "./leagueState.js";
import type { PowerRankingSnapshot } from "./teams/powerRanking.js";
import type { ArchivedPlayer } from "./players/archive.js";
import type { PlayedMatch } from "./standings.js";
import { pruneRetireeArchive } from "./players/archive.js";

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
 * **What is deliberately NOT here, and why.** `newsEvents`, `cupHistory`,
 * `shieldHistory` and `domesticCupHistory` are another ~62 MB at season 56 and
 * look identical from the outside, but two offseason steps genuinely read them:
 * `cullFreeAgentPool` scrubs the culled players' rows out of them, and
 * `extendPlayerNames` walks the cup stat lines to decide which retirees are
 * still referenced. Holding them back needs the culled pid set threaded out of
 * `simOffseason` and an incremental `referencedPids` — a bigger change than
 * this one, and it must not be faked: dropping the scrub would leave deleted
 * players rendering as "Player 4821", which is the exact bug `playerNames`
 * exists to fix. `transfers` and `seasonHistory` are read for real sim
 * decisions (arrival seasons, loan returns, academy form, protected stars) and
 * can never move here.
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
export function reattachPlayed(result: LeagueStore, played: PlayedMatch[]): LeagueStore {
  const out = result.played ?? [];
  let stubs = 0;
  while (stubs < out.length && isStub(out[stubs])) stubs++;
  if (stubs === 0) return result;
  // Defensive: never invent matches we were not holding.
  const restored = played.slice(0, Math.min(stubs, played.length));
  return { ...result, played: [...restored, ...out.slice(stubs)] };
}
