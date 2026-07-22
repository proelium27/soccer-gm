import { describe, it, expect } from "vitest";
import { setMoreMinutes } from "../../src/core/lineup/moreMinutes.js";
import { makeLeague } from "../helpers/league.js";

describe("setMoreMinutes", () => {
  it("flags and unflags a player on the user's own roster", () => {
    const league = makeLeague(0, 1);
    const userTeam = league.teams.find((t) => t.tid === league.meta.userTid)!;
    const pid = userTeam.roster[0];

    const flagged = setMoreMinutes(league, pid, true);
    const flaggedTeam = flagged.teams.find((t) => t.tid === league.meta.userTid)!;
    expect(flaggedTeam.moreMinutes).toContain(pid);

    const unflagged = setMoreMinutes(flagged, pid, false);
    const unflaggedTeam = unflagged.teams.find((t) => t.tid === league.meta.userTid)!;
    expect(unflaggedTeam.moreMinutes).not.toContain(pid);
  });

  it("never flags a player who isn't on the user's roster", () => {
    const league = makeLeague(0, 1);
    const otherTeam = league.teams.find((t) => t.tid !== league.meta.userTid)!;
    const rivalPid = otherTeam.roster[0];
    // A rival's player can't be flagged: no team's moreMinutes ever picks him up.
    for (const pid of [rivalPid, 9_999_999]) {
      const after = setMoreMinutes(league, pid, true);
      expect(after.teams.every((t) => !t.moreMinutes.includes(pid))).toBe(true);
    }
  });
});
