import { describe, it, expect } from "vitest";
import { trophyNewsBySeason, type TrophyRecords } from "../../src/core/trophyNews.js";
import type { CupState } from "../../src/core/cup/types.js";
import type { IntlTournamentSummary } from "../../src/core/international/types.js";

function cup(over: Partial<CupState> & { season: number }): CupState {
  return {
    competition: "continental",
    name: "Continental Cup",
    teams: [],
    seeds: {},
    leaguePhase: null,
    playoff: null,
    playIn: null,
    ties: [],
    championTid: null,
    twoLegged: true,
    koLegs: null,
    statLines: null,
    ...over,
  } as unknown as CupState;
}

function tournament(over: Partial<IntlTournamentSummary> & { season: number }): IntlTournamentSummary {
  return {
    name: "World Cup",
    champion: "Brazil",
    runnerUp: "France",
    finalScore: { champion: 2, runnerUp: 1, pens: null },
    topScorer: null,
    field: [],
    groups: [],
    knockout: [],
    ...over,
  } as IntlTournamentSummary;
}

const empty: TrophyRecords = {
  cup: null, cupHistory: [], shield: null, shieldHistory: [], international: null,
};

describe("trophyNewsBySeason", () => {
  it("reports nothing for a save that has won nothing yet", () => {
    expect(trophyNewsBySeason(empty).size).toBe(0);
  });

  it("ignores a cup still being played", () => {
    // championTid is null until the final is decided.
    const records = { ...empty, cup: cup({ season: 3 }) };
    expect(trophyNewsBySeason(records).size).toBe(0);
  });

  it("reports the cup being played this season as soon as it has a champion", () => {
    // It only moves into cupHistory at the offseason rollover, so reading the
    // archive alone would hold the season's biggest result back until then.
    const records = { ...empty, cup: cup({ season: 3, championTid: 7 }) };
    expect(trophyNewsBySeason(records).get(3)).toEqual([
      { kind: "continentalCup", name: "Continental Cup", tid: 7 },
    ]);
  });

  it("reports the Shield beside the Cup, each under its own season", () => {
    const records: TrophyRecords = {
      ...empty,
      cupHistory: [cup({ season: 1, championTid: 4 }), cup({ season: 2, championTid: 5 })],
      shieldHistory: [
        cup({ season: 2, championTid: 6, competition: "shield", name: "Continental Shield" }),
      ],
    };
    const out = trophyNewsBySeason(records);
    expect(out.get(1)).toEqual([{ kind: "continentalCup", name: "Continental Cup", tid: 4 }]);
    expect(out.get(2)).toEqual([
      { kind: "continentalCup", name: "Continental Cup", tid: 5 },
      { kind: "continentalShield", name: "Continental Shield", tid: 6 },
    ]);
  });

  it("reports a World Cup under the club season it followed", () => {
    // The tournament is played in the offseason after a season and stamped with
    // it, which is the convention the worldwide awards already use.
    const records: TrophyRecords = {
      ...empty,
      international: { history: [tournament({ season: 4 })], confederationCupHistory: [] },
    };
    expect(trophyNewsBySeason(records).get(4)).toEqual([
      {
        kind: "worldCup", name: "World Cup", nation: "Brazil",
        runnerUp: "France", score: "2-1",
      },
    ]);
  });

  it("writes a shootout into the scoreline", () => {
    const records: TrophyRecords = {
      ...empty,
      international: {
        history: [tournament({
          season: 4,
          finalScore: { champion: 1, runnerUp: 1, pens: { champion: 4, runnerUp: 3 } },
        })],
        confederationCupHistory: [],
      },
    };
    expect(trophyNewsBySeason(records).get(4)?.[0].score).toBe("1-1 (4-3 pens)");
  });

  it("reports every confederation cup of the same summer, under its own name", () => {
    const records: TrophyRecords = {
      ...empty,
      international: {
        history: [],
        confederationCupHistory: [
          tournament({ season: 6, name: "European Championship", champion: "Spain", confederation: "UEFA" }),
          tournament({ season: 6, name: "Copa América", champion: "Argentina", confederation: "CONMEBOL" }),
        ],
      },
    };
    const out = trophyNewsBySeason(records).get(6) ?? [];
    expect(out.map((t) => [t.name, t.nation])).toEqual([
      ["European Championship", "Spain"],
      ["Copa América", "Argentina"],
    ]);
    expect(out.every((t) => t.kind === "confederationCup")).toBe(true);
  });

  it("tolerates a save from before international football existed", () => {
    // `international` is null on nothing shipped, but the field is read from a
    // possibly-old save and a missing history must not throw.
    const records: TrophyRecords = {
      ...empty,
      cupHistory: [cup({ season: 1, championTid: 4 })],
      international: null,
    };
    expect(trophyNewsBySeason(records).get(1)).toHaveLength(1);
  });
});
