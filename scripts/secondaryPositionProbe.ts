/**
 * Calibrator for SECONDARY_POSITION_CUTOFF (src/core/constants.ts).
 *
 * Secondary positions are derived, not stored: a position adjacent to a
 * player's own is a second job if he is unusually good there *for a player of
 * his position*. This script measures the cutoffs that make "unusually" mean a
 * fixed share of players, and prints the table to paste into constants.ts.
 *
 * WHY NOT A SINGLE OVR GAP. The obvious rule — "adjacent position within N OVR
 * of his own" — cannot work at any N, because the spread of that difference is
 * a property of the position PAIR, not of the player. CM/DM/AM share most of
 * their OVR weighting (shortPass, longPass, positioning, stamina), so almost
 * every midfielder rates close at the neighbouring role; a striker's weighting
 * (finishing 26, positioning 20, longShot 14) overlaps almost nothing, so
 * almost none do. Measured on a generated world, a flat gap gives:
 *
 *     gap |  1 pos |  2 pos |  3 pos | CM versatile | ST versatile
 *     ----+--------+--------+--------+--------------+-------------
 *       0 |  78.1% |  19.6% |   2.3% |          59% |           0%
 *       1 |  65.3% |  27.0% |   7.7% |          86% |           1%
 *       2 |  54.5% |  27.5% |  18.0% |          98% |           3%
 *       3 |  46.1% |  22.6% |  31.4% |         100% |           6%
 *       5 |  30.8% |  18.5% |  50.7% |         100% |          23%
 *
 * There is no row where both columns are sane: every midfielder is a
 * three-position player long before any striker is a two-position one.
 *
 * Ranking each player against his own position's peers removes that entirely —
 * the rate is then whatever we choose, identically for every position, and a
 * badge means "more capable there than the typical player of his position"
 * rather than "plays a position whose weights happen to overlap".
 *
 * Run: npx tsx scripts/secondaryPositionProbe.ts
 */
import { mulberry32 } from "../src/engine/rng.js";
import { createLeagueState } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { simOffseason } from "../src/core/offseason.js";
import { computeOvr } from "../src/core/players/ovr.js";
import { COVERABLE } from "../src/engine/positionFit.js";
import { deriveSecondaries } from "../src/core/players/positions.js";
import { POSITIONS, type Player, type Position } from "../src/core/players/types.js";
import { SECONDARY_POSITION_RATE } from "../src/core/constants.js";

const SEED = Number(process.env.SEED ?? 1);
/** Seasons to age the world by, to check the calibration doesn't drift. */
const SEASONS = Number(process.env.SEASONS ?? 10);
/** Override the shipped rate to sweep it without editing constants. */
const RATE = Number(process.env.RATE ?? SECONDARY_POSITION_RATE);

/**
 * How much better/worse a player rates at `adj` than at his own position.
 *
 * Two comparators, because the choice between them is the whole calibration
 * question. `computeOvr` is a weighted SUM of ratings, so the gap between two
 * positions scales with the player's own quality: halve every rating and the
 * gap halves too. An absolute point cutoff therefore admits far more weak
 * players than strong ones, and since a pool fills up with low-rated free
 * agents and youth over a dynasty, the share of versatile players climbs on its
 * own. A ratio is scale-invariant and should hold.
 */
const deltaAbs = (p: Player, adj: Position): number =>
  computeOvr(adj, p.ratings, p.heightCm) - p.ovr;
const deltaRel = (p: Player, adj: Position): number =>
  p.ovr === 0 ? 0 : (computeOvr(adj, p.ratings, p.heightCm) - p.ovr) / p.ovr;

type Metric = (p: Player, adj: Position) => number;

/** The cutoff that lets exactly `rate` of a position's players through. */
function cutoffs(players: Player[], rate: number, metric: Metric): Map<string, number> {
  const out = new Map<string, number>();
  for (const pos of POSITIONS) {
    const group = players.filter((p) => p.pos === pos);
    for (const adj of COVERABLE[pos]) {
      const ds = group.map((p) => metric(p, adj)).sort((a, b) => b - a);
      // Index of the last player we want to admit.
      const idx = Math.min(ds.length - 1, Math.max(0, Math.floor(ds.length * rate) - 1));
      out.set(`${pos}>${adj}`, ds.length === 0 ? 0 : ds[idx]);
    }
  }
  return out;
}

/** Share of each position's players holding >=1 secondary under a cutoff table. */
function rates(players: Player[], table: Map<string, number>, metric: Metric) {
  const byPos = new Map<Position, { total: number; any: number; counts: number[] }>();
  for (const p of players) {
    const row = byPos.get(p.pos) ?? { total: 0, any: 0, counts: [0, 0, 0, 0] };
    let n = 0;
    for (const adj of COVERABLE[p.pos]) {
      if (metric(p, adj) >= (table.get(`${p.pos}>${adj}`) ?? Infinity)) n++;
    }
    n = Math.min(n, 2); // MAX_SECONDARY_POSITIONS
    row.total++;
    if (n > 0) row.any++;
    row.counts[n]++;
    byPos.set(p.pos, row);
  }
  return byPos;
}

const rng = mulberry32(SEED);
let league = createLeagueState(0, rng, SEED);
const fresh = league.players;
console.log(`world: ${fresh.length} players, seed ${SEED}, target rate ${RATE}\n`);

const VARIANTS: { name: string; metric: Metric; fmt: (n: number) => string }[] = [
  { name: "absolute (ovr points)", metric: deltaAbs, fmt: (n) => `${n}` },
  { name: "relative (share of own ovr)", metric: deltaRel, fmt: (n) => n.toFixed(3) },
];

