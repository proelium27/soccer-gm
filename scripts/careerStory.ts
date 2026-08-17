/**
 * The season-by-season story of one career.
 *
 * Joins a player's own record to what his club and his country were doing at the
 * same time, which is the only way to answer "how did someone this good win
 * nothing" — the answer is always in the clubs' league finishes and the national
 * team's tournament record, not in the player's own numbers.
 *
 * Works for a live player or an archived retiree. A retiree keeps
 * `{season, tid, ovr, apps}` per season but no per-season goals (those are not
 * reconstructable once the stat lines go), so the goal column is blank for him
 * and the career totals carry the truth instead.
 *
 * Usage:
 *   NODE_OPTIONS=--max-old-space-size=20480 npx tsx scripts/careerStory.ts <save.json> "Player Name"
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import type { LeagueStore } from "../src/core/leagueState.js";
import { migrateLeague } from "../src/db/migrate.js";
import { allCareers } from "../src/core/frivolities/careers.js";

const [path, wanted] = process.argv.slice(2);
if (!path || !wanted) {
  console.error('usage: tsx scripts/careerStory.ts <save.json> "Player Name"');
  process.exit(1);
}

const buf = readFileSync(path);
const text = buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf).toString("utf8") : buf.toString("utf8");
const L = migrateLeague(JSON.parse(text) as LeagueStore);

const career = allCareers(L).find((c) => c.name === wanted);
if (!career) {
  console.error(`no career named "${wanted}" in this save`);
  process.exit(1);
}

const teamName = (tid: number | null | undefined) =>
  tid === null || tid === undefined || tid < 0 ? "—" : L.teams.find((t) => t.tid === tid)?.name ?? `club ${tid}`;
const comps = new Map(L.competitions.map((c) => [c.id, c]));
const histBySeason = new Map((L.seasonHistory ?? []).map((h) => [h.season, h]));
const cupBySeason = new Map((L.cupHistory ?? []).map((c) => [c.season, c]));

console.log(`\n${"=".repeat(78)}`);
console.log(`${career.name} — ${career.nationality}, ${career.pos}`);
console.log("=".repeat(78));
console.log(`seasons ${career.firstSeason}-${career.lastSeason} (${career.seasonsPlayed} played) · ` +
  `peak ovr ${career.peakOvr} in s${career.peakSeason} · ${career.active ? "still active" : "retired"}`);
console.log(`${career.totals.appearances} apps · ${career.totals.goals}G ${career.totals.assists}A · ` +
  `avg rating ${career.totals.avgRating.toFixed(2)} · ${career.caps} caps, ${career.intlGoals} intl goals`);

// ---------------------------------------------------------------- club story
console.log(`\n-- season by season (club, his rating, and where that club finished)`);
console.log(`  ssn  age  club                      ovr  apps   league finish        cup`);
for (const s of [...career.seasons].sort((a, b) => a.season - b.season)) {
  const h = histBySeason.get(s.season);
  let finish = "—";
  let compName = "";
  if (h) {
    const cid = h.compsByTid?.[s.tid];
    if (cid !== undefined) {
      const c = comps.get(Number(cid));
      compName = c ? `${c.country} T${c.tier}` : "";
      const table = (h.table ?? []).filter((r) => String(h.compsByTid[r.tid]) === String(cid));
      const sorted = [...table].sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);
      const pos = sorted.findIndex((r) => r.tid === s.tid) + 1;
      const me = table.find((r) => r.tid === s.tid);
      if (pos > 0) finish = `${String(pos).padStart(2)}/${table.length} ${compName} ${me?.points ?? "?"}pts`;
    }
  }
  // Cup: did his club take part that season, and how far did it get?
  let cup = "—";
  const cs = cupBySeason.get(s.season);
  if (cs) {
    const inLp = (cs.leaguePhase?.matches ?? []).some((m) => m.home === s.tid || m.away === s.tid);
    const inKo = (cs.ties ?? []).some((t) => t.home === s.tid || t.away === s.tid);
    if (cs.championTid === s.tid) cup = "WON IT";
    else if (inKo) {
      const rounds = (cs.ties ?? []).filter((t) => t.home === s.tid || t.away === s.tid);
      const last = rounds[rounds.length - 1];
      cup = last?.winner === s.tid ? "final" : `out in KO r${last?.round ?? "?"}`;
    } else if (inLp) cup = "league phase";
  }
  const age = s.season - career.born;
  console.log(`  ${String(s.season).padStart(3)}  ${String(age).padStart(3)}  ${teamName(s.tid).slice(0, 24).padEnd(24)} ` +
    `${String(s.ovr).padStart(3)}  ${String(s.apps ?? "").padStart(4)}   ${finish.padEnd(20)} ${cup}`);
}

// ---------------------------------------------------------------- how close
const nearMisses: string[] = [];
for (const s of career.seasons) {
  const h = histBySeason.get(s.season);
  if (!h) continue;
  const cid = h.compsByTid?.[s.tid];
  if (cid === undefined) continue;
  const table = (h.table ?? []).filter((r) => String(h.compsByTid[r.tid]) === String(cid));
  const sorted = [...table].sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);
  const pos = sorted.findIndex((r) => r.tid === s.tid) + 1;
  if (pos === 2 || pos === 3) {
    const gap = (sorted[0]?.points ?? 0) - (sorted[pos - 1]?.points ?? 0);
    nearMisses.push(`s${s.season} ${teamName(s.tid)} finished ${pos}${pos === 2 ? "nd" : "rd"}, ${gap} pts off the title`);
  }
}
console.log(`\n-- how close he came`);
console.log(nearMisses.length ? nearMisses.map((m) => `  ${m}`).join("\n") : "  never finished top three, anywhere");

// ---------------------------------------------------------------- transfers
console.log(`\n-- his transfers`);
const moves = (L.transfers ?? []).filter((t) => t.pid === career.pid).sort((a, b) => a.season - b.season);
if (!moves.length) console.log("  none recorded");
for (const t of moves) {
  const kind = t.loanReturn ? "loan return" : t.loanSeasons ? `loan ${t.loanSeasons}s` : t.fee > 0 ? `$${(t.fee / 1e6).toFixed(0)}M` : "free";
  console.log(`  s${String(t.season).padStart(2)} ${teamName(t.fromTid).padEnd(24)} -> ${teamName(t.toTid).padEnd(24)} ${kind}`);
}

// ---------------------------------------------------------------- his country
console.log(`\n-- ${career.nationality} while he was playing`);
const nat = career.nationality;
const inRange = (s: number) => s >= career.firstSeason && s <= career.lastSeason + 1;
const tours = (L.international?.history ?? []).filter((t) => inRange(t.season));
if (!tours.length) console.log("  no World Cups completed during his career");
for (const t of tours) {
  const played = (t.field ?? []).includes(nat);
  let line = `  s${String(t.season).padStart(2)} World Cup: ${t.champion} beat ${t.runnerUp} ` +
    `${t.finalScore.champion}-${t.finalScore.runnerUp}`;
  if (t.champion === nat) line += `  <-- ${nat} WON IT`;
  else if (t.runnerUp === nat) line += `  <-- ${nat} runners-up`;
  else if (played) {
    // how far did they get, from the knockout results?
    const ko = (t.knockout ?? []).filter((k) => k.home === nat || k.away === nat);
    const last = ko[ko.length - 1];
    line += last
      ? `  <-- ${nat} reached the ${last.round === 0 ? "quarter-final" : last.round === 1 ? "semi-final" : `round ${last.round}`}, lost ${last.winner === nat ? "" : `${last.homeGoals}-${last.awayGoals}`}`
      : `  <-- ${nat} went out in the group`;
  } else line += `  <-- ${nat} did not qualify`;
  console.log(line);
}
const quals = (L.international?.qualifyingHistory ?? []).filter((q) => inRange(q.season));
if (quals.length) {
  const made = quals.filter((q) => (q.qualified ?? []).includes(nat)).length;
  console.log(`  qualifying campaigns during his career: ${quals.length}, ${nat} qualified ${made}`);
}
console.log();
