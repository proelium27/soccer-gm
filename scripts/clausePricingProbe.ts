/**
 * Is a transfer clause priced honestly?
 *
 * A clause never adds money to a deal: the other club's total willingness to
 * pay is fixed, and the clause converts part of it from cash into contingency
 * (see core/transfers/clauses.ts). So the whole exploit surface is the pricing.
 * Over-price one and the user is robbed — he gives up more cash than the clause
 * is worth. **Under-price one and it is free money**, because he keeps nearly
 * the full cash fee *and* the upside, on every deal, forever. That is the
 * direction to worry about, and it is what this measures.
 *
 * The method deliberately does NOT require clauses to exist. It sims a world,
 * then for every completed transfer asks two questions off the same history:
 *
 *   PRICED    what `clauseValue` would have quoted at the moment of the deal
 *   REALIZED  what the clause would actually have paid, from what then happened
 *
 * A ratio of realized/priced near 1.0 means the model is honest. Well above 1
 * means the user is being handed value; well below 1 means he is overpaying for
 * contingency. Read the ratio, not either column alone — both scale with the
 * share and the world's fee level.
 *
 * It also reports the three inputs the model rests on, so
 * SELL_ON_RESALE_PROBABILITY and SELL_ON_PRICING_HORIZON can be set from
 * measurement rather than taste:
 *
 *   - how often a bought player is actually sold on inside the clause window
 *   - how long that takes when it happens
 *   - how often each bonus trigger really fires
 *
 * Caveat worth keeping: these are AI↔AI deals, and the user's own buying is not
 * drawn from the same distribution (he buys through `reservationPrice`, with a
 * difficulty scale on top). Treat the numbers as the market's central tendency,
 * which is what a club pricing a clause would have to go on anyway.
 *
 *   npx tsx scripts/clausePricingProbe.ts [seasons] [seed]
 */
import { createLeagueState } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { simOffseason } from "../src/core/offseason.js";
import { mulberry32 } from "../src/engine/rng.js";
import type { LeagueStore } from "../src/core/leagueState.js";
import type { Player } from "../src/core/players/types.js";
import type { CompletedTransfer } from "../src/core/transfers/negotiation.js";
import { isFreeAgentTid } from "../src/core/transfers/negotiation.js";
import { clauseValue, projectedValue, triggerProbability } from "../src/core/transfers/clauses.js";
import { deriveLeagueContexts } from "../src/core/ai/clubContext.js";
import type { StoredTeam } from "../src/core/teams/clubs.js";
import type { BonusTrigger } from "../src/core/transfers/clauses.js";
import { tierOf } from "../src/core/competitions.js";
import {
  SELL_ON_CLAUSE_SEASONS, SELL_ON_RESALE_PROBABILITY, SELL_ON_PRICING_HORIZON,
  BONUS_CLAUSE_SEASONS, BONUS_APPEARANCE_THRESHOLD, BONUS_GOAL_THRESHOLD,
} from "../src/core/constants.js";

const SEASONS = Number(process.argv[2] ?? 12);
const SEED = Number(process.argv[3] ?? 1);
/** The share to price the comparison at. Cancels out of the ratio. */
const SHARE = 0.2;

const money = (n: number) => `£${(n / 1_000_000).toFixed(2)}M`;
const pct = (n: number) => `${(100 * n).toFixed(1)}%`;

const rng = mulberry32(SEED);
let league = createLeagueState(0, rng);

/**
 * A snapshot per season of what we need to look BACK at, because the live
 * league only has today's players and today's tables. Ratings move every
 * offseason and a resold player must be priced as he was on the day he was
 * bought, not as he is now.
 */
interface Snapshot {
  season: number;
  players: Map<number, Player>;
  /** posWeakestStarterOvr per club, for the model's "will he play" terms. */
  weakestStarter: Map<number, Record<string, number> | undefined>;
  teams: Map<number, StoredTeam>;
  compIdByTid: Map<number, number>;
  qualified: Set<number>;
  rosterOf: Map<number, number>;
}
const snaps: Snapshot[] = [];

