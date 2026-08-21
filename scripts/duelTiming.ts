/**
 * Cost of the duel model, in match-sim wall time only.
 *
 * Deliberately imports NOTHING duel-specific, so the identical file runs
 * against main's engine files for the baseline (see the report for the
 * git checkout dance). World generation is excluded from the timed region —
 * it dominates and is unchanged by any of this.
 *
 * Run:  npx tsx scripts/duelTiming.ts
 */
import { mulberry32 } from "../src/engine/rng.js";
import { createLeagueState } from "../src/core/leagueState.js";
import { leagueMatchData } from "../src/core/league/composites.js";
import { simMatchDetailed } from "../src/engine/matchSim.js";

const MATCHES = Number(process.env.MATCHES ?? 3000);
const SEED = Number(process.env.SEED ?? 7001);

const league = createLeagueState(0, mulberry32(SEED));
const data = leagueMatchData({
  teams: league.teams.map((t) => ({ ...t, avgOvr: 0 })),
  players: league.players,
});

const comp0 = league.teams.filter((t) => t.compId === league.teams[0].compId);
const a = data[league.teams.findIndex((t) => t.tid === comp0[10].tid)];
const b = data[league.teams.findIndex((t) => t.tid === comp0[11].tid)];

// Warm the JIT before timing.
for (let i = 0; i < 200; i++) {
  simMatchDetailed(mulberry32(i), a.composites, b.composites, a.xi, b.xi, a.bench, b.bench, {
    recompute: { home: a.recompute, away: b.recompute },
  });
}

let goals = 0;
const t0 = performance.now();
for (let i = 0; i < MATCHES; i++) {
  const r = simMatchDetailed(
    mulberry32(900000 + i),
    a.composites,
    b.composites,
    a.xi,
    b.xi,
    a.bench,
    b.bench,
    { recompute: { home: a.recompute, away: b.recompute } },
  );
  goals += r.home + r.away;
}
const ms = performance.now() - t0;

console.log(`matches:        ${MATCHES}`);
console.log(`total:          ${ms.toFixed(0)} ms`);
console.log(`per match:      ${(ms / MATCHES).toFixed(3)} ms`);
console.log(`goals/match:    ${(goals / MATCHES).toFixed(3)}  (sanity check)`);
// A 16-competition season is 16 * 380 = 6080 league fixtures.
console.log(`=> 6080-fixture season: ${((ms / MATCHES) * 6080 / 1000).toFixed(2)} s of match sim`);
