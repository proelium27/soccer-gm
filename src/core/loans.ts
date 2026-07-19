import type { Player } from "./players/types.js";
import type { StoredTeam } from "./teams/clubs.js";
import type { LeagueStore } from "./leagueState.js";
import type { CompletedTransfer } from "./transfers/negotiation.js";
import type { TransferWindowKind } from "./transfers/window.js";
import type { Competition } from "./competitions.js";
import { transferWindowState } from "./transfers/window.js";
import {
  windowSeed, departsAtRollover, acquisitionWageCharge, hasRosterRoom,
} from "./transfers/negotiation.js";
import { trueTransferValue } from "./finance/valuation.js";
import { clampBudget } from "./finance/budget.js";
import { tierOf } from "./competitions.js";
import { keepsDepthFloor } from "./freeAgency.js";
import { resolveXI } from "./lineup/resolveXI.js";
import { FORMATIONS } from "./lineup/formations.js";
import { deriveLeagueContexts } from "./ai/clubContext.js";
import { valueToClub, perceivedValueToClub } from "./ai/evaluate.js";
import { mulberry32 } from "../engine/rng.js";
import {
  ROSTER_CAP, ROSTER_SAFETY_FLOOR,
  LOAN_FEE_RATE, LOAN_DURATION_MULTIPLIER, LOAN_AI_MAX_AGE, LOAN_AVAILABILITY,
  LOAN_MIN_SURPLUS, LOAN_OFFERS_MAX, AI_LOAN_MAX_MOVES,
} from "./constants.js";

/** A player's loan-out choice, before any club has agreed to take him. */
export interface LoanListing {
  pid: number;
  seasons: 1 | 2 | 3;
}

/** A currently-in-effect loan: pid physically plays for loaneeTid, still owned by parentTid. */
export interface ActiveLoan {
  pid: number;
  parentTid: number;
  loaneeTid: number;
  startSeason: number;
  seasons: number;
  /** The first season pid must be back on parentTid's roster. */
  returnSeason: number;
  fee: number;
}

/** A user-listed player's loan offer turned down this window — kept off the candidate list until the next window. */
export interface LoanRejection {
  pid: number;
  buyerTid: number;
  season: number;
  window: TransferWindowKind;
}

/**
 * Flat loan fee: a fraction of the player's true (permanent) market value,
 * scaled by a diminishing per-duration multiplier — see LOAN_FEE_RATE /
 * LOAN_DURATION_MULTIPLIER for why loans are priced far below a sale.
 */
export function computeLoanFee(player: Player, season: number, seasons: 1 | 2 | 3): number {
  return Math.round(trueTransferValue(player, season) * LOAN_FEE_RATE * LOAN_DURATION_MULTIPLIER[seasons]);
}

/**
 * Move a player onto another club's roster for a fixed-duration loan: the
 * loanee pays a flat fee (+ any mid-season wage charge, same rule as a
 * permanent acquisition) and takes over his wages for as long as he's there,
 * which falls out for free since wage charging already keys off roster
 * membership rather than contract ownership. The player's contract itself is
 * untouched and travels back to the parent club unchanged at loan end.
 */
export function executeLoan(
  league: LeagueStore,
  pid: number,
  parentTid: number,
  loaneeTid: number,
  seasons: 1 | 2 | 3,
  fee: number,
  startSeason: number,
  window: TransferWindowKind,
): LeagueStore {
  const player = league.players.find((p) => p.pid === pid);
  if (!player) return league;
  const wageCharge = acquisitionWageCharge(league, player);

  const loan: ActiveLoan = {
    pid, parentTid, loaneeTid, startSeason, seasons,
    returnSeason: startSeason + seasons, fee,
  };

  return {
    ...league,
    teams: league.teams.map((t) => {
      if (t.tid === parentTid) {
        return {
          ...t,
          roster: t.roster.filter((p) => p !== pid),
          budget: clampBudget(t.budget + fee, tierOf(league.competitions, t.compId), t.hype),
        };
      }
      if (t.tid === loaneeTid) {
        return { ...t, roster: [...t.roster, pid], budget: t.budget - fee - wageCharge };
      }
      return t;
    }),
    loanListings: league.loanListings.filter((l) => l.pid !== pid),
    activeLoans: [...league.activeLoans, loan],
    transfers: [
      ...league.transfers,
      { pid, fromTid: parentTid, toTid: loaneeTid, fee, season: startSeason, window, loanSeasons: seasons },
    ],
  };
}

