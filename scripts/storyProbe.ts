/**
 * What actually HAPPENED in a dynasty — the narrative view, not the metrics.
 *
 * Every other audit here reports means and minima. This one reads the same
 * simulated world for the things a player would actually talk about: dynasties
 * and droughts, the great careers, the freak seasons, who won the Ballon d'Or
 * and why, the biggest fees, promoted sides punching up.
 *
 * Pure and read-only, like the frivolities modules it leans on.
 *
 * Run: npx tsx scripts/storyProbe.ts        (SEED=1 SEASONS=25)
 */
import { mulberry32 } from "../src/engine/rng.js";
import { createLeagueState } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { simOffseason } from "../src/core/offseason.js";
import { competitionOf } from "../src/core/competitions.js";
import { computeRecordBook } from "../src/core/frivolities/records.js";
import { computeClubTrivia } from "../src/core/frivolities/clubs.js";
import { playerGoatRanking } from "../src/core/frivolities/goat.js";
import { allCareers } from "../src/core/frivolities/careers.js";

const SEED = Number(process.env.SEED ?? 1);
const SEASONS = Number(process.env.SEASONS ?? 25);

const rng = mulberry32(SEED);
let league = createLeagueState(0, rng);
for (let s = 0; s < SEASONS; s++) {
  league = simThrough(league, "season", mulberry32(SEED * 1000 + s));
  league = simOffseason(league, mulberry32(SEED * 2000 + s));
}

const nameOf = (tid: number | null | undefined): string =>
  tid === null || tid === undefined ? "—" : (league.teams.find((t) => t.tid === tid)?.name ?? `Club ${tid}`);
const countryOf = (tid: number): string => {
  const t = league.teams.find((x) => x.tid === tid);
  return t ? competitionOf(league.competitions, t.compId).country : "?";
};
const money = (n: number): string => `$${(n / 1e6).toFixed(1)}M`;
const rule = (s: string): void => console.log(`\n${"─".repeat(64)}\n${s}\n${"─".repeat(64)}`);

console.log(`\nWORLD REPORT — seed ${SEED}, ${SEASONS} seasons simulated (now season ${league.season})`);

// ── Dynasties and droughts ────────────────────────────────────────────────
rule("DYNASTIES");
const trivia = computeClubTrivia(league, 200);
const winners = trivia.records.filter((r) => r.leagueTitles > 0).sort((a, b) => b.leagueTitles - a.leagueTitles);
for (const r of winners.slice(0, 8)) {
  console.log(
    `  ${nameOf(r.tid).padEnd(22)} ${String(r.leagueTitles).padStart(2)} league titles, ` +
    `${r.cupTitles} cups  (${countryOf(r.tid)}, ppg ${r.ppg.toFixed(2)}, last title s${r.lastTitleSeason ?? "—"})`,
  );
}
const totalTitles = winners.reduce((a, r) => a + r.leagueTitles, 0);
console.log(`  → ${winners.length} different clubs won a league title across ${totalTitles} title-seasons`);

rule("LONGEST WAITS");
for (const r of trivia.droughts.slice(0, 5)) {
  const never = r.lastTitleSeason === null;
  console.log(
    `  ${nameOf(r.tid).padEnd(22)} ${String(r.titleDrought).padStart(2)} seasons ` +
    `${never ? "and has NEVER won one" : `since s${r.lastTitleSeason}`}  (${countryOf(r.tid)})`,
  );
}

// ── Freak seasons ─────────────────────────────────────────────────────────
const book = computeRecordBook(league, 200);
rule("BEST AND WORST TEAM SEASONS EVER");
for (const t of book.bestTeamSeasons.slice(0, 4)) {
  const r = t.row;
  console.log(
    `  s${t.season} ${nameOf(t.tid).padEnd(20)} ${r.won}W ${r.drawn}D ${r.lost}L  ` +
    `${r.gf}:${r.ga}  ${r.points}pts (${t.ppg.toFixed(2)} ppg, tier ${t.tier})`,
  );
}
for (const t of book.worstTeamSeasons.slice(0, 2)) {
  const r = t.row;
  console.log(
    `  worst: s${t.season} ${nameOf(t.tid).padEnd(13)} ${r.won}W ${r.drawn}D ${r.lost}L  ` +
    `${r.gf}:${r.ga}  ${r.points}pts (${t.ppg.toFixed(2)} ppg)`,
  );
}

