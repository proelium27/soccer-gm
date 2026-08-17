/**
 * Shows the arithmetic behind one player's GOAT score.
 *
 * `playerGoatRanking` returns each row's `components`, and each component keeps
 * the `GoatTerm`s that produced it (count x weight = points, exact). This prints
 * that working, which is the only way to answer "why is a full back who never
 * won an award the second greatest player in his world".
 *
 * Usage:
 *   NODE_OPTIONS=--max-old-space-size=20480 npx tsx scripts/goatBreakdown.ts <save.json> "Name" ["Other Name" ...]
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import type { LeagueStore } from "../src/core/leagueState.js";
import { migrateLeague } from "../src/db/migrate.js";
import { playerGoatRanking } from "../src/core/frivolities/goat.js";

const [path, ...names] = process.argv.slice(2);
if (!path || !names.length) {
  console.error('usage: tsx scripts/goatBreakdown.ts <save.json> "Player Name" [...]');
  process.exit(1);
}

const buf = readFileSync(path);
const text = buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf).toString("utf8") : buf.toString("utf8");
const league = migrateLeague(JSON.parse(text) as LeagueStore);

// Deep enough that a defender ranked outside the headline list still resolves.
const rows = playerGoatRanking(league, 200);
const club = (tid: number | null) => league.teams.find((t) => t.tid === tid)?.name ?? "—";

for (const name of names) {
  const i = rows.findIndex((r) => r.career.name === name);
  if (i < 0) {
    console.log(`\n!! ${name} is not in this save's top 200`);
    continue;
  }
  const r = rows[i];
  const c = r.career;
  const h = r.honours;

  console.log(`\n${"=".repeat(70)}`);
  console.log(`${c.name} (${c.nationality}, ${c.pos})  —  #${i + 1} all time, score ${r.score}`);
  console.log("=".repeat(70));
  console.log(`  ${c.seasonsPlayed} seasons (s${c.firstSeason}-${c.lastSeason}) · peak ovr ${c.peakOvr} in s${c.peakSeason}`);
  console.log(`  ${c.totals.appearances} apps · ${c.totals.goals}G ${c.totals.assists}A · avg rating ${c.totals.avgRating.toFixed(2)}`);
  console.log(`  ${c.clubs.length} club(s) · last at ${club(c.tid)} · ${c.caps} caps, ${c.intlTitles} World Cups`);
  console.log(`  honours: ${h.ballonDOr} Ballon d'Or · ${h.playerOfSeason} POTY · ${h.goldenBoot} Golden Boot · ` +
    `${h.teamOfSeason} TOTS · ${h.worldXI} World XI · ${h.leagueTitles} titles · ${h.cupTitles} cups`);

  console.log(`\n  component     points   terms`);
  for (const comp of r.components) {
    const first = comp.terms[0];
    console.log(`  ${comp.key.padEnd(12)} ${String(comp.points).padStart(6)}   ` +
      (first ? `${first.key} ${first.count} x ${first.weight} = ${first.points.toFixed(1)}` : "—"));
    for (const t of comp.terms.slice(1)) {
      console.log(`  ${" ".repeat(12)} ${" ".repeat(6)}   ${t.key} ${t.count} x ${t.weight} = ${t.points.toFixed(1)}`);
    }
  }
  const sum = r.components.reduce((n, comp) => n + comp.points, 0);
  console.log(`  ${"".padEnd(12)} ${String(sum).padStart(6)}   <- components sum to the score exactly`);
}
console.log();