function snapshot(l: LeagueStore): Snapshot {
  const contexts = deriveLeagueContexts(l);
  const rosterOf = new Map<number, number>();
  for (const t of l.teams) for (const pid of t.roster) rosterOf.set(pid, t.tid);
  // Who is actually IN a continental competition this season.
  //
  // `CupState.teams` is the KNOCKOUT BRACKET, not the field — eight clubs, with
  // -1 in every slot until a result fills it. Reading that reported 0.0% of
  // buyers ever qualifying, which is the shape of trap CLAUDE.md warns about
  // twice for this type. The field is `leaguePhase.teams`.
  const qualified = new Set<number>([
    ...(l.cup?.leaguePhase?.teams ?? []),
    ...(l.shield?.leaguePhase?.teams ?? []),
  ]);
  return {
    season: l.season,
    // Shallow copies are enough: nothing here mutates a player, and the sim
    // replaces them wholesale each offseason rather than editing in place.
    players: new Map(l.players.map((p) => [p.pid, p])),
    weakestStarter: new Map(
      l.teams.map((t) => [t.tid, contexts.get(t.tid)?.posWeakestStarterOvr]),
    ),
    teams: new Map(l.teams.map((t) => [t.tid, t])),
    compIdByTid: new Map(l.teams.map((t) => [t.tid, t.compId])),
    qualified,
    rosterOf,
  };
}

process.stdout.write(`Simming ${SEASONS} seasons (seed ${SEED})…\n`);
for (let s = 0; s < SEASONS; s++) {
  snaps.push(snapshot(league));
  league = simThrough(league, "season", rng);
  league = simOffseason(league, rng);
}
snaps.push(snapshot(league));

const snapAt = (season: number) => snaps.find((s) => s.season === season);

/** Only real club↔club sales: a free transfer or a loan has no fee to share. */
const sales: CompletedTransfer[] = league.transfers.filter(
  (t) => !isFreeAgentTid(t.fromTid) && !isFreeAgentTid(t.toTid)
    && t.loanSeasons === undefined && !t.loanReturn && t.fee > 0,
);

// Indexed once: the naive `sales.find(...)` inside a loop over `sales` is
// quadratic, and a 12-season world has five figures of them.
const salesByPid = new Map<number, CompletedTransfer[]>();
for (const t of sales) {
  const list = salesByPid.get(t.pid);
  if (list) list.push(t); else salesByPid.set(t.pid, [t]);
}
const livePlayers = new Map(league.players.map((p) => [p.pid, p]));

/* ── Sell-on: what it would have been priced at, vs what it would have paid ── */

let pricedTotal = 0;
let realizedTotal = 0;
let n = 0;
let resold = 0;
let resoldAtProfit = 0;
let horizonSum = 0;
/** Deals where the model said one thing and reality said very much another. */
let bigUnderprice = 0;

for (const deal of sales) {
  const snap = snapAt(deal.season);
  if (!snap) continue;
  const player = snap.players.get(deal.pid);
  if (!player) continue;

  // What the buyer would have been charged for granting a SHARE sell-on.
  // `clauseValue` needs the obligor only for the bonus branch, so any club
  // object is fine here; pass the buyer's for honesty.
  const buyerComp = snap.compIdByTid.get(deal.toTid);
  if (buyerComp === undefined) continue;
  const obligor = { tid: deal.toTid, compId: buyerComp } as never;
  const priced = clauseValue(
    { kind: "sellOn", share: SHARE }, player, deal.season, deal.fee,
    obligor, league.competitions, null,
  );

  // What actually happened: did the buyer sell him on inside the window?
  const next = (salesByPid.get(deal.pid) ?? []).find(
    (t) => t.fromTid === deal.toTid
      && t.season > deal.season && t.season <= deal.season + SELL_ON_CLAUSE_SEASONS,
  );
  const realized = next ? Math.round(SHARE * Math.max(0, next.fee - deal.fee)) : 0;

  pricedTotal += priced;
  realizedTotal += realized;
  n++;
  if (next) {
    resold++;
    horizonSum += next.season - deal.season;
    if (next.fee > deal.fee) resoldAtProfit++;
  }
  if (realized > 3 * priced && realized > 1_000_000) bigUnderprice++;
}

