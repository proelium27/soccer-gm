/**
 * What the AI actually picks, once a shape is added to FORMATIONS.
 *
 * chooseBestFormation maximizes the summed OVR of the XI a shape can field, so
 * adding shapes is not neutral: a shape whose slots happen to match how squads
 * are stocked (ROSTER_COMPOSITION) can win almost everywhere and quietly make
 * every club play the same way. This prints the league-wide spread over the
 * full id list against the spread over a restricted list, so the "before" and
 * "after" are measured on the *same* squads rather than two different worlds.
 *
 *   npx tsx scripts/formationSpreadProbe.ts [seasons] [seed]
 */
import { createLeagueState } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { simOffseason } from "../src/core/offseason.js";
import { mulberry32 } from "../src/engine/rng.js";
import { FORMATIONS, FORMATION_IDS, type FormationId } from "../src/core/lineup/formations.js";
import { selectXI } from "../src/core/lineup/selectXI.js";
import { ovrAtSlot } from "../src/core/players/positions.js";
import type { Player } from "../src/core/players/types.js";

const SEASONS = Number(process.argv[2] ?? 3);
const SEED = Number(process.argv[3] ?? 1);

/** The nine shapes that shipped before this probe existed. */
const LEGACY: FormationId[] = [
  "4-3-3", "4-4-2", "3-5-2", "5-3-2", "4-2-3-1", "4-5-1", "3-4-3", "5-4-1", "4-3-1-2",
];

/** chooseBestFormation, but over an arbitrary candidate list. Same tie rule (first wins). */
function bestOf(roster: Player[], ids: readonly FormationId[]): { id: FormationId; score: number } {
  let best = ids[0];
  let bestScore = -Infinity;
  for (const id of ids) {
    const score = selectXI(roster, FORMATIONS[id]).reduce((s, p) => s + p.ovr, 0);
    if (score > bestScore) {
      bestScore = score;
      best = id;
    }
  }
  return { id: best, score: bestScore };
}

const rng = mulberry32(SEED);
let league = createLeagueState(0, rng);
for (let s = 1; s < SEASONS; s++) {
  league = simThrough(league, "season", rng);
  league = simOffseason(league, rng);
}

const byPid = new Map(league.players.map((p) => [p.pid, p]));
const rosters = league.teams
  .filter((t) => t.tid !== league.meta.userTid) // the user's club is unmanaged in headless runs
  .map((t) => t.roster.map((pid) => byPid.get(pid)!).filter(Boolean));

const tally = (ids: readonly FormationId[]) => {
  const counts = new Map<FormationId, number>();
  let total = 0;
  for (const roster of rosters) {
    const { id } = bestOf(roster, ids);
    counts.set(id, (counts.get(id) ?? 0) + 1);
    total += 1;
  }
  return { counts, total };
};

const before = tally(LEGACY);
const after = tally(FORMATION_IDS);

// How much XI quality the wider list actually unlocks, per club — measured two
// ways, because they can disagree. chooseBestFormation ranks shapes by RAW ovr,
// but the match rolls up composites with an out-of-position penalty, so a shape
// can win the pick by fielding a strong player in a slot he's foreign to and
// then play worse than the shape it beat. More shapes means more chances for
// that gap to bite, so the slot-adjusted figure is the one that matters.
const adjusted = (roster: Player[], id: FormationId) => {
  const slots = FORMATIONS[id];
  return selectXI(roster, slots).reduce((s, p, i) => s + ovrAtSlot(p, slots[i] ?? p.pos), 0);
};

let gain = 0;
let adjGain = 0;
let adjWorse = 0;
let switched = 0;
for (const roster of rosters) {
  const b = bestOf(roster, LEGACY);
  const a = bestOf(roster, FORMATION_IDS);
  gain += a.score - b.score;
  const d = adjusted(roster, a.id) - adjusted(roster, b.id);
  adjGain += d;
  if (d < 0) adjWorse += 1;
  if (a.id !== b.id) switched += 1;
}

const pct = (n: number, total: number) => `${((100 * n) / total).toFixed(1)}%`;
const line = (id: FormationId) =>
  `  ${id.padEnd(9)} ${String(before.counts.get(id) ?? 0).padStart(4)} ${pct(before.counts.get(id) ?? 0, before.total).padStart(6)}` +
  `   →  ${String(after.counts.get(id) ?? 0).padStart(4)} ${pct(after.counts.get(id) ?? 0, after.total).padStart(6)}`;

console.log(`world: ${rosters.length} AI clubs, season ${league.season}, seed ${SEED}`);
console.log(`\n  shape        legacy-9 pick        full-list pick`);
for (const id of FORMATION_IDS) console.log(line(id));
console.log(`\n  distinct shapes in use: ${before.counts.size} → ${after.counts.size}`);
console.log(`  most common share:      ${pct(Math.max(...before.counts.values()), before.total)} → ${pct(Math.max(...after.counts.values()), after.total)}`);
console.log(`  clubs that switch shape: ${switched} (${pct(switched, rosters.length)})`);
console.log(`  mean XI ovr gained:      ${(gain / rosters.length / 11).toFixed(3)} per starter (raw, what the picker ranks on)`);
console.log(`  slot-adjusted gained:    ${(adjGain / rosters.length / 11).toFixed(3)} per starter (what the match actually uses)`);
console.log(`  clubs left worse off:    ${adjWorse} (${pct(adjWorse, rosters.length)}) — picked a shape that plays worse than its legacy pick`);
