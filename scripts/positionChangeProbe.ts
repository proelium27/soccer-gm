/**
 * Calibrator for career position changes (PR 3 of the multi-position series).
 *
 * A player's listed position is fixed at generation and never moves. This
 * measures what would happen if it could, BEFORE any rule is written, because
 * the three ways this feature can go wrong are all measurable up front:
 *
 *  1. INFLATION. `ovr` is position-relative (`computeOvr` weights the same 14
 *     skills differently per position), so moving a player to a position he
 *     rates higher at raises his OVR *by construction*. Wages are cubic in ovr
 *     and transfer value steeper still, so a wave of conversions is not just a
 *     cosmetic relabel — it is money. The anti-inflation equilibrium is fragile
 *     and several mechanics exist only to hold it, so the OVR gained per season
 *     is the number that decides whether this ships at all.
 *
 *  2. POSITION MIX. COVERABLE is asymmetric and the OVR weight rows differ, so
 *     conversions need not flow evenly. If they drain one position (a winger can
 *     become a full-back, a full-back cannot become a winger's neighbour the
 *     same way) the world stops being able to field a formation, and
 *     ROSTER_COMPOSITION quietly stops being satisfiable.
 *
 *  3. FLIP-FLOP. If the rule is "play wherever you rate highest", per-season
 *     rating noise will walk a borderline player back and forth every offseason.
 *     The share of players whose best position changes year to year is what sets
 *     how much hysteresis (margin, or a sustained-gap requirement) is needed.
 *
 * Run: npx tsx scripts/positionChangeProbe.ts
 */
import { mulberry32 } from "../src/engine/rng.js";
import { createLeagueState } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { simOffseason } from "../src/core/offseason.js";
import { computeOvr } from "../src/core/players/ovr.js";
import { ageOf } from "../src/core/players/progression.js";
import { COVERABLE } from "../src/engine/positionFit.js";
import { POSITIONS, type Player, type Position } from "../src/core/players/types.js";
import { ROSTER_COMPOSITION } from "../src/core/constants.js";

const SEED = Number(process.env.SEED ?? 1);
const SEASONS = Number(process.env.SEASONS ?? 10);

/** His best coverable position and what it would gain him, or null if he's already there. */
function best(p: Player): { pos: Position; gain: number } | null {
  let out: { pos: Position; gain: number } | null = null;
  for (const pos of COVERABLE[p.pos]) {
    const gain = computeOvr(pos, p.ratings, p.heightCm) - p.ovr;
    if (!out || gain > out.gain) out = { pos, gain };
  }
  return out && out.gain > 0 ? out : null;
}

/** Pids on a senior squad or in an academy — the players a user actually sees. */
function rosteredPids(l: { teams: { roster: number[]; academyRoster?: number[] }[] }): Set<number> {
  const s = new Set<number>();
  for (const t of l.teams) {
    for (const pid of t.roster) s.add(pid);
    for (const pid of t.academyRoster ?? []) s.add(pid);
  }
  return s;
}

const pct = (n: number, d: number) => (d === 0 ? "0.0" : ((100 * n) / d).toFixed(1));

/**
 * (1) How mis-listed is the world, and (2) where would conversions flow?
 *
 * Reported at several margins at once, since the margin IS the design decision:
 * a margin of 0 is "always play your best position" and anything higher trades
 * conversions for stability.
 */
const MARGINS = [0, 1, 2, 3, 4, 5, 6, 8];

