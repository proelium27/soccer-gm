/**
 * Frivolities, but pooled across every save in a folder.
 *
 * Runs the game's own all-time derivations on each save in turn, tags every row
 * with the world it came from, then merges and re-ranks. The result is what the
 * Frivolities page would look like if every player's world were one world.
 *
 * Memory is the constraint: these saves are 50-224 MB of JSON each and several
 * GB once parsed, so leagues are processed strictly one at a time and only the
 * small merged rows are kept. Do not hold a `LeagueStore` across iterations.
 *
 * Usage:
 *   NODE_OPTIONS=--max-old-space-size=20480 npx tsx scripts/multiverseFrivolities.ts [dir] [topN]
 */
import { readFileSync, readdirSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import type { LeagueStore } from "../src/core/leagueState.js";
import { migrateLeague } from "../src/db/migrate.js";
import { playerGoatRanking, teamGoatRanking } from "../src/core/frivolities/goat.js";
import { computeRecordBook } from "../src/core/frivolities/records.js";
import { allTimeLeaders } from "../src/core/frivolities/leaders.js";
import { allTimeInternational } from "../src/core/frivolities/international.js";
import { computePlayerBios } from "../src/core/frivolities/bios.js";
import { computeClubTrivia } from "../src/core/frivolities/clubs.js";
import { ALL_TIME_STAT_KEYS, type AllTimeStatKey } from "../src/core/frivolities/stats.js";

const dir = process.argv[2] ?? "/Users/calebmeyer/soccer-gm/leaguesaves";
const TOP = Number(process.argv[3] ?? 12);

/** A row plus which world produced it. */
type Tagged<T> = T & { world: string; managed: boolean; god: boolean };

const goats: Tagged<{ name: string; nat: string; pos: string; score: number; peakOvr: number;
  seasons: number; goals: number; assists: number; apps: number; clubs: number;
  ballon: number; poty: number; boot: number; titles: number; cups: number; wc: number; club: string }>[] = [];
const clubGoats: Tagged<{ club: string; score: number; titles: number; cups: number;
  t2: number; top4: number; seasons: number; ppg: number }>[] = [];
const teamSeasons: Tagged<{ club: string; season: number; tier: number; pts: number;
  w: number; d: number; l: number; gf: number; ga: number; ppg: number }>[] = [];
const worstSeasons: typeof teamSeasons = [];
const peaks: Tagged<{ name: string; nat: string; pos: string; peakOvr: number; season: number }>[] = [];
const fees: Tagged<{ name: string; fee: number; from: string; to: string; season: number }>[] = [];
const leaders = new Map<string, Tagged<{ name: string; nat: string; pos: string; value: number;
  season: number | null; apps: number; club: string }>[]>();
const intl: Tagged<{ name: string; nat: string; caps: number; goals: number; titles: number }>[] = [];
const bios = {
  tallest: [] as Tagged<{ name: string; v: number; pos: string; club: string }>[],
  shortest: [] as Tagged<{ name: string; v: number; pos: string; club: string }>[],
  oldest: [] as Tagged<{ name: string; v: number; pos: string; club: string }>[],
  oneClub: [] as Tagged<{ name: string; seasons: number; apps: number; goals: number; club: string }>[],
};
const nationality = new Map<string, { count: number; ovrSum: number }>();
const firstNames = new Map<string, number>();
const surnames = new Map<string, number>();
const clubRecords: Tagged<{ club: string; titles: number; cups: number; t2: number;
  trophies: number; seasons: number; ppg: number; drought: number }>[] = [];
const spenders: Tagged<{ club: string; spent: number; received: number; net: number; signings: number }>[] = [];
const worlds: { world: string; seasons: number; god: boolean; imported: boolean; comps: number }[] = [];

const CLUBS_SRC = readFileSync(new URL("../src/core/teams/clubs.ts", import.meta.url), "utf8");

const files = readdirSync(dir).filter((f) => f.endsWith(".json") || f.endsWith(".json.gz")).sort();

for (const file of files) {
  const buf = readFileSync(`${dir}/${file}`);
  const text = buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf).toString("utf8") : buf.toString("utf8");
  const league: LeagueStore = migrateLeague(JSON.parse(text) as LeagueStore);

  const userTid = league.meta.userTid;
  const world = league.teams.find((t) => t.tid === userTid)?.name ?? league.meta.name;
  const god = league.godMode;
  const flagged = league.teams.filter((t) => t.importedIdentity).length;
  const sample = league.teams.slice(0, 12).map((t) => t.name);
  const imported = flagged > 0 || sample.filter((n) => CLUBS_SRC.includes(`"${n}"`)).length < sample.length / 2;
  worlds.push({ world, seasons: league.season, god, imported, comps: league.competitions.length });

  const clubName = (tid: number | null | undefined) =>
    tid === null || tid === undefined ? "—" : league.teams.find((t) => t.tid === tid)?.name ?? `club ${tid}`;
  const tag = <T,>(x: T, managed = false): Tagged<T> => ({ ...x, world, managed, god });

  // ---- GOAT, players
  for (const g of playerGoatRanking(league, 40)) {
    const c = g.career;
    const h = g.honours;
    goats.push(tag({
      name: c.name, nat: c.nationality, pos: c.pos, score: g.score, peakOvr: c.peakOvr,
      seasons: c.seasonsPlayed, goals: c.totals.goals, assists: c.totals.assists,
      apps: c.totals.appearances, clubs: c.clubs.length,
      ballon: h.ballonDOr, poty: h.playerOfSeason, boot: h.goldenBoot,
      titles: h.leagueTitles, cups: h.cupTitles, wc: c.intlTitles, club: clubName(c.tid),
    }, c.clubs.includes(userTid)));
  }

  // ---- GOAT, clubs
  for (const t of teamGoatRanking(league, 25)) {
    clubGoats.push(tag({
      club: clubName(t.tid), score: t.score, titles: t.leagueTitles, cups: t.cupTitles,
      t2: t.secondTierTitles, top4: t.topFinishes, seasons: t.seasons, ppg: t.ppg,
    }, t.tid === userTid));
  }

  // ---- record book
  const rb = computeRecordBook(league, 12);
  const season = (r: (typeof rb.bestTeamSeasons)[number]) => tag({
    club: clubName(r.tid), season: r.season, tier: r.tier, pts: r.row.points,
    w: r.row.won, d: r.row.drawn, l: r.row.lost, gf: r.row.gf, ga: r.row.ga, ppg: r.ppg,
  }, r.tid === userTid);
  for (const r of rb.bestTeamSeasons) teamSeasons.push(season(r));
  for (const r of rb.worstTeamSeasons) worstSeasons.push(season(r));
  for (const c of rb.peakRatings) {
    peaks.push(tag({ name: c.name, nat: c.nationality, pos: c.pos, peakOvr: c.peakOvr, season: c.peakSeason },
      c.clubs.includes(userTid)));
  }
  for (const t of rb.biggestTransfers) {
    fees.push(tag({ name: t.name || `player ${t.pid}`, fee: t.fee, from: clubName(t.fromTid),
      to: clubName(t.toTid), season: t.season }, t.toTid === userTid || t.fromTid === userTid));
  }

  // ---- all-time leaders, career + single season
  for (const stat of ALL_TIME_STAT_KEYS) {
    for (const scope of ["career", "single"] as const) {
      const key = `${stat}|${scope}`;
      const rows = allTimeLeaders(league, stat as AllTimeStatKey, scope, 15);
      const bucket = leaders.get(key) ?? [];
      for (const r of rows) {
        bucket.push(tag({
          name: r.career.name, nat: r.career.nationality, pos: r.career.pos, value: r.value,
          season: r.season, apps: r.appearances, club: clubName(r.career.tid),
        }, r.career.clubs.includes(userTid)));
      }
      leaders.set(key, bucket);
    }
  }

  // ---- international
  // The three boards overlap heavily — a top scorer is usually also highly
  // capped — so dedupe by pid before pooling, or one career lands in the merged
  // list up to three times and appears three times in the output.
  const seenIntl = new Set<number>();
  for (const key of ["caps", "intlGoals", "intlTitles"] as const) {
    for (const r of allTimeInternational(league, key, null, 15)) {
      if (seenIntl.has(r.pid)) continue;
      seenIntl.add(r.pid);
      intl.push(tag({ name: r.name, nat: r.nationality, caps: r.caps, goals: r.intlGoals, titles: r.intlTitles },
        r.clubs.includes(userTid)));
    }
  }

  // ---- bios
  const b = computePlayerBios(league, 12);
  for (const r of b.tallest) bios.tallest.push(tag({ name: r.name, v: r.heightCm, pos: r.pos, club: clubName(r.tid) }, r.tid === userTid));
  for (const r of b.shortest) bios.shortest.push(tag({ name: r.name, v: r.heightCm, pos: r.pos, club: clubName(r.tid) }, r.tid === userTid));
  for (const r of b.oldest) bios.oldest.push(tag({ name: r.name, v: r.age, pos: r.pos, club: clubName(r.tid) }, r.tid === userTid));
  for (const o of b.oneClubMen ?? []) {
    bios.oneClub.push(tag({ name: o.career.name, seasons: o.career.seasonsPlayed,
      apps: o.career.totals.appearances, goals: o.career.totals.goals, club: clubName(o.tid) }, o.tid === userTid));
  }
  for (const n of b.nationalities) {
    const e = nationality.get(n.nationality) ?? { count: 0, ovrSum: 0 };
    e.count += n.count;
    e.ovrSum += n.avgOvr * n.count;
    nationality.set(n.nationality, e);
  }
  for (const n of b.commonFirstNames) firstNames.set(n.name, (firstNames.get(n.name) ?? 0) + n.count);
  for (const n of b.commonSurnames) surnames.set(n.name, (surnames.get(n.name) ?? 0) + n.count);

  // ---- club trivia
  const ct = computeClubTrivia(league, 25);
  for (const r of ct.records) {
    clubRecords.push(tag({ club: clubName(r.tid), titles: r.leagueTitles, cups: r.cupTitles,
      t2: r.secondTierTitles, trophies: r.totalTrophies, seasons: r.seasons, ppg: r.ppg,
      drought: r.titleDrought }, r.tid === userTid));
  }
  for (const r of ct.biggestSpenders) {
    spenders.push(tag({ club: clubName(r.tid), spent: r.spent, received: r.received, net: r.net,
      signings: r.signings }, r.tid === userTid));
  }
}

