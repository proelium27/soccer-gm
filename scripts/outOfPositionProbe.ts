/**
 * Task 0 for slot-aware composites: how often does a starter actually line up
 * somewhere other than his natural position?
 *
 * The answer sets the stakes for the familiarity penalty. If out-of-position
 * starts are a rounding error, the penalty's exact size barely matters; if
 * they're common, calibration is the whole job.
 *
 * Samples every team's resolved XI on every matchday of a season (so
 * injury-depleted squads are counted as they actually happen), and separately
 * reports how often the bench has no natural cover for an on-pitch slot — an
 * upper bound on how much the in-match sub path adds.
 */
import { mulberry32 } from "../src/engine/rng.js";
import { createLeagueState } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { resolveXI } from "../src/core/lineup/resolveXI.js";
import { teamSlots } from "../src/core/lineup/formations.js";
import { BENCH_SIZE } from "../src/core/constants.js";
import type { Player, Position } from "../src/core/players/types.js";

/** Mirrors the private table in core/lineup/selectXI.ts. */
const ADJACENCY: Record<Position, Position[]> = {
  GK: [],
  CB: ["DM", "FB"],
  FB: ["W", "CB", "DM"],
  DM: ["CM", "CB"],
  CM: ["DM", "AM"],
  AM: ["CM", "W"],
  W: ["AM", "FB", "ST"],
  ST: ["W", "AM"],
};

const SEEDS = [1, 2, 3];
const USER_TID = 0;

type Tally = { exact: number; adjacent: number; foreign: number };
const blank = (): Tally => ({ exact: 0, adjacent: 0, foreign: 0 });
const total = (t: Tally) => t.exact + t.adjacent + t.foreign;
const pct = (n: number, d: number) => (d === 0 ? 0 : (100 * n) / d);

function show(label: string, t: Tally): void {
  const n = total(t);
  console.log(
    `  ${label.padEnd(22)} n=${String(n).padStart(7)}  ` +
      `exact ${pct(t.exact, n).toFixed(2).padStart(6)}%  ` +
      `adjacent ${pct(t.adjacent, n).toFixed(2).padStart(6)}%  ` +
      `foreign ${pct(t.foreign, n).toFixed(2).padStart(6)}%`,
  );
}

const ai = blank();
const user = blank();
/** Slots on the pitch whose position has no natural cover left on the bench. */
let slotsWithBenchCover = 0;
let slotsWithoutBenchCover = 0;
/** Per-position foreign counts, to see which slots actually get improvised. */
const foreignBySlot = new Map<Position, number>();
const startsBySlot = new Map<Position, number>();

for (const seed of SEEDS) {
  const rng = mulberry32(seed);
  let league = createLeagueState(USER_TID, rng);

  for (let matchday = 1; matchday <= 38; matchday++) {
    const byPid = new Map<number, Player>(league.players.map((p) => [p.pid, p]));

    for (const t of league.teams) {
      const roster = t.roster.map((pid) => byPid.get(pid)!).filter((p) => p && !p.injury);
      if (roster.length < 11) continue;
      const slots = teamSlots(t);
      const xi = resolveXI(roster, slots, t.starters);
      const xiPids = new Set(xi.map((p) => p.pid));
      const bench = roster
        .filter((p) => !xiPids.has(p.pid))
        .sort((a, b) => b.ovr - a.ovr)
        .slice(0, BENCH_SIZE);
      const benchPos = new Set(bench.map((p) => p.pos));

      const tally = t.tid === USER_TID ? user : ai;
      xi.forEach((p, i) => {
        const slot = slots[i];
        startsBySlot.set(slot, (startsBySlot.get(slot) ?? 0) + 1);
        if (p.pos === slot) tally.exact++;
        else if (ADJACENCY[slot].includes(p.pos)) tally.adjacent++;
        else {
          tally.foreign++;
          foreignBySlot.set(slot, (foreignBySlot.get(slot) ?? 0) + 1);
        }

        // Sub-path upper bound: if this slot needed replacing right now, would
        // the bench hold a natural fit? (GK slots are never subbed in practice.)
        if (slot !== "GK") {
          if (benchPos.has(slot)) slotsWithBenchCover++;
          else slotsWithoutBenchCover++;
        }
      });
    }

    league = simThrough(league, "game", rng);
    if (league.phase !== "regular") break;
  }
}

console.log(`\nStarter slot vs natural position, ${SEEDS.length} seeds x 1 season, all competitions:`);
show("AI clubs", ai);
show("user club (unmanaged)", user);

const coverN = slotsWithBenchCover + slotsWithoutBenchCover;
console.log(
  `\nBench cover for on-pitch outfield slots: ` +
    `${pct(slotsWithoutBenchCover, coverN).toFixed(2)}% of slots have no natural cover on the bench ` +
    `(upper bound on what the sub path adds; n=${coverN})`,
);

console.log(`\nForeign starts by slot (which slots actually get improvised):`);
const rows = [...startsBySlot.entries()].sort((a, b) => (foreignBySlot.get(b[0]) ?? 0) - (foreignBySlot.get(a[0]) ?? 0));
for (const [slot, starts] of rows) {
  const f = foreignBySlot.get(slot) ?? 0;
  if (f === 0) continue;
  console.log(`  ${slot.padEnd(4)} ${String(f).padStart(6)} foreign / ${String(starts).padStart(7)} starts  (${pct(f, starts).toFixed(2)}%)`);
}
