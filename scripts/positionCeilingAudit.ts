/**
 * Why does one position produce elite (80+) players and another doesn't?
 *
 * A real save can't answer this cleanly: who reaches 80 there is confounded by
 * minutes, squad selection, survivorship, and now position conversion. This
 * runs the *generation and progression code itself* on a controlled cohort —
 * same base-quality spread, same starting age, same full-minutes assumption for
 * every position — and reports the peak-ovr distribution each position actually
 * produces. That isolates the rating model from every selection effect.
 *
 * What to read:
 *   - **p95/p99 peak ovr and the 80+ rate** — the award-relevant tail. The
 *     Ballon d'Or is decided by the ovr terms, so a position that can't stock
 *     the 80+ tier can't contend however its end product is priced.
 *   - **age at peak** — the mechanism. Physical ratings read BASE_AGE_CURVE
 *     PHYSICAL_AGE_SHIFT years older and technical ones SKILL_AGE_SHIFT years
 *     younger, so a physical-heavy position peaks earlier and has fewer seasons
 *     of compounding growth to build a tail with.
 *   - **conversion rate** — changedPosition runs inside progressPlayer, so a
 *     cohort leaks into other positions as it develops. A position that sheds
 *     its best developers is losing its own tail to the position they became.
 *
 * Deterministic: every player gets his own seeded stream off (position, index),
 * so a rerun reproduces exactly and two positions see the same quality draws.
 *
 * Run: npx tsx scripts/positionCeilingAudit.ts [perPosition] [seed]
 */
import { mulberry32, hashInts } from "../src/engine/rng.js";
import { generatePlayer } from "../src/core/players/generate.js";
import { progressPlayer } from "../src/core/players/progression.js";
import { emptySeasonStats, type Player, type Position } from "../src/core/players/types.js";
import { FULL_SEASON_APPEARANCES } from "../src/core/constants.js";

const PER_POS = Number(process.argv[2] ?? 400);
const SEED = Number(process.argv[3] ?? 7);

const POSITIONS: Position[] = ["GK", "CB", "FB", "DM", "CM", "AM", "W", "ST"];
const START_AGE = 18;
const END_AGE = 34;
/** Spread of generation base quality, so each cohort spans ordinary to outstanding. */
const BASES = [46, 50, 54, 58, 62];

interface Career {
  peak: number;
  peakAge: number;
  startPos: Position;
  endPos: Position;
  byAge: Map<number, number>;
}

function pct(xs: number[], f: number): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(f * s.length))];
}
const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

/** One player generated at START_AGE and progressed to END_AGE as an ever-present starter. */
function simulateCareer(pos: Position, index: number): Career {
  const rng = mulberry32(hashInts(SEED, POSITIONS.indexOf(pos), index));
  const base = BASES[index % BASES.length];
  let p: Player = generatePlayer(rng, pos, base, index, START_AGE, 0);

  const byAge = new Map<number, number>();
  let peak = p.ovr;
  let peakAge = START_AGE;
  byAge.set(START_AGE, p.ovr);

  for (let age = START_AGE; age < END_AGE; age++) {
    const season = age - START_AGE;
    // progressPlayer reads last season's appearances for its minutes factor;
    // give every position a full season so playing time can't be the variable.
    p = {
      ...p,
      stats: [{ ...emptySeasonStats(season, 0), appearances: FULL_SEASON_APPEARANCES }],
    };
    p = progressPlayer(rng, p, season);
    const nextAge = age + 1;
    byAge.set(nextAge, p.ovr);
    if (p.ovr > peak) {
      peak = p.ovr;
      peakAge = nextAge;
    }
  }
  return { peak, peakAge, startPos: pos, endPos: p.pos, byAge };
}

const careers = new Map<Position, Career[]>();
for (const pos of POSITIONS) {
  const list: Career[] = [];
  for (let i = 0; i < PER_POS; i++) list.push(simulateCareer(pos, i));
  careers.set(pos, list);
}

console.log(`Controlled career cohorts: ${PER_POS} per position, generated at age ${START_AGE}, `
  + `progressed to ${END_AGE} on full minutes, seed ${SEED}.\n`);

console.log("PEAK OVR REACHED (the award-relevant tail)");
console.log("pos    mean    p50    p90    p95    p99    max   >=80    >=78");
for (const pos of POSITIONS) {
  const cs = careers.get(pos)!;
  const peaks = cs.map((c) => c.peak);
  const rate = (t: number) => `${((100 * peaks.filter((x) => x >= t).length) / peaks.length).toFixed(1)}%`;
  console.log(
    `  ${pos.padEnd(3)} ${mean(peaks).toFixed(1).padStart(6)} ${String(pct(peaks, 0.5)).padStart(6)}`
    + ` ${String(pct(peaks, 0.9)).padStart(6)} ${String(pct(peaks, 0.95)).padStart(6)}`
    + ` ${String(pct(peaks, 0.99)).padStart(6)} ${String(Math.max(...peaks)).padStart(6)}`
    + ` ${rate(80).padStart(6)} ${rate(78).padStart(7)}`,
  );
}

console.log("\nAGE AT PEAK (why the tail is the size it is)");
console.log("pos    mean   p50");
for (const pos of POSITIONS) {
  const ages = careers.get(pos)!.map((c) => c.peakAge);
  console.log(`  ${pos.padEnd(3)} ${mean(ages).toFixed(1).padStart(6)} ${String(pct(ages, 0.5)).padStart(5)}`);
}

console.log("\nMEAN OVR BY AGE");
const ages = [18, 20, 22, 24, 26, 28, 30, 32, 34];
console.log("pos  " + ages.map((a) => String(a).padStart(6)).join(""));
for (const pos of POSITIONS) {
  const cs = careers.get(pos)!;
  console.log(`  ${pos.padEnd(3)}` + ages.map((a) => {
    const xs = cs.map((c) => c.byAge.get(a)).filter((x): x is number => x !== undefined);
    return mean(xs).toFixed(1).padStart(6);
  }).join(""));
}

console.log("\nPOSITION CONVERSION (changedPosition runs inside progressPlayer)");
for (const pos of POSITIONS) {
  const cs = careers.get(pos)!;
  const moved = cs.filter((c) => c.endPos !== c.startPos);
  const to = new Map<Position, number>();
  for (const c of moved) to.set(c.endPos, (to.get(c.endPos) ?? 0) + 1);
  const detail = [...to].sort((a, b) => b[1] - a[1]).map(([p, n]) => `${p} ${n}`).join(", ");
  console.log(`  ${pos.padEnd(3)} ${((100 * moved.length) / cs.length).toFixed(1).padStart(5)}% converted`
    + (detail ? `  -> ${detail}` : ""));
}