const tables = VARIANTS.map((v) => cutoffs(fresh, RATE, v.metric));

VARIANTS.forEach((v, i) => {
  console.log(`\n=== ${v.name}: calibrated cutoffs ===`);
  for (const pos of POSITIONS) {
    if (COVERABLE[pos].length === 0) continue;
    const entries = COVERABLE[pos]
      .map((adj) => `${adj}: ${v.fmt(tables[i].get(`${pos}>${adj}`)!)}`)
      .join(", ");
    console.log(`  ${pos}: { ${entries} },`);
  }
});

/**
 * The rate produced by the table actually in constants.ts, as opposed to one
 * recomputed here. This is the number that ships, so it is the one to trust.
 */
function reportShipped(players: Player[]) {
  const counts = [0, 0, 0];
  const byPos = new Map<Position, { total: number; any: number }>();
  for (const p of players) {
    const n = deriveSecondaries(p).length;
    counts[Math.min(n, 2)]++;
    const row = byPos.get(p.pos) ?? { total: 0, any: 0 };
    row.total++;
    if (n > 0) row.any++;
    byPos.set(p.pos, row);
  }
  const total = players.length || 1;
  const line = POSITIONS.map((pos) => {
    const row = byPos.get(pos);
    return `${pos} ${row ? ((100 * row.any) / row.total).toFixed(0) : "0"}%`;
  }).join("  ");
  console.log("  SHIPPED constants");
  console.log(`    1 pos ${((100 * counts[0]) / total).toFixed(1)}%  ` +
    `2 pos ${((100 * counts[1]) / total).toFixed(1)}%  ` +
    `3 pos ${((100 * counts[2]) / total).toFixed(1)}%  ` +
    `(any secondary ${((100 * (total - counts[0])) / total).toFixed(1)}%)`);
  console.log(`    by position: ${line}`);
}

function report(label: string, players: Player[]) {
  console.log(`\n=== ${label} (${players.length} players) ===`);
  if (players.length > 0) reportShipped(players);
  VARIANTS.forEach((v, i) => {
    const r = rates(players, tables[i], v.metric);
    const total = players.length;
    let any = 0;
    const overall = [0, 0, 0];
    for (const [, row] of r) {
      any += row.any;
      for (let j = 0; j < 3; j++) overall[j] += row.counts[j];
    }
    const line = POSITIONS.map((pos) => {
      const row = r.get(pos);
      return `${pos} ${row ? ((100 * row.any) / row.total).toFixed(0) : "0"}%`;
    }).join("  ");
    console.log(`  ${v.name}`);
    console.log(`    1 pos ${((100 * overall[0]) / total).toFixed(1)}%  ` +
      `2 pos ${((100 * overall[1]) / total).toFixed(1)}%  ` +
      `3 pos ${((100 * overall[2]) / total).toFixed(1)}%  ` +
      `(any secondary ${((100 * any) / total).toFixed(1)}%)`);
    console.log(`    by position: ${line}`);
  });
}

/** Pids on a senior squad or in an academy — the players a user actually sees. */
function rosteredPids(l: typeof league): Set<number> {
  const s = new Set<number>();
  for (const t of l.teams) {
    for (const pid of t.roster) s.add(pid);
    for (const pid of t.academyRoster ?? []) s.add(pid);
  }
  return s;
}

/**
 * Split the pool, because the two halves drift for different reasons and only
 * one of them is on screen. A dynasty accumulates unsigned free agents and
 * youth without bound, so a whole-pool rate can move a long way while every
 * squad in the game stays put.
 */
function reportSplit(label: string, l: typeof league) {
  const on = rosteredPids(l);
  report(`${label} — all players`, l.players);
  report(`${label} — rostered only`, l.players.filter((p) => on.has(p.pid)));
  report(`${label} — unrostered only`, l.players.filter((p) => !on.has(p.pid)));
}

reportSplit("fresh world", league);

// The cutoffs are fixed constants but the pool's composition drifts over a
// dynasty (progression, plus an accumulating tail of low-rated free agents and
// youth), so the rate they produce can drift with it. This is the check that
// decides between the two comparators: whichever holds its fresh-world rate
// after a decade is the one that ships.
for (let s = 1; s <= SEASONS; s++) {
  league = simThrough(league, "season", rng);
  league = simOffseason(league, rng);
  // Report at intervals: the shape of the curve is the point. A rate that
  // climbs and then flattens is a new equilibrium and can be calibrated for; one
  // that keeps climbing is unbounded drift and needs a different mechanism.
  if (s % 5 === 0 || s === SEASONS) reportSplit(`after ${s} seasons`, league);
}

// If the rate settles at a new level rather than running away, the fix is to
// calibrate against a mature world instead of a fresh one, so the number is
// right for most of a save's life rather than only its first season. These are
// the cutoffs that would do it.
const aged = cutoffs(league.players, RATE, deltaAbs);
const agedRel = cutoffs(league.players, RATE, deltaRel);
console.log(`\n=== cutoffs recalibrated on the ${SEASONS}-season world ===`);
for (const pos of POSITIONS) {
  if (COVERABLE[pos].length === 0) continue;
  const abs = COVERABLE[pos].map((a) => `${a}: ${aged.get(`${pos}>${a}`)}`).join(", ");
  const rel = COVERABLE[pos].map((a) => `${a}: ${agedRel.get(`${pos}>${a}`)!.toFixed(3)}`).join(", ");
  console.log(`  ${pos}: abs { ${abs} }   rel { ${rel} }`);
}
