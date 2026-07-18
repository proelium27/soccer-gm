import { describe, it, expect } from "vitest";
import { makeLeague } from "../../helpers/league.js";
import { wouldRefuseExtension } from "../../../src/core/ai/breakoutRefusal.js";
import { DIVISION_2_REFUSAL_OVR_THRESHOLD } from "../../../src/core/constants.js";

const USER_TID = 0;

describe("wouldRefuseExtension", () => {
  it("never refuses for a Division 1 player, regardless of ability", () => {
    const league = makeLeague(USER_TID, 1);
    const d1Team = league.teams.find((t) => t.compId === 0)!;
    const target = league.players.find((p) => d1Team.roster.includes(p.pid))!;
    const boosted = { ...target, ovr: 95 };
    expect(wouldRefuseExtension(boosted, d1Team, league.competitions)).toBe(false);
  });

  it("does not refuse a Division 2 player below the OVR threshold", () => {
    const league = makeLeague(USER_TID, 1);
    const d2Team = league.teams.find((t) => t.compId === 1)!;
    const target = league.players.find((p) => d2Team.roster.includes(p.pid))!;
    const weak = { ...target, ovr: DIVISION_2_REFUSAL_OVR_THRESHOLD - 1 };
    expect(wouldRefuseExtension(weak, d2Team, league.competitions)).toBe(false);
  });

  it("refuses a Division 2 player at or above the OVR threshold", () => {
    const league = makeLeague(USER_TID, 1);
    const d2Team = league.teams.find((t) => t.compId === 1 && t.tid !== USER_TID)!;
    const target = league.players.find((p) => d2Team.roster.includes(p.pid))!;
    const star = { ...target, ovr: DIVISION_2_REFUSAL_OVR_THRESHOLD };
    expect(wouldRefuseExtension(star, d2Team, league.competitions)).toBe(true);
  });

  it("is deterministic: repeated calls with the same inputs agree", () => {
    const league = makeLeague(USER_TID, 1);
    const d2Team = league.teams.find((t) => t.compId === 1 && t.tid !== USER_TID)!;
    const target = league.players.find((p) => d2Team.roster.includes(p.pid))!;
    const star = { ...target, ovr: 88 };
    const first = wouldRefuseExtension(star, d2Team, league.competitions);
    const second = wouldRefuseExtension(star, d2Team, league.competitions);
    expect(first).toBe(second);
  });
});
