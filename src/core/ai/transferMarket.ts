import type { Player } from "../players/types.js";
import type { StoredTeam } from "../teams/clubs.js";
import type { PlayedMatch } from "../standings.js";
import type { CompletedTransfer } from "../transfers/negotiation.js";
import type { TransferWindowKind } from "../transfers/window.js";
import type { Competition } from "../competitions.js";
import { deriveLeagueContexts } from "./clubContext.js";
import { valueToClub, perceivedValueToClub } from "./evaluate.js";
import { trueTransferValue } from "../finance/valuation.js";
import { clampBudget } from "../finance/budget.js";
import { tierOf } from "../competitions.js";
import { keepsDepthFloor } from "../freeAgency.js";
import { mulberry32 } from "../../engine/rng.js";
import {
  ROSTER_CAP, ROSTER_SAFETY_FLOOR,
  AI_MARKET_MIN_VALUE, AI_MARKET_AVAILABILITY, AI_MARKET_MIN_SURPLUS,
  AI_MARKET_FEE_SHARE, AI_MARKET_FEE_FLOOR_FRACTION,
  AI_MARKET_MAX_BUYS, AI_MARKET_MAX_SELLS,
  AI_MARKET_RESERVE_FRACTION_MIN, AI_MARKET_RESERVE_FRACTION_MAX,
} from "../constants.js";

export interface AITransferResult {
  teams: StoredTeam[];
  transfers: CompletedTransfer[];
}

/** One evaluation-driven deal the market has decided is worth executing. */
interface Candidate {
  pid: number;
  sellerTid: number;
  buyerTid: number;
  /** Seller's keep-value (valueToClub to the current club) — the floor on the fee. */
  reservation: number;
  /** Buyer's (jittered) valuation — the ceiling on the fee. */
  buyerValue: number;
  /** Club-agnostic true market value — the anchor for AI_MARKET_FEE_FLOOR_FRACTION. */
  market: number;
  /** buyerValue − reservation: how much more useful he is to the buyer. */
  surplus: number;
}

/**
 * Run one round of AI↔AI transfers for an open window. The user's club
 * (`userTid`) never buys or sells — inbound offers for the user's players are
 * a later phase. Only rosters and budgets change (a player's contract travels
 * with him untouched), plus one CompletedTransfer logged per deal; the
 * `players` array is returned to the caller unchanged.
 *
 * The whole market is a single comparison applied everywhere: a player's
 * reservation price is his value to his *current* club, and he moves to
 * whichever other club values him enough more to clear that reservation and
 * afford the fee. Surplus dumping, sell-at-peak, and needs-based buying all
 * fall out of that — no scripted "if rebuilding…" branches.
 *
 * Determinism: valuations are taken as a snapshot at window open (contexts
 * are not recomputed between deals in the same window), deals execute in
 * descending-surplus order, and the only randomness is a seeded per-buyer
 * valuation jitter. Budgets, roster room, per-club move caps, and the
 * seller's positional depth floor are all enforced live as deals execute.
 *
 * @param season  the season the acquired squads will play (age/valuation basis)
 * @param played  results so far this season, for the clubs' form context
 * @param phase   "regular" charges the buyer the player's season wage on top
 *                of the fee (mid-season signings are paid up front); in the
 *                offseason the upcoming season-start charge covers wages.
 */
