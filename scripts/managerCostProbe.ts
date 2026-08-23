/**
 * What the board's end-of-season review costs.
 *
 * `reviewSeason` runs once per season at the offseason transition, and it walks
 * every club in the world (`computeTeamRating` per squad, plus a standings pass
 * per competition). That is cheap next to simming 380 matches, but "cheap"
 * should be a measured number rather than an assumption, because it is now on
 * the path of every season every save ever plays.
 *
 *   npx tsx scripts/managerCostProbe.ts
 */
import { mulberry32 } from "../src/engine/rng.js";
import { createLeagueState } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { reviewSeason } from "../src/core/manager/index.js";

function main(): void {
  const t0 = Date.now();
  let league = createLeagueState(3, mulberry32(42));
  const genMs = Date.now() - t0;
  console.log(`createLeagueState: ${genMs}ms (${league.teams.length} clubs, ${league.players.length} players)`);

  const t1 = Date.now();
  league = simThrough(league, "season", mulberry32(1));
  const seasonMs = Date.now() - t1;

  // Time the review on its own, repeated, so one sample's noise doesn't decide it.
  const RUNS = 20;
  const t2 = Date.now();
  for (let i = 0; i < RUNS; i++) {
    reviewSeason({
      league,
      teams: league.teams,
      players: league.players,
      played: league.played,
      cup: league.cup,
      shield: league.shield,
      domesticCups: league.domesticCups,
    });
  }
  const reviewMs = (Date.now() - t2) / RUNS;

  console.log(`simThrough one season: ${seasonMs}ms`);
  console.log(`reviewSeason:          ${reviewMs.toFixed(1)}ms  (${((reviewMs / seasonMs) * 100).toFixed(2)}% of a season)`);
}

main();
