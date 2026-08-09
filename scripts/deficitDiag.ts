/**
 * Diagnostic: find AI clubs that go into deficit over a dynasty and decompose
 * why.
 *
 * Samples the budget at BOTH points in the season cycle, which matters: the
 * offseason charge (chargeSeasonStart, step 6.5) and the in-season state after
 * simThrough are different numbers, and an in-season deficit is invisible if
 * you only look after the offseason. A first pass here looked only at the
 * offseason boundary and reported zero deficits on both seeds — see the
 * post-season column for why that was the wrong place to look.
 *
 * Run: npx tsx scripts/deficitDiag.ts   (SEEDS=1,2,3 SEASONS=20)
 */
import { mulberry32 } from "../src/engine/rng.js";
import { createLeagueState, type LeagueStore } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { simOffseason } from "../src/core/offseason.js";
import { competitionOf } from "../src/core/competitions.js";
import { financeScale, wageBill } from "../src/core/finance/budget.js";
import { BASE_SEASON_BUDGET } from "../src/core/constants.js";

const SEASONS = Number(process.env.SEASONS ?? 20);
const SEEDS = (process.env.SEEDS ?? "1,2").split(",").map(Number);
const USER_TID = 0;

interface Worst { budget: number; season: number; country: string; where: string }

for (const seed of SEEDS) {
  console.log(`\n=== seed ${seed} (${SEASONS} seasons) ===`);
  let league = createLeagueState(USER_TID, mulberry32(seed));

  let worst: Worst = { budget: Infinity, season: 0, country: "", where: "" };
  const deficitClubs = new Set<number>();
  let deficitSamples = 0;

  const sample = (where: string): void => {
    const salaryMap = new Map(league.players.map((p) => [p.pid, p.contract.salary]));
    for (const t of league.teams) {
      if (t.tid === USER_TID) continue;
      const comp = competitionOf(league.competitions, t.compId);
      if (t.budget < worst.budget) {
        worst = { budget: t.budget, season: league.season, country: comp.country, where };
      }
      if (t.budget < 0) {
        deficitSamples++;
        if (!deficitClubs.has(t.tid)) {
          deficitClubs.add(t.tid);
          const scale = financeScale(league.competitions, t.compId);
          const wages = wageBill([...t.roster, ...t.academyRoster], salaryMap);
          console.log(
            `  s${league.season} ${where} tid ${t.tid} ${comp.country} T${comp.tier}` +
            ` hype ${t.hype.toFixed(0)} | budget £${(t.budget / 1e6).toFixed(2)}M` +
            ` | wages £${(wages / 1e6).toFixed(2)}M (${t.roster.length}+${t.academyRoster.length})` +
            ` | base income £${((BASE_SEASON_BUDGET * scale) / 1e6).toFixed(2)}M`,
          );
        }
      }
    }
  };

  sample("gen");
  for (let s = 0; s < SEASONS; s++) {
    league = simThrough(league, "season", mulberry32(seed * 1000 + s));
    sample("post-season");
    league = simOffseason(league, mulberry32(seed * 2000 + s));
    sample("post-offseason");
  }

  // Squad-quality safety metrics: a solvency gate that starves AI clubs of
  // signings shows up here, not in the budget column (see the retirement audit
  // — washing out AI free agency dropped D1 mean ovr by 3+).
  const aiTeams = league.teams.filter((t) => t.tid !== USER_TID);
  const minRoster = Math.min(...aiTeams.map((t) => t.roster.length));
  const ovrByPid = new Map(league.players.map((p) => [p.pid, p.ovr]));
  const d1OvrsBy = (pred: (country: string) => boolean): number[] =>
    aiTeams
      .filter((t) => {
        const c = competitionOf(league.competitions, t.compId);
        return c.tier === 1 && pred(c.country);
      })
      .flatMap((t) => t.roster.map((pid) => ovrByPid.get(pid)).filter((o): o is number => o !== undefined));
  const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
  const d1Mean = mean(d1OvrsBy(() => true));
  // Per-country, because a solvency gate bites hardest exactly where clubs are
  // poorest — a worldwide mean would hide a starved Turkey behind a healthy
  // England. These are the leagues to watch.
  const COUNTRIES = ["England", "Spain", "Italy", "Germany", "France", "Portugal", "Belgium", "Turkey"];
  const byCountry = COUNTRIES.map(
    (c) => `${c.slice(0, 3).toUpperCase()} ${mean(d1OvrsBy((x) => x === c)).toFixed(1)}`,
  ).join("  ");

  console.log(
    `  worst AI budget £${(worst.budget / 1e6).toFixed(2)}M (${worst.country}, s${worst.season}, ${worst.where})` +
    ` — ${worst.budget < 0 ? "**DEFICIT**" : "SOLVENT"}`,
  );
  console.log(`  distinct AI clubs ever negative: ${deficitClubs.size}  (negative club-samples: ${deficitSamples})`);
  console.log(`  min AI roster: ${minRoster}   D1 mean ovr: ${d1Mean.toFixed(2)}   free agents: ${freeAgentCount(league)}`);
  console.log(`  D1 mean by country: ${byCountry}`);
}

function freeAgentCount(league: LeagueStore): number {
  const rostered = new Set(league.teams.flatMap((t) => [...t.roster, ...t.academyRoster]));
  return league.players.filter((p) => !rostered.has(p.pid)).length;
}
