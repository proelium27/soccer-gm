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

    expect(league.domesticCups).toHaveLength(12); // one per country
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
  // An empty match-data map makes every tie a walkover, which is what's wanted
  // here: the money, with no match sim in the way. (The walkover path itself is
  // the guard against a pairing failing to produce a winner and quietly losing
  // a club from the next round's draw.)
  const noMatchData = new Map<number, TeamMatchData>();

  /**
   * The cup pays nothing, and that is load-bearing rather than an oversight.
   *
   * Prize money is the only part of this feature that can touch the economy,
   * and with real prizes the weak-leagues audit put 2 of 4 seeds into deficit
   * where the baseline is solvent on all four (see the constant for the
   * numbers). At zero, `creditPrizes` is never reached and a dynasty is
   * bit-identical to one with no domestic cups at all.
   *
   * If you re-enable the prizes, this test fails — which is the point. Re-run
   * `scripts/weakLeaguesAudit.ts` against the merge base before you do.
   */
  it("credits nothing, so no club's budget is touched by a cup run", () => {
    let cup = buildDomesticCup("England", comps, worldTeams(), new Map(), 1)!;
    for (let r = 0; r < cup.totalRounds; r++) {
      const played = playDomesticRound(cup, comps, noMatchData, 0, () => 1);
      expect(played.ties.length).toBeGreaterThan(0);
      expect(played.prizes.size).toBe(0);
      expect(domesticPrizeForRound(cup, r)).toBe(0);
      cup = played.cup;
    }
    expect(DOMESTIC_CUP_PRIZE_RUNNER_UP).toBe(0);
    expect(cup.championTid).not.toBeNull();
  });

  it("still resolves every tie to exactly one winner, prizes or not", () => {
    let cup = buildDomesticCup("England", comps, worldTeams(), new Map(), 1)!;
    let survivors = cup.teams.length;
    for (let r = 0; r < cup.totalRounds; r++) {
      const played = playDomesticRound(cup, comps, noMatchData, 0, () => 1);
      for (const tie of played.ties) expect([tie.home, tie.away]).toContain(tie.winner);
      survivors -= played.ties.length; // one club eliminated per tie
      cup = played.cup;
    }
    expect(survivors).toBe(1); // 40 clubs, 39 ties, one left standing
  });
});
