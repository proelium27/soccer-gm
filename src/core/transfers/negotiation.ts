import type { Player } from "../players/types.js";
import type { StoredTeam } from "../teams/clubs.js";
import type { LeagueStore } from "../leagueState.js";
import type { TransferWindowKind } from "./window.js";
import type { Competition } from "../competitions.js";
import { transferWindowState } from "./window.js";
import { trueTransferValue, perceivedTransferValue } from "../finance/valuation.js";
import { clampBudget, financeScale } from "../finance/budget.js";
import { mulberry32 } from "../../engine/rng.js";
import { keepsDepthFloor } from "../freeAgency.js";
import { wouldRefuseExtension } from "../ai/breakoutRefusal.js";
import { isProtectedStar, lastCompletedSeason } from "./protectedStars.js";
import {
  ROSTER_CAP, MAX_TRANSFER_VALUE,
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

/**
 * Sentinel "club" on the from-side of a free-agent signing: nobody owned him,
 * so there's no real tid to name (and -1 can never collide with one). A free
 * signing is recorded as a fee-0 transfer FROM this sentinel so the profile's
 * club-by-season history (and the OVR chart, champion attribution, News Feed)
 * sees every arrival — without a record, a player who joined a club on a free
 * was silently attributed to whatever club his last *paid* move landed him at.
 * UI that renders a tid must map this to "Free agent" — use `clubDisplayName`
 * (src/ui/format.ts) rather than hand-rolling the check.
 *
 * Deliberately one-sided: *departures* into free agency (expiring contracts,
 * roster trims) are NOT recorded. They'd roughly double an already-append-only
 * log for no display gain, since every surface here answers "which club did he
 * belong to in season N", and a release leaves that answer unchanged until his
 * next arrival. The one case where the missing counter-record would lie — a
 * club signing a free agent and then cutting him in the same offseason, so his
 * history claims a club he never played for — is filtered out at the source in
 * offseason.ts instead.
 */
export const FREE_AGENT_TID = -1;

/** True if a transfer's from/to side is the free-agent sentinel, not a club. */
export function isFreeAgentTid(tid: number): boolean {
  return tid === FREE_AGENT_TID;
}

export interface CompletedTransfer {
  pid: number;
  fromTid: number;
  toTid: number;
  fee: number;
  season: number;
  window: TransferWindowKind;
  /** Present for a loan move; the agreed duration in seasons. Absent = a permanent transfer. */
  loanSeasons?: number;
  /** True when a loaned player returns to his parent club at loan end (fee is always 0). */
  loanReturn?: boolean;
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
 * True if the player is either normally for-sale (isForSale) or a Division
 * 2 breakout player who'd refuse to re-sign (wouldRefuseExtension) — such a
 * player is transfer-listed immediately rather than waiting for a normal
 * sale trigger (see the Division 2 weaker-dynasty design doc).
 */
export function isForSaleOrRefusing(
  seller: StoredTeam,
  players: Map<number, Player>,
  pid: number,
  competitions: Competition[],
): boolean {
  if (isForSale(seller, players, pid)) return true;
  const player = players.get(pid);
  if (!player) return false;
  return wouldRefuseExtension(player, seller, competitions);
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
  // Clamp to the same believable ceiling as the value itself — the reservation
  // factor must not push a headline asking price past MAX_TRANSFER_VALUE.
  return Math.min(MAX_TRANSFER_VALUE, Math.round(trueTransferValue(player, season) * factor));
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
  // Never counter above the believable ceiling (the padding sits on top of an
  // already-clamped reservation, so cap the result too).
  const counter = Math.min(MAX_TRANSFER_VALUE, Math.round(reservation * (1 + padding)));
  return { kind: "countered", counter };
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
        return { ...t, roster: t.roster.filter((p) => p !== pid), budget: clampBudget(t.budget + fee, financeScale(league.competitions, t.compId), t.hype) };
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
  // A player out on loan physically sits on the loanee's roster but is owned
  // by his parent — the loanee can't sell what it doesn't own, or the live
  // loan would be orphaned and processLoanReturns would later duplicate the
  // pid onto the parent's roster too.
  if (league.activeLoans.some((l) => l.pid === pid)) return league;

  const offer = Math.round(amount);
  // The offer must be affordable together with any mid-season wage charge,
  // since an accepted offer executes immediately.
  const wageCharge = acquisitionWageCharge(league, player);
  if (!Number.isFinite(offer) || offer <= 0 || offer + wageCharge > user.budget) return league;
  if (!hasRosterRoom(user)) return league;

  const playerMap = new Map(league.players.map((p) => [p.pid, p]));
  if (!isForSaleOrRefusing(seller, playerMap, pid, league.competitions)) return league;
  // A top club's star from a big season simply isn't for sale (see protectedStars.ts).
  if (isProtectedStar(lastCompletedSeason(league), league.competitions, seller.tid, player)) return league;
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
  // A player who went out on loan since the counter was made is no longer the
  // seller's to sell (see makeTransferOffer).
  if (league.activeLoans.some((l) => l.pid === pid)) return league;
  const wageCharge = acquisitionWageCharge(league, player);
  if (negotiation.counter + wageCharge > user.budget) return league;
  if (!hasRosterRoom(user)) return league;

  const playerMap = new Map(league.players.map((p) => [p.pid, p]));
  if (!isForSaleOrRefusing(seller, playerMap, pid, league.competitions)) return league;
  // A top club's star from a big season simply isn't for sale (see protectedStars.ts).
  if (isProtectedStar(lastCompletedSeason(league), league.competitions, seller.tid, player)) return league;
  if (departsAtRollover(league, player)) return league;

  const accepted: TransferNegotiation = { ...negotiation, status: "accepted" };
  const updated: LeagueStore = { ...league, negotiations: upsertNegotiation(league, accepted) };
  return executeTransfer(
    updated, pid, seller.tid, user.tid, negotiation.counter, wageCharge, ws.season, ws.window,
  );
}
