import { describe, it, expect } from "vitest";
import { makeLeague } from "../helpers/league.js";
import { mulberry32 } from "../../src/engine/rng.js";
import { type LeagueStore } from "../../src/core/leagueState.js";
import { simThrough } from "../../src/core/simThrough.js";
import { simOffseason } from "../../src/core/offseason.js";
import { tierOf } from "../../src/core/competitions.js";
import { isCupComplete } from "../../src/core/cup/cup.js";
import type { CupTie } from "../../src/core/cup/types.js";
import { CUP_ROUND_MATCHDAYS } from "../../src/core/constants.js";

/** Advance a fresh save to the start of season 2 (regular phase), by which point a cup is seeded. */
function toSeason2(seed: number, userTid = 0): LeagueStore {
  let league = makeLeague(userTid, 1);
  expect(league.cup).toBeNull(); // season 1 never has a cup
  league = simThrough(league, "season", mulberry32(seed + 1));
  expect(league.phase).toBe("offseason");
  league = simOffseason(league, mulberry32(seed + 2));
  expect(league.season).toBe(2);
  return league;
}

function stubTie(round: number, home: number, away: number, winner: number): CupTie {
  return {
    round, matchday: CUP_ROUND_MATCHDAYS[round], home, away,
    homeGoals: winner === home ? 1 : 0, awayGoals: winner === away ? 1 : 0,
    wentToExtraTime: false, wentToPens: false, homePens: 0, awayPens: 0, winner,
    boxScore: { home: [], away: [], events: [] },
  };
}

describe("Continental Cup — season lifecycle", () => {
  it("seeds a 16-team cup at the first offseason and completes it during season 2", () => {
    // Pick a tier-2 club as the user so the sim is never halted by the
    // stop-before-final rule (a tier-2 club can't qualify for the cup). The
    // fresh, unsimmed world already exposes every club's tier, so this needs
    // no extra season simulation.
    const fresh = makeLeague(0, 1);
    const tier2Tid = fresh.teams.find((t) => tierOf(fresh.competitions, t.compId) === 2)!.tid;
    const league2 = toSeason2(5, tier2Tid);

    expect(league2.cup).not.toBeNull();
    expect(league2.cup!.teams).toHaveLength(16);
    expect(league2.cup!.season).toBe(2);
    // The real world (6 tier-1 leagues) fields a play-in: 14 byes + 2 pending
    // (-1) slots the play-in fills, plus 4 play-in participants.
    expect(league2.cup!.playIn).not.toBeNull();
    expect(league2.cup!.playIn!.teams).toHaveLength(4);
    expect(league2.cup!.teams.filter((t) => t === -1)).toHaveLength(2);
    // No real cup team (bye or play-in participant) is a tier-2 club.
    const preTids = [...league2.cup!.teams.filter((t) => t >= 0), ...league2.cup!.playIn!.teams];
    for (const tid of preTids) {
      expect(tierOf(league2.competitions, league2.teams.find((t) => t.tid === tid)!.compId)).toBe(1);
    }

    const played = simThrough(league2, "season", mulberry32(99));
    expect(played.phase).toBe("offseason");
    expect(isCupComplete(played.cup!)).toBe(true);
    expect(played.cup!.championTid).not.toBeNull();
    // The play-in filled both pending slots, and its 2 ties are recorded separately.
    expect(played.cup!.teams.filter((t) => t === -1)).toHaveLength(0);
    expect(played.cup!.playIn!.ties).toHaveLength(2);
    expect(played.cup!.ties).toHaveLength(15); // R16 8 + QF 4 + SF 2 + F 1 (play-in ties are separate)

    // The champion is one of the two finalists (semi-final winners).
    const finalWinners = played.cup!.ties.filter((t) => t.round === 2).map((t) => t.winner);
    expect(finalWinners).toContain(played.cup!.championTid);

    // The completed cup is archived at the next offseason and a fresh one seeded.
    const after = simOffseason(played, mulberry32(100));
    expect(after.cupHistory).toHaveLength(1);
    expect(after.cupHistory[0].championTid).toBe(played.cup!.championTid);
    expect(after.cup!.season).toBe(3);
  });

  it("halts a season sim before the final when the user's club is a finalist", () => {
    const league2 = toSeason2(7);
    const userTid = league2.meta.userTid;
    const others = league2.teams.map((t) => t.tid).filter((t) => t !== userTid).slice(0, 15);

    // Inject a bracket where the user has already won his semi-final. Only the
    // round set matters for the stop rule: completedRounds({0,1,2}) === 3, and
    // the round-2 (semi-final) winners are the finalists.
    league2.cup = {
      season: 2,
      name: "Continental Cup",
      teams: [userTid, ...others],
      seeds: {},
      playIn: null,
      ties: [
        stubTie(0, userTid, others[0], userTid),
        stubTie(1, userTid, others[1], userTid),
        stubTie(2, userTid, others[2], userTid), // user wins his SF → a finalist
        stubTie(2, others[3], others[4], others[3]),
      ],
      championTid: null,
    };

    const result = simThrough(league2, "season", mulberry32(8));
    // Stopped before the final's matchday: still in regular play, final unplayed.
    expect(result.phase).toBe("regular");
    expect(result.cup!.championTid).toBeNull();
    const nextMatchday = Math.min(...result.schedule.map((g) => g.matchday));
    expect(nextMatchday).toBe(CUP_ROUND_MATCHDAYS[3]); // the final's matchday, still to be played

    // Resuming from exactly the final's matchday plays it through to the end.
    const resumed = simThrough(result, "season", mulberry32(9));
    expect(resumed.phase).toBe("offseason");
    expect(isCupComplete(resumed.cup!)).toBe(true);
  });
});
