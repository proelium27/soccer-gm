/**
 * EXPERIMENT part 2: can a larger TEAM_STRENGTH_SPREAD buy back the
 * within-league spread that global (absolute) normalization compresses?
 *
 * Run one spread value per process (constants read env at module load):
 *   TEAM_SPREAD=9  GLOBAL_NORM=1 npx tsx scripts/spreadSweep.ts
 *   TEAM_SPREAD=16 GLOBAL_NORM=1 npx tsx scripts/spreadSweep.ts
 *
 * Reports, for a settled world:
 *  - normalized `attack` mean + within-league spread per competition
 *  - the D1 hierarchy (does England still read stronger than Portugal?)
 *  - OVR distribution health (starter mean / team-best / world max), because
 *    widening the spread also stretches the ratings scale into the tuned
 *    thresholds (D2 refusal 70, elite valuation 76, protected star 80) and
 *    wages are cubic in ovr.
 *  - champion points after full seasons (the domestic-race payoff metric)
 */
import { mulberry32 } from "../src/engine/rng.js";
import { createLeagueState, type LeagueStore } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { simOffseason } from "../src/core/offseason.js";
import { leagueMatchData } from "../src/core/league/composites.js";
import { competitionOf } from "../src/core/competitions.js";
import { TEAM_STRENGTH_SPREAD, DIVISION_2_OFFSET } from "../src/core/constants.js";
import type { LeagueTeam } from "../src/core/league/generate.js";

const SEED = Number(process.env.SEED ?? 1);
const SEASONS = Number(process.env.SEASONS ?? 3);
const USER_TID = 0;
const MODE = process.env.GLOBAL_NORM
  ? "GLOBAL"
  : process.env.TWO_LEVEL
    ? "TWO-LEVEL"
    : "per-league";

const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const sd = (xs: number[]): number => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};

const toLeagueTeams = (ts: LeagueStore["teams"]): LeagueTeam[] =>
  ts.map((t) => ({
    tid: t.tid, name: t.name, roster: t.roster, avgOvr: 0,
    academyBase: t.academyBase, compId: t.compId, starters: t.starters,
    formation: t.formation, moreMinutes: t.moreMinutes,
  }));

console.log(`\n##### TEAM_SPREAD=${TEAM_STRENGTH_SPREAD} | norm=${MODE} | seed ${SEED} #####`);
console.log(`(derived DIVISION_2_OFFSET = ${DIVISION_2_OFFSET.toFixed(2)})`);

const rng = mulberry32(SEED);
let league = createLeagueState(USER_TID, rng);
for (let s = 1; s <= SEASONS; s++) {
  league = simThrough(league, "season", rng);
  league = simOffseason(league, rng);
}

// --- composite spread, computed the way the sim's matchdays do it ---
const compAttack = new Map<number, number>();
if (MODE === "GLOBAL") {
  const d = leagueMatchData({ teams: toLeagueTeams(league.teams), players: league.players });
  league.teams.forEach((t, i) => compAttack.set(t.tid, d[i].composites.attack));
} else {
  // per-league curve; TWO-LEVEL additionally shifts each league by its distance
  // from the world average (mirrors simThrough's own two-level branch).
  const worldByTid = new Map<number, number>();
  if (MODE === "TWO-LEVEL") {
    const wd = leagueMatchData({ teams: toLeagueTeams(league.teams), players: league.players });
    league.teams.forEach((t, i) => worldByTid.set(t.tid, wd[i].composites.attack));
  }
  const betweenScale = Number(process.env.TWO_LEVEL ?? 1);
  for (const comp of league.competitions) {
    const teams = league.teams.filter((t) => t.compId === comp.id);
    if (!teams.length) continue;
    const d = leagueMatchData({ teams: toLeagueTeams(teams), players: league.players });
    let offset = 0;
    if (MODE === "TWO-LEVEL") {
      const lm = teams.reduce((s, t) => s + (worldByTid.get(t.tid) ?? 0.5), 0) / teams.length;
      offset = (lm - 0.5) * betweenScale;
    }
    teams.forEach((t, i) => compAttack.set(t.tid, d[i].composites.attack + offset));
  }
}

console.log("\n-- normalized `attack` per competition --");
console.log("league          |  mean  | within-league spread");
console.log("----------------+--------+---------------------");
for (const comp of [...league.competitions].sort((a, b) => a.id - b.id)) {
  const c = competitionOf(league.competitions, comp.id);
  const vals = league.teams
    .filter((t) => t.compId === comp.id && t.tid !== USER_TID)
    .map((t) => compAttack.get(t.tid)!);
  console.log(`${`${c.country} D${c.tier}`.padEnd(15)} | ${mean(vals).toFixed(3)}  |        ${sd(vals).toFixed(3)}`);
}

// --- OVR distribution health ---
const ovrByPid = new Map(league.players.map((p) => [p.pid, p.ovr]));
const d1Teams = league.teams.filter(
  (t) => competitionOf(league.competitions, t.compId).tier === 1 && t.tid !== USER_TID,
);
const teamBests = d1Teams.map((t) => Math.max(...t.roster.map((pid) => ovrByPid.get(pid) ?? 0)));
const allD1 = d1Teams.flatMap((t) => t.roster.map((pid) => ovrByPid.get(pid) ?? 0));
console.log("\n-- OVR distribution (tier-1, user club excluded) --");
console.log(`  mean ovr           ${mean(allD1).toFixed(1)}`);
console.log(`  avg team-best ovr  ${mean(teamBests).toFixed(1)}   (Manual says ~75)`);
console.log(`  world max ovr      ${Math.max(...allD1)}   (Manual says 80-85 elite, 90+ rare)`);
console.log(`  count >= 80        ${allD1.filter((o) => o >= 80).length}  |  >= 90: ${allD1.filter((o) => o >= 90).length}`);
console.log(`  count >= 70 (D2 refusal threshold territory)  ${allD1.filter((o) => o >= 70).length}`);

// --- champion points ---
const hist = league.seasonHistory[league.seasonHistory.length - 1];
const compOf = hist.compsByTid;
console.log("\n-- final-season tier-1 tables --");
console.log("league          | champ pts | spread (1st-last)");
console.log("----------------+-----------+------------------");
for (const comp of league.competitions.filter((c) => c.tier === 1).sort((a, b) => a.id - b.id)) {
  const rows = hist.table
    .filter((r) => compOf[r.tid] === comp.id && r.tid !== USER_TID)
    .sort((a, b) => b.points - a.points);
  if (!rows.length) continue;
  const c = competitionOf(league.competitions, comp.id);
  console.log(
    `${`${c.country} D${c.tier}`.padEnd(15)} |    ${String(rows[0].points).padStart(3)}    |        ${String(rows[0].points - rows[rows.length - 1].points).padStart(3)}`,
  );
}
