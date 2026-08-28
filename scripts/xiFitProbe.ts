/**
 * Is the starting XI the strongest eleven the club could field?
 *
 * The instrument behind the `slotValue` selection rule (see selectXI). It asks
 * one question of every tier-1 AI club, in the sim's own currency: for each slot,
 * is anyone worth more there than the man in it? "Worth" is `slotValue` — his
 * rating AT that job less the familiarity penalty the composite rollup charges
 * him — because that is the number the match actually scores, and a picker
 * optimizing anything else fields a side the sim then marks down.
 *
 * Two measures, and they catch different faults:
 *
 *  - **Bench upgrades.** A slot whose starter a substitute would beat outright.
 *    This is the fault that shipped: ranking fit tier above rating made any
 *    natural full-back beat every non-full-back for a full-back slot however
 *    wide the gap. Measured on `origin/main` at season 8 it was 16.9% of slots
 *    across 77% of clubs, mean 15.1 points, worst case a 39-rated full-back
 *    starting with a 67-rated midfielder benched.
 *  - **Starter swaps.** Two starters each worth more in the other's slot. Greedy
 *    assignment alone leaves these (113 pairs / 705 points when measured), which
 *    is why selection finishes with a local-search pass.
 *
 * Both should read ZERO. They are a property of the picker, not of the squads,
 * so any non-zero result is a selection bug rather than a tuning question — run
 * it after touching selectXI, familiarityPenalty, ovrAtSlot or the secondary
 * position derivation.
 *
 * Also prints starter OVR by slot, which is the player-visible symptom: the
 * complaint that started this was "there's no reason teams in D1 should be
 * having 40 rated full backs".
 *
 *   npx tsx scripts/xiFitProbe.ts            # 8 seasons, seed 1
 *   SEASONS=20 SEED=3 npx tsx scripts/xiFitProbe.ts
 */
import { mulberry32 } from "../src/engine/rng.js";
import { createLeagueState } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { simOffseason } from "../src/core/offseason.js";
import { resolveXI } from "../src/core/lineup/resolveXI.js";
import { teamSlots } from "../src/core/lineup/formations.js";
import { slotValue } from "../src/core/players/positions.js";
import { POSITIONS } from "../src/core/players/types.js";
import type { Player, Position } from "../src/core/players/types.js";

const SEASONS = Number(process.env.SEASONS ?? 8);
const SEED = Number(process.env.SEED ?? 1);
const USER_TID = 0;

const rng = mulberry32(SEED);
let league = createLeagueState(USER_TID, rng);
for (let s = 1; s <= SEASONS; s++) {
  league = simThrough(league, "season", rng);
  league = simOffseason(league, rng);
  process.stderr.write(`season ${s}\n`);
}

const byPid = new Map(league.players.map((p) => [p.pid, p]));
// The user's club is unmanaged in a headless run and produces every worst case,
// so it is excluded here rather than allowed to set the numbers (see CLAUDE.md).
const clubs = league.teams.filter(
  (t) => t.tid !== USER_TID
    && league.competitions.find((c) => c.id === t.compId)!.tier === 1,
);

const ovrBySlot = new Map<Position, number[]>();
const gainBySlot = new Map<Position, number[]>();
let slots = 0, benchUpgrades = 0, benchPoints = 0;
let starterSwaps = 0, swapPoints = 0;
let clubsAffected = 0, weakStarters = 0;
let worst = { gain: 0, line: "none" };
const push = (m: Map<Position, number[]>, k: Position, v: number) => {
  const a = m.get(k) ?? [];
  a.push(v);
  m.set(k, a);
};

for (const t of clubs) {
  const roster = t.roster.map((pid) => byPid.get(pid)!).filter(Boolean) as Player[];
  const shape = teamSlots(t) as Position[];
  const xi = resolveXI(roster, shape, t.starters);
  const started = new Set(xi.map((p) => p.pid));
  const bench = roster.filter((p) => !started.has(p.pid));
  let affected = false;

  xi.forEach((p, i) => {
    slots++;
    push(ovrBySlot, shape[i], p.ovr);
    if (p.ovr < 50) weakStarters++;
    const held = slotValue(p, shape[i]);
    let best = held, bestP: Player | null = null;
    for (const b of bench) {
      const v = slotValue(b, shape[i]);
      if (v > best) { best = v; bestP = b; }
    }
    if (!bestP) return;
    benchUpgrades++;
    benchPoints += best - held;
    affected = true;
    push(gainBySlot, shape[i], best - held);
    if (best - held > worst.gain) {
      worst = {
        gain: best - held,
        line: `${t.name} ${shape[i]}: starts ${p.pos} ovr ${p.ovr} (worth ${held}) `
          + `while ${bestP.pos} ovr ${bestP.ovr} (worth ${best}) sits on the bench`,
      };
    }
  });

  for (let i = 0; i < xi.length; i++) {
    for (let j = i + 1; j < xi.length; j++) {
      const now = slotValue(xi[i], shape[i]) + slotValue(xi[j], shape[j]);
      const swapped = slotValue(xi[j], shape[i]) + slotValue(xi[i], shape[j]);
      if (swapped > now) { starterSwaps++; swapPoints += swapped - now; affected = true; }
    }
  }
  if (affected) clubsAffected++;
}

const pct = (n: number, d: number) => (d === 0 ? "0.0" : ((100 * n) / d).toFixed(1));
console.log(`\nseed ${SEED}, after ${SEASONS} seasons: ${clubs.length} tier-1 AI clubs, ${slots} XI slots`);
console.log(`starters below ovr 50:        ${weakStarters} (${pct(weakStarters, slots)}%)`);
console.log(`\n--- both of these must be zero ---`);
console.log(`slots a bench player improves: ${benchUpgrades} (${pct(benchUpgrades, slots)}%), ${benchPoints.toFixed(0)} pts`);
console.log(`starter pairs worth swapping:  ${starterSwaps}, ${swapPoints.toFixed(0)} pts`);
console.log(`clubs with any improving move: ${clubsAffected}/${clubs.length} (${pct(clubsAffected, clubs.length)}%)`);
console.log(`worst single slot:             ${worst.line}`);

console.log(`\nstarter ovr by slot:`);
for (const pos of POSITIONS) {
  const o = ovrBySlot.get(pos) ?? [];
  if (!o.length) continue;
  const mean = o.reduce((a, b) => a + b, 0) / o.length;
  const sorted = [...o].sort((a, b) => a - b);
  console.log(
    `  ${pos.padEnd(3)} n=${String(o.length).padStart(4)}  mean ${mean.toFixed(1).padStart(5)}`
    + `  min ${String(sorted[0]).padStart(3)}  p50 ${String(sorted[Math.floor(o.length / 2)]).padStart(3)}`
    + `  under50 ${pct(o.filter((x) => x < 50).length, o.length).padStart(5)}%`
    + `  improvable ${String((gainBySlot.get(pos) ?? []).length).padStart(4)}`,
  );
}