// ------------------------------------------------------------------ output
const M = (n: number) => `$${(n / 1e6).toFixed(0)}M`;
const flag = (r: { managed: boolean; god: boolean; world: string }) =>
  `${r.managed ? "[MANAGED]" : ""}${r.god ? "[god]" : ""} ${r.world}`.trim();
const head = (s: string) => console.log(`\n${"=".repeat(76)}\n${s}\n${"=".repeat(76)}`);
const sub = (s: string) => console.log(`\n-- ${s}`);

head(`MULTIVERSE FRIVOLITIES — ${worlds.length} worlds`);
for (const w of worlds) {
  console.log(`  ${w.world.padEnd(20)} season ${String(w.seasons).padStart(3)}  ${w.comps} comps` +
    `${w.god ? "  [god mode]" : ""}${w.imported ? "  [imported]" : "  [fictional]"}`);
}
console.log(`  TOTAL: ${worlds.reduce((n, w) => n + w.seasons, 0)} seasons of football`);

head("GOAT — PLAYERS (pooled, by the game's own score)");
for (const [i, g] of goats.sort((a, b) => b.score - a.score).slice(0, TOP).entries()) {
  console.log(`${String(i + 1).padStart(3)}. ${g.name} (${g.nat}, ${g.pos})  score ${g.score}  — ${flag(g)}`);
  console.log(`     peak ${g.peakOvr} · ${g.seasons} seasons · ${g.goals}G ${g.assists}A in ${g.apps} apps · ${g.clubs} clubs · last at ${g.club}`);
  const h = [g.ballon && `${g.ballon}x Ballon d'Or`, g.poty && `${g.poty}x POTY`, g.boot && `${g.boot}x Boot`,
    g.titles && `${g.titles} titles`, g.cups && `${g.cups} cups`, g.wc && `${g.wc}x World Cup`].filter(Boolean);
  console.log(`     ${h.join(" · ") || "no major honours"}`);
}