/**
 * Return every loan due back this season (returnSeason <= the season about
 * to start) to its parent club — called once at the offseason rollover,
 * before season-start wages are charged, so the wage lands on the correct
 * club for the new season. A parent club always gets him back regardless of
 * roster size (mirrors how youth intake can briefly push a club over
 * ROSTER_CAP — AI clubs get trimmed back down the same offseason;
 * ROSTER_CAP is enforced at the next acquisition, not on return).
 */
export function processLoanReturns(
  teams: StoredTeam[],
  activeLoans: ActiveLoan[],
  transfers: CompletedTransfer[],
  nextSeason: number,
): { teams: StoredTeam[]; activeLoans: ActiveLoan[]; transfers: CompletedTransfer[] } {
  const due = activeLoans.filter((l) => l.returnSeason <= nextSeason);
  if (due.length === 0) return { teams, activeLoans, transfers };

  const dueByPid = new Map(due.map((l) => [l.pid, l]));
  const updatedTeams = teams.map((t) => {
    const arriving = due.filter((l) => l.parentTid === t.tid).map((l) => l.pid);
    const departing = new Set(due.filter((l) => l.loaneeTid === t.tid).map((l) => l.pid));
    if (arriving.length === 0 && departing.size === 0) return t;
    return {
      ...t,
      roster: [...t.roster.filter((pid) => !departing.has(pid)), ...arriving],
    };
  });

  const returnTransfers: CompletedTransfer[] = due.map((l) => ({
    pid: l.pid, fromTid: l.loaneeTid, toTid: l.parentTid, fee: 0,
    season: nextSeason, window: "summer", loanReturn: true,
  }));

  return {
    teams: updatedTeams,
    activeLoans: activeLoans.filter((l) => !dueByPid.has(l.pid)),
    transfers: [...transfers, ...returnTransfers],
  };
}

/** A not-yet-negotiated incoming loan offer for one of the user's listed players. */
export interface LoanOfferCandidate {
  player: Player;
  buyerTid: number;
  seasons: 1 | 2 | 3;
  fee: number;
}

/**
 * Incoming loan offers this window: for each player the user has listed, the
 * single AI club most interested (its perceivedValueToClub must clear the
 * player's worth to the user's own club by LOAN_MIN_SURPLUS — a much looser
 * bar than a permanent sale since a loan is cheap and reversible), skipping
 * clubs that already turned this listing down this window and diversifying
 * buyers the same way inbound (permanent) offers do. Computed live, not
 * stored — only becomes persisted state via acceptLoanOffer/rejectLoanOffer.
 */
export function loanOfferCandidates(league: LeagueStore): LoanOfferCandidate[] {
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
  const rejectedFor = (pid: number): Set<number> => new Set(
    league.loanRejections
      .filter((r) => r.pid === pid && r.season === ws.season && r.window === ws.window)
      .map((r) => r.buyerTid),
  );

  const candidates: LoanOfferCandidate[] = [];
  const usedBuyers = new Set<number>();
  for (const listing of league.loanListings) {
    if (!user.roster.includes(listing.pid)) continue;
    const player = playerMap.get(listing.pid);
    if (!player) continue;
    if (departsAtRollover(league, player)) continue;

    const reservation = valueToClub(player, userCtx);
    const jitter = mulberry32(windowSeed(league.lid, ws.season, ws.window, listing.pid, 5));
    const skip = rejectedFor(listing.pid);

    let best: { tid: number; value: number } | null = null;
    for (const buyer of league.teams) {
      if (buyer.tid === userTid || usedBuyers.has(buyer.tid) || skip.has(buyer.tid)) continue;
      if (buyer.roster.length >= ROSTER_CAP) continue;
      const buyerCtx = contexts.get(buyer.tid);
      if (!buyerCtx) continue;
      const value = perceivedValueToClub(player, buyerCtx, jitter);
      if (value < reservation * (1 + LOAN_MIN_SURPLUS)) continue;
      if (!best || value > best.value) best = { tid: buyer.tid, value };
    }
    if (best) {
      usedBuyers.add(best.tid);
      candidates.push({
        player, buyerTid: best.tid, seasons: listing.seasons,
        fee: computeLoanFee(player, ws.season, listing.seasons),
      });
    }
  }

  return candidates.slice(0, LOAN_OFFERS_MAX);
}

