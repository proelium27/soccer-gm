/**
 * Calibrator for POSITION_OVR_CALIBRATION (src/core/constants.ts).
 *
 * A position's OVR weights sit on the skills its players generate highest, so
 * the weighting and the generation table amplify each other and some positions
 * read several OVR points above the pack for no reason a player can act on.
 * This measures each position's mean OVR on freshly generated worlds and prints
 * the shifts that put every position on the same mean.
 *
 * THE TARGET IS THE OLD WORLD MEAN, NOT THE NEW ONE. Equalizing the positions
 * is only half the job: the whole distribution must also stay where it was, or
 * every constant calibrated against OVR silently moves under it (LEAGUE_BASE,
 * GROWTH_DAMPING_START 65, DIVISION_2_REFUSAL_OVR_THRESHOLD 70,
 * PROTECTED_STAR_OVR 80, the wage and valuation curves). So the target is the
 * mean the SHIPPED-BEFORE-THIS-CHANGE formula produced on the same players,
 * reproduced by `legacyOvr` below, and the printed shifts are zero-sum against
 * it by construction.
 *
 * Measured on rostered players only — the free-agent pool is thousands of
 * unsigned nobodies and says nothing about what a player ever sees.
 *
 * Run: npx tsx scripts/positionOvrCalibrate.ts   (SEEDS=n to widen the sample)
 */
import { mulberry32 } from "../src/engine/rng.js";
import { createLeagueState } from "../src/core/leagueState.js";
import { computeOvr, heightScore } from "../src/core/players/ovr.js";
import { OVR_WEIGHTS, type OvrKey } from "../src/core/players/templates.js";
import { POSITIONS, type Player, type Position, type PlayerRatings } from "../src/core/players/types.js";
import { POSITION_OVR_CALIBRATION } from "../src/core/constants.js";

const SEEDS = Number(process.env.SEEDS ?? 3);

/**
 * The formula as it shipped before POSITION_OVR_CALIBRATION: a raw weighted
 * SUM over w/100, with height as a level term and GK's row summing to 92.
 * Kept here so the target mean is reproducible rather than a copied number.
 */
function legacyOvr(pos: Position, ratings: PlayerRatings, heightCm: number): number {
  const weights = OVR_WEIGHTS[pos];
  let sum = 0;
  for (const key of Object.keys(weights) as OvrKey[]) {
    const w = weights[key]!;
    sum += (w / 100) * (key === "height" ? heightScore(heightCm) : ratings[key]);
  }
  return Math.round(sum);
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

const now: Record<Position, number[]> = Object.fromEntries(POSITIONS.map((p) => [p, []])) as never;
const legacy: number[] = [];

for (let s = 0; s < SEEDS; s++) {
  const rng = mulberry32(1 + s);
  const league = createLeagueState(0, rng, 1 + s);
  const rostered = new Set<number>();
  for (const t of league.teams) for (const pid of t.roster) rostered.add(pid);
  const players: Player[] = league.players.filter((p) => rostered.has(p.pid));
  for (const p of players) {
    now[p.pos].push(computeOvr(p.pos, p.ratings, p.heightCm));
    legacy.push(legacyOvr(p.pos, p.ratings, p.heightCm));
  }
}

const target = mean(legacy);
console.log(`sample: ${legacy.length} rostered players over ${SEEDS} seed(s)`);
console.log(`target world mean (legacy formula): ${target.toFixed(2)}\n`);
console.log("pos   n      mean now   shift needed   shift shipped");
for (const pos of POSITIONS) {
  const m = mean(now[pos]);
  const need = target - m;
  console.log(
    `${pos.padEnd(4)} ${String(now[pos].length).padStart(5)} ` +
      `${m.toFixed(2).padStart(10)} ${need.toFixed(2).padStart(14)} ` +
      `${POSITION_OVR_CALIBRATION[pos].toFixed(2).padStart(15)}`,
  );
}

console.log("\npaste into constants.ts (shifts are ON TOP of any already shipped):");
const line = POSITIONS.map(
  (pos) => `${pos}: ${(POSITION_OVR_CALIBRATION[pos] + (target - mean(now[pos]))).toFixed(1)}`,
).join(", ");
console.log(`  { ${line} }`);
