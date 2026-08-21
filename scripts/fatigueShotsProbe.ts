/**
 * Is "tired legs create fewer chances" still true under the duel model, or did
 * the duel terms break it?
 *
 * test/engine/fatigue.test.ts asserts lowShots < highShots on a strict
 * inequality over 200 trials. It failed on the spike at 5166 vs 5159 — a 0.14%
 * gap, i.e. right on the knife edge. That test's own comment records it being
 * bumped 40 -> 200 trials because ONE extra rng draw per turnover made it flaky;
 * the duel model adds two draws per tick, a far larger stream shift.
 *
 * So the question is whether the effect is gone or merely swamped. This runs the
 * same comparison at a much larger trial count, and (via the weight env vars) can
 * separate the two candidate causes:
 *   - weights 0: pure stream shift, duel math inert  -> if this also fails, the
 *     test was always knife-edge and the spike merely reshuffled the dice.
 *   - weights on: the duel math is actually implicated.
 *
 * Run: TRIALS=2000 npx tsx scripts/fatigueShotsProbe.ts
 */
import { mulberry32 } from "../src/engine/rng.js";
import { makeTeam } from "../src/engine/composites.js";
import { simMatchDetailed } from "../src/engine/matchSim.js";
import type { MatchPlayer } from "../src/engine/attribution.js";
import { DUEL_TURNOVER_WEIGHT, DUEL_CHANCE_WEIGHT } from "../src/engine/constants.js";

const TRIALS = Number(process.env.TRIALS ?? 2000);

function makeSquad(pidOffset: number, stamina = 50): MatchPlayer[] {
  const positions: MatchPlayer["pos"][] = [
    "GK", "CB", "CB", "FB", "FB", "DM", "CM", "CM", "W", "W", "ST",
  ];
  return positions.map((pos, i) => ({
    pid: pidOffset + i + 1,
    pos,
    slot: pos,
    secondary: [],
    ovr: pos === "ST" ? 68 : 62,
    shooting: pos === "ST" ? 80 : 40,
    dribbling: 50,
    tackling: pos === "CB" || pos === "DM" ? 70 : 40,
    keeping: pos === "GK" ? 80 : 5,
    positioning: 55,
    heading: 45,
    stamina,
    interceptions: pos === "CB" || pos === "DM" ? 70 : 40,
  }));
}

console.log(`duel weights: turnover=${DUEL_TURNOVER_WEIGHT} chance=${DUEL_CHANCE_WEIGHT}`);
console.log(`trials: ${TRIALS}\n`);

function armShots(stamina: number): { shots: number; ticks: number } {
  let shots = 0;
  let ticks = 0;
  for (let seed = 1; seed <= TRIALS; seed++) {
    const r = simMatchDetailed(
      mulberry32(seed),
      makeTeam("Home"),
      makeTeam("Away"),
      makeSquad(0, stamina),
      makeSquad(100, stamina),
    );
    shots += r.stat.home.shots + r.stat.away.shots;
    ticks += r.stat.home.ticks + r.stat.away.ticks;
  }
  return { shots, ticks };
}

const low = armShots(1);
const high = armShots(99);

const perMatch = (n: number): string => (n / TRIALS).toFixed(4);
console.log(`low stamina (1):   ${low.shots} shots  (${perMatch(low.shots)}/match, ${perMatch(low.ticks)} ticks)`);
console.log(`high stamina (99): ${high.shots} shots  (${perMatch(high.shots)}/match, ${perMatch(high.ticks)} ticks)`);
const diff = high.shots - low.shots;
const pct = (diff / high.shots) * 100;
console.log(`\nhigh - low = ${diff} shots (${pct.toFixed(3)}%)`);
console.log(diff > 0 ? "=> holds: tired legs create fewer chances" : "=> INVERTED or flat");