/* ── Bonus triggers: how often do they really fire? ──────────────────────── */

let apps = 0, goals = 0, cont = 0, promo = 0, bonusN = 0;
// A top-flight buyer can never be promoted and a lower-tier one can never reach
// Europe, and the model scores both at exactly 0. Counting those deals in the
// denominator would report a rate the model is not even trying to predict, so
// each team trigger gets its own eligible count.
let promoEligible = 0, contEligible = 0;
const TRIGGERS: BonusTrigger[] = ["appearances", "goals", "continental", "promotion"];
const predicted = new Map<BonusTrigger, number>(TRIGGERS.map((t) => [t, 0]));
const predictedN = new Map<BonusTrigger, number>(TRIGGERS.map((t) => [t, 0]));
for (const deal of sales) {
  const snap = snapAt(deal.season);
  if (!snap) continue;
  bonusN++;
  const buyerComp0 = snap.compIdByTid.get(deal.toTid);
  const buyerTier = buyerComp0 === undefined ? 0 : tierOf(league.competitions, buyerComp0);
  if (buyerTier === 1) contEligible++;
  if (buyerTier > 1) promoEligible++;
  const obligor = snap.teams.get(deal.toTid);
  const player = snap.players.get(deal.pid);
  if (obligor && player) {
    const starter = snap.weakestStarter.get(deal.toTid)?.[player.pos] ?? null;
    for (const t of TRIGGERS) {
      // Skip the ones the model scores at a structural zero, so the average is
      // over the same population the realized rate is measured on.
      if (t === "continental" && buyerTier !== 1) continue;
      if (t === "promotion" && buyerTier === 1) continue;
      predicted.set(t, predicted.get(t)! + triggerProbability(
        t, player, obligor, league.competitions, starter, BONUS_CLAUSE_SEASONS,
      ));
      predictedN.set(t, predictedN.get(t)! + 1);
    }
  }
  let hitApps = false, hitGoals = false, hitCont = false, hitPromo = false;
  for (let k = 0; k < BONUS_CLAUSE_SEASONS; k++) {
    const season = deal.season + k;
    const later = snapAt(season + 1);
    if (!later) break;
    // Only while he is still at the buying club — the clause dies otherwise.
    if (later.rosterOf.get(deal.pid) !== deal.toTid) break;
    const live = livePlayers.get(deal.pid);
    const line = live?.stats.find((st) => st.season === season && st.tid === deal.toTid);
    if ((line?.appearances ?? 0) >= BONUS_APPEARANCE_THRESHOLD) hitApps = true;
    if ((line?.goals ?? 0) >= BONUS_GOAL_THRESHOLD) hitGoals = true;
    if (later.qualified.has(deal.toTid)) hitCont = true;
    const before = snapAt(season)?.compIdByTid.get(deal.toTid);
    const after = later.compIdByTid.get(deal.toTid);
    if (
      before !== undefined && after !== undefined
      && tierOf(league.competitions, before) > tierOf(league.competitions, after)
    ) hitPromo = true;
  }
  if (hitApps) apps++;
  if (hitGoals) goals++;
  if (hitCont) cont++;
  if (hitPromo) promo++;
}

/* ── Report ─────────────────────────────────────────────────────────────── */

const ratio = pricedTotal > 0 ? realizedTotal / pricedTotal : Number.NaN;

