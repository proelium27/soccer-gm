import type { Player } from "../players/types.js";
import type { StoredTeam } from "../teams/clubs.js";
import type { LeagueStore } from "../leagueState.js";
import type { TransferWindowKind } from "./window.js";
import { transferWindowState } from "./window.js";
import { trueTransferValue, perceivedTransferValue } from "../finance/valuation.js";
import { mulberry32 } from "../../engine/rng.js";
import { keepsDepthFloor } from "../freeAgency.js";
import {
  ROSTER_CAP,
  RESERVATION_FACTOR_MIN, RESERVATION_FACTOR_MAX,
  NEGOTIATION_LOWBALL_FACTOR, NEGOTIATION_MAX_ROUNDS,
  COUNTER_PADDING_START, COUNTER_PADDING_DECAY,
} from "../constants.js";

/** One user↔club transfer talk over a player, scoped to a single window. */
export interface TransferNegotiation {
  pid: number;
  sellerTid: number;
  /** The window's season identity (TransferWindowState.season), not necessarily league.season. */
  season: number;
  window: TransferWindowKind;
  /** User offer history, most recent last. */
  offers: number[];
  /** The seller's current counter-offer — an amount they will accept right now. */
  counter: number | null;
  /** "collapsed" = the club has ended talks for the rest of the window. */
  status: "open" | "accepted" | "collapsed";
}

export interface CompletedTransfer {
  pid: number;
  fromTid: number;
  toTid: number;
  fee: number;
  season: number;
  window: TransferWindowKind;
}

/**
 * True if the team has room under ROSTER_CAP to add another player.
 */
export function hasRosterRoom(team: StoredTeam): boolean {
  return team.roster.length < ROSTER_CAP;
}

/**
 * Deterministic per-(league, season, window, player, salt) seed: scout
 * reports, reservation prices, and recommendation ordering stay fixed for a
 * whole window instead of rerolling on every render or probing offer.
 */
export function windowSeed(
  lid: number,
  season: number,
  window: TransferWindowKind,
  pid: number,
  salt: number,
): number {
  const w = window === "summer" ? 1 : 2;
  let h = Math.imul(lid + 1, 2654435761);
  h = (h ^ Math.imul(season, 40503) ^ Math.imul(w, 99991)) >>> 0;
  h = (h ^ Math.imul(pid + 1, 2246822519) ^ Math.imul(salt + 1, 374761393)) >>> 0;
  return h;
}

/**
 * Clubs won't sell themselves hollow: a player is off the market if the sale
 * would leave the club with fewer than half its target complement
 * (ROSTER_COMPOSITION, rounded up) at that position.
 */
export function isForSale(
  seller: StoredTeam,
  players: Map<number, Player>,
  pid: number,
): boolean {
  return keepsDepthFloor(seller, players, pid);
}

/**
 * During the offseason half of the summer window, a player in the final year
 * of his contract is about to walk for free (`releaseExpiredContracts` runs
 * at Advance) — paying a fee for him would hand the money over and lose the
 * player days later, so he's off the market until he re-signs somewhere.
 */
export function departsAtRollover(
  league: Pick<LeagueStore, "phase" | "season">,
  player: Player,
): boolean {
  return league.phase === "offseason" && player.contract.expiresSeason <= league.season;
}

/** The hidden fee a club will accept for a player, fixed for the whole window. */
export function reservationPrice(
  lid: number,
  season: number,
  window: TransferWindowKind,
  player: Player,
): number {
  const rng = mulberry32(windowSeed(lid, season, window, player.pid, 1));
  const factor =
    RESERVATION_FACTOR_MIN + rng() * (RESERVATION_FACTOR_MAX - RESERVATION_FACTOR_MIN);
  return Math.round(trueTransferValue(player, season) * factor);
}

/**
 * The valuation the user's scouting department reports for a player, stable
 * for the whole window (noise shrinks with scouting spend).
 */
