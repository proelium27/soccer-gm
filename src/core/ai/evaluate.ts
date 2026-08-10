import type { Player } from "../players/types.js";
import type { ClubContext } from "./clubContext.js";
import { trueTransferValue } from "../finance/valuation.js";
import { ROSTER_COMPOSITION } from "../constants.js";
import {
  AI_NEED_SCARCITY, AI_NEED_SURPLUS, AI_NEED_UPGRADE_SLOPE,
  AI_NEED_UPGRADE_MIN, AI_NEED_UPGRADE_MAX, AI_NEED_MIN, AI_NEED_MAX,
  AI_TIMELINE_STRENGTH, AI_PRIME_NEUTRAL, AI_YOUTH_NEUTRAL,
  AI_AFFORD_FREE_FRACTION, AI_AFFORD_SLOPE, AI_AFFORD_BUDGET_FLOOR,
  AI_SCOUT_NOISE_MIN, AI_SCOUT_NOISE_MAX,
  AI_NEED_BUY_WEAK_STARTER_GAP,
} from "../constants.js";

/** Clamp x into [lo, hi]. */
function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/**
 * Which side of a deal a valuation is for.
 *
 * Two things vary independently, so there are three useful combinations:
 *
 *   - Whose squad is he measured against? An *acquirer* compares him to the
 *     players it has; an *incumbent* has to ask the counterfactual — how far
 *     would we fall back without him — or it ends up measuring him against
 *     himself and concluding he adds nothing.
 *   - Is money leaving the club? If so, affordability discounts him.
 *
 * "buy"   — acquirer, spending. What he'd be worth to a club that doesn't have
 *           him.
 * "keep"  — incumbent, not spending. His reservation price: what it would take
 *           to give him up. Affordability must NOT apply — the club isn't
 *           buying anything. Charging a purchase-affordability discount against
 *           a player already on the books priced clubs' own stars at a fraction
 *           of market (measured: an 85-ovr player's own club valued him at
 *           $132M against a $350M market), which is what made every star cheap
 *           and permanently available.
 * Contract renewals deliberately stay on "buy" despite being an incumbent
 * decision: AI_RENEWAL_MARGIN is calibrated against those numbers, and switching
 * them to "keep" re-signs virtually every player in the world and starves free
 * agency (measured — see runAIContractRenewals).
 */
export type ValuationSide = "buy" | "keep";

/**
 * The full breakdown of what a player is worth to a specific club: the
 * market anchor (`base`), each club-relative multiplier applied to it, and
 * the resulting `value`. Returned so the reasoning is transparent (usable
 * later for a "why did they value him at X" UI, and for tests).
 */
export interface ClubValuation {
  /** Market value (trueTransferValue) — the club-agnostic anchor. */
  base: number;
  /** >1 if the club is thin/weak at the position and he'd upgrade it; <1 if stacked. */
  needMult: number;
  /** >1 if his age fits the club's win-now/develop tilt; <1 if it clashes. */
  timelineMult: number;
  /** ≤1 penalty when the deal is large relative to a cautious club's budget. */
  affordabilityMult: number;
  /** base × needMult × timelineMult × affordabilityMult, never negative. */
  value: number;
}

/**
 * Positional-need multiplier. Two independent signals, multiplied:
 *  - depth: below the ROSTER_COMPOSITION target at his position scales value
 *    up (scarcity); above it scales value down (surplus).
 *  - upgrade: how much he'd raise the club's best ovr at that position — a
 *    clear upgrade is worth more, a clear downgrade less.
 *
 * On the KEEP side both signals must be asked counterfactually — "where would
 * we be without him" — rather than as-is, because as-is a club is measuring the
 * player against himself. He *is* its best at the position, so the upgrade term
 * reads 0, and he is one of the bodies making it look well-stocked, so the
 * depth term reads surplus. The result was a club systematically valuing its
 * own best players at a fraction of what any weaker club would pay, which is
 * what made every star permanently available. So on the keep side we compare
 * him to the man who'd actually replace him (posSecondBestOvr) and count the
 * depth he'd be leaving behind.
 */
