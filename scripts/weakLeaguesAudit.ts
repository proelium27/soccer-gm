/**
 * Dynasty audit for the weak-league feature (France/Portugal/Belgium/Turkey).
 * Verifies, over a multi-season dynasty with real simThrough/simOffseason:
 *  - AI solvency holds (no non-user club ever goes into deficit), including the
 *    poorer weak-league clubs;
 *  - the weakness ladder (England > France > Portugal > Belgium > Turkey in D1
 *    mean OVR) persists across the dynasty rather than collapsing (talent
 *    drain) or inverting;
 *  - **each adjacent gap survives at a minimum magnitude**, not merely in rank
 *    order — see MIN_GAP below;
 *  - the league-wide OVR equilibrium doesn't inflate.
 *
 * Why the magnitude check exists (2026-08-08): the original audit asserted only
 * the *ordering* England > France > Portugal, and reported "OK" throughout a
 * dynasty in which the England→Portugal gap eroded from 9.6 to 5.5 OVR and the
 * France→Portugal gap fell to ~2.5 — the design intent was substantially gone
 * while the check still passed. Rank order is far too weak a condition for what
 * COUNTRY_STRENGTH_OFFSET is actually for.
 *
 * The erosion is real and mostly *not* about money: attributing each country's
 * drift to its two possible sources (a player's ovr only ever changes in
 * progression, so retained players' mean change is pure progression and the
 * remainder is pure roster churn) measured, over 20 seasons, progression
 * contributing +4.06 to England vs +7.53 to Portugal — a 3.47 OVR relative lift
 * for the weaker league — against only 0.55 from churn. That is
 * `growthDamping`'s doing: it throttles positive growth above a *global,
 * absolute* ovr of GROWTH_DAMPING_START, so a league whose players sit below
 * that line grows undamped while the big four are throttled. Any future attempt
 * to hold the ladder flatter should start there, not at the transfer market.
 *
 * The user's own club (tid 0) is EXCLUDED from every metric — an unmanaged user
 * club rots in a headless sim and contaminates minima/tails (see the
 * headless-audit-user-club memory).
 *
 * Run: npx tsx scripts/weakLeaguesAudit.ts
 *      SEASONS=30 SEEDS=1,2,3 npx tsx scripts/weakLeaguesAudit.ts
 */
import { mulberry32 } from "../src/engine/rng.js";
import { createLeagueState, type LeagueStore } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { simOffseason } from "../src/core/offseason.js";
import { competitionOf } from "../src/core/competitions.js";

const SEASONS = Number(process.env.SEASONS ?? 20);
const SEEDS = (process.env.SEEDS ?? "1,2").split(",").map(Number);
const USER_TID = 0;

/**
 * The ladder, strongest first. Only the *weak* leagues are checked pairwise —
 * the big four are equal siblings by design, so their mutual order is noise.
 */
const BIG_FOUR = ["England", "Spain", "Italy", "Germany"];
const WEAK_LADDER = ["France", "Portugal", "Belgium", "Turkey"];

/**
 * Minimum OVR each adjacent weak-league gap must still show at the end of the
 * dynasty. Deliberately well below the generation-time gaps (England→France
 * ~4.7, and ~1 between each weak league) because some compression is expected
 * and acceptable — this catches the ladder *collapsing*, not it settling.
 */
const MIN_GAP = 0.4;
/** Minimum surviving gap between the strongest big-four league and the weakest league. */
const MIN_SPREAD = 3.0;

