/**
 * Phase 0 of docs/save-performance-plan.md: measure what each kind of action
 * actually changes, before any of the schema work is built on top of it.
 *
 * The plan's whole design rests on one assumption — that the core is purely
 * functional, so unchanged players keep their object identity and a
 * reference-identity diff is enough to find what needs writing. That assumption
 * is cheap to state and expensive to be wrong about, so this probe measures it
 * directly rather than taking it on faith:
 *
 *   - dirty  = players whose object identity changed (what we would write)
 *   - added / removed = pool membership changes (inserts and deletes)
 *   - bytes  = what a dirty-set write would cost vs. rewriting the whole league
 *
 * If a one-player action shows a whole-pool dirty count, the design in the plan
 * does not work and phase 1 should not start. Run:
 *
 *   npx tsx scripts/savePerfProbe.ts [seasons]
 */
import "fake-indexeddb/auto";
import { createLeagueState, type LeagueStore } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { simOffseason } from "../src/core/offseason.js";
import { mulberry32 } from "../src/engine/rng.js";
import { saveLeague } from "../src/db/leagueDb.js";
import { signFreeAgent, releasePlayer, freeAgentPids } from "../src/core/freeAgency.js";
import { extendContract } from "../src/core/contracts.js";
import type { Player } from "../src/core/players/types.js";

const SEASONS = Number(process.argv[2] ?? 6);

type Diff = {
  dirty: number; added: number; removed: number; dirtyBytes: number; changed: number;
};

/**
 * The exact check the plan proposes to ship: walk the new pool, collect anything
 * whose identity differs from what was last written, plus anything that vanished.
 *
 * `changed` asks the same question by *content*, against `snapshot` — a deep copy
 * taken before the action. The deep copy is the whole point: comparing against
 * the live `before` array cannot detect an in-place mutation, because both sides
 * would be pointing at the same mutated object. Against a snapshot it can.
 *
 * That makes the two numbers mean different things, and both matter:
 *   changed < dirty  fine — we write some players that did not really change.
 *   changed > dirty  THE BUG. A player changed without a new identity, so the
 *                    dirty set would miss it and the change would never persist.
 * `changed` also bounds how much phase 3 could recover. Far too slow to ship.
 */
function diffPlayers(before: Player[], after: Player[], snapshot: Map<number, string>): Diff {
  const prev = new Map(before.map((p) => [p.pid, p]));
  const dirty: Player[] = [];
  let added = 0;
  let changed = 0;
  for (const p of after) {
    const old = prev.get(p.pid);
    if (old === undefined) {
      added++;
      dirty.push(p);
    } else if (old !== p) {
      dirty.push(p);
    }

    const was = snapshot.get(p.pid);
    if (was === undefined || was !== JSON.stringify(p)) changed++;
    prev.delete(p.pid);
  }
  return {
    dirty: dirty.length,
    added,
    removed: prev.size,
    changed,
    dirtyBytes: dirty.reduce((n, p) => n + JSON.stringify(p).length, 0),
  };
}

async function ms(fn: () => unknown | Promise<unknown>): Promise<number> {
  const t0 = performance.now();
  await fn();
  return performance.now() - t0;
}

const rng = mulberry32(7);
let league: LeagueStore = createLeagueState(0, rng);
for (let s = 1; s <= SEASONS; s++) {
  league = simThrough(league, "season", rng);
  league = simOffseason(league, rng);
}
league = { ...league, lid: 1 };

const userTid = league.meta.userTid;
const userTeam = league.teams.find((t) => t.tid === userTid)!;
const faPid = [...freeAgentPids(league.teams, league.players, league.activeLoans)][0];
const rosterPid = userTeam.roster[0];

/**
 * Each case returns the league as the matching LeagueContext action would leave
 * it, so the diff describes a real user interaction rather than a synthetic one.
 */
const cases: Array<{ name: string; run: () => LeagueStore }> = [
  {
    name: "extend contract",
    run: () => ({ ...league, players: extendContract(league.players, rosterPid, league.season) }),
  },
  {
    name: "sign free agent",
    run: () => {
      const { teams, players } = signFreeAgent(
        league.teams, league.players, userTid, faPid, league.season,
        league.phase, league.activeLoans,
      );
      return { ...league, teams, players };
    },
  },
  {
    name: "release player",
    run: () => ({
      ...league,
      teams: releasePlayer(league.teams, league.players, userTid, rosterPid),
    }),
  },
  {
    name: "set lineup",
    run: () => ({
      ...league,
      teams: league.teams.map((t) =>
        t.tid === userTid ? { ...t, starters: [...userTeam.roster].slice(0, 11) } : t,
      ),
    }),
  },
  {
    name: "set scouting spend",
    run: () => ({
      ...league,
      teams: league.teams.map((t) => (t.tid === userTid ? { ...t, nextScoutingSpend: 1 } : t)),
    }),
  },
  { name: "sim one matchday", run: () => simThrough(league, "game", mulberry32(11)) },
  { name: "sim a season", run: () => simThrough(league, "season", mulberry32(12)) },
  {
    name: "offseason",
    run: () => simOffseason(simThrough(league, "season", mulberry32(13)), mulberry32(14)),
  },
];

const fullBytes = JSON.stringify(league).length;
const tFullSave = await ms(() => saveLeague(league));

console.log(`seasons=${SEASONS}  players=${league.players.length}  league=${(fullBytes / 1e6).toFixed(1)} MB`);
console.log(`whole-league saveLeague: ${tFullSave.toFixed(0)} ms  (today's cost for every action below)\n`);
console.log(["action", "dirty", "changed", "added", "removed", "dirtyKB", "saveMs"].join("\t"));

let unsafe = 0;
for (const c of cases) {
  // Fresh per case, and taken before the action: this is the only baseline that
  // can catch a player being mutated in place (see diffPlayers).
  const snapshot = new Map(league.players.map((p) => [p.pid, JSON.stringify(p)]));
  const after = c.run();
  const d = diffPlayers(league.players, after.players, snapshot);
  const flag = d.changed > d.dirty ? "  <-- MISSED WRITE" : "";
  if (d.changed > d.dirty) unsafe++;

  // Re-save the base first so the write cache describes exactly the pre-action
  // pool; the timed save then costs precisely this action's dirty set.
  await saveLeague(league);
  const tSave = await ms(() => saveLeague(after));

  console.log(
    [c.name, d.dirty, d.changed, d.added, d.removed,
     (d.dirtyBytes / 1e3).toFixed(1), `${tSave.toFixed(0)}${flag}`].join("\t"),
  );
}

console.log(
  unsafe === 0
    ? "\nIdentity diff caught every content change. The plan's assumption holds."
    : `\n${unsafe} action(s) changed a player without a new identity — a dirty-set write would LOSE those edits.`,
);
process.exit(unsafe === 0 ? 0 : 1);
