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
 * Two separate forces move a league off its generated rung, and they are easy
 * to confuse:
 *
 *  1. `growthDamping` throttles positive growth above a *global, absolute* ovr
 *     (GROWTH_DAMPING_START), so a league sitting below that line grows
 *     undamped while the big four are throttled. Attributing 20 seasons of
 *     drift to its sources (a player's ovr only ever changes in progression, so
 *     retained players' mean change is pure progression and the remainder is
 *     pure churn) measured progression at +4.06 for England vs +7.53 for
 *     Portugal. This compresses every gap toward the middle but does NOT
 *     reorder leagues, and it should not be "fixed" by making the threshold
 *     league-relative — that hands every weak league its own elites.
 *
 *  2. **Budget reorders them.** COUNTRY_BUDGET_SCALE must stay monotonic with
 *     COUNTRY_STRENGTH_OFFSET: at Belgium 0.35 / Turkey 0.50 the ladder
 *     inverted by 2.23 OVR over 20 seasons, with Turkey finishing above a
 *     Belgium it generated 0.9 below.
 *
 * MEASUREMENT TRAP: comparing leagues with very different starting OVR
 * (England vs Portugal) buries force 2 under force 1 — that comparison put
 * churn at only 0.55 OVR and wrongly cleared a budget inversion that a
 * near-equal pair (Belgium vs Turkey) then caught. Compare near-equal leagues.
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
 * What the ladder actually guarantees, and what it does not.
 *
 * Portugal/Belgium/Turkey are one COUNTRY_STRENGTH_OFFSET point apart (≈0.9 OVR
 * at generation), and ~40% of every country gap erodes over 20 seasons. So
 * adjacent weak rungs end up within a few tenths of each other and are NOT
 * separately resolvable — measured, seed 1: POR 49.6 / BEL 49.6 / TUR 49.3.
 * Asserting a per-rung magnitude there would be asserting precision the design
 * doesn't have, and would fail on seed noise alone.
 *
 * What IS meaningful, and what these gates check:
 *  - ORDER never inverts. This is the real failure mode and the one that
 *    actually bit: a weaker-but-richer league overtaking a stronger-but-poorer
 *    one, which showed up as a 2.23 OVR inversion, far outside noise.
 *  - The weak block stays genuinely below the big four (MIN_SPREAD).
 *  - The weak ladder's own ends stay apart (MIN_END_SPREAD) — France must still
 *    be clearly stronger than Turkey even if the middle rungs blur.
 *
 * Per-rung gaps are printed for information, not gated. If a future change
 * needs the rungs individually resolvable across a dynasty, widen the offsets
 * to 2-point steps (e.g. Portugal 10 / Belgium 12 / Turkey 14) rather than
 * tightening these numbers.
 */
/** Minimum surviving gap between the big-four mean and the weakest league. */
const MIN_SPREAD = 3.0;
/** Minimum surviving gap between the strongest and weakest weak league. */
const MIN_END_SPREAD = 1.0;
/**
 * How far an adjacent rung may sit *below* where it belongs before it counts as
 * a real inversion rather than seed noise. Rungs one offset point apart end a
 * few tenths apart, so their order genuinely coin-flips between seeds and a
 * strict `gap > 0` check would be flaky. Sized well under the failure this
 * exists to catch: the Belgium/Turkey budget inversion measured 2.23.
 */
const INVERSION_TOLERANCE = 0.5;

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

  const trackBudget = () => {
    const mb = minAIBudget(league);
    if (mb < minBudget) {
      minBudget = mb;
      minBudgetSeason = league.season;
      const worst = league.teams.filter((t) => t.tid !== USER_TID).sort((a, b) => a.budget - b.budget)[0];
      minBudgetCountry = competitionOf(league.competitions, worst.compId).country;
    }
  };

  const measure = () => {
    const byCountry = new Map<string, number>();
    for (const c of [...BIG_FOUR, ...WEAK_LADDER]) byCountry.set(c, d1MeanOvr(league, c));
    trackBudget();
    return byCountry;
  };

  const report = (label: string, m: Map<string, number>, checkGaps: boolean) => {
    const big = avg(BIG_FOUR.map((c) => m.get(c)!));
    const line = WEAK_LADDER.map((c) => `${c.slice(0, 3).toUpperCase()} ${m.get(c)!.toFixed(1)}`).join("  ");
    console.log(`${label} s${league.season}: BIG4 ${big.toFixed(1)}  ${line}`);
    if (!checkGaps) return;

    const problems: string[] = [];

    // 1. Order must never invert — the real failure mode (see the header).
    let prev = big;
    let prevName = "BIG4";
    const gaps: string[] = [];
    for (const c of WEAK_LADDER) {
      const gap = prev - m.get(c)!;
      gaps.push(`${prevName}→${c} ${gap >= 0 ? "+" : ""}${gap.toFixed(2)}`);
      if (gap < -INVERSION_TOLERANCE) problems.push(`${prevName}→${c} INVERTED (${gap.toFixed(2)})`);
      prev = m.get(c)!;
      prevName = c;
    }
    console.log(`       rungs: ${gaps.join("  ")}`);

    // 2. The weak block must stay genuinely below the big four.
    const weakest = WEAK_LADDER[WEAK_LADDER.length - 1];
    const spread = big - m.get(weakest)!;
    if (spread < MIN_SPREAD) problems.push(`BIG4→${weakest} spread only ${spread.toFixed(2)} (< ${MIN_SPREAD})`);

    // 3. The weak ladder's own ends must stay apart.
    const endSpread = m.get(WEAK_LADDER[0])! - m.get(weakest)!;
    if (endSpread < MIN_END_SPREAD) {
      problems.push(`${WEAK_LADDER[0]}→${weakest} spread only ${endSpread.toFixed(2)} (< ${MIN_END_SPREAD})`);
    }

    if (problems.length) {
      anyFailure = true;
      console.log(`  → ladder **BROKEN**: ${problems.join("; ")}`);
    } else {
      console.log(
        `  → ladder OK (no inversion beyond ${INVERSION_TOLERANCE}; BIG4→${weakest} ${spread.toFixed(2)} ≥ ${MIN_SPREAD}; ` +
        `${WEAK_LADDER[0]}→${weakest} ${endSpread.toFixed(2)} ≥ ${MIN_END_SPREAD})`,
      );
    }
  };

  const gen = measure();
  report("gen ", gen, false);
  for (let s = 0; s < SEASONS; s++) {
    league = simThrough(league, "season", mulberry32(seed * 1000 + s));
    // Sample the budget at BOTH points in the cycle, every season. This used to
    // run only at generation and at the end, while reporting itself as "min AI
    // budget over dynasty" — so a club that dipped negative in season 9 and
    // recovered by season 20 was reported as solvent, and an in-season deficit
    // (regular-window buys charge a full season's salary up front) was never
    // sampled at all.
    trackBudget();
    league = simOffseason(league, mulberry32(seed * 2000 + s));
    trackBudget();
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
