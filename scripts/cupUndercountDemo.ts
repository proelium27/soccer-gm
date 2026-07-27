/**
 * Demonstrates the cup-appearance under-count on a real save.
 *
 * The Continental Cup has three stages, each stored separately:
 *   league phase -> cup.leaguePhase.matches   (6 games per club, 60 per season)
 *   playoff      -> cup.playoff.ties          (4 single-leg eliminators)
 *   knockout     -> cup.ties                  (QF / SF / Final, 7 ties)
 *
 * cupStatsForPlayer loops over `cup.ties` only, so the Player Profile Cup tab
 * has only ever counted knockout appearances. A club that plays all 6 group
 * games and goes out in the playoff shows 0 cup appearances for every player.
 */
import { readFileSync, existsSync } from "node:fs";
import type { LeagueStore } from "../src/core/leagueState.js";
import { cupStatsForPlayer } from "../src/core/cup/cupStats.js";

const cachePath = process.argv[2]
  ?? `${process.env.CLAUDE_JOB_DIR ?? "/tmp"}/tmp/league14.json`;
if (!existsSync(cachePath)) {
  console.error(`No cached league at ${cachePath}. Run leagueSizeDeepDive.ts first.`);
  process.exit(1);
}
const league = JSON.parse(readFileSync(cachePath, "utf8")) as LeagueStore;
const nameOf = new Map(league.players.map((p) => [p.pid, p.name]));
const clubOf = new Map(league.teams.map((t) => [t.tid, t.name]));

const cup = league.cupHistory[0];
if (!cup) { console.error("no archived cup in this save"); process.exit(1); }

console.log(`Archived cup, season ${cup.season}\n`);

// Count each player's appearances per stage, straight from the box scores.
const lp = new Map<number, number>();
const po = new Map<number, number>();
const ko = new Map<number, number>();
const bump = (m: Map<number, number>, pid: number) => m.set(pid, (m.get(pid) ?? 0) + 1);

for (const m of cup.leaguePhase?.matches ?? []) {
  if (!m.boxScore) continue;
  for (const side of [m.boxScore.home, m.boxScore.away]) for (const l of side) bump(lp, l.pid);
}
for (const t of cup.playoff?.ties ?? []) {
  if (!t.boxScore) continue;
  for (const side of [t.boxScore.home, t.boxScore.away]) for (const l of side) bump(po, l.pid);
}
for (const t of cup.ties) {
  if (!t.boxScore) continue;
  for (const side of [t.boxScore.home, t.boxScore.away]) for (const l of side) bump(ko, l.pid);
}

const everyone = new Set([...lp.keys(), ...po.keys(), ...ko.keys()]);
const sum = (m: Map<number, number>) => [...m.values()].reduce((a, b) => a + b, 0);
console.log(`players who featured in this cup: ${everyone.size}`);
console.log(`  league-phase appearances: ${sum(lp)}`);
console.log(`  playoff appearances:      ${sum(po)}`);
console.log(`  knockout appearances:     ${sum(ko)}   <-- the only ones the Cup tab counts`);
console.log(`  TOTAL actually played:    ${sum(lp) + sum(po) + sum(ko)}`);

// The starkest case: players who played the group stage but show nothing at all.
const invisible = [...everyone].filter((pid) => !ko.has(pid));
console.log(`\nplayers whose Cup tab shows NOTHING despite featuring: ${invisible.length} of ${everyone.size}`);

console.log("\nexamples (profile shows 0 cup appearances for this season):");
for (const pid of invisible.sort((a, b) => (lp.get(b) ?? 0) - (lp.get(a) ?? 0)).slice(0, 5)) {
  const line = cupStatsForPlayer(cup, pid);
  console.log(
    `  ${(nameOf.get(pid) ?? `pid ${pid}`).padEnd(22)} `
    + `played ${lp.get(pid) ?? 0} group + ${po.get(pid) ?? 0} playoff`
    + `  ->  Cup tab says ${line.appearances} appearances, ${line.goals} goals`,
  );
}

// And someone who did reach the knockout: even they lose their group games.
const reached = [...ko.keys()].sort((a, b) => (lp.get(b) ?? 0) - (lp.get(a) ?? 0))[0];
if (reached !== undefined) {
  const line = cupStatsForPlayer(cup, reached);
  console.log(`\neven a knockout player loses his group games:`);
  console.log(
    `  ${nameOf.get(reached) ?? reached} (${clubOf.get(0) ? "" : ""}) `
    + `played ${lp.get(reached) ?? 0} group + ${po.get(reached) ?? 0} playoff + ${ko.get(reached)} knockout`
    + `  ->  Cup tab says ${line.appearances}`,
  );
}
