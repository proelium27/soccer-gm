import { mulberry32 } from "../src/engine/rng.js";
import { createLeagueState } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { simOffseason } from "../src/core/offseason.js";

const SEASONS = 30;
const SEEDS = [1, 2, 3];

function avg(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function pctOver(xs: number[], t: number): number {
  return (100 * xs.filter((x) => x >= t).length) / xs.length;
}

for (const seed of SEEDS) {
  console.log(`\n=== seed ${seed} ===`);
  const rng = mulberry32(seed);
  let league = createLeagueState(0, rng);

  let minBudget = Infinity;
  let lastD1: number[] = [];
  let lastD2: number[] = [];
  let lastD1TeamAvgs: number[] = [];
  let lastD2TeamAvgs: number[] = [];

  for (let s = 1; s <= SEASONS; s++) {
    league = simThrough(league, "season", rng);
    league = simOffseason(league, rng);
    for (const t of league.teams) minBudget = Math.min(minBudget, t.budget);

    const ovrByTid = new Map<number, number[]>();
    for (const p of league.players) {
      const tid = league.teams.find((t) => t.roster.includes(p.pid))?.tid;
      if (tid === undefined) continue;
      const arr = ovrByTid.get(tid) ?? [];
      arr.push(p.ovr);
      ovrByTid.set(tid, arr);
    }
    lastD1 = league.teams.filter((t) => t.division === 0).flatMap((t) => ovrByTid.get(t.tid) ?? []);
    lastD2 = league.teams.filter((t) => t.division === 1).flatMap((t) => ovrByTid.get(t.tid) ?? []);
    lastD1TeamAvgs = league.teams.filter((t) => t.division === 0).map((t) => avg(ovrByTid.get(t.tid) ?? []));
    lastD2TeamAvgs = league.teams.filter((t) => t.division === 1).map((t) => avg(ovrByTid.get(t.tid) ?? []));
  }

  console.log("min budget ever observed:", minBudget.toLocaleString());
  console.log("D1 final-season OVR: mean", avg(lastD1).toFixed(1), "80+:", pctOver(lastD1, 80).toFixed(1) + "%");
  console.log("D2 final-season OVR: mean", avg(lastD2).toFixed(1), "80+:", pctOver(lastD2, 80).toFixed(1) + "%");
  console.log(
    "D2's strongest TEAM (avg roster ovr) vs D1's average TEAM (should be roughly equal per design):",
    Math.max(...lastD2TeamAvgs).toFixed(1), "vs", avg(lastD1TeamAvgs).toFixed(1),
  );

  const finalD1Ids = new Set(league.teams.filter((t) => t.division === 0).map((t) => t.tid));
  const startingD1Ids = new Set(Array.from({ length: 20 }, (_, i) => i));
  const stillInD1 = [...finalD1Ids].filter((tid) => startingD1Ids.has(tid)).length;
  console.log(`D1 clubs still in D1 after ${SEASONS} seasons: ${stillInD1}/20 (turnover from promotion/relegation)`);
}
