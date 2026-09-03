import type { Player } from "../players/types.js";
import type { LeagueStore } from "../leagueState.js";
import type { StoredTeam } from "../teams/clubs.js";
import type { Competition } from "../competitions.js";
import { trueTransferValue } from "../finance/valuation.js";
import {
  tierOf, competitionTeamCount, competitionPromotionSpots, divisionAbove,
} from "../competitions.js";
import { cupSlotsForCompetition } from "../cup/qualification.js";
import { deriveLeagueContexts } from "../ai/clubContext.js";
import {
  VALUATION_POTENTIAL_WEIGHT_PEAK_AGE, CUP_FORMATS, CONTINENTAL_ORDER,
  SELL_ON_CLAUSE_SEASONS, SELL_ON_MAX_SHARE, SELL_ON_RESALE_PROBABILITY,
  SELL_ON_PRICING_HORIZON, SELL_ON_PROFIT_REALIZATION,
  BONUS_CLAUSE_SEASONS, BONUS_MAX_TOTAL_FRACTION,
  BONUS_APPEARANCE_THRESHOLD, BONUS_GOAL_THRESHOLD,
  BONUS_BASE_PROBABILITY, BONUS_STARTER_OVR_SWING,
} from "../constants.js";

/**
 * Contingent money attached to a transfer: a sell-on share of the buying
 * club's profit if they move the player on, and one-off bonuses that pay when
 * a stated thing happens.
 *
 * ## Why this is its own LeagueStore field and not a field on CompletedTransfer
 *
 * The transfer log looks like the natural home and is the wrong one, in a way
 * that fails silently rather than loudly. `detachTransfers` (core/simArchive.ts)
 * windows `league.transfers` to the last PLAYER_SETTLED_SEASONS seasons before
 * the league crosses to the worker, because the only thing the sim reads it for
 * is `settledMultiplier`, which is provably inert beyond that horizon. The
 * offseason — where a bonus settles, and where an AI resale would trigger a
 * sell-on — runs inside that worker. A clause agreed in season 3 and triggered
 * in season 9 would therefore be read as absent: no crash, no type error, the
 * beneficiary simply never gets paid. That is the exact "plausible wrong
 * answer" failure mode simArchive.ts warns about, and it is why clauses live in
 * their own array which is never detached.
 *
 * The second reason is shape: the transfer log is append-only history, and an
 * obligation is live state that has to be *deleted* when it resolves, expires,
 * or its player leaves the world.
 *
 * ## Bounded by construction
 *
 * There is deliberately no cap on the array, and none is needed. A clause is
 * dropped when it pays out, when its expiry season passes, when the obligor
 * sells the player (sell-ons pay and die; bonuses die unpaid, because the
 * condition was about *this* club), when the player is released to free
 * agency, and when he retires or is culled — the same scrub sites the watchlist
 * already goes through. Nothing can accumulate them.
 *
 * ## User-only, deliberately
 *
 * Only deals the user negotiates carry clauses. AI↔AI transfers are untouched,
 * so world money flow is byte-identical to a save without this feature and no
 * dynasty audit is involved — the same property every difficulty lever has, and
 * for the same reason (see DIFFICULTIES in constants.ts). If AI clubs are ever
 * given clauses of their own, that changes receipts into the weak leagues and
 * needs scripts/weakLeaguesAudit.ts run on both sides.
 */

/** What a bonus pays out for. */
export type BonusTrigger =
  /** The player makes BONUS_APPEARANCE_THRESHOLD league appearances in one season. */
  | "appearances"
  /** The player scores BONUS_GOAL_THRESHOLD league goals in one season. */
  | "goals"
  /** The obligor qualifies for either continental competition. */
  | "continental"
  /** The obligor wins promotion out of its division. */
  | "promotion";

interface ClauseBase {
  /** The player the clause is about. */
  pid: number;
  /** Club owed the money — whoever inserted the clause when they sold/bought. */
  beneficiaryTid: number;
  /** Club that owes it. The clause dies if the player leaves them. */
  obligorTid: number;
  /** Season the deal was struck. */
  season: number;
  /** Last season this can still pay out; dropped once the league passes it. */
  expires: number;
}

export interface SellOnClause extends ClauseBase {
  kind: "sellOn";
  /**
   * The cash fee the obligor paid. Profit is measured above this, so a resale
   * at or below it pays nothing — that is the whole point of pricing the
   * clause on profit rather than on the gross fee.
   */
  baseFee: number;
  /** Share of the profit, 0..SELL_ON_MAX_SHARE. */
  share: number;
}

