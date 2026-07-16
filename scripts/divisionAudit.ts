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

function totsAvgOvr(
  awards: { teamOfSeason: (number | null)[] },
  playersByPid: Map<number, { ovr: number }>,
): number {
  const ovrs = awards.teamOfSeason
    .filter((pid): pid is number => pid !== null)
    .map((pid) => playersByPid.get(pid)?.ovr ?? 0);
  return avg(ovrs);
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
  let lastD1WageBill = 0;
  let lastD2WageBill = 0;
  let season1D2Max = 0;
  let season1D2TotsAvg = 0;

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
    lastD1 = league.teams.filter((t) => t.compId === 0).flatMap((t) => ovrByTid.get(t.tid) ?? []);
    lastD2 = league.teams.filter((t) => t.compId === 1).flatMap((t) => ovrByTid.get(t.tid) ?? []);
    lastD1TeamAvgs = league.teams.filter((t) => t.compId === 0).map((t) => avg(ovrByTid.get(t.tid) ?? []));
    lastD2TeamAvgs = league.teams.filter((t) => t.compId === 1).map((t) => avg(ovrByTid.get(t.tid) ?? []));

    const salaryByPid = new Map(league.players.map((p) => [p.pid, p.contract.salary]));
    lastD1WageBill = league.teams
      .filter((t) => t.compId === 0)
      .reduce((sum, t) => sum + t.roster.reduce((s, pid) => s + (salaryByPid.get(pid) ?? 0), 0), 0);
    lastD2WageBill = league.teams
      .filter((t) => t.compId === 1)
      .reduce((sum, t) => sum + t.roster.reduce((s, pid) => s + (salaryByPid.get(pid) ?? 0), 0), 0);

    if (s === 1) {
      season1D2Max = Math.max(...lastD2);
      const hist = league.seasonHistory[league.seasonHistory.length - 1];
      const playersByPid = new Map(league.players.map((p) => [p.pid, p]));
      season1D2TotsAvg = totsAvgOvr(hist.awards[1], playersByPid);
    }
  }

  const finalHist = league.seasonHistory[league.seasonHistory.length - 1];
  const finalPlayersByPid = new Map(league.players.map((p) => [p.pid, p]));
  const season30D2TotsAvg = totsAvgOvr(finalHist.awards[1], finalPlayersByPid);

  console.log("min budget ever observed:", minBudget.toLocaleString());
  console.log("D1 final-season OVR: mean", avg(lastD1).toFixed(1), "80+:", pctOver(lastD1, 80).toFixed(1) + "%");
  console.log("D2 final-season OVR: mean", avg(lastD2).toFixed(1), "80+:", pctOver(lastD2, 80).toFixed(1) + "%");
  console.log(
    "D2's strongest TEAM (avg roster ovr) vs D1's average TEAM:",
    Math.max(...lastD2TeamAvgs).toFixed(1), "vs", avg(lastD1TeamAvgs).toFixed(1),
  );
  console.log(
    "D2 single max player OVR: season 1 =", season1D2Max, "| season", SEASONS, "=", Math.max(...lastD2),
    "(target: ~70-75)",
  );
  console.log(
    "D2 Team of the Season avg OVR: season 1 =", season1D2TotsAvg.toFixed(1),
    "| season", SEASONS, "=", season30D2TotsAvg.toFixed(1), "(target: ~65)",
  );
  console.log(
    "D2/D1 wage bill ratio (final season):",
    (lastD2WageBill / lastD1WageBill).toFixed(3),
    `(D2 total: ${lastD2WageBill.toLocaleString()}, D1 total: ${lastD1WageBill.toLocaleString()})`,
  );

  const finalD1Ids = new Set(league.teams.filter((t) => t.compId === 0).map((t) => t.tid));
  const startingD1Ids = new Set(Array.from({ length: 20 }, (_, i) => i));
  const stillInD1 = [...finalD1Ids].filter((tid) => startingD1Ids.has(tid)).length;
  console.log(`D1 clubs still in D1 after ${SEASONS} seasons: ${stillInD1}/20 (turnover from promotion/relegation)`);
}