rule("INDIVIDUAL SEASONS");
for (const c of book.seasonGoals.slice(0, 5)) {
  const b = c.best.goals;
  console.log(
    `  ${c.name.padEnd(22)} ${b.value} goals in s${b.season} (${b.appearances} apps, ${c.pos}, ${c.nationality})`,
  );
}
for (const c of book.seasonAssists.slice(0, 3)) {
  const b = c.best.assists;
  console.log(`  ${c.name.padEnd(22)} ${b.value} assists in s${b.season} (${c.pos})`);
}

rule("PEAK RATINGS — the best players who ever lived here");
for (const c of book.peakRatings.slice(0, 6)) {
  console.log(
    `  ovr ${c.peakOvr}  ${c.name.padEnd(22)} ${c.pos.padEnd(3)} ${c.nationality.padEnd(14)} ` +
    `peaked s${c.peakSeason}, ${c.seasonsPlayed} seasons, ${c.active ? "still playing" : "retired"}`,
  );
}

// ── Careers ───────────────────────────────────────────────────────────────
rule("GOAT RANKING");
const goats = playerGoatRanking(league, 8);
for (const [i, g] of goats.entries()) {
  const c = g.career;
  console.log(
    `  ${String(i + 1).padStart(2)}. ${c.name.padEnd(22)} score ${String(Math.round(g.score)).padStart(4)}  ` +
    `${c.pos.padEnd(3)} peak ${c.peakOvr}  ${c.totals.goals}g ${c.totals.assists}a in ${c.totals.appearances} apps` +
    `${c.intlTitles ? `  ${c.intlTitles}x World Cup` : ""}`,
  );
}

rule("LONGEST CAREERS & CAREER SCORING");
for (const c of book.longestCareers.slice(0, 3)) {
  console.log(`  ${c.name.padEnd(22)} ${c.seasonsPlayed} seasons (s${c.firstSeason}-s${c.lastSeason}), ${c.clubs.length} clubs`);
}
for (const c of book.careerGoals.slice(0, 3)) {
  console.log(`  ${c.name.padEnd(22)} ${c.totals.goals} career goals in ${c.totals.appearances} apps`);
}

// ── Money ─────────────────────────────────────────────────────────────────
rule("BIGGEST TRANSFERS");
for (const t of book.biggestTransfers.slice(0, 6)) {
  console.log(
    `  ${money(t.fee).padStart(8)}  ${(t.name || `Player ${t.pid}`).padEnd(22)} ` +
    `${nameOf(t.fromTid)} → ${nameOf(t.toTid)}  (s${t.season})`,
  );
}
console.log("  — biggest sellers by profit —");
for (const s of trivia.biggestSellers.slice(0, 3)) {
  console.log(`  ${nameOf(s.tid).padEnd(22)} profit ${money(s.received - s.spent)}  (${countryOf(s.tid)})`);
}

