import type { Player } from "../players/types.js";
import type { LeagueStore } from "../leagueState.js";
import type { ClubContext } from "../ai/clubContext.js";
import type { TransferWindowKind } from "./window.js";
import type { StoredTeam } from "../teams/clubs.js";
import { transferWindowState } from "./window.js";
import {
  windowSeed, departsAtRollover, acquisitionWageCharge, hasRosterRoom, executeTransfer,
} from "./negotiation.js";
import { deriveLeagueContexts } from "../ai/clubContext.js";
import { valueToClub, perceivedValueToClub } from "../ai/evaluate.js";
import { mulberry32 } from "../../engine/rng.js";
import {
  AI_MARKET_MIN_SURPLUS, AI_MARKET_FEE_SHARE,
  AI_MARKET_RESERVE_FRACTION_MIN, AI_MARKET_RESERVE_FRACTION_MAX,
  INBOUND_OFFERS_MAX,
  NEGOTIATION_LOWBALL_FACTOR, NEGOTIATION_MAX_ROUNDS,
  COUNTER_PADDING_START, COUNTER_PADDING_DECAY,
} from "../constants.js";

/**
 * What a buyer can actually spend right now without dipping into its cash
 * reserve (see AI_MARKET_RESERVE_FRACTION_* — same reserve rule the AI↔AI
 * market uses, so a rich club chasing one of the user's players doesn't get
 * spent to zero any more than it would chasing another club's).
 */
export function buyerSpendable(buyer: StoredTeam, buyerCtx: ClubContext, wageCharge: number): number {
  const reserveFraction =
    AI_MARKET_RESERVE_FRACTION_MIN +
    buyerCtx.frugality * (AI_MARKET_RESERVE_FRACTION_MAX - AI_MARKET_RESERVE_FRACTION_MIN);
  return buyer.budget * (1 - reserveFraction) - wageCharge;
}

/**
 * An AI club's live interest in one of the user's players, scoped to a
 * single window. Unlike TransferNegotiation (user↔club, user is the buyer),
 * the user is the seller here and the AI club is the buyer.
 */
export interface InboundOffer {
  pid: number;
  buyerTid: number;
  season: number;
  window: TransferWindowKind;
  /** Buyer's offer history, most recent last (starts with their opening offer). */
  offers: number[];
  /** The user's ask history, most recent last — empty until the user counters. */
  asks: number[];
  status: "open" | "accepted" | "rejected" | "collapsed";
}

/** A not-yet-negotiated inbound offer, freshly computed from current league state. */
export interface InboundOfferCandidate {
  player: Player;
  buyerTid: number;
  /** The player's value to the user's own club — the floor a sale must clear. */
  reservation: number;
  /** The buyer's (jittered) willingness-to-pay ceiling. */
  ceiling: number;
  /** reservation + AI_MARKET_FEE_SHARE * (ceiling - reservation), rounded. */
  openingOffer: number;
}

/**
 * Inbound offers for the user's players this window: for each roster player,
 * the single AI club that values him most (if any club clears him by at
 * least AI_MARKET_MIN_SURPLUS above his worth to the user's own club),
 * capped to the INBOUND_OFFERS_MAX most compelling. Reuses the exact same
 * valueToClub primitive and fee-split math as the AI↔AI market (phase 2) —
 * the user's club is just one more context in that comparison. Deterministic
 * within a window (a per-player seeded scouting-noise jitter on the buyer's
 * valuation via perceivedValueToClub, the same role it plays in the AI↔AI
 * market); empty when no window is open or nobody clears the bar.
 */
