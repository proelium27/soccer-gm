/**
 * Exactly which cup box scores survive the archive strip.
 *
 * stripLeaguePhaseBoxScores only clears `leaguePhase.matches[].boxScore`. This
 * confirms on a real simmed cup that the elimination stages -- the Swiss playoff
 * and every knockout tie -- keep theirs.
 */
import { createLeagueState } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { simOffseason } from "../src/core/offseason.js";
import { mulberry32 } from "../src/engine/rng.js";
import { cupStatsForPlayer } from "../src/core/cup/cupStats.js";

const rng = mulberry32(7);
let league = createLeagueState(0, rng);
// Season 1 has no cup; sim on until archived cups exist.
for (let s = 1; s <= 4; s++) {
  league = simThrough(league, "season", rng);
  league = simOffseason(league, rng);
}

const has = (b: unknown) => (b === null || b === undefined ? "none" : "KEPT");

for (const cup of league.cupHistory) {
  const lp = cup.leaguePhase;
  const lpPlayed = lp ? lp.matches.filter((m) => m.played) : [];
  const lpWithBox = lpPlayed.filter((m) => m.boxScore !== null);
  const po = cup.playoff;
  const poMatches = (po?.ties ?? []) as { boxScore?: unknown }[];
  const poWithBox = poMatches.filter((m) => m.boxScore !== null && m.boxScore !== undefined);
  const tiesWithBox = cup.ties.filter((t) => t.boxScore !== null && t.boxScore !== undefined);

  console.log(`\n=== archived cup, season ${cup.season} ===`);
  console.log(`  league phase (group stage, NOT elimination):`);
  console.log(`      ${lpPlayed.length} played, ${lpWithBox.length} still carry a box score`);
  console.log(`  playoff ties (single-leg eliminator for the last QF places):`);
  console.log(`      ${poMatches.length} matches, ${poWithBox.length} still carry a box score`);
  console.log(`  knockout ties (QF / SF / Final):`);
  console.log(`      ${cup.ties.length} ties, ${tiesWithBox.length} still carry a box score`);

  // Scorelines and the table must survive regardless.
  const sample = lpPlayed[0];
  if (sample) {
    console.log(`  sample LP match: ${sample.homeGoals}-${sample.awayGoals} `
      + `(scoreline ${sample.homeGoals >= 0 ? "KEPT" : "LOST"}, boxScore ${has(sample.boxScore)})`);
  }
}

// What a player's cup stat line is actually built from.
const cup = league.cupHistory[0];
if (cup && cup.ties.length > 0) {
  const pid = cup.ties[0].boxScore.home[0]?.pid;
  if (pid !== undefined) {
    const line = cupStatsForPlayer(cup, pid);
    console.log(`\ncupStatsForPlayer(pid ${pid}) on season ${cup.season}: `
      + `${line.appearances} appearances, ${line.goals} goals, ${line.minutesPlayed} minutes`);
    console.log("  (it sums cup.ties only -- see note below)");
  }
}
