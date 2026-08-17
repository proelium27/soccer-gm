/**
 * Hunts for the dramatic shapes in a season history that a leaderboard misses.
 *
 * Leaderboards find extremes; this finds *turns* — a club that went unbeaten, a
 * champion relegated the following year, a promoted side that won the thing, a
 * forty-season wait that finally ended. Those are the events a reader remembers,
 * and none of them are a maximum of anything.
 *
 * Usage:
 *   NODE_OPTIONS=--max-old-space-size=20480 npx tsx scripts/storyHunt.ts [dir]
 */
import { readFileSync, readdirSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import type { LeagueStore } from "../src/core/leagueState.js";
import { migrateLeague } from "../src/db/migrate.js";

const dir = process.argv[2] ?? "/Users/calebmeyer/soccer-gm/leaguesaves";

type Row = { world: string; text: string; sort: number };
const unbeaten: Row[] = [];
const swings: Row[] = [];
const droughtsEnded: Row[] = [];
const promotedChamps: Row[] = [];
const champsRelegated: Row[] = [];
const cupDrama: Row[] = [];
const cupOutsiders: Row[] = [];

for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
  const buf = readFileSync(`${dir}/${file}`);
  const text = buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf).toString("utf8") : buf.toString("utf8");
  const L: LeagueStore = migrateLeague(JSON.parse(text) as LeagueStore);
  const userTid = L.meta.userTid;
  const world = L.teams.find((t) => t.tid === userTid)?.name ?? L.meta.name;
  const name = (tid: number) => L.teams.find((t) => t.tid === tid)?.name ?? `club ${tid}`;
  const comps = new Map(L.competitions.map((c) => [c.id, c]));
  const mine = (tid: number) => (tid === userTid ? " [MANAGED]" : "");

  const hist = [...(L.seasonHistory ?? [])].sort((a, b) => a.season - b.season);

  // position of every club in its own competition, per season
  const posBySeason = new Map<number, Map<number, { pos: number; of: number; tier: number; pts: number; row: any }>>();
  for (const h of hist) {
    const m = new Map<number, { pos: number; of: number; tier: number; pts: number; row: any }>();
    const byComp = new Map<number, any[]>();
    for (const r of h.table ?? []) {
      const cid = Number(h.compsByTid?.[r.tid]);
      if (!Number.isFinite(cid)) continue;
      byComp.set(cid, [...(byComp.get(cid) ?? []), r]);
    }
    for (const [cid, rows] of byComp) {
      const sorted = [...rows].sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);
      sorted.forEach((r, i) => m.set(r.tid, { pos: i + 1, of: rows.length, tier: comps.get(cid)?.tier ?? 1, pts: r.points, row: r }));
      // an unbeaten league season
      for (const r of rows) {
        if (r.played > 0 && r.lost === 0) {
          unbeaten.push({
            world, sort: r.points,
            text: `${name(r.tid)}${mine(r.tid)} went the whole of season ${h.season} unbeaten — ` +
              `${r.won}W ${r.drawn}D 0L, ${r.points} pts, ${r.gf} scored ${r.ga} conceded (tier ${comps.get(cid)?.tier})`,
          });
        }
      }
    }
    posBySeason.set(h.season, m);
  }

  // turns between consecutive seasons
  const seasons = hist.map((h) => h.season);
  for (let i = 1; i < seasons.length; i++) {
    const prev = posBySeason.get(seasons[i - 1])!;
    const now = posBySeason.get(seasons[i])!;
    for (const [tid, b] of now) {
      const a = prev.get(tid);
      if (!a) continue;
      // champion the year after promotion
      if (b.pos === 1 && b.tier === 1 && a.tier === 2) {
        promotedChamps.push({ world, sort: seasons[i], text:
          `${name(tid)}${mine(tid)} came up from the second tier and won the league at the first attempt, season ${seasons[i]}` });
      }
      // huge points swing inside the same tier. Tier matters to how a reader
      // reads it: a 20th-to-1st swing is necessarily second tier, because 20th
      // in the top flight is relegated and so changes tier.
      if (a.tier === b.tier) {
        const d = b.pts - a.pts;
        if (Math.abs(d) >= 45) {
          swings.push({ world, sort: Math.abs(d), text:
            `${name(tid)}${mine(tid)} went from ${a.pts} points (${a.pos}${a.pos === 1 ? "st" : "th"}) in season ${seasons[i - 1]} ` +
            `to ${b.pts} (${b.pos}${b.pos === 1 ? "st" : "th"}) in season ${seasons[i]} — a swing of ${d > 0 ? "+" : ""}${d}` +
            `  [${b.tier === 1 ? "top flight" : "second tier"}]` });
        }
      }
    }
  }

  // Champion to relegated. Not a one-season check: 20th in the top flight is
  // still tier 1 that season and only drops the *following* one, so a champion
  // who collapses shows up two steps later. Look forward a few seasons instead.
  for (const h of hist) {
    for (const [cid, tid] of Object.entries(h.championTidByCompId ?? {})) {
      if (comps.get(Number(cid))?.tier !== 1) continue;
      for (const later of seasons.filter((s) => s > h.season && s <= h.season + 3)) {
        const p = posBySeason.get(later)?.get(tid as number);
        if (p && p.tier === 2) {
          champsRelegated.push({ world, sort: later - h.season, text:
            `${name(tid as number)}${mine(tid as number)} won the league in season ${h.season} and were ` +
            `playing second-tier football by season ${later} — ${later - h.season} season(s) later` });
          break;
        }
      }
    }
  }

  // droughts that ended: gap between a club's tier-1 titles
  const titleSeasons = new Map<number, number[]>();
  for (const h of hist) {
    for (const [cid, tid] of Object.entries(h.championTidByCompId ?? {})) {
      if (comps.get(Number(cid))?.tier !== 1) continue;
      titleSeasons.set(tid as number, [...(titleSeasons.get(tid as number) ?? []), h.season]);
    }
  }
  for (const [tid, ss] of titleSeasons) {
    for (let i = 1; i < ss.length; i++) {
      const gap = ss[i] - ss[i - 1];
      if (gap >= 20) {
        droughtsEnded.push({ world, sort: gap, text:
          `${name(tid)}${mine(tid)} won the league in season ${ss[i - 1]}, then waited ${gap} seasons and won it again in season ${ss[i]}` });
      }
    }
  }

  // cup drama: finals on penalties, and winners from outside the top four
  for (const cup of [...(L.cupHistory ?? []), ...(L.cup ? [L.cup] : [])]) {
    const final = (cup.ties ?? []).filter((t) => t.winner !== null).sort((a, b) => b.round - a.round)[0];
    if (final && cup.championTid !== null) {
      if (final.wentToPens) {
        cupDrama.push({ world, sort: cup.season, text:
          `${name(cup.championTid)}${mine(cup.championTid)} won the Continental Cup of season ${cup.season} on penalties, ` +
          `${final.homePens}-${final.awayPens} after ${final.homeGoals}-${final.awayGoals}` });
      } else if (final.wentToExtraTime) {
        cupDrama.push({ world, sort: cup.season, text:
          `${name(cup.championTid)}${mine(cup.championTid)} won the Continental Cup of season ${cup.season} in extra time` });
      }
      // where did the winner finish at home that season?
      const p = posBySeason.get(cup.season)?.get(cup.championTid);
      if (p && p.pos >= 5) {
        cupOutsiders.push({ world, sort: p.pos, text:
          `${name(cup.championTid)}${mine(cup.championTid)} won the Continental Cup in season ${cup.season} ` +
          `while finishing ${p.pos}th of ${p.of} in their own league` });
      }
    }
  }
}

const show = (title: string, rows: Row[], desc = true, n = 10) => {
  console.log(`\n${"=".repeat(76)}\n${title}\n${"=".repeat(76)}`);
  const sorted = [...rows].sort((a, b) => (desc ? b.sort - a.sort : a.sort - b.sort)).slice(0, n);
  if (!sorted.length) console.log("  (none found)");
  for (const r of sorted) console.log(`  ${r.text}\n      — ${r.world} world`);
};

show("UNBEATEN SEASONS", unbeaten);
show("PROMOTED, THEN CHAMPIONS", promotedChamps, false);
show("CHAMPIONS, THEN RELEGATED", champsRelegated, false);
show("DROUGHTS THAT FINALLY ENDED", droughtsEnded);
show("BIGGEST SEASON-TO-SEASON SWINGS", swings);
show("CUP FINALS DECIDED IN EXTRA TIME OR ON PENALTIES", cupDrama, false, 12);
show("CUP WINNERS WHO WERE NOWHERE IN THEIR OWN LEAGUE", cupOutsiders);
console.log();
