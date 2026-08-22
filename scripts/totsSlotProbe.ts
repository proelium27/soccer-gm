/**
 * Does the Team of the Season XI have room for the players who win Player of
 * the Season?
 *
 * The Team of the Season is picked by walking a fixed slot list and taking the
 * best player whose position is an EXACT match for each slot. The shipped list
 * is FORMATIONS["4-3-3"], which contains no AM slot at all — so an attacking
 * midfielder can win Player of the Season and be structurally ineligible for
 * the Team of the Season the same year. This measures how often that bites,
 * and what alternative slot lists would do about it.
 *
 * Reported per variant: how often the POTY winner appears in the XI, how many
 * slots went unfilled, and which positions the remaining misses are at.
 *
 *   npx tsx scripts/totsSlotProbe.ts
 *   SEASONS=8 SEEDS=1,2,3 npx tsx scripts/totsSlotProbe.ts
 *
 * TWO measurement traps, both hit for real while this was written:
 *
 *  - The numbers move with award *tuning*, not just with the slot list.
 *    positionGroup() decides which weight column a position is paid under, so
 *    regrouping AM (as 2026-08-14 did, MID -> FWD) changes how often an AM wins
 *    POTY at all. Re-run this rather than quoting an old figure, and re-run it
 *    on origin/main rather than a stale checkout.
 *
 *  - The baseline row is only a baseline on an UNMODIFIED tree. `teamOfSeason`
 *    feeds `isProtectedStar`, so the shipped slot list decides which players are
 *    unbuyable, which moves the transfer market, which changes the world the
 *    next season is played in. Rows *within* one run share their worlds and are
 *    comparable to each other; the "shipped" row from a tree that already
 *    carries a slot-list change is NOT comparable to one from before it.
 */
import { mulberry32 } from "../src/engine/rng.js";
import { createLeagueState } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { simOffseason } from "../src/core/offseason.js";
import { potyScore, totsScore, statsFor } from "../src/core/awards.js";
import { AWARD_MIN_APPEARANCES, AWARD_OVR_WEIGHT } from "../src/core/constants.js";
import { fitTier } from "../src/engine/positionFit.js";
import { POSITION_ADJACENT_PENALTY } from "../src/engine/constants.js";
import { secondaryPositions } from "../src/core/players/positions.js";
import type { Player, Position, SeasonStats } from "../src/core/players/types.js";

const SEASONS = Number(process.env.SEASONS ?? 6);
const SEEDS = (process.env.SEEDS ?? "1,2").split(",").map(Number);

const SHIPPED: Position[] = ["GK", "CB", "CB", "FB", "FB", "DM", "CM", "CM", "W", "W", "ST"];

/**
 * Slot list plus how a player becomes eligible for a slot.
 *
 *  - "exact"       his listed position IS the slot (what ships).
 *  - "adjacency"   any position the engine's ADJACENCY table says can cover the
 *                  slot, at a familiarity penalty. UNGATED: every centre-back
 *                  is eligible at full-back.
 *  - "secondary"   he has that slot as a real secondary position
 *                  (`secondaryPositions`, per-player and gated on his own
 *                  rating at that slot), so no penalty — the game's own
 *                  versatility model rather than a flat table.
 *
 * The last two rows are here so the comparison stays reproducible, not because
 * either is a candidate. See the note printed at the end.
 */
type Fit = "exact" | "adjacency" | "secondary";
const VARIANTS: Record<string, { slots: Position[]; fit?: Fit }> = {
  "4-3-3 DM-CM-CM (shipped)": { slots: SHIPPED },
  "4-3-3 DM-CM-AM         ": { slots: ["GK", "CB", "CB", "FB", "FB", "DM", "CM", "AM", "W", "W", "ST"] },
  "4-2-3-1                ": { slots: ["GK", "CB", "CB", "FB", "FB", "DM", "DM", "W", "AM", "W", "ST"] },
  "shipped + adjacency    ": { slots: SHIPPED, fit: "adjacency" },
  "shipped + secondaries  ": { slots: SHIPPED, fit: "secondary" },
};

/** 6 ovr points of unfamiliarity, converted into award-score units. */
const ADJ_PENALTY = POSITION_ADJACENT_PENALTY * AWARD_OVR_WEIGHT;

type Entry = { player: Player; stats: SeasonStats };

/** The shipped pickTeamOfSeason, parameterised by slot list and fit rule. */
function pickXI(
  entries: Entry[], slots: Position[], season: number, fit: Fit,
): (number | null)[] {
  const used = new Set<number>();
  return slots.map((slot) => {
    let best: Entry | null = null;
    let bestScore = -Infinity;
    for (const e of entries) {
      if (used.has(e.player.pid)) continue;
      let penalty = 0;
      if (e.player.pos !== slot) {
        if (fit === "exact") continue;
        if (fit === "secondary") {
          // A real secondary waives the familiarity penalty outright, which is
          // exactly what the badge means, so there is nothing to subtract.
          if (!secondaryPositions(e.player).includes(slot)) continue;
        } else {
          if (fitTier(slot as never, e.player.pos as never) !== 1) continue;
          penalty = ADJ_PENALTY;
        }
      }
      const qualifies = e.stats.appearances >= AWARD_MIN_APPEARANCES;
      const score = (qualifies ? 1000 : 0) + totsScore(e.player, e.stats, season) - penalty;
      if (score > bestScore) { best = e; bestScore = score; }
    }
    if (!best) return null;
    used.add(best.player.pid);
    return best.player.pid;
  });
}