export interface BonusClause extends ClauseBase {
  kind: "bonus";
  trigger: BonusTrigger;
  /** Flat payout, obligor → beneficiary, once. */
  amount: number;
}

export type TransferClause = SellOnClause | BonusClause;

/** A clause the user is proposing but has not yet agreed — no tids resolved yet. */
export type ProposedClause =
  | { kind: "sellOn"; share: number }
  | { kind: "bonus"; trigger: BonusTrigger; amount: number };

/**
 * Project a player's transfer value `horizon` seasons out.
 *
 * Deliberately built on the shipped `trueTransferValue` rather than a second
 * value model: a clause has to be priced on the same curve the resale will
 * actually be priced on, or the two disagree and the user is systematically
 * over- or under-paid.
 *
 * Two modelling choices worth knowing:
 *
 * - **Ovr moves toward potential, linearly, arriving at peak age.** Potential
 *   *is* the projected peak (see estimatePotential), and
 *   VALUATION_POTENTIAL_WEIGHT_PEAK_AGE is already the age the valuation curve
 *   treats as that peak — so this reuses the existing constant instead of
 *   introducing a growth model. Decline after the peak needs no special case:
 *   VALUATION_AGE_CURVE inside trueTransferValue handles it.
 * - **Contract years remaining are held flat**, exactly as
 *   `careerValueHistory` holds them for the same reason. Old contract terms
 *   aren't stored and future ones can't be known, so letting the term run down
 *   would price in an expiry the club would in reality have renewed away, and
 *   turn the projection into a read on paperwork rather than on ability.
 */
export function projectedValue(player: Player, season: number, horizon: number): number {
  const age = season - player.born;
  const gap = Math.max(0, player.potential - player.ovr);
  const seasonsToPeak = Math.max(1, VALUATION_POTENTIAL_WEIGHT_PEAK_AGE - age);
  const realized = gap * Math.min(1, Math.max(0, horizon / seasonsToPeak));
  const futureSeason = season + horizon;
  const yearsRemaining = Math.max(0, player.contract.expiresSeason - season);
  const projected: Player = {
    ...player,
    ovr: Math.round(player.ovr + realized),
    contract: { ...player.contract, expiresSeason: futureSeason + yearsRemaining },
  };
  return trueTransferValue(projected, futureSeason);
}

/**
 * How likely a bonus trigger is to fire before the clause expires, in [0, 1].
 *
 * These are coarse by design. The point is not to predict the season — it is
 * that the buyer discounts its cash offer by something defensible, so a clause
 * converts price from cash into contingency instead of conjuring money. What
 * matters is that the same function prices both sides of the table (see
 * `clauseValue`'s note on symmetry), and that it is honest enough that neither
 * party is systematically robbed — which `scripts/clausePricingProbe.ts`
 * measures against what actually pays out.
 */
export function triggerProbability(
  trigger: BonusTrigger,
  player: Player,
  obligor: StoredTeam,
  competitions: Competition[],
  starterOvr: number | null,
  seasons: number,
): number {
  const base = BONUS_BASE_PROBABILITY[trigger];
  switch (trigger) {
    case "appearances":
    case "goals": {
      // Both are really one question, will he play, so both key off the same
      // signal: how he rates against the man he has to displace. `starterOvr` is
      // ClubContext.posWeakestStarterOvr, the weakest player the club's shape
      // actually fields in his position, which is the buy-side counterfactual
      // the transfer AI already reasons with.
      //
      // A logistic on that gap, centred so an even match scores exactly the
      // population base rate. A position the formation fields nobody in leaves
      // `starterOvr` null and falls back to that same centre rather than to a
      // different formula: the first version returned the per-season rate for
      // the null case and the compounded one below for every other, which
      // disagreed by more than a factor of two over the window.
      const p = starterOvr === null
        ? 0.5
        : 1 / (1 + Math.exp(-(player.ovr - starterOvr) / BONUS_STARTER_OVR_SWING));
      const perSeason = Math.min(1, base * 2 * p);
      // Over `seasons` chances, at most one payout: P(at least one).
      return 1 - (1 - perSeason) ** seasons;
    }
    case "continental":
    case "promotion": {
      const comp = competitions.find((c) => c.id === obligor.compId);
      if (!comp) return 0;
      const tier = tierOf(competitions, obligor.compId);
      // Promotion is meaningless for a top-flight club and continental
      // qualification unreachable from below it, so each is simply impossible
      // in the other's half of the pyramid. A clause that cannot fire is
      // refused at proposal time rather than priced at zero here.
      if (trigger === "promotion" && tier === 1) return 0;
      if (trigger === "continental" && tier !== 1) return 0;
      const slots = trigger === "promotion"
        ? competitionPromotionSpots(comp, divisionAbove(competitions, comp.id))
        // "Continental" means either competition — a Shield place is still a
        // European night — so this is the league's whole allocation. Slot counts
        // move between countries every season on the rolling coefficient, and
        // that is deliberately not modelled here: the clause is priced when it
        // is agreed, off the allocation the league has now.
        : CONTINENTAL_ORDER.reduce(
            (n, id) => n + cupSlotsForCompetition(comp, CUP_FORMATS[id]), 0,
          );
      const size = competitionTeamCount(comp);
      if (size <= 0 || slots <= 0) return 0;
      // Slots over clubs is the base rate for an average club. It is a coarse
      // read — it says nothing about whether THIS club is any good — and that is
      // the honest limit of pricing a team achievement without simulating the
      // league. The probe measures how far off it lands.
      const perSeason = Math.min(1, slots / size);
      return 1 - (1 - perSeason) ** seasons;
    }
  }
}

