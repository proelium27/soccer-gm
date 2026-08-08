/**
 * Market-realism audit: measures the three complaints in the transfer market —
 *   1. stars move too often,
 *   2. fees are inflated (too many nine-figure deals),
 *   3. stars move to clubs that make no sense (downward moves).
 *
 * Read-only: runs headless dynasties and reports. Run with:
 *   npx tsx scripts/marketRealismAudit.ts
 */
import { mulberry32 } from "../src/engine/rng.js";
import { createLeagueState } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { simOffseason } from "../src/core/offseason.js";
import { simThroughInternational, isIntlStagePending } from "../src/core/international/staging.js";
import { tierOf } from "../src/core/competitions.js";
import type { LeagueStore } from "../src/core/leagueState.js";

const SEASONS = Number(process.env.SEASONS ?? 12);
const SEEDS = (process.env.SEEDS ?? "1,2,3").split(",").map(Number);
/** OVR at/above which we call a player a "star" for churn/destination stats. */
const STAR_OVR = 78;

function avg(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}
function fmtM(x: number): string {
  return `$${(x / 1e6).toFixed(0)}M`;
}

/** Mean ovr of a club's best 16 — the same shape the AI uses for squad strength. */
function strengthByTid(league: LeagueStore): Map<number, number> {
  const byPid = new Map(league.players.map((p) => [p.pid, p]));
  const m = new Map<number, number>();
  for (const t of league.teams) {
    const ovrs = t.roster
      .map((pid) => byPid.get(pid)?.ovr ?? 0)
      .sort((a, b) => b - a)
      .slice(0, 16);
    m.set(t.tid, avg(ovrs));
  }
  return m;
}

interface Row {
  season: number;
  paidMoves: number;
  bigFees: number;
  maxFee: number;
  starPool: number;
  starMoves: number;
  starDownMoves: number;
  starTierDrops: number;
  sweeps: number;
  loanMoves: number;
}

for (const seed of SEEDS) {
  console.log(`\n=== seed ${seed} ===`);
  const rng = mulberry32(seed);
  let league = createLeagueState(0, rng);

  const rows: Row[] = [];
  /** pid -> season of his previous paid move, for tenure-between-moves. */
  const lastMoveSeason = new Map<number, number>();
  const tenures: number[] = [];
  let seenTransfers = 0;

  for (let s = 1; s <= SEASONS; s++) {
    league = simThrough(league, "season", rng);
    if (isIntlStagePending(league.international)) {
      const r = simThroughInternational(league.international, league.players, league.lid, league.season);
      league = { ...league, international: r.international, players: r.players };
    }
    league = simOffseason(league, rng);

    const strength = strengthByTid(league);
    const byPid = new Map(league.players.map((p) => [p.pid, p]));
    const tidOf = new Map<number, number>();
    for (const t of league.teams) for (const pid of t.roster) tidOf.set(pid, t.tid);
    const tierByTid = new Map(league.teams.map((t) => [t.tid, tierOf(league.competitions, t.compId)]));

    // Every transfer logged this cycle (both windows), excluding free-agent
    // arrivals (fromTid === -1 sentinel) so we measure the paid market only.
    const fresh = league.transfers.slice(seenTransfers);
    seenTransfers = league.transfers.length;
    const permanent = fresh.filter(
      (t) => t.fromTid >= 0 && t.toTid >= 0 && !t.loanSeasons && !t.loanReturn,
    );
    const paid = permanent.filter((t) => t.fee > 0);
    const sweeps = permanent.length - paid.length;
    const loanMoves = fresh.filter((t) => t.loanSeasons).length;

    const starPool = league.players.filter(
      (p) => p.ovr >= STAR_OVR && tidOf.has(p.pid) && tierByTid.get(tidOf.get(p.pid)!) === 1,
    ).length;

    let starMoves = 0;
    let starDownMoves = 0;
    let starTierDrops = 0;
    let maxFee = 0;
    let bigFees = 0;

    for (const t of paid) {
      maxFee = Math.max(maxFee, t.fee);
      if (t.fee >= 100e6) bigFees++;
      const p = byPid.get(t.pid);
      if (!p || p.ovr < STAR_OVR) continue;
      starMoves++;
      const from = strength.get(t.fromTid) ?? 0;
      const to = strength.get(t.toTid) ?? 0;
      if (to < from) starDownMoves++;
      if ((tierByTid.get(t.fromTid) ?? 1) === 1 && (tierByTid.get(t.toTid) ?? 1) === 2) starTierDrops++;

      const prev = lastMoveSeason.get(t.pid);
      if (prev !== undefined) tenures.push(t.season - prev);
      lastMoveSeason.set(t.pid, t.season);
    }

    rows.push({
      season: s,
      paidMoves: paid.length,
      bigFees,
      maxFee,
      starPool,
      starMoves,
      starDownMoves,
      starTierDrops,
      sweeps,
      loanMoves,
    });
  }

  // Skip season 1 (no prior market state) when averaging.
  const r = rows.slice(1);
  const starMoveRate = (100 * avg(r.map((x) => x.starMoves))) / Math.max(1, avg(r.map((x) => x.starPool)));
  console.log(`paid moves/season          ${avg(r.map((x) => x.paidMoves)).toFixed(0)}  (+${avg(r.map((x) => x.sweeps)).toFixed(0)} free ceiling-sweep moves, ${avg(r.map((x) => x.loanMoves)).toFixed(0)} loans)`);
  console.log(`fees >= $100M per season   ${avg(r.map((x) => x.bigFees)).toFixed(1)}`);
  console.log(`biggest fee seen           ${fmtM(Math.max(...rows.map((x) => x.maxFee)))}`);
  console.log(`star pool (ovr>=${STAR_OVR}, D1)  ${avg(r.map((x) => x.starPool)).toFixed(0)}`);
  console.log(`star moves/season          ${avg(r.map((x) => x.starMoves)).toFixed(1)}  (${starMoveRate.toFixed(0)}% of the star pool moves each season)`);
  console.log(
    `  ...to a WEAKER squad     ${(
      (100 * avg(r.map((x) => x.starDownMoves))) /
      Math.max(0.01, avg(r.map((x) => x.starMoves)))
    ).toFixed(0)}%`,
  );
  console.log(`  ...down into division 2  ${avg(r.map((x) => x.starTierDrops)).toFixed(2)}/season`);
  console.log(`seasons between repeat moves: median ${median(tenures)}, mean ${avg(tenures).toFixed(1)} (n=${tenures.length})`);
}
