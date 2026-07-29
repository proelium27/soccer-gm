/**
 * EXPERIMENT: what does removing per-league z-normalization do?
 *
 * Part A (pure/isolated): build a world, settle it a couple seasons, then
 * compute each team's normalized `attack` composite BOTH ways — per-competition
 * (the shipped behavior) and globally (one shared world mean/sd, FM-style
 * absolute scale). Prints per country/tier the mean composite and the
 * within-league spread (sd). Shows (1) whether the cross-league gap surfaces and
 * (2) whether within-league spread compresses.
 *
 * Part B (behavioral): run a few full seasons per-league vs global (env
 * GLOBAL_NORM) on the same seed; print each tier-1 league's champion points and
 * table spread to show the domestic-race consequence.
 *
 * Run:
 *   npx tsx scripts/normExperiment.ts                 # Part A + Part B(per-league)
 *   GLOBAL_NORM=1 npx tsx scripts/normExperiment.ts   # Part B under global norm
 */
import { mulberry32 } from "../src/engine/rng.js";
import { createLeagueState, type LeagueStore } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { simOffseason } from "../src/core/offseason.js";
import { leagueMatchData } from "../src/core/league/composites.js";
import { competitionOf } from "../src/core/competitions.js";
import type { LeagueTeam } from "../src/core/league/generate.js";

const SEED = Number(process.env.SEED ?? 1);
const USER_TID = 0;

const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const sd = (xs: number[]): number => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};

function toLeagueTeams(ts: LeagueStore["teams"]): LeagueTeam[] {
  return ts.map((t) => ({
    tid: t.tid, name: t.name, roster: t.roster, avgOvr: 0,
    academyBase: t.academyBase, compId: t.compId, starters: t.starters,
    formation: t.formation, moreMinutes: t.moreMinutes,
  }));
}

function label(league: LeagueStore, compId: number): string {
  const c = competitionOf(league.competitions, compId);
  return `${c.country} D${c.tier}`;
}

// ---- Part A: isolate the normalization effect on one settled world ----
function partA(league: LeagueStore): void {
  const players = league.players;
  // Per-competition normalization (shipped): stats scoped to each comp.
  const perComp = new Map<number, number>(); // tid -> normalized attack
  for (const comp of league.competitions) {
    const teams = league.teams.filter((t) => t.compId === comp.id);
    const data = leagueMatchData({ teams: toLeagueTeams(teams), players });
    teams.forEach((t, i) => perComp.set(t.tid, data[i].composites.attack));
  }
  // Global normalization: one shared world baseline.
  const global = new Map<number, number>();
  const worldData = leagueMatchData({ teams: toLeagueTeams(league.teams), players });
  league.teams.forEach((t, i) => global.set(t.tid, worldData[i].composites.attack));

  const comps = [...league.competitions].sort((a, b) => a.id - b.id);
  console.log("\n=== PART A: normalized `attack` composite, per-league vs global ===");
  console.log("(0.5 = baseline average; higher = stronger. spread = sd across the league's clubs)\n");
  console.log("league         | per-league mean (spread) | global mean (spread)");
  console.log("---------------+--------------------------+---------------------");
  for (const comp of comps) {
    const teams = league.teams.filter((t) => t.compId === comp.id && t.tid !== USER_TID);
    const pc = teams.map((t) => perComp.get(t.tid)!);
    const gl = teams.map((t) => global.get(t.tid)!);
    console.log(
      `${label(league, comp.id).padEnd(14)} |   ${mean(pc).toFixed(3)}  (${sd(pc).toFixed(3)})        |   ${mean(gl).toFixed(3)}  (${sd(gl).toFixed(3)})`,
    );
  }
}

// ---- Part B: behavioral consequence over full seasons ----
function partB(seasons: number): void {
  const mode = process.env.GLOBAL_NORM ? "GLOBAL" : "per-league";
  console.log(`\n=== PART B: ${seasons} seasons, ${mode} normalization, seed ${SEED} ===`);
  const rng = mulberry32(SEED);
  let league = createLeagueState(USER_TID, rng);
  for (let s = 1; s <= seasons; s++) {
    league = simThrough(league, "season", rng);
    league = simOffseason(league, rng);
  }
  const hist = league.seasonHistory[league.seasonHistory.length - 1];
  const compOf = hist.compsByTid;
  const tier1 = league.competitions.filter((c) => c.tier === 1).sort((a, b) => a.id - b.id);
  console.log("league          | champ pts | table spread (1st-last) | avg goals/game");
  console.log("----------------+-----------+-------------------------+---------------");
  for (const comp of tier1) {
    const rows = hist.table
      .filter((r) => compOf[r.tid] === comp.id && r.tid !== USER_TID)
      .sort((a, b) => b.points - a.points);
    if (rows.length === 0) continue;
    const champPts = rows[0].points;
    const spread = rows[0].points - rows[rows.length - 1].points;
    const gpg = mean(rows.map((r) => (r.gf + r.ga) / Math.max(1, r.played)));
    console.log(
      `${label(league, comp.id).padEnd(15)} |    ${String(champPts).padStart(3)}    |          ${String(spread).padStart(3)}            |     ${gpg.toFixed(2)}`,
    );
  }
}

// Part A needs a settled world; build one independently of Part B's mode.
const rng = mulberry32(SEED);
let world = createLeagueState(USER_TID, rng);
for (let s = 1; s <= 2; s++) {
  world = simThrough(world, "season", rng);
  world = simOffseason(world, rng);
}
partA(world);
partB(3);