/**
 * The expected value of a proposed clause, in money.
 *
 * **This is the load-bearing function, and there is exactly one of it on
 * purpose.** A clause does not add money to a deal — the buyer's total
 * willingness to pay is whatever it was, and a clause converts part of it from
 * cash into contingency. So both directions subtract this same number from the
 * cash price: selling, it comes off the buyer's cash ceiling; buying, it comes
 * off the seller's cash reservation. If buy and sell ever priced a clause
 * differently, one of them would be free money, which is the whole exploit
 * surface this feature has. Same argument as `saleGateFor` being extracted
 * rather than copied.
 *
 * Rounded to whole money, and never negative.
 */
export function clauseValue(
  clause: ProposedClause,
  player: Player,
  season: number,
  baseFee: number,
  obligor: StoredTeam,
  competitions: Competition[],
  starterOvr: number | null,
): number {
  if (clause.kind === "sellOn") {
    const future = projectedValue(player, season, SELL_ON_PRICING_HORIZON);
    // The projection is what the valuation curve says he'd be worth; the market
    // pays out rather less than that on a resale, because most resales are not
    // at a profit at all. SELL_ON_PROFIT_REALIZATION is the measured gap — see
    // its note, and scripts/clausePricingProbe.ts, which reads 1.0 when the two
    // agree.
    const profit = Math.max(0, future - baseFee) * SELL_ON_PROFIT_REALIZATION;
    return Math.max(0, Math.round(SELL_ON_RESALE_PROBABILITY * profit * clause.share));
  }
  const p = triggerProbability(
    clause.trigger, player, obligor, competitions, starterOvr, BONUS_CLAUSE_SEASONS,
  );
  return Math.max(0, Math.round(p * clause.amount));
}

/** The combined cash discount a set of proposed clauses buys. */
export function clausesValue(
  clauses: ProposedClause[],
  player: Player,
  season: number,
  baseFee: number,
  obligor: StoredTeam,
  competitions: Competition[],
  starterOvr: number | null,
): number {
  return clauses.reduce(
    (sum, c) => sum + clauseValue(c, player, season, baseFee, obligor, competitions, starterOvr),
    0,
  );
}

/**
 * Whether a proposed set of clauses is legal on a deal of this size.
 *
 * Two limits, both about keeping a transfer a transfer: the sell-on share is
 * capped so a club can't sell a player while keeping most of his future, and
 * total bonus money is capped as a fraction of the base fee so a deal can't be
 * turned into a lottery ticket with a nominal cash component. Both also bound
 * how far the cash price can be discounted, which keeps the pricing model —
 * coarse by construction — from being leaned on harder than it deserves.
 */
export function clausesAreValid(clauses: ProposedClause[], baseFee: number): boolean {
  let share = 0;
  let bonusTotal = 0;
  const triggers = new Set<BonusTrigger>();
  for (const c of clauses) {
    if (c.kind === "sellOn") {
      if (!Number.isFinite(c.share) || c.share <= 0) return false;
      share += c.share;
    } else {
      if (!Number.isFinite(c.amount) || c.amount <= 0) return false;
      // One bonus per trigger — two "10 goals" add-ons on one deal is a way of
      // writing one bigger bonus, and it makes the ledger unreadable.
      if (triggers.has(c.trigger)) return false;
      triggers.add(c.trigger);
      bonusTotal += c.amount;
    }
  }
  if (share > SELL_ON_MAX_SHARE) return false;
  if (bonusTotal > BONUS_MAX_TOTAL_FRACTION * baseFee) return false;
  return true;
}

