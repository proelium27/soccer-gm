/**
 * The stories inside a real player save.
 *
 * Where `playerSaveAudit.ts` looks for what's broken, this looks for what
 * happened: the legends, the dynasties, the collapses and the player's own
 * career arc. It runs the game's OWN derivations — `playerGoatRanking`,
 * `teamGoatRanking`, `computeRecordBook`, `computeClubHistory` — so what it
 * prints is exactly what the Frivolities and Club History pages would show.
 *
 * Unlike the audit, this DOES go through `migrateLeague`, because we want the
 * game's view of the save rather than the raw bytes.
 *
 * Usage:
 *   NODE_OPTIONS=--max-old-space-size=20480 npx tsx scripts/playerSaveStories.ts "/path/to/save.json"
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import type { LeagueStore } from "../src/core/leagueState.js";
import { migrateLeague } from "../src/db/migrate.js";
import { playerGoatRanking, teamGoatRanking } from "../src/core/frivolities/goat.js";
import { computeRecordBook } from "../src/core/frivolities/records.js";
import { computeClubHistory } from "../src/core/clubHistory.js";

const path = process.argv[2];
if (!path) {
  console.error("usage: tsx scripts/playerSaveStories.ts <save.json>");
  process.exit(1);
}

const buf = readFileSync(path);
const text = buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf).toString("utf8") : buf.toString("utf8");
const league = migrateLeague(JSON.parse(text) as LeagueStore);

const name = (tid: number | null | undefined) =>
  tid === null || tid === undefined ? "—" : league.teams.find((t) => t.tid === tid)?.name ?? `club ${tid}`;
const comp = new Map(league.competitions.map((c) => [c.id, c]));
const money = (n: number) => `$${(n / 1e6).toFixed(0)}M`;
const userTid = league.meta.userTid;

console.log(`\n${"=".repeat(72)}`);
console.log(`${league.meta.name} — season ${league.season}, ${league.competitions.length} competitions`);
console.log("=".repeat(72));

// ---------------------------------------------------------------- the manager
const history = computeClubHistory(league, userTid);
// computeClubHistory returns seasons newest-first (the order the page renders).
// Sort ascending before any chronological walk — reading it as-is makes "last
// title" report the *earliest* one and inverts the drought calculation.
const seasons = [...(history.seasons ?? [])].sort((a, b) => a.season - b.season);
console.log(`\n## THE MANAGER'S OWN STORY`);
if (seasons.length) {
  const finishes = seasons.map((s) => s.position);
  const best = Math.min(...finishes);
  const worst = Math.max(...finishes);
  const titles = seasons.filter((s) => s.champion && s.tier === 1).length;
  const tier2 = seasons.filter((s) => s.tier === 2).length;
  console.log(`  ${seasons.length} seasons managed · ${titles} top-flight titles · best finish ${best}, worst ${worst}`);
  if (tier2) console.log(`  spent ${tier2} season(s) in the second tier`);

  // the arc, decade by decade
  const decades = new Map<number, number[]>();
  for (const s of seasons) {
    const d = Math.floor((s.season - 1) / 10) * 10 + 1;
    decades.set(d, [...(decades.get(d) ?? []), s.position]);
  }
  const arc = [...decades]
    .sort((a, b) => a[0] - b[0])
    .map(([d, rs]) => `s${d}s avg ${(rs.reduce((x, y) => x + y, 0) / rs.length).toFixed(1)}`);
  console.log(`  finishing arc: ${arc.join(" · ")}`);

  // longest drought and longest run of titles
  let drought = 0;
  let longestDrought = 0;
  let lastTitle: number | null = null;
  for (const s of seasons) {
    if (s.champion && s.tier === 1) {
      longestDrought = Math.max(longestDrought, drought);
      drought = 0;
      lastTitle = s.season;
    } else drought++;
  }
  console.log(`  longest title drought ${Math.max(longestDrought, drought)} seasons` +
    (lastTitle ? ` · last title season ${lastTitle}` : ` · never won it`));
}
const cups = (league.cupHistory ?? []).filter((c) => c.championTid === userTid).length;
console.log(`  Continental Cups: ${cups}`);

// ---------------------------------------------------------------- the legends
console.log(`\n## THE GREATEST PLAYERS THIS WORLD PRODUCED`);
const goats = playerGoatRanking(league, 8);
for (const [i, g] of goats.entries()) {
  const c = g.career;
  const h = g.honours;
  const trophies: string[] = [];
  if (h.ballonDOr) trophies.push(`${h.ballonDOr}x Ballon d'Or`);
  if (h.playerOfSeason) trophies.push(`${h.playerOfSeason}x POTY`);
  if (h.goldenBoot) trophies.push(`${h.goldenBoot}x Golden Boot`);
  if (h.leagueTitles) trophies.push(`${h.leagueTitles} league titles`);
  if (h.cupTitles) trophies.push(`${h.cupTitles} Continental Cups`);
  if (c.intlTitles) trophies.push(`${c.intlTitles}x World Cup`);
  console.log(
    `  ${String(i + 1).padStart(2)}. ${c.name} (${c.nationality}, ${c.pos})  score ${g.score}` +
      `\n      peak ovr ${c.peakOvr} in s${c.peakSeason} · ${c.seasonsPlayed} seasons (s${c.firstSeason}-${c.lastSeason})` +
      ` · ${c.totals.goals}G ${c.totals.assists}A in ${c.totals.appearances} apps` +
      ` · ${c.clubs.length} club(s) · ${c.caps} caps` +
      (c.active ? ` · STILL PLAYING at ${name(c.tid)}` : ` · retired, last at ${name(c.tid)}`) +
      (trophies.length ? `\n      ${trophies.join(" · ")}` : `\n      no major honours`),
  );
}

// ---------------------------------------------------------------- the dynasties
console.log(`\n## THE GREATEST CLUBS`);
for (const [i, t] of teamGoatRanking(league, 6).entries()) {
  const c = comp.get(league.teams.find((x) => x.tid === t.tid)?.compId ?? -1);
  console.log(
    `  ${i + 1}. ${name(t.tid).padEnd(24)} ${t.leagueTitles} titles · ${t.cupTitles} cups · ` +
      `${t.topFinishes} top-4s · ${t.ppg.toFixed(2)} ppg over ${t.seasons} seasons` +
      (t.tid === userTid ? "   <-- the player's club" : "") +
      (c?.tier === 2 ? `   (currently in tier 2!)` : ""),
  );
}

// ---------------------------------------------------------------- the record book
const rb = computeRecordBook(league, 4);
console.log(`\n## THE RECORD BOOK`);
const season = (r: (typeof rb.bestTeamSeasons)[number]) =>
  `${name(r.tid)} s${r.season} — ${r.row.points} pts (${r.row.won}W ${r.row.drawn}D ${r.row.lost}L, ` +
  `${r.row.gf}:${r.row.ga}), ${r.ppg.toFixed(2)} ppg${r.tier === 2 ? " [tier 2]" : ""}`;
console.log(`  greatest seasons:`);
for (const r of rb.bestTeamSeasons) console.log(`    ${season(r)}`);
console.log(`  worst seasons:`);
for (const r of rb.worstTeamSeasons) console.log(`    ${season(r)}`);
console.log(`  highest ovr ever reached:`);
for (const c of rb.peakRatings) console.log(`    ${c.name} — ${c.peakOvr} in s${c.peakSeason} (${c.pos}, ${c.nationality})`);
console.log(`  most goals in one season:`);
for (const c of rb.seasonGoals) {
  console.log(`    ${c.name} — ${c.best.goals.value} in s${c.best.goals.season} (${c.best.goals.appearances} apps)`);
}
console.log(`  career goals:`);
for (const c of rb.careerGoals) console.log(`    ${c.name} — ${c.totals.goals} in ${c.totals.appearances} apps over ${c.seasonsPlayed} seasons`);
console.log(`  longest careers:`);
for (const c of rb.longestCareers) console.log(`    ${c.name} — ${c.seasonsPlayed} seasons (s${c.firstSeason}-${c.lastSeason}), peak ${c.peakOvr}`);
console.log(`  biggest transfers:`);
for (const t of rb.biggestTransfers) {
  console.log(`    ${t.name || `player ${t.pid}`} — ${money(t.fee)}, ${name(t.fromTid)} to ${name(t.toTid)}, s${t.season}`);
}

// ---------------------------------------------------------------- nations
const intl = league.international;
console.log(`\n## INTERNATIONAL`);
const wins = new Map<string, number>();
for (const t of intl?.history ?? []) wins.set(t.champion, (wins.get(t.champion) ?? 0) + 1);
if (wins.size) {
  const ranked = [...wins].sort((a, b) => b[1] - a[1]);
  console.log(`  ${intl.history.length} World Cups played · ${wins.size} different winners`);
  console.log(`  roll of honour: ${ranked.slice(0, 6).map(([n, w]) => `${n} ${w}`).join(" · ")}`);
  const recent = intl.history.slice(-3);
  for (const t of recent) {
    console.log(
      `  s${t.season}: ${t.champion} beat ${t.runnerUp} ${t.finalScore.champion}-${t.finalScore.runnerUp}` +
        (t.finalScore.pens ? ` (pens ${t.finalScore.pens.champion}-${t.finalScore.pens.runnerUp})` : "") +
        (t.topScorer ? ` · top scorer ${t.topScorer.name ?? `player ${t.topScorer.pid}`} (${t.topScorer.goals})` : ""),
    );
  }
} else console.log(`  no completed World Cups yet`);

// ---------------------------------------------------------------- oddities
console.log(`\n## ODDITIES`);
const players = league.players;
const ageOf = (p: (typeof players)[number]) => league.season - p.born;
const rosterOf = new Map<number, number>();
for (const t of league.teams) for (const pid of t.roster) rosterOf.set(pid, t.tid);

const oldest = players.filter((p) => rosterOf.has(p.pid)).sort((a, b) => ageOf(b) - ageOf(a))[0];
if (oldest) console.log(`  oldest active player: ${oldest.name}, ${ageOf(oldest)} (${oldest.pos}, ovr ${oldest.ovr}) at ${name(rosterOf.get(oldest.pid))}`);

const tallest = players.sort((a, b) => b.heightCm - a.heightCm)[0];
const shortest = players.filter((p) => rosterOf.has(p.pid)).sort((a, b) => a.heightCm - b.heightCm)[0];
if (tallest) console.log(`  tallest: ${tallest.name} ${tallest.heightCm}cm (${tallest.pos}) · shortest: ${shortest.name} ${shortest.heightCm}cm (${shortest.pos})`);

// one-club men among the greats
const loyal = playerGoatRanking(league, 60).filter((g) => g.career.clubs.length === 1 && g.career.seasonsPlayed >= 10);
if (loyal.length) {
  console.log(`  one-club men in the all-time top 60: ${loyal.length}`);
  for (const g of loyal.slice(0, 3)) {
    console.log(`    ${g.career.name} — ${g.career.seasonsPlayed} seasons, all at ${name(g.career.clubs[0])}`);
  }
}

// journeymen
const nomads = playerGoatRanking(league, 200).sort((a, b) => b.career.clubs.length - a.career.clubs.length)[0];
if (nomads) console.log(`  most-travelled of the all-time top 200: ${nomads.career.name}, ${nomads.career.clubs.length} clubs in ${nomads.career.seasonsPlayed} seasons`);

// the fallen: clubs with titles now in tier 2
const fallen = teamGoatRanking(league, 40).filter((t) => {
  const club = league.teams.find((x) => x.tid === t.tid);
  return club && comp.get(club.compId)?.tier === 2 && t.leagueTitles > 0;
});
if (fallen.length) {
  console.log(`  fallen giants (title winners now in tier 2):`);
  for (const t of fallen.slice(0, 5)) {
    const club = league.teams.find((x) => x.tid === t.tid)!;
    console.log(`    ${name(t.tid)} — ${t.leagueTitles} titles, now ${club.roster.length} players, ${money(club.budget)} in the bank`);
  }
}
console.log();