export function scoutedValue(
  lid: number,
  season: number,
  window: TransferWindowKind,
  player: Player,
  scoutingSpend: number,
): number {
  const rng = mulberry32(windowSeed(lid, season, window, player.pid, 2));
  return perceivedTransferValue(rng, player, season, scoutingSpend);
}

export type OfferOutcome =
  | { kind: "accepted"; fee: number }
  | { kind: "countered"; counter: number }
  | { kind: "collapsed" };

/**
 * How a club answers an offer, per docs/finance-design.md: accept anything at
 * or above the reservation price; end talks outright on a way-off lowball, a
 * non-improving repeat offer, or once patience runs out; otherwise counter,
 * starting above the reservation price and converging toward it each round.
 */
export function respondToOffer(
  reservation: number,
  offer: number,
  priorOffers: number[],
): OfferOutcome {
  if (offer >= reservation) return { kind: "accepted", fee: offer };
  if (offer < reservation * NEGOTIATION_LOWBALL_FACTOR) return { kind: "collapsed" };
  const bestPrior = priorOffers.length > 0 ? Math.max(...priorOffers) : null;
  if (bestPrior !== null && offer <= bestPrior) return { kind: "collapsed" };
  if (priorOffers.length + 1 >= NEGOTIATION_MAX_ROUNDS) return { kind: "collapsed" };
  const padding = COUNTER_PADDING_START * COUNTER_PADDING_DECAY ** priorOffers.length;
  return { kind: "countered", counter: Math.round(reservation * (1 + padding)) };
}

/**
 * The wage charge a buying/signing club pays on top of any fee when adding a
 * player mid-season: wages are paid up front at each season's start, so a
 * player acquired during the regular phase charges his full season salary at
 * acquisition (clubs eat the year's wages on mid-season signings). Offseason
 * additions cost nothing here — the upcoming season-start charge covers them.
 */
export function acquisitionWageCharge(league: LeagueStore, player: Player): number {
  return league.phase === "regular" ? player.contract.salary : 0;
}

/**
 * Move a player between clubs for a fee: rosters swap membership, the fee
 * moves buyer→seller (money is conserved), the deal is logged, and the buyer
 * additionally pays any mid-season wage charge (acquisitionWageCharge). The
 * player's contract travels with them untouched (contracts are never
 * negotiated).
 */
export function executeTransfer(
  league: LeagueStore,
  pid: number,
  fromTid: number,
  toTid: number,
  fee: number,
  wageCharge: number,
  season: number,
  window: TransferWindowKind,
): LeagueStore {
  return {
    ...league,
    teams: league.teams.map((t) => {
      if (t.tid === fromTid) {
        return { ...t, roster: t.roster.filter((p) => p !== pid), budget: t.budget + fee };
      }
      if (t.tid === toTid) {
        return { ...t, roster: [...t.roster, pid], budget: t.budget - fee - wageCharge };
      }
      return t;
    }),
    transfers: [
      ...league.transfers,
      { pid, fromTid, toTid, fee, season, window },
    ],
  };
}

/** Negotiations for the currently open window (what the UI should show). */
export function currentNegotiations(league: LeagueStore): TransferNegotiation[] {
  const ws = transferWindowState(league);
  if (!ws.open) return [];
  return league.negotiations.filter(
    (n) => n.season === ws.season && n.window === ws.window,
  );
}

function upsertNegotiation(
  league: LeagueStore,
  negotiation: TransferNegotiation,
): TransferNegotiation[] {
  // Prune talks from earlier windows while we're here so the list never
  // accumulates across seasons.
  const rest = league.negotiations.filter(
    (n) =>
      n.season === negotiation.season &&
      n.window === negotiation.window &&
      n.pid !== negotiation.pid,
  );
  return [...rest, negotiation];
}