/** Turn proposals into live obligations once a deal actually executes. */
export function materializeClauses(
  clauses: ProposedClause[],
  pid: number,
  beneficiaryTid: number,
  obligorTid: number,
  season: number,
  baseFee: number,
): TransferClause[] {
  return clauses.map((c) =>
    c.kind === "sellOn"
      ? {
          kind: "sellOn" as const,
          pid, beneficiaryTid, obligorTid, season,
          expires: season + SELL_ON_CLAUSE_SEASONS,
          baseFee, share: c.share,
        }
      : {
          kind: "bonus" as const,
          pid, beneficiaryTid, obligorTid, season,
          expires: season + BONUS_CLAUSE_SEASONS,
          trigger: c.trigger, amount: c.amount,
        },
  );
}

/**
 * What a set of proposed clauses takes off the CASH price of a deal, from the
 * live league.
 *
 * The single entry point both directions of the market use, and the reason the
 * feature can't be farmed: buying, this comes off the seller's cash
 * reservation; selling, it comes off the buyer's cash ceiling. Same function,
 * same number, opposite side of the table — so a clause moves money between
 * certain and contingent rather than creating any.
 *
 * `obligorTid` is whoever will owe the money, i.e. always the buying club.
 * Returns 0 for an empty proposal without deriving anything, which keeps the
 * ordinary no-clause path exactly as cheap as it was: `deriveLeagueContexts`
 * walks every squad in the world and this runs on a user's click.
 */
export function clauseCashDiscount(
  league: LeagueStore,
  pid: number,
  obligorTid: number,
  baseFee: number,
  clauses: ProposedClause[],
): number {
  if (clauses.length === 0) return 0;
  const player = league.players.find((p) => p.pid === pid);
  const obligor = league.teams.find((t) => t.tid === obligorTid);
  if (!player || !obligor) return 0;
  const contexts = deriveLeagueContexts({
    teams: league.teams, players: league.players, season: league.season,
    played: league.played, competitions: league.competitions,
  });
  // The weakest man the buyer's shape actually fields in his position — the
  // buy-side counterfactual the transfer AI already reasons with, and the right
  // read on "will he play" for an appearance or goal bonus.
  const starterOvr = contexts.get(obligorTid)?.posWeakestStarterOvr[player.pos] ?? null;
  return clausesValue(
    clauses, player, league.season, baseFee, obligor, league.competitions, starterOvr,
  );
}

/** Money a clause has come due for, ready to be moved between two budgets. */
export interface ClausePayout {
  /** The club that owes it. */
  fromTid: number;
  /** The club owed it. */
  toTid: number;
  amount: number;
  pid: number;
  /** What produced it, for the news feed and the finance ledger. */
  reason: "sellOn" | BonusTrigger;
}

/**
 * Settle every clause a sale triggers, and drop the ones that sale kills.
 *
 * Called from the single shared fee path (`settleFee` in negotiation.ts), so
 * both the user's own deals and the AI↔AI market — which credits budgets inline
 * rather than going through `executeTransfer` — honour a sell-on identically.
 * Two copies of "who gets paid" would drift, which is the same argument that
 * put `saleGateFor` in one place.
 *
 * Both kinds of clause die when the player leaves the club that owed them, and
 * only one of them pays on the way out:
 *
 * - A **sell-on** is exactly about this moment. It pays a share of the profit
 *   over what the obligor originally paid — so a club that sells at a loss owes
 *   nothing, which is what pricing on profit rather than on the gross fee buys.
 * - A **bonus** was a bet on what he would do *at that club*, so it lapses
 *   unpaid. Carrying it to the new club would be paying the old obligor's debt
 *   out of a stranger's budget.
 *
 * Pure: returns what to credit and what survives, and touches no budgets
 * itself. No rng draw.
 */
export function settleClausesOnSale(
  clauses: TransferClause[],
  pid: number,
  sellerTid: number,
  fee: number,
  season: number,
): { payouts: ClausePayout[]; remaining: TransferClause[] } {
  const payouts: ClausePayout[] = [];
  const remaining: TransferClause[] = [];
  for (const c of clauses) {
    if (c.pid !== pid || c.obligorTid !== sellerTid) {
      remaining.push(c);
      continue;
    }
    if (c.kind === "sellOn" && season <= c.expires) {
      const profit = Math.max(0, fee - c.baseFee);
      const amount = Math.round(profit * c.share);
      if (amount > 0) {
        payouts.push({
          fromTid: c.obligorTid, toTid: c.beneficiaryTid, amount, pid, reason: "sellOn",
        });
      }
    }
    // Either way it does not survive the move.
  }
  return { payouts, remaining };
}

/**
 * Whether a bonus's condition was met in the season just played.
 *
 * `stats` is the player's league line for that season and may be absent (he
 * never appeared). The team triggers are answered by the caller, which has the
 * final tables — this only knows what a player did.
 */