// ── Ballon d'Or ───────────────────────────────────────────────────────────
rule("BALLON D'OR");
const careerByPid = new Map(allCareers(league).map((c) => [c.pid, c]));
const bdWins = new Map<number, number>();
for (const h of league.seasonHistory) {
  const w = h.world?.ballonDOr?.[0];
  if (!w) continue;
  bdWins.set(w.pid, (bdWins.get(w.pid) ?? 0) + 1);
}
for (const h of league.seasonHistory.slice(-8)) {
  const w = h.world?.ballonDOr?.[0];
  if (!w) continue;
  const c = careerByPid.get(w.pid);
  const parts = [
    `league ${w.league.toFixed(1)}`,
    w.cup > 0.05 ? `cup ${w.cup.toFixed(1)}` : "",
    w.intl > 0.05 ? `intl ${w.intl.toFixed(1)}` : "",
    w.title > 0.05 ? "won his league" : "",
  ].filter(Boolean);
  console.log(
    `  s${String(h.season).padStart(2)}  ${(c?.name ?? `Player ${w.pid}`).padEnd(22)} ` +
    `${(c?.pos ?? "?").padEnd(3)} ${nameOf(w.tid).padEnd(20)} — ${parts.join(", ")}`,
  );
}
const repeat = [...bdWins.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]);
for (const [pid, n] of repeat) {
  console.log(`  → ${careerByPid.get(pid)?.name ?? `Player ${pid}`} won it ${n} times`);
}

// ── International ─────────────────────────────────────────────────────────
rule("WORLD CUP");
for (const t of league.international?.history ?? []) {
  const f = t.finalScore;
  const pens = f.pens ? ` (pens ${f.pens.champion}-${f.pens.runnerUp})` : "";
  const scorer = t.topScorer ? `  top scorer ${t.topScorer.name ?? `Player ${t.topScorer.pid}`} (${t.topScorer.nation}, ${t.topScorer.goals})` : "";
  console.log(`  s${t.season}  ${t.champion} beat ${t.runnerUp} ${f.champion}-${f.runnerUp}${pens}${scorer}`);
}

// ── Oddities: things worth a raised eyebrow ───────────────────────────────
rule("ODDITIES");
const oddities: string[] = [];

// A promoted club winning the top flight, or a champion going down.
for (let i = 1; i < league.seasonHistory.length; i++) {
  const prev = league.seasonHistory[i - 1];
  const cur = league.seasonHistory[i];
  for (const [compIdStr, championTid] of Object.entries(cur.championTidByCompId)) {
    const compId = Number(compIdStr);
    const prevComp = prev.compsByTid[championTid];
    if (prevComp !== undefined && prevComp !== compId) {
      const prevTier = competitionOf(league.competitions, prevComp).tier;
      if (prevTier === 2) {
        oddities.push(`s${cur.season}: ${nameOf(championTid)} won ${competitionOf(league.competitions, compId).name} the season after promotion`);
      }
    }
  }
}
// An unbeaten or nearly-unbeaten league season.
for (const t of book.bestTeamSeasons) {
  if (t.row.lost === 0) oddities.push(`s${t.season}: ${nameOf(t.tid)} went the whole league season UNBEATEN (${t.row.won}W ${t.row.drawn}D)`);
  else if (t.row.lost === 1) oddities.push(`s${t.season}: ${nameOf(t.tid)} lost just one league game all season`);
}
// A player who outscored his own age, or hit a round number.
for (const c of book.seasonGoals.slice(0, 12)) {
  if (c.best.goals.value >= 38) {
    oddities.push(`${c.name} scored ${c.best.goals.value} in a single season (s${c.best.goals.season}) — more than one a game`);
  }
}
// One-club men among the long careers.
for (const c of book.longestCareers.slice(0, 12)) {
  if (c.clubs.length === 1 && c.seasonsPlayed >= 12) {
    oddities.push(`${c.name} played all ${c.seasonsPlayed} of his seasons for ${nameOf(c.clubs[0])}`);
  }
}
// A club that has never once reached the top flight, or never won anything.
const neverTop = trivia.records.filter((r) => r.seasons >= SEASONS - 2 && r.topFlightSeasons === 0);
if (neverTop.length) {
  oddities.push(`${neverTop.length} clubs spent every one of ${SEASONS} seasons in the second tier without a single promotion`);
}

for (const o of oddities.slice(0, 14)) console.log(`  • ${o}`);
if (!oddities.length) console.log("  (nothing unusual this run)");

console.log("");
