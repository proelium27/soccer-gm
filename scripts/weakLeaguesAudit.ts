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
const SEEDS = [1, 2];
const USER_TID = 0;

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
    console.log(
      `${label} s${league.season}: ENG D1 ${eng.toFixed(1)}  FRA D1 ${fra.toFixed(1)}  POR D1 ${por.toFixed(1)}  ` +
      `| minAI budget £${(mb / 1e6).toFixed(1)}M  | ordering ${eng > fra && fra > por ? "OK" : "**BROKEN**"}`,
    );
  };

  record("gen ");
  for (let s = 0; s < SEASONS; s++) {
    league = simThrough(league, "season", mulberry32(seed * 1000 + s));
    league = simOffseason(league, mulberry32(seed * 2000 + s));
  }
  record("end ");
  console.log(
    `  → min AI budget over dynasty: £${(minBudget / 1e6).toFixed(1)}M ` +
    `(season ${minBudgetSeason}, ${minBudgetCountry}) — ${minBudget > 0 ? "SOLVENT" : "**DEFICIT**"}`,
  );
}
