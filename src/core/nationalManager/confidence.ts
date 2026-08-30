/**
 * The federation's verdict on a campaign.
 *
 * Deliberately the same *shape* as the club board's `judgeSeason` — a running
 * 0-100 balance, a memory term that pulls back toward the starting point, an
 * asymmetric demand scaling, then flat bonuses for trophies — so that the two
 * confidence bars in the game mean the same thing and can share their mood
 * labels. What differs is the tuning and what counts as an achievement, which
 * is why the constants are a separate block (see the NATIONAL_* comment there).
 *
 * Pure and rng-free.
 */
import {
  NATIONAL_CONFIDENCE_SWING,
  NATIONAL_CONFIDENCE_RECOVERY,
  NATIONAL_START_CONFIDENCE,
  NATIONAL_TITLE_CONFIDENCE,
  NATIONAL_CONTINENTAL_CONFIDENCE,
  NATIONAL_QUALIFICATION_CONFIDENCE,
  NATIONAL_MISSED_QUALIFICATION_CONFIDENCE,
  NATIONAL_DEMAND_PENALTY_SCALE,
  NATIONAL_DEMAND_REWARD_DAMPING,
  NATIONAL_GRACE_CAMPAIGNS,
  NATIONAL_SACK_THRESHOLD,
} from "../constants.js";

/** Which competition a verdict is about. */
export type CampaignKind = "qualifying" | "tournament" | "confederation";

/** What the nation achieved, and what the federation made of it. */
export interface CampaignVerdict {
  kind: CampaignKind;
  /** The competition's name, for display ("World Cup", "Copa América"). */
  competition: string;
  /**
   * Where the nation finished, as a placement in the field — fractional on
   * purpose. Everyone knocked out in the same round shares a band of places
   * (the four beaten quarter-finalists are 5th to 8th), and the midpoint of that
   * band is the only honest single number for it. See `tournamentPlacement`.
   */
  placement: number;
  /** Where the strength of its players said it should finish. */
  expectedRank: number;
  /** How many nations were in the field. */
  nations: number;
  /** Placement versus expectation as a fraction of the field. */
  overperformance: number;
  /** 1 if this was the World Cup and the nation won it. */
  titles: number;
  /** 1 if this was a confederation championship and the nation won it. */
  continentalTitles: number;
  /** For a qualifying campaign: did the nation reach the finals? Null otherwise. */
  qualified: boolean | null;
  /** How demanding this federation is, [0,1]. */
  demand: number;
  /** How far confidence moved, before clamping. */
  delta: number;
  /** Confidence after the verdict, 0-100. */
  confidence: number;
  /** The federation has dismissed you. */
  sacked: boolean;
}

export interface CampaignFacts {
  kind: CampaignKind;
  competition: string;
  placement: number;
  expectedRank: number;
  nations: number;
  demand: number;
  titles: number;
  continentalTitles: number;
  qualified: boolean | null;
}

const clamp01to100 = (n: number): number => Math.min(100, Math.max(0, n));

/**
 * Apply one campaign to a manager's standing with their federation.
 *
 * `campaignsManaged` is the number already seen through, so the grace window is
 * counted in campaigns survived — a manager appointed last summer has always had
 * a full window before the first campaign that can cost them the job.
 */
export function judgeCampaign(
  facts: CampaignFacts,
  confidence: number,
  campaignsManaged: number,
  sackingEnabled: boolean,
  boardPatience: number,
): CampaignVerdict {
  const { placement, expectedRank, nations, demand } = facts;
  const over = nations > 1 ? (expectedRank - placement) / (nations - 1) : 0;

  // Federations forget, in both directions — same term, and same reasoning, as
  // the club board's. Applied before the verdict so a manager merely meeting
  // expectations climbs slowly out of a bad cycle, and so a World Cup won eight
  // years ago stops working as a permanent shield.
  const remembered =
    confidence + (NATIONAL_START_CONFIDENCE - confidence) * NATIONAL_CONFIDENCE_RECOVERY;

  const base = over * NATIONAL_CONFIDENCE_SWING;
  let delta =
    base >= 0
      ? base * (1 - demand * NATIONAL_DEMAND_REWARD_DAMPING)
      : base * (1 + demand * NATIONAL_DEMAND_PENALTY_SCALE);

  // Trophies and qualification are judged flat rather than scaled by demand, for
  // the same reason a club's cup win is: a World Cup is a World Cup, and damping
  // a strong nation's toward nothing would make the greatest achievement in the
  // sport worth almost no goodwill to the only people who can realistically win it.
  delta += facts.titles * NATIONAL_TITLE_CONFIDENCE;
  delta += facts.continentalTitles * NATIONAL_CONTINENTAL_CONFIDENCE;
  if (facts.qualified === true) delta += NATIONAL_QUALIFICATION_CONFIDENCE;
  if (facts.qualified === false) delta += NATIONAL_MISSED_QUALIFICATION_CONFIDENCE;

  // The save's difficulty is the global patience knob, applied last and to the
  // whole verdict, so a difficulty level moves job security uniformly instead of
  // quietly re-weighting trophies against tournament placement.
  const patience = boardPatience > 0 ? boardPatience : 1;
  delta = delta >= 0 ? delta * patience : delta / patience;

  const next = clamp01to100(remembered + delta);
  const sacked =
    sackingEnabled && next <= NATIONAL_SACK_THRESHOLD && campaignsManaged >= NATIONAL_GRACE_CAMPAIGNS;

  return {
    kind: facts.kind,
    competition: facts.competition,
    placement,
    expectedRank,
    nations,
    overperformance: over,
    titles: facts.titles,
    continentalTitles: facts.continentalTitles,
    qualified: facts.qualified,
    demand,
    delta,
    confidence: next,
    sacked,
  };
}
