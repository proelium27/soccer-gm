/**
 * Replays one club's Continental Cup campaign, round by round.
 *
 * The cup table records who won it. This says how: the league-phase results,
 * who they knocked out, the scorelines, and what the club was doing in its own
 * league at the same time, which is usually the interesting part.
 *
 * Usage:
 *   NODE_OPTIONS=--max-old-space-size=20480 npx tsx scripts/cupRun.ts <save.json> <season> ["Club Name"]
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import type { LeagueStore } from "../src/core/leagueState.js";
import { migrateLeague } from "../src/db/migrate.js";

const [path, seasonArg, clubArg] = process.argv.slice(2);
if (!path || !seasonArg) {
  console.error('usage: tsx scripts/cupRun.ts <save.json> <season> ["Club Name"]');
  process.exit(1);
}
const season = Number(seasonArg);

const buf = readFileSync(path);
const text = buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf).toString("utf8") : buf.toString("utf8");
const L = migrateLeague(JSON.parse(text) as LeagueStore);

const cup = (L.cupHistory ?? []).find((c) => c.season === season) ?? (L.cup?.season === season ? L.cup : null);
if (!cup) {
  console.error(`no cup recorded for season ${season}`);
  process.exit(1);
}
const nm = (tid: number) => (tid < 0 ? "TBD" : L.teams.find((t) => t.tid === tid)?.name ?? `club ${tid}`);
const comps = new Map(L.competitions.map((c) => [c.id, c]));
const countryOf = (tid: number) => comps.get(L.teams.find((t) => t.tid === tid)?.compId ?? -1)?.country ?? "?";

const focusTid = clubArg
  ? L.teams.find((t) => t.name === clubArg)?.tid
  : cup.championTid ?? undefined;
if (focusTid === undefined) {
  console.error("could not resolve a club to follow");
  process.exit(1);
}

console.log(`\n${"=".repeat(74)}`);
console.log(`${cup.name ?? "Continental Cup"}, season ${season} — following ${nm(focusTid)} (${countryOf(focusTid)})`);
console.log("=".repeat(74));
console.log(`  winners: ${cup.championTid !== null ? nm(cup.championTid) : "not finished"}`);
console.log(`  field: ${(cup.teams ?? []).filter((t) => t >= 0).length} clubs in the knockout bracket`);

// what the club was doing at home that season
const h = L.seasonHistory?.find((x) => x.season === season);
if (h) {
  const cid = h.compsByTid?.[focusTid];
  const table = (h.table ?? []).filter((r) => String(h.compsByTid[r.tid]) === String(cid));
  const sorted = [...table].sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);
  const pos = sorted.findIndex((r) => r.tid === focusTid) + 1;
  const me = table.find((r) => r.tid === focusTid);
  console.log(`  at home the same season: ${pos} of ${table.length}, ${me?.points} pts ` +
    `(${me?.won}W ${me?.drawn}D ${me?.lost}L, ${me?.gf}:${me?.ga})`);
}

// league phase
const lp = cup.leaguePhase;
if (lp) {
  const mine = (lp.matches ?? []).filter((m) => m.home === focusTid || m.away === focusTid);
  if (mine.length) {
    console.log(`\n-- league phase`);
    let w = 0, d = 0, l = 0;
    for (const m of mine) {
      const home = m.home === focusTid;
      const gf = home ? m.homeGoals : m.awayGoals;
      const ga = home ? m.awayGoals : m.homeGoals;
      const opp = home ? m.away : m.home;
      if (gf > ga) w++; else if (gf === ga) d++; else l++;
      console.log(`  ${home ? "H" : "A"}  ${gf}-${ga}  vs ${nm(opp)} (${countryOf(opp)})`);
    }
    console.log(`  record: ${w}W ${d}D ${l}L`);
  }
}

// playoff round
for (const t of cup.playoff?.ties ?? []) {
  if (t.home !== focusTid && t.away !== focusTid) continue;
  const home = t.home === focusTid;
  console.log(`\n-- playoff round`);
  console.log(`  ${home ? "H" : "A"}  ${home ? t.homeGoals : t.awayGoals}-${home ? t.awayGoals : t.homeGoals} ` +
    `vs ${nm(home ? t.away : t.home)} (${countryOf(home ? t.away : t.home)})` +
    `${t.wentToPens ? `, on penalties ${t.homePens}-${t.awayPens}` : t.wentToExtraTime ? ", after extra time" : ""}` +
    `  ${t.winner === focusTid ? "WON" : "OUT"}`);
}

// knockout
const ko = (cup.ties ?? []).filter((t) => t.home === focusTid || t.away === focusTid)
  .sort((a, b) => a.round - b.round);
if (ko.length) {
  const label = (round: number, total: number) => {
    const from = total - round - 1;
    return from === 0 ? "final" : from === 1 ? "semi-final" : from === 2 ? "quarter-final" : `round ${round}`;
  };
  const maxRound = Math.max(...(cup.ties ?? []).map((t) => t.round));
  console.log(`\n-- knockout`);
  for (const t of ko) {
    const home = t.home === focusTid;
    const opp = home ? t.away : t.home;
    // `legs` is keyed to the TIE's nominal home and away, not to whoever hosted
    // that particular leg, so it is reported from the followed club's side to
    // match the aggregate above. Reading it as host-first does not reconcile.
    const legs = (t.legs ?? [])
      .map((g) => (home ? `${g.homeGoals}-${g.awayGoals}` : `${g.awayGoals}-${g.homeGoals}`))
      .join(", then ");
    console.log(`  ${label(t.round, maxRound + 1).padEnd(13)} vs ${nm(opp).padEnd(24)} (${countryOf(opp)})  ` +
      `${home ? t.homeGoals : t.awayGoals}-${home ? t.awayGoals : t.homeGoals} on aggregate` +
      (legs ? ` [legs ${legs}]` : "") +
      (t.wentToPens ? `, penalties ${t.homePens}-${t.awayPens}` : t.wentToExtraTime ? ", after extra time" : "") +
      `  ${t.winner === focusTid ? "WON" : "OUT"}`);
  }
}

// how the opponents were doing at home, for context on the run's difficulty
if (h) {
  console.log(`\n-- who they beat, and where those clubs finished at home that season`);
  for (const t of ko) {
    if (t.winner !== focusTid) continue;
    const opp = t.home === focusTid ? t.away : t.home;
    const cid = h.compsByTid?.[opp];
    const table = (h.table ?? []).filter((r) => String(h.compsByTid[r.tid]) === String(cid));
    const sorted = [...table].sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);
    const pos = sorted.findIndex((r) => r.tid === opp) + 1;
    console.log(`  ${nm(opp).padEnd(26)} finished ${pos} of ${table.length} in ${countryOf(opp)}`);
  }
}
console.log();
