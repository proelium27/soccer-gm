import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { createLeagueState } from "../../src/core/leagueState.js";
import { simThrough } from "../../src/core/simThrough.js";
import { simOffseason } from "../../src/core/offseason.js";
import {
  freeAgentPids, signTrialist, releaseTrialist, trialSigningsLeft,
} from "../../src/core/freeAgency.js";
import { academyFacilitiesBonus } from "../../src/core/players/academyFacilities.js";
import {
  YOUTH_TRIAL_GROUP_MIN, YOUTH_TRIAL_GROUP_MAX, YOUTH_TRIAL_SIGN_LIMIT,
  SCOUTING_SPEND_MAX, HYPE_MAX, YOUTH_AGE,
} from "../../src/core/constants.js";
import type { LeagueStore } from "../../src/core/leagueState.js";

/** One season plus its offseason, which is what lays out a trial group. */
function advance(league: LeagueStore, rng: () => number): LeagueStore {
  return simOffseason(simThrough(league, "season", rng), rng);
}

describe("youth trial group", () => {
  it("hands the user a group to choose from instead of signing his intake for him", () => {
    const rng = mulberry32(4);
    const league = advance(createLeagueState(0, rng), rng);
    const user = league.teams.find((t) => t.tid === league.meta.userTid)!;

    expect(user.youthTrialists?.length ?? 0).toBeGreaterThanOrEqual(YOUTH_TRIAL_GROUP_MIN);
    expect(user.youthTrialists!.length).toBeLessThanOrEqual(YOUTH_TRIAL_GROUP_MAX);
    // Nobody is signed: the academy is still empty and no trialist is rostered.
    expect(user.academyRoster).toHaveLength(0);
    expect(user.youthTrialSignings).toBe(0);

    const byPid = new Map(league.players.map((p) => [p.pid, p]));
    for (const pid of user.youthTrialists!) {
      expect(byPid.get(pid)!.born).toBe(league.season - YOUTH_AGE);
    }
  });

  it("holds trialists out of the free-agent pool while the decision is pending", () => {
    // Or an AI club would sign one out from under the user mid-decision, and
    // the free-agent cull would be free to delete him.
    const rng = mulberry32(4);
    const league = advance(createLeagueState(0, rng), rng);
    const user = league.teams.find((t) => t.tid === league.meta.userTid)!;
    const fa = freeAgentPids(league.teams, league.players, league.activeLoans);
    for (const pid of user.youthTrialists!) expect(fa.has(pid)).toBe(false);
  });

  it("signs a trialist into the academy and stops at the limit", () => {
    const rng = mulberry32(4);
    let league = advance(createLeagueState(0, rng), rng);
    const tid = league.meta.userTid;

    const group = [...league.teams.find((t) => t.tid === tid)!.youthTrialists!];
    // One more than allowed, so the cap is exercised rather than assumed.
    for (const pid of group.slice(0, YOUTH_TRIAL_SIGN_LIMIT + 1)) {
      const { teams, players } = signTrialist(league.teams, league.players, tid, pid, league.season);
      league = { ...league, teams, players };
    }

    const user = league.teams.find((t) => t.tid === tid)!;
    expect(user.academyRoster).toHaveLength(YOUTH_TRIAL_SIGN_LIMIT);
    expect(trialSigningsLeft(user)).toBe(0);
    // The one over the limit is still on trial, not silently dropped.
    expect(user.youthTrialists).toContain(group[YOUTH_TRIAL_SIGN_LIMIT]);

    // A signed trialist carries academy terms and an academy-stamped history,
    // so his OVR chart starts in the academy rather than with a senior point.
    const signed = league.players.find((p) => p.pid === group[0])!;
    expect(signed.contract.expiresSeason).toBeGreaterThan(league.season);
    expect(signed.hist.every((h) => h.academy)).toBe(true);
  });

  it("makes a released trialist an ordinary free agent", () => {
    const rng = mulberry32(4);
    const league = advance(createLeagueState(0, rng), rng);
    const tid = league.meta.userTid;
    const pid = league.teams.find((t) => t.tid === tid)!.youthTrialists![0];

    const teams = releaseTrialist(league.teams, tid, pid);
    expect(teams.find((t) => t.tid === tid)!.youthTrialists).not.toContain(pid);
    expect(freeAgentPids(teams, league.players, league.activeLoans).has(pid)).toBe(true);
  });

  it("replaces an undecided group at the next offseason rather than accumulating", () => {
    const rng = mulberry32(4);
    let league = advance(createLeagueState(0, rng), rng);
    const tid = league.meta.userTid;
    const first = [...league.teams.find((t) => t.tid === tid)!.youthTrialists!];

    league = advance(league, rng);
    const user = league.teams.find((t) => t.tid === tid)!;
    // The old group is gone rather than appended to — otherwise a user who
    // never opens the screen accumulates a permanent unsignable holding pool.
    expect(user.youthTrialists!.length).toBeLessThanOrEqual(YOUTH_TRIAL_GROUP_MAX);
    for (const pid of first) expect(user.youthTrialists).not.toContain(pid);
    expect(user.youthTrialSignings).toBe(0);
    // And last year's undecided trialists are signable by anyone now.
    const fa = freeAgentPids(league.teams, league.players, league.activeLoans);
    expect(first.some((pid) => fa.has(pid))).toBe(true);
  });
});

