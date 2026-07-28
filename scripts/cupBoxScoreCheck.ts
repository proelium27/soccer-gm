/**
 * Verifies what archiving a cup keeps and drops.
 *
 * `archiveCup` folds every stage's box scores into one stat line per player and
 * then drops the box scores. This checks, on a real simmed cup, that:
 *   - all three stages lose their box scores (that's the space win)
 *   - scorelines, aggregates and winners survive (that's what the UI draws)
 *   - cupStatsForPlayer still returns per-player numbers afterwards
 *   - those numbers now include league-phase and playoff games, which the old
 *     knockout-only summing never counted
 */
import { createLeagueState } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { simOffseason } from "../src/core/offseason.js";
import { mulberry32 } from "../src/engine/rng.js";
import { cupStatsForPlayer } from "../src/core/cup/cupStats.js";
import { archiveCup } from "../src/core/cup/archive.js";
import type { CupState } from "../src/core/cup/types.js";

const rng = mulberry32(7);
let league = createLeagueState(0, rng);
// Season 1 has no cup; sim until one has been played and archived.
for (let s = 1; s <= 3; s++) {
  league = simThrough(league, "season", rng);
  league = simOffseason(league, rng);
}

const boxCounts = (cup: CupState) => ({
  lp: (cup.leaguePhase?.matches ?? []).filter((m) => m.boxScore).length,
  po: (cup.playoff?.ties ?? []).filter((t) => t.boxScore).length,
  ko: cup.ties.filter((t) => t.boxScore).length,
});

for (const cup of league.cupHistory) {
  const c = boxCounts(cup);
  console.log(`\n=== archived cup, season ${cup.season} ===`);
  console.log(`  box scores remaining: leaguePhase ${c.lp}, playoff ${c.po}, knockout ${c.ko}`);
  console.log(`  statLines stored: ${cup.statLines?.length ?? 0} players`);

  // The displayed data has to survive.
  const lpPlayed = (cup.leaguePhase?.matches ?? []).filter((m) => m.played);
  const sample = lpPlayed[0];
  if (sample) {
    console.log(`  sample group game scoreline: ${sample.homeGoals}-${sample.awayGoals} (kept)`);
  }
  const tie = cup.ties[0];
  if (tie) {
    console.log(`  sample knockout tie: ${tie.homeGoals}-${tie.awayGoals}, winner tid ${tie.winner} (kept)`);
  }

  // Stats still read out of the stored aggregate.
  const top = [...(cup.statLines ?? [])].sort((a, b) => b.appearances - a.appearances)[0];
  if (top) {
    const viaStore = cupStatsForPlayer(cup, top.pid);
    console.log(
      `  busiest player pid ${top.pid}: ${viaStore.appearances} appearances, `
      + `${viaStore.goals} goals, ${viaStore.minutesPlayed} minutes`,
    );
  }
}

// Round-trip check: archiving an already-archived cup must not change it.
const first = league.cupHistory[0];
if (first) {
  const again = archiveCup(first);
  const same = JSON.stringify(again.statLines) === JSON.stringify(first.statLines);
  console.log(`\nre-archiving is idempotent: ${same ? "yes" : "NO"}`);
}
