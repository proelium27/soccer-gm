/**
 * Summarize a generated roster file: clubs per competition, the strongest
 * players, and the resulting OVR distribution.
 *
 * Uses the game's own computeOvr rather than recomputing the formula here —
 * a hand-reimplementation got it wrong during development (heightScore spans a
 * fixed 160-200cm, and computeOvr sums weight/100 without normalizing by the
 * total, which matters because GK weights sum to 92 rather than 100) and made
 * every keeper read ~9% too strong. Import the real thing.
 *
 *   npx tsx scripts/eafc/inspectRosterFile.ts --in eafc-roster.json [--top 25]
 */
import { parseArgs } from "node:util";
import { readFileSync } from "node:fs";
import { parseRosterFile } from "../../src/core/teams/rosterFile.js";
import { computeOvr } from "../../src/core/players/ovr.js";
import type { Position } from "../../src/core/players/types.js";

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    in: { type: "string" },
    top: { type: "string", default: "25" },
    clubs: { type: "boolean", default: false },
  },
});

if (!values.in) {
  console.error("usage: npx tsx scripts/eafc/inspectRosterFile.ts --in <roster.json> [--top N] [--clubs]");
  process.exit(1);
}

const file = parseRosterFile(readFileSync(values.in, "utf8"));

interface Row {
  name: string; pos: Position; age: number; nationality?: string;
  club: string; comp: string; ovr: number; potential?: number;
}
const all: Row[] = [];

for (const comp of file.competitions) {
  if (values.clubs) {
    console.log(`\n=== ${comp.match} (${comp.clubs.length} clubs) ===`);
    console.log(comp.clubs.map((k) => `${k.abbrev} ${k.name}`).join(" | "));
  }
  for (const club of comp.clubs) {
    for (const p of club.players ?? []) {
      if (!p.ratings) continue;
      all.push({
        name: p.name, pos: p.pos, age: p.age, nationality: p.nationality,
        club: club.name, comp: comp.match, potential: p.potential,
        ovr: computeOvr(p.pos, p.ratings, p.heightCm ?? 180),
      });
    }
  }
}

all.sort((a, b) => b.ovr - a.ovr);

const top = Number(values.top);
console.log(`\n=== TOP ${top} BY OVR ===`);
for (const p of all.slice(0, top)) {
  console.log(
    `${String(p.ovr).padStart(3)} pot${String(p.potential ?? "-").padStart(3)} ` +
      `${p.pos.padEnd(3)} ${String(p.age).padStart(2)} ${p.name.padEnd(22)} ` +
      `${p.club.padEnd(24)} ${p.nationality ?? ""}`,
  );
}

const q = (xs: number[], f: number) => [...xs].sort((a, b) => a - b)[Math.floor(f * (xs.length - 1))];
const ovrs = all.map((p) => p.ovr);
console.log(`\ntotal players ${all.length}`);
console.log(
  `ovr  min ${Math.min(...ovrs)}  p25 ${q(ovrs, 0.25)}  p50 ${q(ovrs, 0.5)}  ` +
    `p75 ${q(ovrs, 0.75)}  p95 ${q(ovrs, 0.95)}  p99 ${q(ovrs, 0.99)}  max ${Math.max(...ovrs)}`,
);

// Per-position top end: a systematic bias in the attribute mapping shows up
// here first (an inflated keeper mapping put 11 GKs in the overall top 25).
console.log("\nper-position  n     p50  p95  max");
const positions = [...new Set(all.map((p) => p.pos))].sort();
for (const pos of positions) {
  const xs = all.filter((p) => p.pos === pos).map((p) => p.ovr);
  console.log(
    `  ${pos.padEnd(3)} ${String(xs.length).padStart(6)}  ${String(q(xs, 0.5)).padStart(4)} ` +
      `${String(q(xs, 0.95)).padStart(4)} ${String(Math.max(...xs)).padStart(4)}`,
  );
}

console.log("\nshare of the overall top 50, by position:");
const top50 = all.slice(0, 50);
const counts = new Map<string, number>();
for (const p of top50) counts.set(p.pos, (counts.get(p.pos) ?? 0) + 1);
console.log(
  [...counts].sort((a, b) => b[1] - a[1]).map(([pos, n]) => `${pos} ${n}`).join("  "),
);
