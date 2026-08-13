/**
 * Reproduces test/core/offseason.test.ts's roster-safety-floor case outside
 * vitest, so it can be run identically in two worktrees to tell a real
 * regression apart from a pre-existing marginal invariant.
 *
 * Prints every club below the floor with enough context to say WHY (is it the
 * user's unmanaged club? which tier? how big is its academy?), plus the overall
 * distribution, since "the minimum moved" and "the whole distribution moved"
 * are different problems.
 *
 * Run: npx tsx scripts/rosterFloorProbe.ts
 */
import { mulberry32 } from "../src/engine/rng.js";
import { createLeagueState } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { simOffseason } from "../src/core/offseason.js";
import { ROSTER_SAFETY_FLOOR } from "../src/core/constants.js";

const SEEDS = (process.env.SEEDS ?? "3").split(",").map(Number);

console.log(`floor ${ROSTER_SAFETY_FLOOR}`);
/** Seasons to follow, to tell a transient dip apart from a club that stays gutted. */
const SEASONS = Number(process.env.SEASONS ?? 1);

for (const SEED of SEEDS) {
  const rng = mulberry32(SEED);
  let league = createLeagueState(0, rng);
  let next = league;
  for (let s = 0; s < SEASONS; s++) {
    league = simThrough(next, "season", rng);
    next = simOffseason(league, rng);
    if (SEASONS > 1) {
      const ss = next.teams.map((t) => t.roster.length).sort((a, b) => a - b);
      const bel = next.teams.filter((t) => t.roster.length < ROSTER_SAFETY_FLOOR);
      console.log(`  seed ${SEED} season ${s + 1}: min ${ss[0]} below ${bel.length}` +
        (bel.length ? `  [${bel.map((t) => `tid ${t.tid} n=${t.roster.length}`).join("; ")}]` : ""));
    }
  }
  if (SEASONS > 1) continue;

  const userTid = next.meta.userTid;
  const sizes = next.teams.map((t) => t.roster.length).sort((a, b) => a - b);
  const below = next.teams.filter((t) => t.roster.length < ROSTER_SAFETY_FLOOR);
  const detail = below
    .map((t) => `tid ${t.tid}${t.tid === userTid ? "(USER)" : ""} comp ${t.compId} n=${t.roster.length}`)
    .join("; ");
  console.log(
    `seed ${String(SEED).padStart(2)}  min ${String(sizes[0]).padStart(2)}  ` +
      `p05 ${sizes[Math.floor(sizes.length * 0.05)]}  median ${sizes[Math.floor(sizes.length / 2)]}  ` +
      `below ${below.length}${detail ? `  [${detail}]` : ""}`,
  );
}
