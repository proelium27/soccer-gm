/**
 * Print the OVR distribution of a freshly generated world, per competition and
 * overall. Calibration input for the EA FC roster converter's rescale curve
 * (scripts/eafc/) — we need to know where soccer-gm's own percentiles sit
 * before we can map EA's onto them.
 */
import { mulberry32 } from "../src/engine/rng.js";
import { generateWorld } from "../src/core/league/generate.js";
import { worldCompetitions } from "../src/core/competitions.js";

const world = generateWorld(mulberry32(12345), 12345);
const comps = worldCompetitions();
const byTid = new Map(world.teams.map((t) => [t.tid, t]));
const byPid = new Map(world.players.map((p) => [p.pid, p]));

function quantiles(xs: number[], qs: number[]): number[] {
  const s = [...xs].sort((a, b) => a - b);
  return qs.map((q) => s[Math.min(s.length - 1, Math.floor(q * s.length))]);
}

const QS = [0.05, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99, 0.999];

console.log("comp                        n   min   p5  p25  p50  p75  p90  p95  p99 p99.9  max  mean");
for (const c of comps) {
  const ovrs = world.teams
    .filter((t) => t.compId === c.id)
    .flatMap((t) => t.roster.map((pid) => byPid.get(pid)!.ovr));
  const q = quantiles(ovrs, QS);
  const mean = ovrs.reduce((a, b) => a + b, 0) / ovrs.length;
  console.log(
    c.name.padEnd(24),
    String(ovrs.length).padStart(5),
    String(Math.min(...ovrs)).padStart(5),
    ...q.map((x) => String(x).padStart(4)),
    String(Math.max(...ovrs)).padStart(5),
    mean.toFixed(1).padStart(6),
  );
}

const all = world.players.map((p) => p.ovr);
const tier1 = world.teams
  .filter((t) => comps.find((c) => c.id === t.compId)!.tier === 1)
  .flatMap((t) => t.roster.map((pid) => byPid.get(pid)!.ovr));

for (const [label, xs] of [["WORLD", all], ["TIER-1 ONLY", tier1]] as const) {
  const q = quantiles(xs, QS);
  console.log(
    label.padEnd(24),
    String(xs.length).padStart(5),
    String(Math.min(...xs)).padStart(5),
    ...q.map((x) => String(x).padStart(4)),
    String(Math.max(...xs)).padStart(5),
    (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1).padStart(6),
  );
}

// Per-club mean OVR spread within the strongest league — tells us how far apart
// the strongest and weakest slots are, i.e. how much room a club->slot mapping
// has to get wrong.
const eng1 = world.teams.filter((t) => t.compId === 0);
const clubMeans = eng1
  .map((t) => ({
    tid: t.tid,
    academyBase: t.academyBase,
    mean: t.roster.reduce((a, pid) => a + byPid.get(pid)!.ovr, 0) / t.roster.length,
  }))
  .sort((a, b) => b.mean - a.mean);
console.log("\nEnglish Division 1 clubs by mean OVR (tid order is NOT strength order):");
for (const c of clubMeans) {
  console.log(`  tid ${String(c.tid).padStart(3)}  academyBase ${c.academyBase.toFixed(1).padStart(6)}  meanOvr ${c.mean.toFixed(1)}`);
}

// Within-player skill spread: how far a generated player's individual skills sit
// from his own mean. EA attributes are far spikier (a centre-back at finishing 40
// / tackling 90), so this is the number the converter's spread factor is
// calibrated against.
console.log("\nWithin-player skill spread (stdev of a player's own 14 skills), by position:");
const byPos = new Map<string, number[]>();
for (const p of world.players) {
  const vals = Object.values(p.ratings);
  const m = vals.reduce((a, b) => a + b, 0) / vals.length;
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - m) ** 2, 0) / vals.length);
  if (!byPos.has(p.pos)) byPos.set(p.pos, []);
  byPos.get(p.pos)!.push(sd);
}
for (const [pos, sds] of [...byPos].sort()) {
  const mean = sds.reduce((a, b) => a + b, 0) / sds.length;
  console.log(`  ${pos.padEnd(3)} mean stdev ${mean.toFixed(1)}  (n=${sds.length})`);
}
const allSd = [...byPos.values()].flat();
console.log(`  ALL mean stdev ${(allSd.reduce((a, b) => a + b, 0) / allSd.length).toFixed(1)}`);

// Per-skill range across all generated players — the band the converter's
// shifted EA ratings should land inside.
console.log("\nPer-skill min/p50/max across the generated world:");
const skills = Object.keys(world.players[0].ratings) as (keyof (typeof world.players)[0]["ratings"])[];
for (const k of skills) {
  const xs = world.players.map((p) => p.ratings[k]);
  const [p50] = quantiles(xs, [0.5]);
  console.log(`  ${String(k).padEnd(14)} ${String(Math.min(...xs)).padStart(3)} / ${String(p50).padStart(3)} / ${String(Math.max(...xs)).padStart(3)}`);
}
void byTid;