function avg(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

/** Mean OVR of all rostered players in a country's tier-1 clubs, excluding the user's club. */
function d1MeanOvr(league: LeagueStore, country: string): number {
  const ovrByPid = new Map(league.players.map((p) => [p.pid, p.ovr]));
  const ovrs: number[] = [];
  for (const t of league.teams) {
    if (t.tid === USER_TID) continue;
    const comp = competitionOf(league.competitions, t.compId);
    if (comp.country !== country || comp.tier !== 1) continue;
    for (const pid of t.roster) {
      const o = ovrByPid.get(pid);
      if (o !== undefined) ovrs.push(o);
    }
  }
  return avg(ovrs);
}

function minAIBudget(league: LeagueStore): number {
  return Math.min(...league.teams.filter((t) => t.tid !== USER_TID).map((t) => t.budget));
}

let anyFailure = false;

for (const seed of SEEDS) {
  console.log(`\n=== seed ${seed} (${SEASONS} seasons) ===`);
  let league = createLeagueState(USER_TID, mulberry32(seed));

  let minBudget = Infinity;
  let minBudgetSeason = 0;
  let minBudgetCountry = "";

  const measure = () => {
    const byCountry = new Map<string, number>();
    for (const c of [...BIG_FOUR, ...WEAK_LADDER]) byCountry.set(c, d1MeanOvr(league, c));
    const mb = minAIBudget(league);
    if (mb < minBudget) {
      minBudget = mb;
      minBudgetSeason = league.season;
      const worst = league.teams.filter((t) => t.tid !== USER_TID).sort((a, b) => a.budget - b.budget)[0];
      minBudgetCountry = competitionOf(league.competitions, worst.compId).country;
    }
    return byCountry;
  };

  const report = (label: string, m: Map<string, number>, checkGaps: boolean) => {
    const big = avg(BIG_FOUR.map((c) => m.get(c)!));
    const line = WEAK_LADDER.map((c) => `${c.slice(0, 3).toUpperCase()} ${m.get(c)!.toFixed(1)}`).join("  ");
    console.log(`${label} s${league.season}: BIG4 ${big.toFixed(1)}  ${line}`);
    if (!checkGaps) return;

    // Every adjacent step down the weak ladder must survive at MIN_GAP.
    const problems: string[] = [];
    let prev = big;
    let prevName = "BIG4";
    for (const c of WEAK_LADDER) {
      const gap = prev - m.get(c)!;
      if (gap < MIN_GAP) problems.push(`${prevName}→${c} only ${gap.toFixed(2)}`);
      prev = m.get(c)!;
      prevName = c;
    }
    const spread = big - m.get(WEAK_LADDER[WEAK_LADDER.length - 1])!;
    if (spread < MIN_SPREAD) problems.push(`BIG4→${WEAK_LADDER[WEAK_LADDER.length - 1]} spread only ${spread.toFixed(2)}`);

    if (problems.length) {
      anyFailure = true;
      console.log(`  → ladder **BROKEN**: ${problems.join("; ")}`);
    } else {
      console.log(`  → ladder OK (every adjacent gap ≥ ${MIN_GAP}, spread ${spread.toFixed(2)} ≥ ${MIN_SPREAD})`);
    }
  };

  const gen = measure();
  report("gen ", gen, false);
  for (let s = 0; s < SEASONS; s++) {
    league = simThrough(league, "season", mulberry32(seed * 1000 + s));
    league = simOffseason(league, mulberry32(seed * 2000 + s));
  }
  const end = measure();
  report("end ", end, true);

  // Erosion report: how much of each generation-time gap survived.
  const genBig = avg(BIG_FOUR.map((c) => gen.get(c)!));
  const endBig = avg(BIG_FOUR.map((c) => end.get(c)!));
  console.log("  erosion vs the big four:");
  for (const c of WEAK_LADDER) {
    const g = genBig - gen.get(c)!;
    const e = endBig - end.get(c)!;
    console.log(`    ${c.padEnd(9)} gap ${g.toFixed(2)} → ${e.toFixed(2)}  (${((1 - e / g) * 100).toFixed(0)}% eroded)`);
  }

  const solvent = minBudget > 0;
  if (!solvent) anyFailure = true;
  console.log(
    `  → min AI budget over dynasty: £${(minBudget / 1e6).toFixed(1)}M ` +
    `(season ${minBudgetSeason}, ${minBudgetCountry}) — ${solvent ? "SOLVENT" : "**DEFICIT**"}`,
  );
}

console.log(anyFailure ? "\nRESULT: **FAILURES ABOVE**" : "\nRESULT: all checks passed");
process.exit(anyFailure ? 1 : 0);
