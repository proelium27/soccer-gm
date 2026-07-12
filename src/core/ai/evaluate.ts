import type { Player } from "../players/types.js";
import type { ClubContext } from "./clubContext.js";
import { trueTransferValue } from "../finance/valuation.js";
import { ROSTER_COMPOSITION } from "../constants.js";
import {
  AI_NEED_SCARCITY, AI_NEED_SURPLUS, AI_NEED_UPGRADE_SLOPE,
  AI_NEED_UPGRADE_MIN, AI_NEED_UPGRADE_MAX, AI_NEED_MIN, AI_NEED_MAX,
  AI_TIMELINE_STRENGTH, AI_PRIME_NEUTRAL, AI_YOUTH_NEUTRAL,
  AI_AFFORD_FREE_FRACTION, AI_AFFORD_SLOPE, AI_AFFORD_BUDGET_FLOOR,
} from "../constants.js";

/** Clamp x into [lo, hi]. */
function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

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
 */
function needMultiplier(player: Player, ctx: ClubContext): number {
  const pos = player.pos;
  const target = ROSTER_COMPOSITION[pos];
  const depth = ctx.posDepth[pos];
  const depthRatio = target > 0 ? depth / target : 1;

  const depthMult =
    depthRatio <= 1
      ? 1 + AI_NEED_SCARCITY * (1 - depthRatio)
      : 1 / (1 + AI_NEED_SURPLUS * (depthRatio - 1));

  // Best they currently have at the position (0 if the slot is empty, which
  // makes any incumbent-less signing read as a big upgrade — as it should).
  const upgrade = player.ovr - ctx.posBestOvr[pos];
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
function timelineMultiplier(player: Player, ctx: ClubContext): number {
  const age = ctx.season - player.born;
  const primeTerm = ctx.ambition * (primeScore(age) - AI_PRIME_NEUTRAL);
  const youthTerm = (1 - ctx.ambition) * (youthScore(age) - AI_YOUTH_NEUTRAL);
  return 1 + AI_TIMELINE_STRENGTH * (primeTerm + youthTerm);
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
export function evaluatePlayerForClub(player: Player, ctx: ClubContext): ClubValuation {
  const base = trueTransferValue(player, ctx.season);
  const needMult = needMultiplier(player, ctx);
  const timelineMult = timelineMultiplier(player, ctx);
  const affordabilityMult = affordabilityMultiplier(player, ctx, base);
  const value = Math.max(0, base * needMult * timelineMult * affordabilityMult);
  return { base, needMult, timelineMult, affordabilityMult, value };
}

/** Convenience: just the club-relative value (see evaluatePlayerForClub). */
export function valueToClub(player: Player, ctx: ClubContext): number {
  return evaluatePlayerForClub(player, ctx).value;
}
