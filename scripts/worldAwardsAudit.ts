/**
 * Sanity audit for the worldwide awards (core/worldAwards.ts).
 *
 * The question it exists to answer: does the league-strength correction
 * actually work? Match ratings are z-normalized inside each competition, so
 * without a correction the Ballon d'Or would drift to whichever league is
 * weakest (dominating weak opposition scores the same as dominating strong).
 * A healthy result is winners concentrated in the four strong leagues, with
 * France/Portugal appearing occasionally rather than never or constantly, and
 * the winner's ovr sitting at the top of the world rather than mid-table.
 *
 *   npx tsx scripts/worldAwardsAudit.ts
 */
import { mulberry32 } from "../src/engine/rng.js";
import { createLeagueState } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { simOffseason } from "../src/core/offseason.js";
import { competitionOf } from "../src/core/competitions.js";
import { cupStatsByPid } from "../src/core/cup/cupStats.js";

const SEASONS = Number(process.env.SEASONS ?? 12);
const SEEDS = (process.env.SEEDS ?? "1,2,3").split(",").map(Number);

const winnersByCountry = new Map<string, number>();
const xiByCountry = new Map<string, number>();
const winnerOvrRanks: number[] = [];

for (const seed of SEEDS) {
  const rng = mulberry32(seed);
  let league = createLeagueState(0, rng);
  console.log(`\n=== seed ${seed} ===`);

  for (let s = 0; s < SEASONS; s++) {
    league = simThrough(league, "season", rng);
    league = simOffseason(league, rng);
    const entry = league.seasonHistory.at(-1)!;
    const { ballonDOr, worldTeamOfYear } = entry.world;
    if (ballonDOr.length === 0) continue;

    const byPid = new Map(league.players.map((p) => [p.pid, p]));
    const countryOf = (tid: number): string => {
      const compId = entry.compsByTid[tid];
      return compId === undefined ? "?" : competitionOf(league.competitions, compId).country;
    };

    const winner = ballonDOr[0];
    const country = countryOf(winner.tid);
    winnersByCountry.set(country, (winnersByCountry.get(country) ?? 0) + 1);
    for (const pid of worldTeamOfYear) {
      if (pid === null) continue;
      const stats = byPid.get(pid)?.stats.find((x) => x.season === entry.season);
      const c = stats ? countryOf(stats.tid) : "?";
      xiByCountry.set(c, (xiByCountry.get(c) ?? 0) + 1);
    }

    // Where the winner ranks by raw ovr among everyone who played that season —
    // a Ballon d'Or going to the world's 200th-best player means the correction
    // is off, not that a statistical outlier had a good year.
    const played = league.players
      .filter((p) => p.stats.some((x) => x.season === entry.season && x.appearances > 0))
      .sort((a, b) => b.ovr - a.ovr);
    const rank = played.findIndex((p) => p.pid === winner.pid) + 1;
    winnerOvrRanks.push(rank);

    const seasonCup = league.cupHistory.find((c) => c.season === entry.season) ?? null;
    const cupLines = seasonCup ? cupStatsByPid(seasonCup) : new Map();
    const line = (e: typeof winner, i: number): string => {
      const p = byPid.get(e.pid);
      const st = p?.stats.find((x) => x.season === entry.season);
      const r = played.findIndex((x) => x.pid === e.pid) + 1;
      const cl = cupLines.get(e.pid);
      const cupDetail = cl
        ? `${cl.appearances}ap/${cl.goals}g/${(cl.ratingSum / Math.max(1, cl.ratedAppearances)).toFixed(2)}av`
        : "-";
      return `    ${String(i + 1).padStart(2)}. ${(p?.name ?? String(e.pid)).padEnd(22)}` +
        ` ${String(p?.ovr ?? "?").padStart(2)}ovr r${String(r).padStart(4)}` +
        ` ${countryOf(e.tid).padEnd(9)}` +
        ` ${String(st?.goals ?? 0).padStart(2)}g ${String(st?.assists ?? 0).padStart(2)}a` +
        ` ${(st?.avgRating ?? 0).toFixed(2)}av` +
        ` | tot ${e.score.toFixed(2)} = lg ${e.league.toFixed(2)}` +
        ` cup ${e.cup.toFixed(2)} intl ${e.intl.toFixed(2)} ttl ${e.title.toFixed(2)}` +
        ` | cup line ${cupDetail}`;
    };
    console.log(`  s${entry.season}  [winner ovr rank ${rank}/${played.length}]`);
    ballonDOr.slice(0, Number(process.env.SHOW ?? 3)).forEach((e, i) => console.log(line(e, i)));
  }
}

const pct = (n: number, total: number) => `${((100 * n) / total).toFixed(0)}%`;
const totalWinners = [...winnersByCountry.values()].reduce((a, b) => a + b, 0);
const totalXI = [...xiByCountry.values()].reduce((a, b) => a + b, 0);

console.log("\n=== Ballon d'Or winners by country ===");
for (const [c, n] of [...winnersByCountry].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${c.padEnd(10)} ${String(n).padStart(3)}  ${pct(n, totalWinners)}`);
}
console.log("\n=== World XI places by country ===");
for (const [c, n] of [...xiByCountry].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${c.padEnd(10)} ${String(n).padStart(3)}  ${pct(n, totalXI)}`);
}
const meanRank = winnerOvrRanks.reduce((a, b) => a + b, 0) / winnerOvrRanks.length;
console.log(
  `\nWinner's world ovr rank: mean ${meanRank.toFixed(1)}, ` +
    `median ${[...winnerOvrRanks].sort((a, b) => a - b)[Math.floor(winnerOvrRanks.length / 2)]}, ` +
    `worst ${Math.max(...winnerOvrRanks)}`,
);