describe("the trial group's containment", () => {
  it("allocates every extra trialist a pid above every other player generated", () => {
    // The property that keeps the rest of the world identical, and it is not
    // cosmetic: developmentBias and isGenerational are hashed off the pid, so
    // an academy taking pids mid-sequence would change which players are
    // wonderkids at all 420 clubs. Verified end-to-end by fingerprinting every
    // non-user rostered player with and without this feature (identical on
    // seeds 4 and 11, 10,375 and 10,326 players); pinned structurally here so
    // a regression shows up without a two-branch measurement.
    const rng = mulberry32(4);
    const before = createLeagueState(0, rng);
    const league = advance(before, rng);

    const known = new Set(before.players.map((p) => p.pid));
    const fresh = league.players.filter((p) => !known.has(p.pid));
    const trialists = new Set(
      league.teams.find((t) => t.tid === league.meta.userTid)!.youthTrialists!,
    );

    // The user's ordinary intake is drawn inside the main loop and keeps its
    // place in the sequence, so only the top-up sits above everyone else.
    const othersMax = Math.max(
      ...fresh.filter((p) => !trialists.has(p.pid)).map((p) => p.pid),
    );
    const extras = [...trialists].filter((pid) => pid > othersMax);
    expect(extras.length).toBeGreaterThan(0);
    const lowestExtra = Math.min(...extras);
    for (const p of fresh) {
      if (trialists.has(p.pid)) continue;
      expect(p.pid).toBeLessThan(lowestExtra);
    }
  });
});

describe("academyFacilitiesBonus", () => {
  const team = (scoutingSpend: number, hype: number) =>
    ({ scoutingSpend, hype, academyRoster: [], roster: [] }) as never;

  it("pays nothing at no spend and no hype, and the full swing at both maxed", () => {
    expect(academyFacilitiesBonus(team(0, 0))).toBe(0);
    expect(academyFacilitiesBonus(team(SCOUTING_SPEND_MAX, HYPE_MAX))).toBeCloseTo(6, 5);
  });

  it("is a bonus only — never negative, however badly the club is run", () => {
    // Deliberately out of range on both axes: the anchor and academy form
    // already push downward, and a third penalty would stack on a struggling
    // club's cheapest route back.
    expect(academyFacilitiesBonus(team(-1, -50))).toBe(0);
    expect(academyFacilitiesBonus(team(NaN, NaN))).toBe(0);
  });

  it("caps rather than extrapolating past the top of each range", () => {
    expect(academyFacilitiesBonus(team(SCOUTING_SPEND_MAX * 10, HYPE_MAX * 10)))
      .toBeCloseTo(6, 5);
  });
});
