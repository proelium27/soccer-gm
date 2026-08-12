/**
 * How much of the market actually rides on AI_NEED_BUY_MIN_SURPLUS being 0?
 *
 * A "need buy" (buyer has a real positional gap) currently clears at the
 * seller's bare reservation — zero margin — so the seller is left exactly
 * indifferent and the seeded scouting-noise draw decides the deal. The comment
 * in transferMarket.ts calls a seller-side need-to-sell term the principled fix
 * for that and a positive floor on the constant the patch. Before building
 * either, this measures how many deals the zero margin is actually responsible
 * for, and whether they are the downhill moves the 2026-08-08 rework exists to
 * suppress.
 *
 * It cannot answer that by editing the constant and re-running: the constant is
 * live during the warm-up seasons too, so the two runs would be probing
 * different worlds. Instead it MIRRORS the candidate loop of
 * runAITransferMarket — same seeded jitter stream, same order — and reports the
 * margin each executed deal actually cleared by. The mirror is self-checking:
 * every executed deal must be found among the mirrored candidates, or the
 * numbers are not describing the real market and it says so.
 *
 *   npx tsx scripts/needBuyMarginProbe.ts [seasons] [seed]
 */
import { createLeagueState } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { simOffseason } from "../src/core/offseason.js";
import { mulberry32 } from "../src/engine/rng.js";
import { runAITransferMarket } from "../src/core/ai/transferMarket.js";
import { deriveLeagueContexts } from "../src/core/ai/clubContext.js";
import { keepValueToClub, perceivedValueToClub, hasPositionalGap } from "../src/core/ai/evaluate.js";
import { trueTransferValue } from "../src/core/finance/valuation.js";
import { moveAppealBetween, settledMultiplier, joinedSeasons } from "../src/core/transfers/playerWill.js";
import { tierOf } from "../src/core/competitions.js";
import {
  AI_NEED_BUY_MIN_SURPLUS,
  AI_MARKET_MIN_SURPLUS,
  AI_MARKET_MIN_VALUE,
  DIVISION_2_REFUSAL_OVR_THRESHOLD,
} from "../src/core/constants.js";

const SEASONS = Number(process.argv[2] ?? 6);
const SEED = Number(process.argv[3] ?? 1);
const MARKET_SEED = 12345;

const rng = mulberry32(SEED);
let league = createLeagueState(0, rng);
for (let s = 1; s < SEASONS; s++) {
  league = simThrough(league, "season", rng);
  league = simOffseason(league, rng);
}

const { teams, players, season, competitions } = league;
const userTid = league.meta.userTid;
const contexts = deriveLeagueContexts(league);
const byPid = new Map(players.map((p) => [p.pid, p]));

const res = runAITransferMarket(
  teams, players, league.activeLoans, league.transfers, season, league.played,
  "summer", league.phase, userTid, MARKET_SEED, competitions, new Set<number>(),
);
const deals = res.transfers.slice(league.transfers.length);

/* ── Mirror of the candidate loop, in the identical order. ───────────────── */
const jitter = mulberry32(MARKET_SEED);
const tierByTid = new Map(teams.map((t) => [t.tid, tierOf(competitions, t.compId)]));
const onLoanPids = new Set(league.activeLoans.map((l) => l.pid));
const joined = joinedSeasons(league.transfers);

/** key `${pid}:${sellerTid}:${buyerTid}` → what that pairing looked like. */
const seen = new Map<string, { margin: number; needBuy: boolean; reservation: number }>();

for (const seller of teams) {
  if (seller.tid === userTid) continue;
  const sellerCtx = contexts.get(seller.tid);
  if (!sellerCtx) continue;
  for (const pid of seller.roster) {
    if (onLoanPids.has(pid)) continue;
    const player = byPid.get(pid);
    if (!player) continue;
    const market = trueTransferValue(player, season);
    if (market < AI_MARKET_MIN_VALUE) continue;
    const reservation =
      keepValueToClub(player, sellerCtx) * settledMultiplier(joined.get(pid), season);

    for (const buyer of teams) {
      if (buyer.tid === seller.tid || buyer.tid === userTid) continue;
      const buyerCtx = contexts.get(buyer.tid);
      if (!buyerCtx) continue;
      const rawJittered = perceivedValueToClub(player, buyerCtx, jitter);
      const jittered = rawJittered * moveAppealBetween(player, sellerCtx, buyerCtx);
      if (tierByTid.get(buyer.tid) === 2 && player.ovr >= DIVISION_2_REFUSAL_OVR_THRESHOLD) continue;
      const needBuy = hasPositionalGap(player, buyerCtx);
      const minSurplus = needBuy ? AI_NEED_BUY_MIN_SURPLUS : AI_MARKET_MIN_SURPLUS;
      if (jittered < reservation * (1 + minSurplus)) continue;
      seen.set(`${pid}:${seller.tid}:${buyer.tid}`, {
        margin: reservation > 0 ? (jittered - reservation) / reservation : Infinity,
        needBuy,
        reservation,
      });
    }
  }
}

/* ── Report. ─────────────────────────────────────────────────────────────── */
let matched = 0;
let needBuys = 0;
let thin = 0;          // need buys that cleared by < 5% — the disputed population
let thinDownhill = 0;
let thinElite = 0;
let downhill = 0;
const steps: number[] = [];

for (const d of deals) {
  const from = contexts.get(d.fromTid);
  const to = contexts.get(d.toTid);
  if (from && to) {
    const step = to.squadStrength - from.squadStrength;
    steps.push(step);
    if (step < 0) downhill++;
  }
  const c = seen.get(`${d.pid}:${d.fromTid}:${d.toTid}`);
  if (!c) continue;
  matched++;
  if (!c.needBuy) continue;
  needBuys++;
  if (c.margin < 0.05) {
    thin++;
    const p = byPid.get(d.pid);
    if (p && p.ovr >= 78) thinElite++;
    if (from && to && to.squadStrength < from.squadStrength) thinDownhill++;
  }
}

steps.sort((a, b) => a - b);
const pctOf = (n: number): string => `${((n / deals.length) * 100).toFixed(1)}%`;

console.log(`season ${season}, seed ${SEED}, ${teams.length} clubs`);
console.log(`AI_MARKET_MIN_SURPLUS ${AI_MARKET_MIN_SURPLUS}  AI_NEED_BUY_MIN_SURPLUS ${AI_NEED_BUY_MIN_SURPLUS}\n`);
console.log(`deals executed              ${deals.length}`);
console.log(`  reproduced by the mirror  ${matched}${matched === deals.length ? "" : "  <-- MIRROR DIVERGED, numbers below are unreliable"}`);
console.log(`  downhill by squad ovr     ${downhill} (${pctOf(downhill)}), median step ${(steps[Math.floor(steps.length / 2)] ?? 0).toFixed(2)}`);
console.log(`\nneed buys (relaxed bar)     ${needBuys} (${pctOf(needBuys)})`);
console.log(`  cleared by under 5%       ${thin} (${pctOf(thin)} of all deals)  <-- what a floor or a need-to-sell term would touch`);
console.log(`    of those, downhill      ${thinDownhill}`);
console.log(`    of those, ovr 78+       ${thinElite}`);
