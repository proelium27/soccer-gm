import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../../src/engine/rng.js";
import { createLeagueState } from "../../../src/core/leagueState.js";
import { wouldRefuseExtension } from "../../../src/core/ai/breakoutRefusal.js";
import { DIVISION_2_REFUSAL_OVR_THRESHOLD } from "../../../src/core/constants.js";

const USER_TID = 0;

describe("wouldRefuseExtension", () => {
  it("never refuses for a Division 1 player, regardless of ability", () => {
    const league = createLeagueState(USER_TID, mulberry32(11));
    const d1Team = league.teams.find((t) => t.division === 0)!;
    const target = league.players.find((p) => d1Team.roster.includes(p.pid))!;
    const boosted = { ...target, ovr: 95 };
    expect(wouldRefuseExtension(boosted, d1Team)).toBe(false);
  });

  it("does not refuse a Division 2 player below the OVR threshold", () => {
    const league = createLeagueState(USER_TID, mulberry32(11));
    const d2Team = league.teams.find((t) => t.division === 1)!;
    const target = league.players.find((p) => d2Team.roster.includes(p.pid))!;
    const weak = { ...target, ovr: DIVISION_2_REFUSAL_OVR_THRESHOLD - 1 };
    expect(wouldRefuseExtension(weak, d2Team)).toBe(false);
  });

  it("refuses a Division 2 player at or above the OVR threshold", () => {
    const league = createLeagueState(USER_TID, mulberry32(11));
    const d2Team = league.teams.find((t) => t.division === 1 && t.tid !== USER_TID)!;
    const target = league.players.find((p) => d2Team.roster.includes(p.pid))!;
    const star = { ...target, ovr: DIVISION_2_REFUSAL_OVR_THRESHOLD };
    expect(wouldRefuseExtension(star, d2Team)).toBe(true);
  });

  it("is deterministic: repeated calls with the same inputs agree", () => {
    const league = createLeagueState(USER_TID, mulberry32(11));
    const d2Team = league.teams.find((t) => t.division === 1 && t.tid !== USER_TID)!;
    const target = league.players.find((p) => d2Team.roster.includes(p.pid))!;
    const star = { ...target, ovr: 88 };
    const first = wouldRefuseExtension(star, d2Team);
    const second = wouldRefuseExtension(star, d2Team);
    expect(first).toBe(second);
  });
});
