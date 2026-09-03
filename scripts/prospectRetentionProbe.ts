/**
 * Do AI clubs keep the young players they produce, and what does that leave in
 * the free-prospect pool the user shops on Incoming Talent?
 *
 * Reports, per offseason:
 *  - what share of the world's youth intake is released the same offseason it
 *    arrives, overall and for the POT>=70 slice that matters;
 *  - the size and quality of the unsigned under-22 pool that leaves behind;
 *  - **tier-1/tier-2 XI ratings, AI roster size and AI wage bill** — the three
 *    columns prospect retention could plausibly move, and the reason it is
 *    built as extra slots rather than a reweighted depth chart.
 *
 * BEFORE THIS EXISTED every AI signing and retention path ranked on current
 * ovr, so a 16-year-old was always bottom of his depth chart: 84-86% of intake
 * was released on arrival, 80% of the POT>=70 prospects with it, and nobody
 * signed them back. See AI_PROSPECT_SLOTS in constants.ts.
 *
 * MEASURE BOTH SIDES. Every number here drifts across seeds and seasons for
 * unrelated reasons, so run this same file on origin/main for the baseline
 * rather than comparing against the figures quoted in CLAUDE.md — the recurring
 * lesson from the M1/M3 gates.
 *
 * Run: npx tsx scripts/prospectRetentionProbe.ts [seasons] [seed]
 */
import { mulberry32 } from "../src/engine/rng.js";
import { createLeagueState } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { simOffseason } from "../src/core/offseason.js";
import { freeAgentPids } from "../src/core/freeAgency.js";
import { PROSPECT_AGE_MAX, AI_PROSPECT_MIN_POT } from "../src/core/constants.js";
import { competitionOf } from "../src/core/competitions.js";

const SEASONS = Number(process.argv[2] ?? 6);
const SEED = Number(process.argv[3] ?? 7);
const avg = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pct = (n: number, d: number): string => `${((100 * n) / Math.max(1, d)).toFixed(0)}%`;

const rng = mulberry32(SEED);
let league = createLeagueState(0, rng);
const userTid = league.meta.userTid;

console.log(`seasons=${SEASONS} seed=${SEED} (POT bar ${AI_PROSPECT_MIN_POT})`);

for (let s = 1; s <= SEASONS; s++) {
  const before = new Set(league.players.map((p) => p.pid));
  league = simThrough(league, "season", rng);
  league = simOffseason(league, rng);

  const fa = freeAgentPids(league.teams, league.players, league.activeLoans);
  const age = (p: { born: number }): number => league.season - p.born;

  // Anyone who did not exist before this offseason is this year's youth intake.
  const intake = league.players.filter((p) => !before.has(p.pid));
  const hiPot = intake.filter((p) => p.potential >= AI_PROSPECT_MIN_POT);

  const pool = league.players.filter((p) => fa.has(p.pid) && age(p) <= PROSPECT_AGE_MAX);
  const top25 = [...pool]
    .sort((a, b) => b.ovr + b.potential - (a.ovr + a.potential))
    .slice(0, 25);

  // The user's club is unmanaged in a headless run and produces every extreme
  // roster and wage tail, so it is excluded throughout (CLAUDE.md invariant).
  const pmap = new Map(league.players.map((p) => [p.pid, p]));
  const xiByTier: Record<number, number[]> = { 1: [], 2: [] };
  const sizes: number[] = [];
  const wages: number[] = [];
  for (const t of league.teams) {
    if (t.tid === userTid) continue;
    const roster = t.roster.map((pid) => pmap.get(pid)!).filter(Boolean);
    if (roster.length < 11) continue;
    sizes.push(roster.length);
    wages.push(roster.reduce((a, p) => a + p.contract.salary, 0));
    // Top 11 by ovr stands in for the XI. selectXI ranks on slotValue, but this
    // change is meant to leave selection alone, so a rating proxy is enough to
    // catch a shift and is directly comparable across both branches.
    const xi = [...roster].sort((a, b) => b.ovr - a.ovr).slice(0, 11);
    xiByTier[competitionOf(league.competitions, t.compId).tier]?.push(...xi.map((p) => p.ovr));
  }

  console.log(
    `s${String(league.season).padStart(2)}`
      + ` | intake ${intake.length} cut ${pct(intake.filter((p) => fa.has(p.pid)).length, intake.length)}`
      + ` (POT>=${AI_PROSPECT_MIN_POT}: ${hiPot.length} cut`
      + ` ${pct(hiPot.filter((p) => fa.has(p.pid)).length, hiPot.length)})`
      + ` | u22 pool ${String(pool.length).padStart(4)}`
      + ` POT>=75 ${String(pool.filter((p) => p.potential >= 75).length).padStart(3)}`
      + ` top25 pot ${avg(top25.map((p) => p.potential)).toFixed(1)}`
      + ` | T1 XI ${avg(xiByTier[1]).toFixed(2)} T2 XI ${avg(xiByTier[2]).toFixed(2)}`
      + ` | roster ${avg(sizes).toFixed(1)} wages £${(avg(wages) / 1e6).toFixed(2)}M`,
  );
}