function pickPoty(entries: Entry[], season: number): number | null {
  const qualified = entries.filter((e) => e.stats.appearances >= AWARD_MIN_APPEARANCES);
  const pool = qualified.length > 0 ? qualified : entries;
  if (pool.length === 0) return null;
  let best = pool[0];
  let bestScore = potyScore(best.player, best.stats, season);
  for (const e of pool.slice(1)) {
    const score = potyScore(e.player, e.stats, season);
    if (score > bestScore) { best = e; bestScore = score; }
  }
  return best.player.pid;
}

const acc: Record<string, {
  total: number; made: number; empty: number;
  miss: Map<string, number>; xiPos: Map<string, number>; slots: number;
}> = {};
for (const k of Object.keys(VARIANTS)) {
  acc[k] = { total: 0, made: 0, empty: 0, miss: new Map(), xiPos: new Map(), slots: 0 };
}
const potyByPos = new Map<string, number>();

for (const seed of SEEDS) {
  const rng = mulberry32(seed);
  let league = createLeagueState(0, rng);
  for (let s = 0; s < SEASONS; s++) {
    league = simThrough(league, "season", rng);
    league = simOffseason(league, rng);
    const entry = league.seasonHistory.at(-1)!;
    const byPid = new Map(league.players.map((p) => [p.pid, p]));

    // Group by competition off the season's own tid->comp snapshot, so every
    // variant is scored against identical pools.
    const byComp = new Map<number, Entry[]>();
    for (const p of league.players) {
      const st = statsFor(p, entry.season);
      if (!st || st.appearances === 0) continue;
      const compId = entry.compsByTid[st.tid];
      if (compId === undefined) continue;
      if (!byComp.has(compId)) byComp.set(compId, []);
      byComp.get(compId)!.push({ player: p, stats: st });
    }

    for (const entries of byComp.values()) {
      const poty = pickPoty(entries, entry.season);
      if (poty === null) continue;
      const potyPos = byPid.get(poty)?.pos ?? "?";
      potyByPos.set(potyPos, (potyByPos.get(potyPos) ?? 0) + 1);
      for (const [name, v] of Object.entries(VARIANTS)) {
        const xi = pickXI(entries, v.slots, entry.season, v.fit ?? "exact");
        const a = acc[name];
        a.total++;
        a.empty += xi.filter((x) => x === null).length;
        if (xi.includes(poty)) a.made++;
        else a.miss.set(potyPos, (a.miss.get(potyPos) ?? 0) + 1);
        for (const pid of xi) {
          a.slots++;
          if (pid === null) continue;
          const pos = byPid.get(pid)!.pos;
          a.xiPos.set(pos, (a.xiPos.get(pos) ?? 0) + 1);
        }
      }
    }
  }
}

const totalPoty = [...potyByPos.values()].reduce((a, b) => a + b, 0);
console.log(`\n${SEEDS.length} seed(s) x ${SEASONS} seasons`);
console.log(`\nPOTY winners by position: ${[...potyByPos].sort((a, b) => b[1] - a[1])
  .map(([p, n]) => `${p} ${n} (${((100 * n) / totalPoty).toFixed(0)}%)`).join("  ")}`);
console.log("\nslot list                   POTY in XI        unfilled   misses");
for (const [name, a] of Object.entries(acc)) {
  const miss = [...a.miss].sort((x, y) => y[1] - x[1]).map(([p, n]) => `${p} ${n}`).join("  ") || "none";
  console.log(`${name}  ${String(a.made).padStart(4)}/${a.total} (${((100 * a.made) / a.total).toFixed(1)}%)` +
    `   ${String(a.empty).padStart(6)}     ${miss}`);
}

console.log("\nXI composition (what the selection rule actually fields)");
for (const [name, a] of Object.entries(acc)) {
  console.log(`${name}  ${[...a.xiPos].sort((x, y) => y[1] - x[1])
    .map(([p, n]) => `${p} ${((100 * n) / a.slots).toFixed(1)}%`).join("  ")}`);
}
console.log(
  `\nadjacency penalty ${ADJ_PENALTY.toFixed(2)} award pts` +
  ` (${POSITION_ADJACENT_PENALTY} ovr x ${AWARD_OVR_WEIGHT}).` +
  "\nWatch the last two rows' composition, not just their POTY rate: totsScore is a" +
  "\nWITHIN-position statistic (defenders' tackles/interceptions are weighted 0.03" +
  "\nagainst a forward's 0.01, on stats they collect in far greater volume), so once" +
  "\nslots stop requiring an exact match the XI fills up with centre-backs. Exact" +
  "\nmatching is what keeps the formula valid.",
);