function needMultiplier(player: Player, ctx: ClubContext, side: ValuationSide): number {
  const pos = player.pos;
  const target = ROSTER_COMPOSITION[pos];
  const keep = side === "keep";
  const depth = keep ? ctx.posDepth[pos] - 1 : ctx.posDepth[pos];
  const depthRatio = target > 0 ? Math.max(0, depth) / target : 1;

  const depthMult =
    depthRatio <= 1
      ? 1 + AI_NEED_SCARCITY * (1 - depthRatio)
      : 1 / (1 + AI_NEED_SURPLUS * (depthRatio - 1));

  // Who he's measured against: on the buy side, the best they currently have
  // (0 if the slot is empty, which makes an incumbent-less signing read as a
  // big upgrade — as it should). On the keep side, whoever would step up if he
  // left: the second best, unless he isn't their best anyway.
  const incumbent = keep && player.ovr >= ctx.posBestOvr[pos]
    ? ctx.posSecondBestOvr[pos]
    : ctx.posBestOvr[pos];
  const upgrade = player.ovr - incumbent;
  const upgradeMult = clamp(
    1 + AI_NEED_UPGRADE_SLOPE * upgrade,
    AI_NEED_UPGRADE_MIN,
    AI_NEED_UPGRADE_MAX,
  );

  return clamp(depthMult * upgradeMult, AI_NEED_MIN, AI_NEED_MAX);
}

/** Usefulness-now score, [0,1]: triangular peak at 26, zero by 18 and 34. */
function primeScore(age: number): number {
  return clamp(1 - Math.abs(age - 26) / 8, 0, 1);
}

/** Upside/longevity score, [0,1]: 1 at ≤18, linearly to 0 by 28. */
function youthScore(age: number): number {
  return clamp((28 - age) / 10, 0, 1);
}

/**
 * Timeline multiplier: how the player's age fits the club's ambition. A
 * win-now club (high ambition) weights prime-age readiness and shrugs off
 * upside; a developer club (low ambition) weights youth/upside. The neutral
 * references keep a typical mid-20s player near 1.0 at any ambition.
 */
function timelineMultiplier(player: Player, ctx: ClubContext, side: ValuationSide): number {
  const age = ctx.season - player.born;
  const prime = primeScore(age) - AI_PRIME_NEUTRAL;
  const youth = youthScore(age) - AI_YOUTH_NEUTRAL;
  if (side === "keep") {
    // Keeping is not the mirror of buying. A club weighs its buying by what it
    // needs *now* versus later, but it holds on to a player if he's useful now
    // OR he's the future — a win-now club does not sell its best 21-year-old
    // just because its priority is this season. Taking the better of the two
    // views (rather than the ambition-weighted blend) is what stops the market
    // stripping clubs of exactly the young talent they should be building on.
    return 1 + AI_TIMELINE_STRENGTH * Math.max(prime, youth);
  }
  return 1 + AI_TIMELINE_STRENGTH * (ctx.ambition * prime + (1 - ctx.ambition) * youth);
}

/**
 * Affordability multiplier, ≤1. The deal's rough first-year outlay (a fee
 * proxy = market value, plus the season wage) is measured against the club's
 * budget; spend beyond AI_AFFORD_FREE_FRACTION of the budget is penalized,
 * steeper the more frugal (poorer) the club. Wealthy clubs (frugality ~0)
 * feel almost nothing — they can absorb mistakes.
 */
function affordabilityMultiplier(player: Player, ctx: ClubContext, base: number): number {
  const cost = base + player.contract.salary;
  const budget = Math.max(ctx.budget, AI_AFFORD_BUDGET_FLOOR);
  const relCost = cost / budget;
  const excess = Math.max(0, relCost - AI_AFFORD_FREE_FRACTION);
  return 1 / (1 + AI_AFFORD_SLOPE * ctx.frugality * excess);
}