export function inboundOfferCandidates(league: LeagueStore): InboundOfferCandidate[] {
  const ws = transferWindowState(league);
  if (!ws.open) return [];

  const userTid = league.meta.userTid;
  const user = league.teams.find((t) => t.tid === userTid);
  if (!user) return [];

  const contexts = deriveLeagueContexts({
    teams: league.teams, players: league.players, season: league.season, played: league.played,
    competitions: league.competitions,
  });
  const userCtx = contexts.get(userTid);
  if (!userCtx) return [];

  const playerMap = new Map(league.players.map((p) => [p.pid, p]));

  const candidates: InboundOfferCandidate[] = [];
  for (const pid of user.roster) {
    const player = playerMap.get(pid);
    if (!player) continue;
    if (departsAtRollover(league, player)) continue;

    const reservation = valueToClub(player, userCtx);
    const wageCharge = acquisitionWageCharge(league, player);
    const jitter = mulberry32(windowSeed(league.lid, ws.season, ws.window, pid, 4));

    let best: InboundOfferCandidate | null = null;
    for (const buyer of league.teams) {
      if (buyer.tid === userTid) continue;
      const buyerCtx = contexts.get(buyer.tid);
      if (!buyerCtx) continue;

      const rawCeiling = perceivedValueToClub(player, buyerCtx, jitter);
      // A buyer only shows up as a candidate if it can actually pay a fair
      // fee without dipping into its cash reserve — otherwise the offer
      // would just fail affordability at accept time (see buyerSpendable).
      const ceiling = Math.min(rawCeiling, buyerSpendable(buyer, buyerCtx, wageCharge));
      if (ceiling < reservation * (1 + AI_MARKET_MIN_SURPLUS)) continue;
      if (!best || ceiling > best.ceiling) {
        best = {
          player,
          buyerTid: buyer.tid,
          reservation,
          ceiling,
          openingOffer: Math.round(reservation + AI_MARKET_FEE_SHARE * (ceiling - reservation)),
        };
      }
    }
    if (best) candidates.push(best);
  }

  return candidates
    .sort(
      (a, b) =>
        (b.ceiling - b.reservation) - (a.ceiling - a.reservation) || a.player.pid - b.player.pid,
    )
    .slice(0, INBOUND_OFFERS_MAX);
}

/** Inbound offers (negotiated or not) for the currently open window. */
export function currentInboundOffers(league: LeagueStore): InboundOffer[] {
  const ws = transferWindowState(league);
  if (!ws.open) return [];
  return league.inboundOffers.filter((o) => o.season === ws.season && o.window === ws.window);
}

function upsertInboundOffer(league: LeagueStore, offer: InboundOffer): InboundOffer[] {
  const rest = league.inboundOffers.filter(
    (o) => !(o.season === offer.season && o.window === offer.window && o.pid === offer.pid),
  );
  return [...rest, offer];
}

/** The live offer on the table for a player: persisted state if talks have started, else the fresh candidate. */
function resolveOpenOffer(
  league: LeagueStore,
  pid: number,
): { buyerTid: number; fee: number; offers: number[]; asks: number[] } | null {
  const ws = transferWindowState(league);
  if (!ws.open) return null;

  const existing = league.inboundOffers.find(
    (o) => o.pid === pid && o.season === ws.season && o.window === ws.window,
  );
  if (existing) {
    if (existing.status !== "open") return null;
    return {
      buyerTid: existing.buyerTid,
      fee: existing.offers.at(-1)!,
      offers: existing.offers,
      asks: existing.asks,
    };
  }

  const candidate = inboundOfferCandidates(league).find((c) => c.player.pid === pid);
  if (!candidate) return null;
  return { buyerTid: candidate.buyerTid, fee: candidate.openingOffer, offers: [candidate.openingOffer], asks: [] };
}

export type InboundResponse =
  | { kind: "accepted"; fee: number }
  | { kind: "countered"; offer: number }
  | { kind: "collapsed" };

/**
 * Mirror image of respondToOffer (negotiation.ts): the buyer's ceiling plays
 * the role of the seller's reservation, and the user's ask plays the role of
 * the buyer's offer, with every "higher is better" comparison flipped to
 * "lower is better". Reuses the exact same tuning constants so both
 * directions of the market haggle at the same pace and give up at the same
 * point.
 */
export function respondToAsk(ceiling: number, ask: number, priorAsks: number[]): InboundResponse {
  if (ask <= ceiling) return { kind: "accepted", fee: ask };
  if (ask > ceiling / NEGOTIATION_LOWBALL_FACTOR) return { kind: "collapsed" };
  const bestPrior = priorAsks.length > 0 ? Math.min(...priorAsks) : null;
  if (bestPrior !== null && ask >= bestPrior) return { kind: "collapsed" };
  if (priorAsks.length + 1 >= NEGOTIATION_MAX_ROUNDS) return { kind: "collapsed" };
  const padding = COUNTER_PADDING_START * COUNTER_PADDING_DECAY ** priorAsks.length;
  return { kind: "countered", offer: Math.round(ceiling * (1 - padding)) };
}

/**
 * Accept the buyer's current offer (their opening bid, or a raised counter
 * from a prior round) at face value. No-op unless a window is open, an offer
 * is actually on the table, and the buyer can still afford it (its budget or
 * roster may have moved since the offer was computed).
 */
