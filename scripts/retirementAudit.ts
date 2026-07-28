/**
 * Dynasty audit for quality-based retirement (roster status scales the age curve).
 *
 * Watches the things the rework could plausibly break, not just the thing it's
 * meant to do:
 *   - **pool size** (the intended shrink) and how much of it is unsigned,
 *   - **min roster size** across AI clubs — retirement runs at offseason step 3,
 *     immediately before AI free agency draws from the pool at step 4, so
 *     over-culling would leave clubs unable to fill squads. This is the safety
 *     metric; if it drops, RETIREMENT_UNROSTERED_BASE is too high.
 *   - **Division 1 mean ovr** — must stay flat across the dynasty, or the
 *     rework has disturbed the rating equilibrium CLAUDE.md warns about,
 *   - **squad age** and how many players are still playing at 38+, which is the
 *     "good enough to last till 40" ask actually landing.
 *
 * Run: npx tsx scripts/retirementAudit.ts [seasons] [seed]
 */
import { mulberry32 } from "../src/engine/rng.js";
import { createLeagueState } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { simOffseason } from "../src/core/offseason.js";

const SEASONS = Number(process.argv[2] ?? 25);
const SEED = Number(process.argv[3] ?? 7);

function avg(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

const rng = mulberry32(SEED);
let league = createLeagueState(0, rng);
const userTid = league.meta.userTid;

console.log(`seasons=${SEASONS} seed=${SEED}`);
console.log(
  "season |   pool | rostered |     FA | minRos | avgAge | 33+ | 36+ | 38+ | D1 ovr | retd",
);

let prevPids = new Set(league.players.map((p) => p.pid));

for (let s = 1; s <= SEASONS; s++) {
  league = simThrough(league, "season", rng);
  const before = new Set(league.players.map((p) => p.pid));
  league = simOffseason(league, rng);

  const gone = [...before].filter((pid) => !new Set(league.players.map((p) => p.pid)).has(pid));
  prevPids = before;

  const rosteredSet = new Set(
    league.teams.flatMap((t) => [...t.roster, ...t.academyRoster]),
  );
  const ageOf = (p: { born: number }) => league.season - p.born;
  const rostered = league.players.filter((p) => rosteredSet.has(p.pid));
  const fas = league.players.filter((p) => !rosteredSet.has(p.pid));

  // Exclude the user's club: it is unmanaged in headless audits and produces
  // all the worst-case roster tails (CLAUDE.md invariant).
  const aiRosterSizes = league.teams
    .filter((t) => t.tid !== userTid)
    .map((t) => t.roster.length);

  const d1Tids = new Set(league.teams.filter((t) => t.compId === 0).map((t) => t.tid));
  const d1Ovrs = league.teams
    .filter((t) => d1Tids.has(t.tid) && t.tid !== userTid)
    .flatMap((t) => t.roster)
    .map((pid) => league.players.find((p) => p.pid === pid)?.ovr ?? NaN)
    .filter((x) => !Number.isNaN(x));

  const ages = rostered.map(ageOf);
  console.log(
    [
      String(league.season).padStart(6),
      String(league.players.length).padStart(6),
      String(rostered.length).padStart(8),
      String(fas.length).padStart(6),
      String(Math.min(...aiRosterSizes)).padStart(6),
      avg(ages).toFixed(1).padStart(6),
      String(ages.filter((a) => a >= 33).length).padStart(3),
      String(ages.filter((a) => a >= 36).length).padStart(3),
      String(ages.filter((a) => a >= 38).length).padStart(3),
      avg(d1Ovrs).toFixed(1).padStart(6),
      String(gone.length).padStart(4),
    ].join(" | "),
  );
}