export function bonusTriggered(
  clause: BonusClause,
  stats: { appearances: number; goals: number } | undefined,
  teamAchieved: boolean,
): boolean {
  switch (clause.trigger) {
    case "appearances":
      return (stats?.appearances ?? 0) >= BONUS_APPEARANCE_THRESHOLD;
    case "goals":
      return (stats?.goals ?? 0) >= BONUS_GOAL_THRESHOLD;
    case "continental":
    case "promotion":
      return teamAchieved;
  }
}

/**
 * Everything a completed season's bonuses come due for.
 *
 * Pure, and deliberately separated from the offseason step that calls it: the
 * step's job is to *answer* the four questions below off the season's tables and
 * stats, which only it can do; deciding who then gets paid is ordinary logic
 * that should be testable without simming a season to reach it.
 *
 * A bonus only counts while the player is still at the club that agreed it —
 * the same rule that makes a sale kill it. It pays once and is gone.
 */
export interface BonusSettlementInputs {
  /** Which club each player is on right now. Absent = nobody's. */
  rosterOf: ReadonlyMap<number, number>;
  /** Each player's league line for the season just played. */
  statsByPid: ReadonlyMap<number, { appearances: number; goals: number } | undefined>;
  /** Clubs in a continental competition off that season. */
  qualifiedTids: ReadonlySet<number>;
  /** Clubs promoted at this rollover. */
  promotedTids: ReadonlySet<number>;
}

export function settleBonuses(
  clauses: TransferClause[],
  inputs: BonusSettlementInputs,
): { payouts: ClausePayout[]; remaining: TransferClause[] } {
  const payouts: ClausePayout[] = [];
  const remaining: TransferClause[] = [];
  for (const c of clauses) {
    if (c.kind !== "bonus") { remaining.push(c); continue; }
    const stillThere = inputs.rosterOf.get(c.pid) === c.obligorTid;
    const teamAchieved =
      c.trigger === "continental" ? inputs.qualifiedTids.has(c.obligorTid)
      : c.trigger === "promotion" ? inputs.promotedTids.has(c.obligorTid)
      : false;
    if (stillThere && bonusTriggered(c, inputs.statsByPid.get(c.pid), teamAchieved)) {
      payouts.push({
        fromTid: c.obligorTid, toTid: c.beneficiaryTid,
        amount: c.amount, pid: c.pid, reason: c.trigger,
      });
      continue;
    }
    remaining.push(c);
  }
  return { payouts, remaining };
}

/**
 * Net effect of a set of payouts on each club, as tid → delta.
 *
 * Both sides always move, so the total is exactly zero — money changes hands
 * and none is created. Callers apply it to budgets themselves because only they
 * know the right money scale (and whether to clamp).
 */
export function payoutDeltas(payouts: ClausePayout[]): Map<number, number> {
  const delta = new Map<number, number>();
  const add = (tid: number, amount: number) =>
    delta.set(tid, (delta.get(tid) ?? 0) + amount);
  for (const p of payouts) {
    add(p.fromTid, -p.amount);
    add(p.toTid, p.amount);
  }
  return delta;
}

/** Clauses the given club is owed money by someone else on. */
export function clausesOwedTo(league: LeagueStore, tid: number): TransferClause[] {
  return (league.transferClauses ?? []).filter((c) => c.beneficiaryTid === tid);
}

/** Clauses the given club owes money on. */
export function clausesOwedBy(league: LeagueStore, tid: number): TransferClause[] {
  return (league.transferClauses ?? []).filter((c) => c.obligorTid === tid);
}

/** Every live clause attached to one player. */
export function clausesForPlayer(league: LeagueStore, pid: number): TransferClause[] {
  return (league.transferClauses ?? []).filter((c) => c.pid === pid);
}

/**
 * Drop clauses whose expiry season has passed. Called once per offseason,
 * after the season's bonuses have had their chance to settle.
 */
export function expireClauses(clauses: TransferClause[], season: number): TransferClause[] {
  return clauses.filter((c) => c.expires >= season);
}

/**
 * Drop every clause naming any of these pids.
 *
 * Called from the same places the watchlist is scrubbed — retirement and the
 * free-agent cull — plus release to free agency. A clause pointing at a deleted
 * player can never fire and can never be seen, so leaving it would be a slow
 * leak of unreadable rows into every save.
 */
export function scrubClausesForPids(
  clauses: TransferClause[],
  pids: ReadonlySet<number>,
): TransferClause[] {
  return clauses.filter((c) => !pids.has(c.pid));
}