export function runAITransferMarket(
  teams: StoredTeam[],
  players: Player[],
  transfers: CompletedTransfer[],
  season: number,
  played: PlayedMatch[],
  window: TransferWindowKind,
  phase: "regular" | "offseason",
  userTid: number,
  seed: number,
  competitions: Competition[],
): AITransferResult {
  const contexts = deriveLeagueContexts({ teams, players, season, played, competitions });
  const playerMap = new Map(players.map((p) => [p.pid, p]));
  const jitter = mulberry32(seed);

  // Assemble every deal that looks worthwhile at window open. Valuations are
  // read from this snapshot; live roster/budget state is applied later.
  const candidates: Candidate[] = [];
  for (const seller of teams) {
    if (seller.tid === userTid) continue;
    const sellerCtx = contexts.get(seller.tid);
    if (!sellerCtx) continue;

    for (const pid of seller.roster) {
      const player = playerMap.get(pid);
      if (!player) continue;

      const market = trueTransferValue(player, season);
      if (market < AI_MARKET_MIN_VALUE) continue;

      // Reservation = what the player is worth to his current club. Only
      // shop players the club doesn't value above their market price.
      // (Division 2's strength ceiling is enforced separately and
      // deterministically — see enforceDivision2Ceiling — so this market
      // doesn't need any Division-2-specific carve-out of its own.)
      const reservation = valueToClub(player, sellerCtx);
      if (reservation > market * AI_MARKET_AVAILABILITY) continue;

      for (const buyer of teams) {
        if (buyer.tid === seller.tid || buyer.tid === userTid) continue;
        const buyerCtx = contexts.get(buyer.tid);
        if (!buyerCtx) continue;

        const jittered = perceivedValueToClub(player, buyerCtx, jitter);
        if (jittered < reservation * (1 + AI_MARKET_MIN_SURPLUS)) continue;

        candidates.push({
          pid,
          sellerTid: seller.tid,
          buyerTid: buyer.tid,
          reservation,
          buyerValue: jittered,
          market,
          surplus: jittered - reservation,
        });
      }
    }
  }

  // Best (most mutually beneficial) deals first; deterministic tie-break.
  candidates.sort(
    (a, b) => b.surplus - a.surplus || a.pid - b.pid || a.buyerTid - b.buyerTid,
  );

  // Live mutable state.
  const roster = new Map(teams.map((t) => [t.tid, [...t.roster]]));
  const budget = new Map(teams.map((t) => [t.tid, t.budget]));
  const buys = new Map<number, number>();
  const sells = new Map<number, number>();
  const moved = new Set<number>();
  const executed: CompletedTransfer[] = [];

  for (const c of candidates) {
    if (moved.has(c.pid)) continue;
    if ((buys.get(c.buyerTid) ?? 0) >= AI_MARKET_MAX_BUYS) continue;
    if ((sells.get(c.sellerTid) ?? 0) >= AI_MARKET_MAX_SELLS) continue;

    const buyerRoster = roster.get(c.buyerTid)!;
    if (buyerRoster.length >= ROSTER_CAP) continue;

    // Re-check the seller's depth floor against the live roster (an earlier
    // sale this window may have already thinned this position).
    const sellerRoster = roster.get(c.sellerTid)!;
    if (!sellerRoster.includes(c.pid)) continue;
    if (!keepsDepthFloor({ ...teams.find((t) => t.tid === c.sellerTid)!, roster: sellerRoster }, playerMap, c.pid)) {
      continue;
    }
    // keepsDepthFloor only protects the sold player's own position — a club
    // can still sell AI_MARKET_MAX_SELLS players across several different
    // well-stocked positions and end up dangerously thin overall (a real
    // 22-team dynasty audit caught a club dropping to 19 total this way).
    // Guard the whole-roster floor too, same bar as the user's own academy
    // emergency call-up (ROSTER_SAFETY_FLOOR).
    if (sellerRoster.length <= ROSTER_SAFETY_FLOOR) continue;

    // The seller's reservation can be crushed well below true value by a bad
    // need/timeline/affordability fit; require the buyer to actually value
    // him at a reasonable fraction of true market value before the deal
    // executes, and floor the fee there too, so a lowballed seller can't be
    // flipped for many times the fee he was just sold for.
    const feeFloor = Math.round(AI_MARKET_FEE_FLOOR_FRACTION * c.market);
    if (c.buyerValue < feeFloor) continue;

    const player = playerMap.get(c.pid)!;
    const wageCharge = phase === "regular" ? player.contract.salary : 0;
    let fee = Math.max(
      feeFloor,
      Math.round(c.reservation + AI_MARKET_FEE_SHARE * (c.buyerValue - c.reservation)),
    );

    // A club spends only the surplus above its cash reserve (never its whole
    // budget), and covers any mid-season wage charge on top. The reserve
    // fraction rises with frugality — cautious/poorer clubs hold more back.
    // Measured against the live budget, so selling first frees up spend.
    const frugality = contexts.get(c.buyerTid)?.frugality ?? 0.5;
    const reserveFraction =
      AI_MARKET_RESERVE_FRACTION_MIN +
      frugality * (AI_MARKET_RESERVE_FRACTION_MAX - AI_MARKET_RESERVE_FRACTION_MIN);
    const spendable = (budget.get(c.buyerTid) ?? 0) * (1 - reserveFraction);

    // A fee squeezed down to the seller's reservation is still an acceptable
    // deal, but below it isn't (and neither is one the reserve won't cover).
    const affordableFee = spendable - wageCharge;
    if (affordableFee < fee) fee = affordableFee;
    if (fee < c.reservation) continue;

    // Execute: rosters swap, fee moves buyer→seller, buyer also eats any
    // mid-season wage charge. Money is conserved between the two clubs.
    roster.set(c.sellerTid, sellerRoster.filter((p) => p !== c.pid));
    buyerRoster.push(c.pid);
    const sellerCompId = teams.find((t) => t.tid === c.sellerTid)!.compId;
    budget.set(c.sellerTid, clampBudget((budget.get(c.sellerTid) ?? 0) + fee, tierOf(competitions, sellerCompId)));
    budget.set(c.buyerTid, (budget.get(c.buyerTid) ?? 0) - fee - wageCharge);
    moved.add(c.pid);
    buys.set(c.buyerTid, (buys.get(c.buyerTid) ?? 0) + 1);
    sells.set(c.sellerTid, (sells.get(c.sellerTid) ?? 0) + 1);
    executed.push({ pid: c.pid, fromTid: c.sellerTid, toTid: c.buyerTid, fee, season, window });
  }

  return {
    teams: teams.map((t) => ({ ...t, roster: roster.get(t.tid)!, budget: budget.get(t.tid)! })),
    transfers: [...transfers, ...executed],
  };
}
