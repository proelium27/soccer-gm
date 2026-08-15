/**
 * How often does a generated world hand two players the same name?
 *
 * Name pools are per-nationality (`NATIONALITIES` / `OTHER_NATIONS` /
 * `UNLISTED_NATIONALITIES` in `core/players/nationalities.ts`), and a name is
 * one draw from `first` x one from `last`, so a pool of 10x10 covers 100
 * distinct names -- against a world that generates ~6000 players at creation
 * and thousands more per dynasty. Small pools read as an obvious repeat.
 *
 * Prints the per-nationality pool sizes alongside the collision rate actually
 * observed in a freshly generated world, so a pool expansion can be measured
 * rather than eyeballed. Run: npx tsx scripts/namePoolProbe.ts
 */
import { createLeagueState } from "../src/core/leagueState.js";
import { mulberry32 } from "../src/engine/rng.js";
import {
  NATIONALITIES, OTHER_NATIONS, UNLISTED_NATIONALITIES,
} from "../src/core/players/nationalities.js";

const league = createLeagueState(0, mulberry32(1), 1);
const players = league.players;

const byNat = new Map<string, string[]>();
for (const p of players) {
  const list = byNat.get(p.nationality) ?? [];
  list.push(p.name);
  byNat.set(p.nationality, list);
}

function poolOf(nat: string): { first: number; last: number } | null {
  const def = NATIONALITIES[nat] ?? UNLISTED_NATIONALITIES[nat] ?? OTHER_NATIONS[nat];
  return def ? { first: def.first.length, last: def.last.length } : null;
}

const rows: {
  nationality: string; players: number; pool: string; combos: number;
  distinct: number; dupPct: string; worst: string;
}[] = [];

let totalDup = 0;
for (const [nat, names] of byNat) {
  const counts = new Map<string, number>();
  for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1);
  const distinct = counts.size;
  const dup = names.length - distinct;
  totalDup += dup;
  let worst = "";
  let worstN = 0;
  for (const [n, c] of counts) if (c > worstN) { worstN = c; worst = n; }
  const pool = poolOf(nat);
  rows.push({
    nationality: nat,
    players: names.length,
    pool: pool ? `${pool.first}x${pool.last}` : "(syllables)",
    combos: pool ? pool.first * pool.last : 0,
    distinct,
    dupPct: `${((dup / names.length) * 100).toFixed(1)}%`,
    worst: worstN > 1 ? `${worst} x${worstN}` : "-",
  });
}

rows.sort((a, b) => b.players - a.players);
console.table(rows);

const allNames = players.map((p) => p.name);
const globalDistinct = new Set(allNames).size;
console.log(`\nWorld: ${players.length} players, ${globalDistinct} distinct names`);
console.log(`Shares a name with someone: ${allNames.length - globalDistinct} (${
  (((allNames.length - globalDistinct) / allNames.length) * 100).toFixed(1)}%)`);
console.log(`Same-nationality duplicates: ${totalDup}`);

const globalCounts = new Map<string, number>();
for (const n of allNames) globalCounts.set(n, (globalCounts.get(n) ?? 0) + 1);
const top = [...globalCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
console.log("\nMost-repeated names:");
for (const [n, c] of top) console.log(`  ${String(c).padStart(3)}x  ${n}`);