head("GOAT — CLUBS (pooled)");
for (const [i, c] of clubGoats.sort((a, b) => b.score - a.score).slice(0, TOP).entries()) {
  console.log(`${String(i + 1).padStart(3)}. ${c.club.padEnd(24)} ${c.titles} titles · ${c.cups} cups · ${c.top4} top-4 · ` +
    `${c.ppg.toFixed(2)} ppg over ${c.seasons}s  — ${flag(c)}`);
}

head("RECORDS");
sub("greatest team seasons (by points per game)");
for (const r of teamSeasons.sort((a, b) => b.ppg - a.ppg).slice(0, TOP)) {
  console.log(`  ${r.ppg.toFixed(2)} ppg  ${r.club} s${r.season}${r.tier === 2 ? " [T2]" : ""} — ${r.pts} pts ` +
    `(${r.w}W ${r.d}D ${r.l}L, ${r.gf}:${r.ga})  — ${flag(r)}`);
}
sub("worst team seasons");
for (const r of worstSeasons.sort((a, b) => a.ppg - b.ppg).slice(0, TOP)) {
  console.log(`  ${r.ppg.toFixed(2)} ppg  ${r.club} s${r.season}${r.tier === 2 ? " [T2]" : ""} — ${r.pts} pts ` +
    `(${r.w}W ${r.d}D ${r.l}L, ${r.gf}:${r.ga})  — ${flag(r)}`);
}
sub("highest rating ever reached");
for (const p of peaks.sort((a, b) => b.peakOvr - a.peakOvr).slice(0, TOP)) {
  console.log(`  ${p.peakOvr}  ${p.name} (${p.nat}, ${p.pos}) in s${p.season}  — ${flag(p)}`);
}
sub("biggest transfer fees");
for (const f of fees.sort((a, b) => b.fee - a.fee).slice(0, TOP)) {
  console.log(`  ${M(f.fee).padStart(6)}  ${f.name} — ${f.from} to ${f.to}, s${f.season}  — ${flag(f)}`);
}

