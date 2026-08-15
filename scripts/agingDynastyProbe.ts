/**
 * Dynasty guard for a change to the aging shifts (PHYSICAL_AGE_SHIFT /
 * SKILL_AGE_SHIFT). Those constants set every position's growth arc, so the
 * controlled cohort audit (`positionCeilingAudit.ts`) proves the *shape* of the
 * change but says nothing about what it does to a live world over decades.
 * This watches the two things a shift change can actually break:
 *
 *   - **League mean ovr drift.** The whole anti-inflation equilibrium is the
 *     claim that a career averages out flat-to-declining. If tier-1 mean ovr
 *     climbs season over season, the ratchet is back.
 *   - **The 80+ population in tier 1.** GROWTH_DAMPING_END/FLOOR were swept
 *     specifically to land this at 8-16 and re-verified over 100 seasons
 *     (see their comment). A change that moves growth arcs moves this too.
 *
 * Also prints the tier-1 position mix at 80+, which is the thing the shift
 * change is *for*: strikers should stop being locked out of the elite tier.
 *
 * Chunked deliberately: a full run is far longer than one shell invocation
 * survives here, so state is written to disk and the next call resumes.
 *
 *   npx tsx scripts/agingDynastyProbe.ts <seasonsThisRun> [seed] [stateFile]
 *
 * Run it repeatedly with the same seed/stateFile to extend the dynasty.
 * Delete the state file to start over.
 */
import fs from "node:fs";
import { mulberry32 } from "../src/engine/rng.js";
import { createLeagueState, type LeagueStore } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { simOffseason } from "../src/core/offseason.js";

const SEASONS = Number(process.argv[2] ?? 5);
const SEED = Number(process.argv[3] ?? 7);
const STATE = process.argv[4] ?? `/tmp/aging-dynasty-${SEED}.json`;

interface Row {
  season: number;
  tier1Mean: number;
  tier1Over80: number;
  byPos: Record<string, number>;
}

function snapshot(league: LeagueStore): Row {
  const tier1 = new Set(
    league.competitions.filter((c) => c.tier === 1).map((c) => c.id),
  );
  const tids = new Set(
    league.teams.filter((t) => tier1.has(t.compId) && t.tid !== league.meta.userTid).map((t) => t.tid),
  );
  const ovrs: number[] = [];
  const byPos: Record<string, number> = {};
  let over80 = 0;
  for (const t of league.teams) {
    if (!tids.has(t.tid)) continue;
    for (const pid of t.roster) {
      const p = league.players.find((x) => x.pid === pid);
      if (!p) continue;
      ovrs.push(p.ovr);
      if (p.ovr >= 80) {
        over80++;
        byPos[p.pos] = (byPos[p.pos] ?? 0) + 1;
      }
    }
  }
  return {
    season: league.season,
    tier1Mean: ovrs.reduce((a, b) => a + b, 0) / Math.max(1, ovrs.length),
    tier1Over80: over80,
    byPos,
  };
}

let league: LeagueStore;
let rows: Row[];
let rngState: number;

if (fs.existsSync(STATE)) {
  const saved = JSON.parse(fs.readFileSync(STATE, "utf8"));
  league = saved.league;
  rows = saved.rows;
  rngState = saved.rngState;
  console.log(`Resuming from ${STATE} at season ${league.season} (${rows.length} seasons recorded).`);
} else {
  const rng = mulberry32(SEED);
  league = createLeagueState(0, rng);
  rows = [snapshot(league)];
  rngState = SEED;
  console.log(`Fresh world, seed ${SEED}. Season ${league.season} baseline recorded.`);
}

// The dynasty's own stream, re-derived from the recorded counter so a resumed
// run continues the same sequence rather than restarting it.
const rng = mulberry32(rngState);

for (let i = 0; i < SEASONS; i++) {
  league = simThrough(league, "season", rng);
  league = simOffseason(league, rng);
  const row = snapshot(league);
  rows.push(row);
  console.log(
    `season ${String(row.season).padStart(3)}  tier1 mean ovr ${row.tier1Mean.toFixed(2)}`
    + `  80+ ${String(row.tier1Over80).padStart(3)}`
    + `  ${Object.entries(row.byPos).sort((a, b) => b[1] - a[1]).map(([p, n]) => `${p}:${n}`).join(" ")}`,
  );
}

rngState = Math.floor(rng() * 2 ** 32);
fs.writeFileSync(STATE, JSON.stringify({ league, rows, rngState }));

const first = rows[0];
const last = rows[rows.length - 1];
console.log(`\n--- ${rows.length - 1} seasons total, seed ${SEED} ---`);
console.log(`tier1 mean ovr  ${first.tier1Mean.toFixed(2)} -> ${last.tier1Mean.toFixed(2)}`
  + `  (drift ${(last.tier1Mean - first.tier1Mean >= 0 ? "+" : "")}${(last.tier1Mean - first.tier1Mean).toFixed(2)})`);
const over80s = rows.slice(1).map((r) => r.tier1Over80);
console.log(`tier1 80+ population  min ${Math.min(...over80s)}  max ${Math.max(...over80s)}`
  + `  last ${last.tier1Over80}   (GROWTH_DAMPING_* were swept to hold this at 8-16)`);
const posTotals: Record<string, number> = {};
for (const r of rows.slice(1)) for (const [p, n] of Object.entries(r.byPos)) posTotals[p] = (posTotals[p] ?? 0) + n;
console.log(`80+ by position over the run: `
  + Object.entries(posTotals).sort((a, b) => b[1] - a[1]).map(([p, n]) => `${p} ${n}`).join(", "));
console.log(`state: ${STATE}`);