/**
 * The user offers `amount` for another club's player. No-op unless a window
 * is open, the player is on another club's roster and for sale, the amount is
 * within budget, and talks haven't already ended this window. On acceptance
 * the transfer executes immediately at the offered fee.
 */
export function makeTransferOffer(
  league: LeagueStore,
  pid: number,
  amount: number,
): LeagueStore {
  const ws = transferWindowState(league);
  if (!ws.open) return league;

  const userTid = league.meta.userTid;
  const user = league.teams.find((t) => t.tid === userTid);
  const seller = league.teams.find((t) => t.tid !== userTid && t.roster.includes(pid));
  const player = league.players.find((p) => p.pid === pid);
  if (!user || !seller || !player) return league;

  const offer = Math.round(amount);
  // The offer must be affordable together with any mid-season wage charge,
  // since an accepted offer executes immediately.
  const wageCharge = acquisitionWageCharge(league, player);
  if (!Number.isFinite(offer) || offer <= 0 || offer + wageCharge > user.budget) return league;
  if (!hasRosterRoom(user)) return league;

  const playerMap = new Map(league.players.map((p) => [p.pid, p]));
  if (!isForSale(seller, playerMap, pid)) return league;
  if (departsAtRollover(league, player)) return league;

  const existing = league.negotiations.find(
    (n) => n.pid === pid && n.season === ws.season && n.window === ws.window,
  );
  if (existing && existing.status !== "open") return league;

  const priorOffers = existing?.offers ?? [];
  const reservation = reservationPrice(league.lid, ws.season, ws.window, player);
  const outcome = respondToOffer(reservation, offer, priorOffers);

  const negotiation: TransferNegotiation = {
    pid,
    sellerTid: seller.tid,
    season: ws.season,
    window: ws.window,
    offers: [...priorOffers, offer],
    counter: outcome.kind === "countered" ? outcome.counter : null,
    status:
      outcome.kind === "accepted" ? "accepted"
      : outcome.kind === "collapsed" ? "collapsed"
      : "open",
  };

  let updated: LeagueStore = { ...league, negotiations: upsertNegotiation(league, negotiation) };
  if (outcome.kind === "accepted") {
    updated = executeTransfer(
      updated, pid, seller.tid, userTid, outcome.fee, wageCharge, ws.season, ws.window,
    );
  }
  return updated;
}

/**
 * Accept the seller's current counter-offer: the transfer executes at exactly
 * the countered fee. No-op without an open negotiation holding a counter the
 * user can afford — and the sale conditions (depth floor, contract expiry)
 * are re-checked here, since the roster may have changed since the counter
 * was made (e.g. a parallel negotiation already sold a teammate).
 */
export function acceptCounterOffer(league: LeagueStore, pid: number): LeagueStore {
  const ws = transferWindowState(league);
  if (!ws.open) return league;

  const negotiation = league.negotiations.find(
    (n) => n.pid === pid && n.season === ws.season && n.window === ws.window,
  );
  if (!negotiation || negotiation.status !== "open" || negotiation.counter === null) {
    return league;
  }

  const user = league.teams.find((t) => t.tid === league.meta.userTid);
  const seller = league.teams.find((t) => t.tid === negotiation.sellerTid);
  const player = league.players.find((p) => p.pid === pid);
  if (!user || !seller || !player) return league;
  const wageCharge = acquisitionWageCharge(league, player);
  if (negotiation.counter + wageCharge > user.budget) return league;
  if (!hasRosterRoom(user)) return league;

  const playerMap = new Map(league.players.map((p) => [p.pid, p]));
  if (!isForSale(seller, playerMap, pid)) return league;
  if (departsAtRollover(league, player)) return league;

  const accepted: TransferNegotiation = { ...negotiation, status: "accepted" };
  const updated: LeagueStore = { ...league, negotiations: upsertNegotiation(league, accepted) };
  return executeTransfer(
    updated, pid, seller.tid, user.tid, negotiation.counter, wageCharge, ws.season, ws.window,
  );
}