head("ALL-TIME LEADERS (career, pooled)");
const SHOW: AllTimeStatKey[] = ["goals", "assists", "appearances", "minutesPlayed", "saves",
  "tackles", "interceptions", "passes", "crosses", "shots", "foulsCommitted", "avgRating"];
for (const stat of SHOW) {
  const rows = (leaders.get(`${stat}|career`) ?? []).sort((a, b) => b.value - a.value).slice(0, 5);
  sub(stat);
  for (const r of rows) {
    const v = stat === "avgRating" ? r.value.toFixed(2) : Math.round(r.value).toLocaleString();
    console.log(`  ${String(v).padStart(9)}  ${r.name} (${r.nat}, ${r.pos}) in ${r.apps} apps  — ${flag(r)}`);
  }
}

head("ALL-TIME LEADERS (single season, pooled)");
for (const stat of ["goals", "assists", "saves", "tackles", "avgRating"] as AllTimeStatKey[]) {
  const rows = (leaders.get(`${stat}|single`) ?? []).sort((a, b) => b.value - a.value).slice(0, 5);
  sub(stat);
  for (const r of rows) {
    const v = stat === "avgRating" ? r.value.toFixed(2) : Math.round(r.value).toLocaleString();
    console.log(`  ${String(v).padStart(8)}  ${r.name} (${r.nat}, ${r.pos}) s${r.season} in ${r.apps} apps  — ${flag(r)}`);
  }
}

