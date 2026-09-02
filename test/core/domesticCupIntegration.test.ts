import { describe, it, expect } from "vitest";
import type { TeamMatchData } from "../../src/core/league/composites.js";
import { makeLeague } from "../helpers/league.js";
import { simThrough } from "../../src/core/simThrough.js";
import { mulberry32 } from "../../src/engine/rng.js";
import { worldCompetitions, competitionTeamCount } from "../../src/core/competitions.js";
import {
  buildDomesticCup, pendingRound, domesticRoundName, domesticPrizeForRound,
} from "../../src/core/domesticCup/cup.js";
import { playDomesticRound } from "../../src/core/domesticCup/simCup.js";
import {
  DOMESTIC_CUP_MATCHDAYS, DOMESTIC_CUP_PRIZE_RUNNER_UP,
} from "../../src/core/constants.js";

const comps = worldCompetitions();

// Sized from the table rather than a flat 20+20: divisions are different sizes
// per country now, and a cup's whole shape (rounds, byes, which matchday it
// starts on) falls out of how many clubs its country actually has.
function worldTeams(): { tid: number; compId: number }[] {
  const teams: { tid: number; compId: number }[] = [];
  let tid = 0;
  for (const c of comps.filter((x) => x.tier === 1)) {
    const d2 = comps.find((x) => x.country === c.country && x.tier === 2)!;
    for (let i = 0; i < competitionTeamCount(c); i++) teams.push({ tid: tid++, compId: c.id });
    for (let i = 0; i < competitionTeamCount(d2); i++) teams.push({ tid: tid++, compId: d2.id });
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

    // Countries no longer all field 40 clubs, so their cups no longer all have
    // the same number of rounds — and a shorter cup takes the LAST n matchdays
    // rather than the first, so every country's final still lands on the same
    // day. Belgium and Serbia (32 clubs) are the sharp case: an exact power of
    // two needs no preliminary round at all, so their round 0 IS the round of
    // 32 and it does not kick off until matchday 9.
    for (const cup of league.domesticCups) {
      // Rounds needed is ceil(log2(field)), and the cup takes that many
      // matchdays off the END of the list — so a smaller country starts later
      // and every final still lands on the same day.
      expect(cup.totalRounds).toBe(Math.ceil(Math.log2(cup.teams.length)));
      const firstMatchday = DOMESTIC_CUP_MATCHDAYS[DOMESTIC_CUP_MATCHDAYS.length - cup.totalRounds];
      expect(pendingRound(cup)!.matchday).toBe(firstMatchday);
    }

    // Matchdays 1-4: nothing is due in any country yet.
    league = simThrough(league, { matchday: 4 }, rng);
    for (const cup of league.domesticCups) {
      expect(cup.rounds).toHaveLength(1);
      expect(cup.rounds[0].ties).toHaveLength(0);
    }

    // Through matchday 9 every cup has played at least its opening round — 9 is
    // the latest any of them starts.
    league = simThrough(league, { matchday: 9 }, rng);

    for (const cup of league.domesticCups) {
      const played = cup.rounds.filter((r) => r.ties.length > 0);
      expect(played.length).toBeGreaterThan(0);

      for (const round of played) {
        expect(round.ties).toHaveLength(round.pairings.length);
        for (const tie of round.ties) {
          // Single-leg: somebody always goes through on the day.
          expect([tie.home, tie.away]).toContain(tie.winner);
          expect(tie.boxScore).not.toBeNull();
        }
      }

      // The next round is drawn from exactly the clubs that came through the
      // last one, and each round halves the field.
      const last = played[played.length - 1];
      const next = pendingRound(cup)!;
      const survivors = next.pairings.flatMap((p) => [p.home, p.away]);
      expect(survivors).toHaveLength(next.pairings.length * 2);
      expect(new Set(survivors).size).toBe(survivors.length); // nobody drawn twice
      const through = new Set([...last.byes, ...last.ties.map((t) => t.winner)]);
      for (const tid of survivors) expect(through.has(tid)).toBe(true);
    }

    // A field that is not a power of two opens with a preliminary round; one
    // that is starts at its first named round. England fields 60 clubs across
    // three divisions, Scotland exactly 32 — which is why the power-of-two case
    // moved here from Belgium when every country gained a third division and
    // Belgium went to 48.
    const england = league.domesticCups.find((c) => c.country === "England")!;
    expect(domesticRoundName(england, england.rounds[0].round)).toBe("Preliminary round");
    const scotland = league.domesticCups.find((c) => c.country === "Scotland")!;
    expect(domesticRoundName(scotland, scotland.rounds[0].round)).toBe("Round of 32");
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