function report(label: string, players: Player[], season: number) {
  console.log(`\n=== ${label} (${players.length} players) ===`);

  // --- 1. gap distribution + OVR that conversion would create -------------
  console.log("  margin | converts |  ovr gained  | mean gain | median age");
  for (const m of MARGINS) {
    const hits = players
      .map((p) => ({ p, b: best(p) }))
      .filter((r): r is { p: Player; b: { pos: Position; gain: number } } =>
        r.b !== null && r.b.gain >= m);
    const gained = hits.reduce((a, r) => a + r.b.gain, 0);
    const ages = hits.map((r) => ageOf(r.p, season)).sort((a, b) => a - b);
    console.log(
      `  ${String(m).padStart(6)} | ${pct(hits.length, players.length).padStart(7)}% |` +
        ` ${gained.toFixed(0).padStart(8)} ovr |` +
        ` ${(hits.length ? gained / hits.length : 0).toFixed(2).padStart(9)} |` +
        ` ${String(ages.length ? ages[Math.floor(ages.length / 2)] : 0).padStart(10)}`,
    );
  }

  // --- 2. does the gap grow with age? -------------------------------------
  // The intuition this feature rests on is that physicals decline first
  // (PHYSICAL_KEYS in progression.ts), so pace-hungry roles get relatively
  // worse as a player ages and deeper roles get relatively better. If that is
  // real, the mean best-gain should rise with age. If it doesn't, position
  // changes are a youth phenomenon and the rule should say so.
  const bands: [string, number, number][] = [
    ["<=20", 0, 20], ["21-24", 21, 24], ["25-28", 25, 28],
    ["29-32", 29, 32], ["33+", 33, 99],
  ];
  const ageLine = bands.map(([name, lo, hi]) => {
    const g = players.filter((p) => {
      const a = ageOf(p, season);
      return a >= lo && a <= hi;
    });
    const gains = g.map((p) => best(p)?.gain ?? 0);
    const mean = gains.length ? gains.reduce((a, b) => a + b, 0) / gains.length : 0;
    return `${name} ${mean.toFixed(2)}`;
  }).join("  ");
  console.log(`  mean best-gain by age: ${ageLine}`);

  // --- 3. position mix, now vs if everyone moved to their best -------------
  const now = new Map<Position, number>();
  const after = new Map<Position, number>();
  for (const p of players) {
    now.set(p.pos, (now.get(p.pos) ?? 0) + 1);
    const b = best(p);
    // At margin 3, a middling bar, to show the direction of flow.
    const to = b && b.gain >= 3 ? b.pos : p.pos;
    after.set(to, (after.get(to) ?? 0) + 1);
  }
  const targetTotal = POSITIONS.reduce((a, pos) => a + (ROSTER_COMPOSITION[pos] ?? 0), 0);
  console.log("  position mix (share of pool, vs ROSTER_COMPOSITION target):");
  console.log(
    "    " +
      POSITIONS.map((pos) => {
        const target = (100 * (ROSTER_COMPOSITION[pos] ?? 0)) / targetTotal;
        return `${pos} ${pct(now.get(pos) ?? 0, players.length)}→${pct(after.get(pos) ?? 0, players.length)}` +
          `(want ${target.toFixed(1)})`;
      }).join("  "),
  );
}

const rng = mulberry32(SEED);
let league = createLeagueState(0, rng, SEED);
console.log(`world: ${league.players.length} players, seed ${SEED}`);

const on0 = rosteredPids(league);
report("fresh world — all players", league.players, league.season);
report("fresh world — rostered only", league.players.filter((p) => on0.has(p.pid)), league.season);

/**
 * (3) Flip-flop: how often does a player's best position change season to
 * season? Tracked on the ROSTERED pool, since that is where instability would
 * actually be visible to a user, and only for players present in both samples.
 */
let prevBest = new Map<number, Position | null>();
for (const p of league.players) prevBest.set(p.pid, best(p)?.pos ?? null);

for (let s = 1; s <= SEASONS; s++) {
  league = simThrough(league, "season", rng);
  league = simOffseason(league, rng);

  const on = rosteredPids(league);
  const rostered = league.players.filter((p) => on.has(p.pid));
  let seen = 0;
  let moved = 0;
  const nextBest = new Map<number, Position | null>();
  for (const p of league.players) {
    const b = best(p)?.pos ?? null;
    nextBest.set(p.pid, b);
    if (!on.has(p.pid)) continue;
    if (!prevBest.has(p.pid)) continue;
    seen++;
    if (prevBest.get(p.pid) !== b) moved++;
  }
  prevBest = nextBest;
  console.log(
    `\n[season ${s}] best-position churn among rostered players seen last season: ` +
      `${pct(moved, seen)}% (${moved}/${seen})`,
  );

  if (s % 5 === 0 || s === SEASONS) {
    report(`after ${s} seasons — all players`, league.players, league.season);
    report(`after ${s} seasons — rostered only`, rostered, league.season);
  }
}
