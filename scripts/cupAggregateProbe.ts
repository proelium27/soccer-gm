/**
 * Sizing the "only keep the current season's box scores" idea for archived cups.
 *
 * Two of the three box-score stores are already current-season only:
 * `league.played` is emptied every offseason, and archived international
 * campaigns already drop theirs. So this only concerns `cupHistory`.
 *
 * Compares three options per archived cup:
 *   A. today (after the league-phase strip): playoff.ties + ties box scores kept
 *   B. delete them outright: saves everything, but the Player Profile Cup tab is
 *      built from exactly this data, so a player's cup career history vanishes
 *   C. aggregate first: fold every stage into one CupStatLine per player, store
 *      that, then drop the box scores -- keeps the feature and shrinks it
 *
 * C can also count league-phase and playoff appearances, which cupStatsForPlayer
 * never has (it sums only the top-level cup.ties).
 */
import { readFileSync, existsSync } from "node:fs";
import type { LeagueStore } from "../src/core/leagueState.js";

const cachePath = process.argv[2]
  ?? `${process.env.CLAUDE_JOB_DIR ?? "/tmp"}/tmp/league14.json`;
if (!existsSync(cachePath)) {
  console.error(`No cached league at ${cachePath}. Run leagueSizeDeepDive.ts first.`);
  process.exit(1);
}
const league = JSON.parse(readFileSync(cachePath, "utf8")) as LeagueStore;

const size = (v: unknown) => JSON.stringify(v ?? null).length;
const kb = (n: number) => (n / 1024).toFixed(0).padStart(6);

interface Line {
  pid: number; apps: number; g: number; a: number; sh: number; sot: number;
  sv: number; ga: number; tk: number; int: number; min: number;
}

/** Every box score in one cup, across all three stages. */
function allBoxScores(cup: LeagueStore["cupHistory"][number]) {
  const out: { home: unknown[]; away: unknown[] }[] = [];
  for (const m of cup.leaguePhase?.matches ?? []) if (m.boxScore) out.push(m.boxScore);
  for (const t of cup.playoff?.ties ?? []) if (t.boxScore) out.push(t.boxScore);
  for (const t of cup.ties) if (t.boxScore) out.push(t.boxScore);
  return out;
}

function aggregate(cup: LeagueStore["cupHistory"][number]): Line[] {
  const byPid = new Map<number, Line>();
  for (const box of allBoxScores(cup)) {
    for (const side of [box.home, box.away]) {
      for (const raw of side as Record<string, number>[]) {
        let l = byPid.get(raw.pid);
        if (!l) {
          l = { pid: raw.pid, apps: 0, g: 0, a: 0, sh: 0, sot: 0, sv: 0, ga: 0, tk: 0, int: 0, min: 0 };
          byPid.set(raw.pid, l);
        }
        l.apps++;
        l.g += raw.goals; l.a += raw.assists; l.sh += raw.shots; l.sot += raw.shotsOnTarget;
        l.sv += raw.saves; l.ga += raw.goalsAgainst; l.tk += raw.tackles;
        l.int += raw.interceptions; l.min += raw.minutesPlayed;
      }
    }
  }
  return [...byPid.values()];
}

let curKept = 0, curAll = 0, agg = 0, lines = 0, koOnlyApps = 0, allApps = 0;

console.log("season\tkept now\tif deleted\tif aggregated\tplayers");
for (const cup of league.cupHistory) {
  // Option A: what my strip leaves behind (playoff + knockout box scores).
  const keptNow =
    (cup.playoff?.ties ?? []).reduce((n, t) => n + size(t.boxScore), 0)
    + cup.ties.reduce((n, t) => n + size(t.boxScore), 0);
  // Everything, for reference (pre-strip saves still carry the league phase).
  const all = allBoxScores(cup).reduce((n, b) => n + size(b), 0);
  const ls = aggregate(cup);
  const aggBytes = size(ls);

  curKept += keptNow; curAll += all; agg += aggBytes; lines += ls.length;
  allApps += ls.reduce((n, l) => n + l.apps, 0);
  koOnlyApps += cup.ties.reduce(
    (n, t) => n + t.boxScore.home.length + t.boxScore.away.length, 0,
  );

  console.log(`${cup.season}\t${kb(keptNow)} KB\t${kb(0)} KB\t\t${kb(aggBytes)} KB\t${ls.length}`);
}

console.log(`\nacross ${league.cupHistory.length} archived cups`);
console.log(`  every box score, all stages:        ${kb(curAll)} KB`);
console.log(`  kept today (after the LP strip):    ${kb(curKept)} KB`);
console.log(`  option B, delete outright:          ${kb(0)} KB  (loses the Cup tab's history)`);
console.log(`  option C, aggregated stat lines:    ${kb(agg)} KB  (${lines} player-seasons)`);
console.log(`\n  C saves ${kb(curKept - agg)} KB vs today, and keeps the feature.`);
console.log(`  appearances countable: ${allApps} (all stages) vs ${koOnlyApps} (knockout only, what the Cup tab shows today)`);
