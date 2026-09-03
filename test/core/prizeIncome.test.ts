import { describe, it, expect } from "vitest";
import type { TeamMatchData } from "../../src/core/league/composites.js";
import { worldCompetitions, worldTeamSlots } from "../../src/core/competitions.js";
import { buildDomesticCup } from "../../src/core/domesticCup/cup.js";
import { playDomesticRound } from "../../src/core/domesticCup/simCup.js";
import { domesticCupScaleFor } from "../../src/core/finance/budget.js";
import { domesticCupPrizeIncome, continentalPrizeIncome } from "../../src/core/finance/prizeIncome.js";
import type { CupState } from "../../src/core/cup/types.js";
import { CUP_PRIZE_PARTICIPATION, CUP_PRIZE_LP_WIN, CUP_PRIZE_LP_DRAW } from "../../src/core/constants.js";

const comps = worldCompetitions();
const tierById = new Map(comps.map((c) => [c.id, c.tier]));
const noMatchData = new Map<number, TeamMatchData>();

function worldTeams(): { tid: number; compId: number }[] {
  return worldTeamSlots(comps);
}
function tierOfFrom(teams: { tid: number; compId: number }[]): (tid: number) => number {
  const byTid = new Map(teams.map((t) => [t.tid, tierById.get(t.compId) ?? 1]));
  return (tid) => byTid.get(tid) ?? 1;
}

/**
 * The gate that keeps `prizeIncome.ts` honest.
 *
 * That module RESTATES the sim's prize rules in order to report them on the
 * Finance page without persisting anything, which buys a retroactive breakdown
 * and costs a second copy of the rules that could drift. Reusing the sim's
 * helpers pins every *amount*; only this test pins the *rules* — that the set of
 * things a club gets paid for is the same set. If the sim starts paying for
 * something new and this file is not updated, the Finance page silently
 * under-reports, which is exactly the failure a player would report as "my
 * budget went up by more than the page says".
 */
describe("derived prize income matches what the sim actually credits", () => {
  it("agrees with playDomesticRound for every club, over a whole cup", () => {
    const teams = worldTeams();
    const tierOf = tierOfFrom(teams);
    const country = "England";
    const countryTeams = teams.filter(
      (t) => comps.find((c) => c.id === t.compId)?.country === country,
    );
    // The same scale simThrough passes: country-scaled, tier-flat. Using a flat
    // 1 here would let a scale bug pass, since both sides would drop it.
    const scaleByTid = new Map(
      countryTeams.map((t) => [
        t.tid,
        domesticCupScaleFor(comps, t.compId, t.tid, -1, "normal"),
      ]),
    );

    let cup = buildDomesticCup(country, comps, teams, new Map(), 1)!;
    // What the sim paid, accumulated round by round exactly as simThrough does.
    const credited = new Map<number, number>();
    for (let r = 0; r < cup.totalRounds; r++) {
      const played = playDomesticRound(
        cup, comps, noMatchData, 0, (tid) => scaleByTid.get(tid) ?? 1, tierOf,
      );
      for (const [tid, amount] of played.prizes) {
        credited.set(tid, (credited.get(tid) ?? 0) + amount);
      }
      cup = played.cup;
    }

    expect(cup.championTid).not.toBeNull();
    expect(credited.size).toBeGreaterThan(20); // the cup really did pay a crowd

    // Every club the sim paid must be reported at the same total, and every
    // club it did not pay must report nothing.
    for (const t of countryTeams) {
      const derived = domesticCupPrizeIncome(
        cup, comps, t.tid, t.compId, -1, "normal", tierOf,
      );
      const expected = credited.get(t.tid) ?? 0;
      expect(derived?.total ?? 0).toBeCloseTo(expected, 6);
    }

    // And the totals agree in aggregate, so a compensating pair of errors
    // cannot pass the per-club check.
    const derivedTotal = countryTeams.reduce(
      (sum, t) =>
        sum + (domesticCupPrizeIncome(cup, comps, t.tid, t.compId, -1, "normal", tierOf)?.total ?? 0),
      0,
    );
    const creditedTotal = [...credited.values()].reduce((a, b) => a + b, 0);
    expect(derivedTotal).toBeCloseTo(creditedTotal, 6);
  });

  it("reads a continental league phase the way the sim pays it", () => {
    // A hand-built league phase is the only way to assert the per-result rule
    // exactly: one win, one draw, one defeat, plus participation.
    const cup = {
      season: 2,
      competition: "continental",
      teams: [10, 11, 12, 13, 14, 15, 16, 17],
      leaguePhase: {
        teams: [10, 11, 12, 13],
        matches: [
          { round: 0, matchday: 3, home: 10, away: 11, played: true, homeGoals: 2, awayGoals: 0, boxScore: null },
          { round: 1, matchday: 7, home: 12, away: 10, played: true, homeGoals: 1, awayGoals: 1, boxScore: null },
          { round: 2, matchday: 11, home: 10, away: 13, played: true, homeGoals: 0, awayGoals: 3, boxScore: null },
          // Unplayed: must contribute nothing at all.
          { round: 3, matchday: 15, home: 11, away: 10, played: false, homeGoals: -1, awayGoals: -1, boxScore: null },
        ],
      },
      playoff: null,
      playIn: null,
      ties: [],
      championTid: null,
      twoLegged: true,
      statLines: null,
    } as unknown as CupState;

    const income = continentalPrizeIncome(cup, 10);
    expect(income?.total).toBe(CUP_PRIZE_PARTICIPATION + CUP_PRIZE_LP_WIN + CUP_PRIZE_LP_DRAW);
    expect(income?.competition).toBe("Continental Cup");

    // A club that never entered earns nothing rather than participation.
    expect(continentalPrizeIncome(cup, 99)).toBeNull();
  });

  it("pays participation only once the first round has actually been played", () => {
    const drawn = {
      season: 2,
      competition: "continental",
      teams: [10, 11],
      leaguePhase: {
        teams: [10, 11],
        matches: [
          { round: 0, matchday: 3, home: 10, away: 11, played: false, homeGoals: -1, awayGoals: -1, boxScore: null },
        ],
      },
      playoff: null, playIn: null, ties: [], championTid: null, twoLegged: true, statLines: null,
    } as unknown as CupState;
    // Qualified, drawn, not yet kicked off: nothing banked.
    expect(continentalPrizeIncome(drawn, 10)).toBeNull();
  });
});
