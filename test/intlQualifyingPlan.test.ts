import { describe, expect, it } from "vitest";
import { makeLeague } from "./helpers/league.js";
import { initQualifying } from "../src/core/international/qualifying.js";
import { qualifyingPlan, placesByPosition } from "../src/core/international/index.js";
import { INTL_FIELD_SIZE } from "../src/core/constants.js";

/**
 * The Qualifying page tells the user what each confederation is playing for
 * ("13 of the 32 places, from seven groups: every group winner, plus the six
 * best runners-up") three offseasons before the last leg is played. That claim
 * is only worth making if it is the rule the sim actually fills places by, so
 * these pin the plan to the draw it describes.
 */

function drawCampaign() {
  const league = makeLeague(0, 7);
  const campaign = initQualifying(league.players, league.season);
  expect(campaign).not.toBeNull();
  return campaign!;
}

describe("placesByPosition", () => {
  it("takes every group's place at a position before moving down one", () => {
    // Seven groups, thirteen places: all seven winners, then six of the seven
    // runners-up. Nobody finishing third is reachable.
    expect(placesByPosition([5, 5, 5, 5, 5, 5, 5], 13)).toEqual([7, 6]);
  });

  it("hands out exactly the places available, never more", () => {
    expect(placesByPosition([4, 4, 4], 8).reduce((a, b) => a + b, 0)).toBe(8);
    expect(placesByPosition([4, 4, 4], 12).reduce((a, b) => a + b, 0)).toBe(12);
  });

  it("stops at the shallowest depth it can reach, so a slot can't fall off the end", () => {
    // Six nations in one group, three places: first, second and third.
    expect(placesByPosition([6], 3)).toEqual([1, 1, 1]);
    // More places than nations: it runs out of rows, not of places.
    expect(placesByPosition([3], 9)).toEqual([1, 1, 1]);
  });

  it("counts only the groups deep enough to have the position", () => {
    // Serpentine draws leave group sizes differing by one. At position 4 only
    // the five-nation group has a row to give.
    expect(placesByPosition([5, 4, 4], 12)).toEqual([3, 3, 3, 3]);
    expect(placesByPosition([5, 4, 4], 13)).toEqual([3, 3, 3, 3, 1]);
  });
});

describe("qualifyingPlan", () => {
  it("shares out exactly the tournament field between the confederations", () => {
    const plans = qualifyingPlan(drawCampaign());
    expect(plans.length).toBeGreaterThan(0);
    expect(plans.reduce((sum, p) => sum + p.slots, 0)).toBe(INTL_FIELD_SIZE);
  });

  it("gives every confederation that plays qualifying exactly its allocation", () => {
    for (const plan of qualifyingPlan(drawCampaign())) {
      if (plan.groups === 0) continue;
      expect(plan.byPosition.reduce((a, b) => a + b, 0)).toBe(plan.slots);
    }
  });

  it("never promises more group winners than there are places", () => {
    // The guarantee the page prints as "every group winner" rests on this: the
    // draw never makes more groups than the confederation has places.
    for (const plan of qualifyingPlan(drawCampaign())) {
      expect(plan.groups).toBeLessThanOrEqual(plan.slots);
    }
  });

  it("marks a confederation with no more nations than places as playing nothing", () => {
    for (const plan of qualifyingPlan(drawCampaign())) {
      if (plan.nations > plan.slots) continue;
      expect(plan.groups).toBe(0);
      expect(plan.byPosition).toEqual([]);
    }
  });

  it("describes the groups actually drawn, not a fresh draw", () => {
    const campaign = drawCampaign();
    const drawn = new Map<string, number>();
    for (const g of campaign.groups) {
      if (g.confederation == null) continue;
      drawn.set(g.confederation, (drawn.get(g.confederation) ?? 0) + 1);
    }
    for (const plan of qualifyingPlan(campaign)) {
      expect(plan.groups).toBe(drawn.get(plan.confederation) ?? 0);
    }
  });
});