export function acceptInboundOffer(league: LeagueStore, pid: number): LeagueStore {
  const ws = transferWindowState(league);
  if (!ws.open) return league;

  const resolved = resolveOpenOffer(league, pid);
  if (!resolved) return league;

  const buyer = league.teams.find((t) => t.tid === resolved.buyerTid);
  const player = league.players.find((p) => p.pid === pid);
  if (!buyer || !player) return league;
  if (departsAtRollover(league, player)) return league;
  if (!hasRosterRoom(buyer)) return league;

  const wageCharge = acquisitionWageCharge(league, player);
  if (resolved.fee + wageCharge > buyer.budget) return league;

  const accepted: InboundOffer = {
    pid, buyerTid: resolved.buyerTid, season: ws.season, window: ws.window,
    offers: resolved.offers, asks: resolved.asks, status: "accepted",
  };
  const updated: LeagueStore = { ...league, inboundOffers: upsertInboundOffer(league, accepted) };
  return executeTransfer(
    updated, pid, league.meta.userTid, resolved.buyerTid, resolved.fee, wageCharge, ws.season, ws.window,
  );
}

/** Turn down the offer on the table outright — talks end for this window. */
export function rejectInboundOffer(league: LeagueStore, pid: number): LeagueStore {
  const ws = transferWindowState(league);
  if (!ws.open) return league;

  const resolved = resolveOpenOffer(league, pid);
  if (!resolved) return league;

  const rejected: InboundOffer = {
    pid, buyerTid: resolved.buyerTid, season: ws.season, window: ws.window,
    offers: resolved.offers, asks: resolved.asks, status: "rejected",
  };
  return { ...league, inboundOffers: upsertInboundOffer(league, rejected) };
}

/**
 * Ask the buyer for more. The buyer re-evaluates against a freshly computed
 * ceiling (their willingness-to-pay may have shifted since the opening offer
 * if the roster/budget state moved) and either meets the ask, raises their
 * offer partway, or walks — via respondToAsk, mirroring how an AI seller
 * responds to the user's outgoing offers.
 */
export function counterInboundOffer(league: LeagueStore, pid: number, askAmount: number): LeagueStore {
  const ws = transferWindowState(league);
  if (!ws.open) return league;

  const resolved = resolveOpenOffer(league, pid);
  if (!resolved) return league;

  const ask = Math.round(askAmount);
  if (!Number.isFinite(ask) || ask <= 0) return league;

  const buyer = league.teams.find((t) => t.tid === resolved.buyerTid);
  const player = league.players.find((p) => p.pid === pid);
  if (!buyer || !player) return league;

  const contexts = deriveLeagueContexts({
    teams: league.teams, players: league.players, season: league.season, played: league.played,
    competitions: league.competitions,
  });
  const buyerCtx = contexts.get(resolved.buyerTid);
  if (!buyerCtx) return league;
  const wageCharge = acquisitionWageCharge(league, player);
  // Re-derived live (no jitter — that's only for opening-offer variety), but
  // still capped by what the buyer can actually spend without dipping into
  // its reserve, same as at candidate-generation time.
  const ceiling = Math.min(valueToClub(player, buyerCtx), buyerSpendable(buyer, buyerCtx, wageCharge));

  const response = respondToAsk(ceiling, ask, resolved.asks);
  const offers = response.kind === "countered" ? [...resolved.offers, response.offer] : resolved.offers;
  const asks = [...resolved.asks, ask];

  const negotiation: InboundOffer = {
    pid, buyerTid: resolved.buyerTid, season: ws.season, window: ws.window,
    offers, asks,
    status:
      response.kind === "accepted" ? "accepted"
      : response.kind === "collapsed" ? "collapsed"
      : "open",
  };
  let updated: LeagueStore = { ...league, inboundOffers: upsertInboundOffer(league, negotiation) };

  if (response.kind === "accepted") {
    // The buyer agreed in principle, but their budget/roster may no longer
    // cover it — fall back to a collapse rather than execute an impossible deal.
    if (!hasRosterRoom(buyer) || ask + wageCharge > buyer.budget) {
      return {
        ...updated,
        inboundOffers: upsertInboundOffer(updated, { ...negotiation, status: "collapsed" }),
      };
    }
    updated = executeTransfer(
      updated, pid, league.meta.userTid, resolved.buyerTid, ask, wageCharge, ws.season, ws.window,
    );
  }
  return updated;
}