process.stdout.write(`
SELL-ON PRICING  (${n} club-to-club sales, share ${pct(SHARE)}, ${SEASONS} seasons, seed ${SEED})

  priced (what the model charges)   ${money(pricedTotal)}   mean ${money(pricedTotal / Math.max(1, n))}
  realized (what it would have paid) ${money(realizedTotal)}   mean ${money(realizedTotal / Math.max(1, n))}
  realized / priced                 ${ratio.toFixed(3)}   ${verdict(ratio)}

  deals where realized > 3x priced  ${bigUnderprice}  (${pct(bigUnderprice / Math.max(1, n))})

MODEL INPUTS  (set the constants from these, not from taste)

  resold inside ${SELL_ON_CLAUSE_SEASONS} seasons        ${pct(resold / Math.max(1, n))}   SELL_ON_RESALE_PROBABILITY = ${SELL_ON_RESALE_PROBABILITY}
  ...of those, at a profit          ${pct(resoldAtProfit / Math.max(1, resold))}
  mean seasons to resale            ${(horizonSum / Math.max(1, resold)).toFixed(2)}   SELL_ON_PRICING_HORIZON = ${SELL_ON_PRICING_HORIZON}

BONUS TRIGGER RATES  (within ${BONUS_CLAUSE_SEASONS} seasons, while still at the buying club; ${bonusN} deals)

  ${BONUS_APPEARANCE_THRESHOLD}+ appearances in a season      ${pct(apps / Math.max(1, bonusN))}
  ${BONUS_GOAL_THRESHOLD}+ goals in a season             ${pct(goals / Math.max(1, bonusN))}
  buyer in a continental cup        ${pct(cont / Math.max(1, contEligible))}   (of ${contEligible} top-flight buyers)
  buyer promoted                    ${pct(promo / Math.max(1, promoEligible))}   (of ${promoEligible} buyers below the top flight)

  Per season, which is what BONUS_BASE_PROBABILITY holds:
    appearances ${pct(perSeason(apps / Math.max(1, bonusN)))}   goals ${pct(perSeason(goals / Math.max(1, bonusN)))}

BONUS PRICING  (what the model predicts against what happened; 1.0 is honest)

${bonusRow("appearances", apps, bonusN)}
${bonusRow("goals", goals, bonusN)}
${bonusRow("continental", cont, contEligible)}
${bonusRow("promotion", promo, promoEligible)}

Note: a projected value is what the model thinks he'll be worth; at the median
deal that is ${money(medianProjection())}, against a median fee of ${money(medianFee())}.
`);

function bonusRow(t: BonusTrigger, hits: number, n: number): string {
  const pred = predicted.get(t)! / Math.max(1, predictedN.get(t)!);
  const real = hits / Math.max(1, n);
  const ratio = pred > 0 ? real / pred : Number.NaN;
  const flag = !Number.isFinite(ratio) ? ""
    : ratio > 1.25 ? "  UNDER-PRICED"
    : ratio < 0.8 ? "  OVER-PRICED"
    : "  ok";
  return `  ${t.padEnd(13)} predicted ${pct(pred).padStart(6)}   realized ${pct(real).padStart(6)}`
    + `   ratio ${Number.isFinite(ratio) ? ratio.toFixed(3) : "n/a"}${flag}`;
}

/** Undo the "at least once in BONUS_CLAUSE_SEASONS" compounding. */
function perSeason(overWindow: number): number {
  return 1 - (1 - Math.min(0.999, overWindow)) ** (1 / BONUS_CLAUSE_SEASONS);
}

function verdict(r: number): string {
  if (!Number.isFinite(r)) return "(no data)";
  if (r > 1.35) return "UNDER-PRICED — the user keeps the cash and the upside";
  if (r < 0.65) return "OVER-PRICED — the user pays too much for contingency";
  return "OK";
}

function medianFee(): number {
  const f = sales.map((s) => s.fee).sort((a, b) => a - b);
  return f[Math.floor(f.length / 2)] ?? 0;
}

function medianProjection(): number {
  const v: number[] = [];
  for (const deal of sales) {
    const snap = snapAt(deal.season);
    const p = snap?.players.get(deal.pid);
    if (p) v.push(projectedValue(p, deal.season, SELL_ON_PRICING_HORIZON));
  }
  v.sort((a, b) => a - b);
  return v[Math.floor(v.length / 2)] ?? 0;
}