head("INTERNATIONAL (pooled)");
sub("most caps");
for (const r of [...intl].sort((a, b) => b.caps - a.caps).slice(0, TOP)) {
  console.log(`  ${String(r.caps).padStart(3)} caps  ${r.name} (${r.nat}) — ${r.goals} goals, ${r.titles} World Cups  — ${flag(r)}`);
}
sub("most international goals");
for (const r of [...intl].sort((a, b) => b.goals - a.goals).slice(0, TOP)) {
  console.log(`  ${String(r.goals).padStart(3)} goals  ${r.name} (${r.nat}) in ${r.caps} caps  — ${flag(r)}`);
}
sub("most World Cups won");
for (const r of [...intl].sort((a, b) => b.titles - a.titles || b.caps - a.caps).slice(0, 8)) {
  console.log(`  ${r.titles}x  ${r.name} (${r.nat}) — ${r.caps} caps  — ${flag(r)}`);
}

head("PLAYER BIOS (pooled)");
sub("tallest");
for (const r of bios.tallest.sort((a, b) => b.v - a.v).slice(0, 6)) console.log(`  ${r.v}cm  ${r.name} (${r.pos}) at ${r.club}  — ${flag(r)}`);
sub("shortest");
for (const r of bios.shortest.sort((a, b) => a.v - b.v).slice(0, 6)) console.log(`  ${r.v}cm  ${r.name} (${r.pos}) at ${r.club}  — ${flag(r)}`);
sub("oldest still playing");
for (const r of bios.oldest.sort((a, b) => b.v - a.v).slice(0, 6)) console.log(`  ${r.v}  ${r.name} (${r.pos}) at ${r.club}  — ${flag(r)}`);
sub("one-club men (longest careers)");
for (const r of bios.oneClub.sort((a, b) => b.seasons - a.seasons).slice(0, TOP)) {
  console.log(`  ${String(r.seasons).padStart(2)} seasons  ${r.name} — all at ${r.club}, ${r.apps} apps, ${r.goals}G  — ${flag(r)}`);
}
sub("most represented nationalities (current players, all worlds)");
for (const [n, e] of [...nationality].sort((a, b) => b[1].count - a[1].count).slice(0, 12)) {
  console.log(`  ${String(e.count).padStart(5)}  ${n.padEnd(20)} mean ovr ${(e.ovrSum / e.count).toFixed(1)}`);
}
sub("most common first names / surnames");
console.log(`  first:   ${[...firstNames].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n, c]) => `${n} ${c}`).join(" · ")}`);
console.log(`  surname: ${[...surnames].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n, c]) => `${n} ${c}`).join(" · ")}`);

head("CLUB RECORDS (pooled)");
sub("trophy cabinets");
for (const r of clubRecords.sort((a, b) => b.trophies - a.trophies).slice(0, TOP)) {
  console.log(`  ${String(r.trophies).padStart(2)} trophies  ${r.club.padEnd(24)} ${r.titles} league · ${r.cups} cup · ${r.t2} T2 · ` +
    `${r.ppg.toFixed(2)} ppg over ${r.seasons}s  — ${flag(r)}`);
}
sub("longest title droughts");
for (const r of clubRecords.filter((r) => r.seasons > 8).sort((a, b) => b.drought - a.drought).slice(0, TOP)) {
  console.log(`  ${String(r.drought).padStart(3)} seasons  ${r.club.padEnd(24)} (${r.titles} titles all time)  — ${flag(r)}`);
}
sub("biggest spenders");
for (const r of spenders.sort((a, b) => b.spent - a.spent).slice(0, TOP)) {
  console.log(`  ${M(r.spent).padStart(7)}  ${r.club.padEnd(24)} ${r.signings} signings, net ${M(r.net)}  — ${flag(r)}`);
}
// `net` is received minus spent, so profit is the LARGEST net, not the smallest.
// Sorting the other way lists the biggest losses under a "profit" heading.
sub("biggest net transfer profit");
for (const r of spenders.sort((a, b) => b.net - a.net).slice(0, TOP)) {
  console.log(`  ${M(r.net).padStart(7)}  ${r.club.padEnd(24)} received ${M(r.received)}, spent ${M(r.spent)}  — ${flag(r)}`);
}
sub("biggest net transfer loss");
for (const r of spenders.sort((a, b) => a.net - b.net).slice(0, 6)) {
  console.log(`  ${M(r.net).padStart(7)}  ${r.club.padEnd(24)} spent ${M(r.spent)}, received ${M(r.received)}  — ${flag(r)}`);
}
console.log();