/** Accept an AI club's offer to take a listed player on loan. */
export function acceptLoanOffer(league: LeagueStore, pid: number): LeagueStore {
  const ws = transferWindowState(league);
  if (!ws.open) return league;
  const candidate = loanOfferCandidates(league).find((c) => c.player.pid === pid);
  if (!candidate) return league;

  const buyer = league.teams.find((t) => t.tid === candidate.buyerTid);
  if (!buyer || !hasRosterRoom(buyer)) return league;
  const wageCharge = acquisitionWageCharge(league, candidate.player);
  if (candidate.fee + wageCharge > buyer.budget) return league;

  return executeLoan(
    league, pid, league.meta.userTid, candidate.buyerTid, candidate.seasons,
    candidate.fee, ws.season, ws.window,
  );
}

/** Turn down the AI club's offer — it won't be re-offered for this listing this window. */
export function rejectLoanOffer(league: LeagueStore, pid: number): LeagueStore {
  const ws = transferWindowState(league);
  if (!ws.open) return league;
  const candidate = loanOfferCandidates(league).find((c) => c.player.pid === pid);
  if (!candidate) return league;

  const rest = league.loanRejections.filter(
    (r) => !(r.season === ws.season && r.window === ws.window),
  );
  const thisWindow = league.loanRejections.filter(
    (r) => r.season === ws.season && r.window === ws.window,
  );
  return {
    ...league,
    loanRejections: [...rest, ...thisWindow, { pid, buyerTid: candidate.buyerTid, season: ws.season, window: ws.window }],
  };
}

/** Add (or update the duration of) a listing for one of the user's own senior-roster players. */
export function listPlayerForLoan(league: LeagueStore, pid: number, seasons: 1 | 2 | 3): LeagueStore {
  const user = league.teams.find((t) => t.tid === league.meta.userTid);
  const playerMap = new Map(league.players.map((p) => [p.pid, p]));
  if (!user || !keepsDepthFloor(user, playerMap, pid)) return league;
  if (league.activeLoans.some((l) => l.pid === pid)) return league;

  const rest = league.loanListings.filter((l) => l.pid !== pid);
  return { ...league, loanListings: [...rest, { pid, seasons }] };
}

/** Withdraw a listing before any offer is accepted. */
export function unlistPlayerForLoan(league: LeagueStore, pid: number): LeagueStore {
  return { ...league, loanListings: league.loanListings.filter((l) => l.pid !== pid) };
}

export interface AILoanResult {
  teams: StoredTeam[];
  activeLoans: ActiveLoan[];
  transfers: CompletedTransfer[];
}

/**
 * AI↔AI loans, one round per open window: a young, buried player at one AI
 * club (surplus at his position, valued by his own club at no more than
 * LOAN_AVAILABILITY × market — same "would rather free the slot" screen the
 * permanent AI↔AI market uses) moves on a 1-season loan to whichever other
 * AI club values him meaningfully more (LOAN_MIN_SURPLUS). Deterministic
 * given `seed`; the user's club is never a party on either side (loaning the
 * user's own players in/out is a manual action — see loanOfferCandidates /
 * the Loans page).
 *
 * "Buried" is literal, not just a valuation screen: a player in his club's
 * own starting XI is never loaned out, whatever his keep-value — the whole
 * point of a loan is real minutes for a young player who isn't getting them
 * at home, and a starter already is. This is also what keeps genuinely
 * elite youngsters out of the loan pool (a 75+ prospect is starting
 * somewhere), so Division 2 can't end up hosting a loaned-in star the
 * ceiling sweep can never touch.
 */
