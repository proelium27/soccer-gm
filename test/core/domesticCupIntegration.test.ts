import { describe, it, expect } from "vitest";
import type { TeamMatchData } from "../../src/core/league/composites.js";
import { makeLeague } from "../helpers/league.js";
import { simThrough } from "../../src/core/simThrough.js";
import { mulberry32 } from "../../src/engine/rng.js";
import { worldCompetitions } from "../../src/core/competitions.js";
import {
  buildDomesticCup, pendingRound, domesticRoundName, domesticPrizeForRound,
} from "../../src/core/domesticCup/cup.js";
import { playDomesticRound } from "../../src/core/domesticCup/simCup.js";
import {
  DOMESTIC_CUP_MATCHDAYS, DOMESTIC_CUP_PRIZE_RUNNER_UP, NUM_TEAMS, NUM_TEAMS_D2,
} from "../../src/core/constants.js";

const comps = worldCompetitions();

function worldTeams(): { tid: number; compId: number }[] {
  const teams: { tid: number; compId: number }[] = [];
  let tid = 0;
  for (const c of comps.filter((x) => x.tier === 1)) {
    const d2 = comps.find((x) => x.country === c.country && x.tier === 2)!;
    for (let i = 0; i < NUM_TEAMS; i++) teams.push({ tid: tid++, compId: c.id });
    for (let i = 0; i < NUM_TEAMS_D2; i++) teams.push({ tid: tid++, compId: d2.id });
  }
  return teams;
}

/**
 * The wiring the pure unit tests can't reach: that `simThrough` actually plays a
 * domestic round on its matchday and draws the next one from the winners.
 *
 * Deliberately stops at matchday 8 rather than simming a season: the
 * preliminary round (matchday 5) and the draw that follows it exercise every
 * step of the cycle, and a full 16-competition season would cost minutes here
 * for nothing extra.
 */
describe("domestic cups through simThrough", () => {
  it("plays a round on its matchday, then draws the next from the winners", () => {
    let league = makeLeague(0, 1);
    const rng = mulberry32(4242);

    expect(league.domesticCups).toHaveLength(8); // one per country
    expect(pendingRound(league.domesticCups[0])!.matchday).toBe(DOMESTIC_CUP_MATCHDAYS[0]);

    // Matchdays 1-4: nothing is due yet.
    league = simThrough(league, { matchday: 4 }, rng);
    expect(league.domesticCups[0].rounds).toHaveLength(1);
    expect(league.domesticCups[0].rounds[0].ties).toHaveLength(0);

    // Matchdays 5-8: the preliminary round is played and the round of 32 drawn.
    league = simThrough(league, { matchday: 8 }, rng);

    for (const cup of league.domesticCups) {
      const prelim = cup.rounds[0];
      expect(prelim.ties).toHaveLength(prelim.pairings.length);
      for (const tie of prelim.ties) {
        // Single-leg: somebody always goes through on the day.
        expect([tie.home, tie.away]).toContain(tie.winner);
        expect(tie.boxScore).not.toBeNull();
      }
      expect(cup.rounds).toHaveLength(2);

      const next = pendingRound(cup)!;
      expect(next.matchday).toBe(DOMESTIC_CUP_MATCHDAYS[1]);
      expect(domesticRoundName(cup, next.round)).toBe("Round of 32");

      const survivors = next.pairings.flatMap((p) => [p.home, p.away]);
      expect(survivors).toHaveLength(32);
      expect(new Set(survivors).size).toBe(32); // nobody drawn twice
      const throughFromPrelim = new Set([...prelim.byes, ...prelim.ties.map((t) => t.winner)]);
      for (const tid of survivors) expect(throughFromPrelim.has(tid)).toBe(true);
    }
  });
});

describe("domestic cup prize money", () => {
  // An empty match-data map makes every tie a walkover to the home side, which
  // is exactly what's wanted here: the prize arithmetic, with no match sim in
  // the way. (The walkover path itself is the guard against a pairing failing
  // to produce a winner and losing a club from the next round's draw.)
  const noMatchData = new Map<number, TeamMatchData>();

  it("pays the winner of a tie, scaled by the club's finance scale", () => {
    const cup = buildDomesticCup("England", comps, worldTeams(), new Map(), 1)!;
    const { ties, prizes } = playDomesticRound(cup, comps, noMatchData, 0, () => 0.5);

    expect(ties).toHaveLength(8);
    const expected = domesticPrizeForRound(cup, 0) * 0.5;
    expect(expected).toBeGreaterThan(0);
    for (const tie of ties) {
      expect(tie.winner).toBe(tie.home); // walkover
      expect(prizes.get(tie.winner)).toBeCloseTo(expected, 6);
      const loser = tie.away;
      expect(prizes.has(loser)).toBe(false);
    }
  });

  it("pays a runner-up only in the final", () => {
    let cup = buildDomesticCup("England", comps, worldTeams(), new Map(), 1)!;
    let last: ReturnType<typeof playDomesticRound> | null = null;
    for (let r = 0; r < cup.totalRounds; r++) {
      last = playDomesticRound(cup, comps, noMatchData, 0, () => 1);
      // Only the final pays the beaten side, so every earlier round credits
      // exactly one club per tie.
      if (r < cup.totalRounds - 1) {
        expect(last.prizes.size).toBe(last.ties.length);
      }
      cup = last.cup;
    }

    const final = last!.ties[0];
    expect(cup.championTid).toBe(final.winner);
    const runnerUp = final.winner === final.home ? final.away : final.home;
    expect(last!.prizes.get(runnerUp)).toBeCloseTo(DOMESTIC_CUP_PRIZE_RUNNER_UP, 6);
    expect(last!.prizes.get(final.winner)).toBeGreaterThan(DOMESTIC_CUP_PRIZE_RUNNER_UP);
  });
});