/**
 * Value a player to a specific club, returning the full breakdown. The
 * club-agnostic market value (`trueTransferValue`) is tilted by three
 * club-relative factors — positional need, age×ambition timeline fit, and
 * affordability — so the same player is worth different amounts to different
 * clubs. This is the primitive every future AI transfer/contract decision is
 * meant to build on (buy if value ≥ asking, sell if value < market, etc.).
 */
export function evaluatePlayerForClub(
  player: Player,
  ctx: ClubContext,
  side: ValuationSide = "buy",
): ClubValuation {
  const base = trueTransferValue(player, ctx.season);
  const needMult = needMultiplier(player, ctx, side);
  const timelineMult = timelineMultiplier(player, ctx, side);
  // Only an acquirer has a purchase to afford; a reservation price is not a
  // spending decision at all — see ValuationSide.
  const affordabilityMult =
    side === "keep" ? 1 : affordabilityMultiplier(player, ctx, base);
  const value = Math.max(0, base * needMult * timelineMult * affordabilityMult);
  return { base, needMult, timelineMult, affordabilityMult, value };
}

/** Convenience: just the club-relative value (see evaluatePlayerForClub). */
export function valueToClub(player: Player, ctx: ClubContext): number {
  return evaluatePlayerForClub(player, ctx).value;
}

/**
 * What the club that owns him would need to be paid to let him go — his
 * reservation price. Every "should we sell / should we renew" decision should
 * use this rather than valueToClub; see ValuationSide for why the two differ.
 */
export function keepValueToClub(player: Player, ctx: ClubContext): number {
  return evaluatePlayerForClub(player, ctx, "keep").value;
}

/**
 * Does this club have a genuine gap at the player's position? Either it's
 * understaffed there (fewer bodies than ROSTER_COMPOSITION wants) or it has a
 * weak startable hole this player would upgrade (its best at the position sits
 * AI_NEED_BUY_WEAK_STARTER_GAP+ ovr below the club's own squad strength, and the
 * player beats that incumbent). Drives the AI "need buy" path: a cash-rich club
 * with a real hole pays a fair price to fill it instead of holding out for a
 * bargain. Position quality/affordability are judged elsewhere — this only asks
 * "is there a hole here?".
 */
export function hasPositionalGap(player: Player, ctx: ClubContext): boolean {
  const pos = player.pos;
  const understaffed = ctx.posDepth[pos] < ROSTER_COMPOSITION[pos];
  const weakStarter =
    ctx.posBestOvr[pos] < ctx.squadStrength - AI_NEED_BUY_WEAK_STARTER_GAP &&
    player.ovr > ctx.posBestOvr[pos];
  return understaffed || weakStarter;
}

/**
 * A club's scouting noise (± fraction of value applied to any valuation it
 * makes), scaled by frugality: the wealthiest club in the league (frugality
 * 0) judges players almost exactly right, the poorest (frugality 1) can be
 * off by up to AI_SCOUT_NOISE_MAX. Reuses frugality rather than adding a new
 * ClubContext field — wealth already stands in for scouting investment.
 */
export function scoutNoiseFraction(ctx: ClubContext): number {
  return AI_SCOUT_NOISE_MIN + ctx.frugality * (AI_SCOUT_NOISE_MAX - AI_SCOUT_NOISE_MIN);
}

/**
 * valueToClub with the club's scouting noise applied — its perceived value
 * of the player rather than the "true" club-relative value. Every AI
 * valuation used to decide a transfer/renewal should go through this instead
 * of the raw valueToClub, so richer/better-scouted clubs make sharper calls.
 */
export function perceivedValueToClub(
  player: Player,
  ctx: ClubContext,
  jitter: () => number,
  side: ValuationSide = "buy",
): number {
  const value = evaluatePlayerForClub(player, ctx, side).value;
  const noise = scoutNoiseFraction(ctx);
  return value * (1 + (jitter() * 2 - 1) * noise);
}