export function runAILoanMarket(
  teams: StoredTeam[],
  players: Player[],
  activeLoans: ActiveLoan[],
  transfers: CompletedTransfer[],
  season: number,
  played: LeagueStore["played"],
  window: TransferWindowKind,
  userTid: number,
  seed: number,
  competitions: Competition[],
): AILoanResult {
  const contexts = deriveLeagueContexts({ teams, players, season, played, competitions });
  const playerMap = new Map(players.map((p) => [p.pid, p]));
  const jitter = mulberry32(seed);
  const onLoanPids = new Set(activeLoans.map((l) => l.pid));

  interface Candidate {
    pid: number; sellerTid: number; buyerTid: number; reservation: number; buyerValue: number; surplus: number;
  }
  const candidates: Candidate[] = [];
  for (const seller of teams) {
    if (seller.tid === userTid) continue;
    const sellerCtx = contexts.get(seller.tid);
    if (!sellerCtx) continue;

    // A starter is getting his minutes at home — only players outside the
    // club's starting XI are loan candidates (see the doc comment above).
    const sellerPlayers = seller.roster
      .map((pid) => playerMap.get(pid))
      .filter((p): p is Player => p !== undefined);
    const xiPids = new Set(
      resolveXI(sellerPlayers, FORMATIONS["4-3-3"], seller.starters).map((p) => p.pid),
    );

    for (const pid of seller.roster) {
      if (onLoanPids.has(pid)) continue;
      if (xiPids.has(pid)) continue;
      const player = playerMap.get(pid);
      if (!player) continue;
      if (season - player.born > LOAN_AI_MAX_AGE) continue;

      const market = trueTransferValue(player, season);
      const reservation = valueToClub(player, sellerCtx);
      if (reservation > market * LOAN_AVAILABILITY) continue;

      for (const buyer of teams) {
        if (buyer.tid === seller.tid || buyer.tid === userTid) continue;
        const buyerCtx = contexts.get(buyer.tid);
        if (!buyerCtx) continue;
        const value = perceivedValueToClub(player, buyerCtx, jitter);
        if (value < reservation * (1 + LOAN_MIN_SURPLUS)) continue;
        candidates.push({ pid, sellerTid: seller.tid, buyerTid: buyer.tid, reservation, buyerValue: value, surplus: value - reservation });
      }
    }
  }

  candidates.sort((a, b) => b.surplus - a.surplus || a.pid - b.pid || a.buyerTid - b.buyerTid);

  const roster = new Map(teams.map((t) => [t.tid, [...t.roster]]));
  const budget = new Map(teams.map((t) => [t.tid, t.budget]));
  const takes = new Map<number, number>();
  const sends = new Map<number, number>();
  const moved = new Set<number>();
  const newLoans: ActiveLoan[] = [];
  const executed: CompletedTransfer[] = [];

  for (const c of candidates) {
    if (moved.has(c.pid)) continue;
    if ((takes.get(c.buyerTid) ?? 0) >= AI_LOAN_MAX_MOVES) continue;
    if ((sends.get(c.sellerTid) ?? 0) >= AI_LOAN_MAX_MOVES) continue;

    const buyerRoster = roster.get(c.buyerTid)!;
    if (buyerRoster.length >= ROSTER_CAP) continue;

    const sellerRoster = roster.get(c.sellerTid)!;
    if (!sellerRoster.includes(c.pid)) continue;
    if (sellerRoster.length <= ROSTER_SAFETY_FLOOR) continue;
    if (!keepsDepthFloor({ ...teams.find((t) => t.tid === c.sellerTid)!, roster: sellerRoster }, playerMap, c.pid)) {
      continue;
    }

    const player = playerMap.get(c.pid)!;
    const fee = computeLoanFee(player, season, 1);
    if ((budget.get(c.buyerTid) ?? 0) < fee) continue;

    roster.set(c.sellerTid, sellerRoster.filter((p) => p !== c.pid));
    buyerRoster.push(c.pid);
    const sellerTeam = teams.find((t) => t.tid === c.sellerTid)!;
    budget.set(c.sellerTid, clampBudget((budget.get(c.sellerTid) ?? 0) + fee, tierOf(competitions, sellerTeam.compId), sellerTeam.hype));
    budget.set(c.buyerTid, (budget.get(c.buyerTid) ?? 0) - fee);
    moved.add(c.pid);
    takes.set(c.buyerTid, (takes.get(c.buyerTid) ?? 0) + 1);
    sends.set(c.sellerTid, (sends.get(c.sellerTid) ?? 0) + 1);
    newLoans.push({
      pid: c.pid, parentTid: c.sellerTid, loaneeTid: c.buyerTid,
      startSeason: season, seasons: 1, returnSeason: season + 1, fee,
    });
    executed.push({ pid: c.pid, fromTid: c.sellerTid, toTid: c.buyerTid, fee, season, window, loanSeasons: 1 });
  }

  return {
    teams: teams.map((t) => ({ ...t, roster: roster.get(t.tid)!, budget: budget.get(t.tid)! })),
    activeLoans: [...activeLoans, ...newLoans],
    transfers: [...transfers, ...executed],
  };
}
