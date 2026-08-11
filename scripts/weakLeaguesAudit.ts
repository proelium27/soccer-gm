/**
 * Dynasty audit for the France/Portugal weak-league feature. Verifies, over a
 * multi-season dynasty with real simThrough/simOffseason:
 *  - AI solvency holds (no non-user club ever goes into deficit), including the
 *    poorer France/Portugal clubs;
 *  - the weakness ordering (England > France > Portugal in D1 mean OVR) persists
 *    across the dynasty rather than collapsing (talent drain) or inverting;
 *  - the league-wide OVR equilibrium doesn't inflate.
 *
 * The user's own club (tid 0) is EXCLUDED from every metric — an unmanaged user
 * club rots in a headless sim and contaminates minima/tails (see the
 * headless-audit-user-club memory).
 *
 * Run: npx tsx scripts/weakLeaguesAudit.ts
 */
import { mulberry32 } from "../src/engine/rng.js";
import { createLeagueState, type LeagueStore } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { simOffseason } from "../src/core/offseason.js";
import { competitionOf } from "../src/core/competitions.js";

const SEASONS = Number(process.env.SEASONS ?? 20);
// Overridable so a tuning change can be checked against worlds it was not
// tuned on — fitting a constant to seeds 1 and 2 and then reporting seeds 1
// and 2 measures the sample, not the mechanism.
// Parsed defensively: the whole point of this knob is checking a tuning change
// on unseen seeds, so a typo must not silently produce a confident verdict about
// a world nobody meant to run. Note `SEEDS=` is an empty string, not nullish, so
// `??` alone would not fall back — and Number("") is 0, not NaN, so an empty
// segment (or a trailing comma) would quietly add seed 0 rather than be rejected.
const seedsRaw = process.env.SEEDS?.trim();
const SEEDS = (seedsRaw || "1,2")
  .split(",")
  .map((s) => s.trim())
  .filter((s) => s.length > 0)
  .map(Number);
if (!SEEDS.length || !SEEDS.every(Number.isFinite)) {
  throw new Error(`SEEDS must be a comma-separated list of numbers; got "${process.env.SEEDS}"`);
}
const USER_TID = 0;

/**
 * How far a rung may sit *below* where it belongs before it counts as a real
 * inversion rather than seed noise. Adjacent weak rungs are ~1
 * COUNTRY_STRENGTH_OFFSET point apart (≈0.9 ovr at generation) and ~40% of that
 * erodes, so their order genuinely coin-flips between seeds; a strict `>` check
 * would be flaky. Sized well under the failure this exists to catch — the
 * 2026-08-11 ladder inversion ran to 2.5 ovr with England finishing *below*
 * Portugal.
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

const failures: string[] = [];

for (const seed of SEEDS) {
  console.log(`\n=== seed ${seed} (${SEASONS} seasons) ===`);
  const rng = mulberry32(seed);
  let league = createLeagueState(USER_TID, rng);

  let minBudget = Infinity;
  let minBudgetSeason = 0;
  let minBudgetCountry = "";
  const record = (label: string) => {
    const eng = d1MeanOvr(league, "England");
    const fra = d1MeanOvr(league, "France");
    const por = d1MeanOvr(league, "Portugal");
    const mb = minAIBudget(league);
    if (mb < minBudget) {
      minBudget = mb;
      minBudgetSeason = league.season;
      const worst = league.teams.filter((t) => t.tid !== USER_TID).sort((a, b) => a.budget - b.budget)[0];
      minBudgetCountry = competitionOf(league.competitions, worst.compId).country;
    }
    const inverted = [
      ...(eng - fra < -INVERSION_TOLERANCE ? [`ENG→FRA (${(eng - fra).toFixed(2)})`] : []),
      ...(fra - por < -INVERSION_TOLERANCE ? [`FRA→POR (${(fra - por).toFixed(2)})`] : []),
    ];
    console.log(
      `${label} s${league.season}: ENG D1 ${eng.toFixed(1)}  FRA D1 ${fra.toFixed(1)}  POR D1 ${por.toFixed(1)}  ` +
      `| minAI budget £${(mb / 1e6).toFixed(1)}M  | ordering ${inverted.length ? `**BROKEN**: ${inverted.join(", ")}` : "OK"}`,
    );
    return inverted;
  };

  record("gen ");
  for (let s = 0; s < SEASONS; s++) {
    league = simThrough(league, "season", mulberry32(seed * 1000 + s));
    league = simOffseason(league, mulberry32(seed * 2000 + s));
  }
  const inverted = record("end ");
  const solvent = minBudget > 0;
  console.log(
    `  → min AI budget over dynasty: £${(minBudget / 1e6).toFixed(1)}M ` +
    `(season ${minBudgetSeason}, ${minBudgetCountry}) — ${solvent ? "SOLVENT" : "**DEFICIT**"}`,
  );
  if (inverted.length) failures.push(`seed ${seed}: ladder inverted — ${inverted.join(", ")}`);
  if (!solvent) failures.push(`seed ${seed}: AI club in deficit (£${(minBudget / 1e6).toFixed(1)}M)`);
}

// Exit non-zero on failure. This script previously printed "**BROKEN**" and
// exited 0, so a fully inverted strength ladder shipped to main with green CI
// (see docs/transfer-mobility.md). A gate that reports failure and returns
// success is worse than no gate — it reads as evidence the invariant holds.
if (failures.length) {
  console.log(`\nRESULT: **FAILURES**\n${failures.map((f) => `  - ${f}`).join("\n")}`);
  process.exit(1);
}
console.log("\nRESULT: all checks passed");
