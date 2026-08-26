/**
 * International football: the pure structural pieces — eligibility, slot
 * allocation, draw shapes, group tables, bracket seeding and the derived
 * nation-history readings.
 *
 * The season-simulating tests live in `internationalCampaign.test.ts` and
 * `internationalConfederationCups.test.ts`; see the note there for why.
 */

import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { createLeagueState } from "../../src/core/leagueState.js";
import { seedBracket } from "../../src/core/international/simIntl.js";
import { buildSquads } from "../../src/core/international/squads.js";
import { namePoolFor } from "../../src/core/players/nationalities.js";
import * as Nats from "../../src/core/players/nationalities.js";
import { formatFor, knockoutRounds, TOURNAMENT_FORMATS } from "../../src/core/international/format.js";
import { roundRobin, groupTable, buildGroup, serpentineGroups, potDraw } from "../../src/core/international/groups.js";
import { allocateSlots, confederationOf } from "../../src/core/international/confederations.js";
import { nationRecords, finishOf } from "../../src/core/international/index.js";
import type { IntlTournamentSummary } from "../../src/core/international/index.js";
import {
  INTL_FIELD_SIZE, INTL_KO_SIZE,
} from "../../src/core/constants.js";

describe("confederation table", () => {
  it("covers every nation a generated player can hold", () => {
    // Collect every nation that has a name pool (the ones players can be given).
    const withPool = new Set<string>();
    for (const table of Object.values(Nats) as unknown[]) {
      if (table && typeof table === "object" && !Array.isArray(table)) {
        for (const nation of Object.keys(table as object)) {
          if (namePoolFor(nation)) withPool.add(nation);
        }
      }
    }
    const missing = [...withPool].filter((n) => confederationOf(n) === null);
    expect(missing, `nations with a name pool but no confederation: ${missing.join(", ")}`).toEqual([]);
  });
});

describe("slot allocation", () => {
  it("distributes exactly the field size, floors every confederation, respects caps", () => {
    const byConf = new Map([
      ["Europe", Array.from({ length: 24 }, (_, i) => `E${i}`)],
      ["South America", Array.from({ length: 6 }, (_, i) => `S${i}`)],
      ["Africa", Array.from({ length: 8 }, (_, i) => `A${i}`)],
      ["Oceania", ["O0"]],
    ] as [string, string[]][]);
    const alloc = allocateSlots(byConf as never, INTL_FIELD_SIZE);
    const total = [...alloc.values()].reduce((a, b) => a + b, 0);
    expect(total).toBe(INTL_FIELD_SIZE);
    // Every confederation with nations gets at least one.
    for (const [, n] of alloc) expect(n).toBeGreaterThanOrEqual(1);
    // Oceania has a single nation, so it can get at most one place.
    expect(alloc.get("Oceania")).toBe(1);
  });

  it("weights toward confederations holding the strongest nations", () => {
    const byConf = new Map([
      ["Europe", ["E0", "E1", "E2", "E3"]],
      ["Africa", Array.from({ length: 12 }, (_, i) => `A${i}`)],
    ] as [string, string[]][]);
    // All four strong contenders are European; Africa has more nations but none.
    const contenders = new Set(["E0", "E1", "E2", "E3"]);
    const weighted = allocateSlots(byConf as never, 8, contenders);
    const unweighted = allocateSlots(byConf as never, 8);
    // Weighting by strength gives Europe more than weighting by raw count would.
    expect(weighted.get("Europe")!).toBeGreaterThan(unweighted.get("Europe")!);
  });
});

describe("round robin", () => {
  it("single leg: every pair meets once", () => {
    const fixtures = roundRobin([0, 1, 2, 3]);
    expect(fixtures).toHaveLength(6); // C(4,2)
    const pairs = new Set(fixtures.map((m) => [m.home, m.away].sort((a, b) => a - b).join("-")));
    expect(pairs.size).toBe(6);
  });

  it("two legs: every pair meets twice with reversed venues", () => {
    const fixtures = roundRobin([0, 1, 2, 3], 2);
    expect(fixtures).toHaveLength(12);
    // Each ordered (home, away) appears exactly once across both legs.
    const ordered = fixtures.map((m) => `${m.home}-${m.away}`);
    expect(new Set(ordered).size).toBe(12);
    // Each fixture is tagged with its leg (6 per leg), so a leg can be played on its own.
    expect(fixtures.filter((m) => m.leg === 0)).toHaveLength(6);
    expect(fixtures.filter((m) => m.leg === 1)).toHaveLength(6);
  });

  it("odd group: nobody plays themselves, everyone plays everyone", () => {
    const fixtures = roundRobin([0, 1, 2, 3, 4]);
    expect(fixtures).toHaveLength(10);
    for (const m of fixtures) expect(m.home).not.toBe(m.away);
  });
});

describe("group table", () => {
  it("orders on points then goal difference", () => {
    const group = buildGroup(0, [0, 1, 2], null);
    // 0 beats 1 (2-0), 0 beats 2 (1-0), 2 beats 1 (3-0).
    group.matches = group.matches.map((m) => {
      if (m.home === 0 && m.away === 1) return { ...m, homeGoals: 2, awayGoals: 0 };
      if (m.home === 1 && m.away === 0) return { ...m, homeGoals: 0, awayGoals: 2 };
      if ((m.home === 0 && m.away === 2) || (m.home === 2 && m.away === 0))
        return { ...m, homeGoals: m.home === 0 ? 1 : 0, awayGoals: m.home === 0 ? 0 : 1 };
      if ((m.home === 2 && m.away === 1) || (m.home === 1 && m.away === 2))
        return { ...m, homeGoals: m.home === 2 ? 3 : 0, awayGoals: m.home === 2 ? 0 : 3 };
      return m;
    });
    const table = groupTable(group);
    expect(table[0].nid).toBe(0); // 6 pts
    expect(table[1].nid).toBe(2); // 3 pts, +2 GD
    expect(table[2].nid).toBe(1); // 0 pts
  });
});

describe("draw shapes", () => {
  it("serpentine balances group strength", () => {
    const groups = serpentineGroups([0, 1, 2, 3, 4, 5, 6, 7], 4);
    // Group 0 gets the strongest (0) and the weakest of the second row (7).
    expect(groups[0]).toEqual([0, 7]);
    expect(groups[3]).toEqual([3, 4]);
  });

  it("pot draw puts one seed from each pot in each group", () => {
    const rng = mulberry32(1);
    const groups = potDraw([0, 1, 2, 3, 4, 5, 6, 7], 4, rng);
    for (const g of groups) {
      expect(g).toHaveLength(2);
      // One nation from the top pot (0-3), one from the bottom (4-7).
      expect(g.some((n) => n < 4)).toBe(true);
      expect(g.some((n) => n >= 4)).toBe(true);
    }
  });
});

describe("squads", () => {
  it("a fresh world fields more than enough eligible nations", () => {
    const rng = mulberry32(7);
    const league = createLeagueState(0, rng);
    const squads = buildSquads(league.players);
    expect(squads.length).toBeGreaterThanOrEqual(INTL_FIELD_SIZE);
    // Strongest first, and every squad has at least an XI.
    for (let i = 1; i < squads.length; i++) {
      expect(squads[i - 1].rating).toBeGreaterThanOrEqual(squads[i].rating);
    }
    for (const s of squads) expect(s.pids.length).toBeGreaterThanOrEqual(11);
  });
});

describe("tournament shapes", () => {
  it("picks the biggest shape that fits both the target and the nations available", () => {
    // A confederation with plenty of nations gets the full 16-team shape...
    expect(formatFor(25, 16)).toEqual({ fieldSize: 16, groupCount: 4, qualifyPerGroup: 2 });
    // ...one with a dozen drops to four groups of three...
    expect(formatFor(12, 16)).toEqual({ fieldSize: 12, groupCount: 4, qualifyPerGroup: 2 });
    // ...and a handful plays a single round-robin into a final.
    expect(formatFor(5, 10)).toEqual({ fieldSize: 5, groupCount: 1, qualifyPerGroup: 2 });
    // The target caps it even when the nations are there.
    expect(formatFor(25, 8)).toEqual({ fieldSize: 8, groupCount: 2, qualifyPerGroup: 2 });
    // Too few for any shape at all: no tournament.
    expect(formatFor(3, 16)).toBeNull();

    // Every supported shape must end in a power-of-two knockout, which is what
    // lets several championships be played side by side and finish together.
    for (const f of TOURNAMENT_FORMATS) {
      expect(Number.isInteger(knockoutRounds(f))).toBe(true);
      expect(knockoutRounds(f)).toBeGreaterThanOrEqual(1);
    }
  });

  it("seeds a bracket of the right size whatever the group count", () => {
    // A group whose every fixture is played, so groupTable can order it.
    const played = (nids: number[]) => {
      const g = buildGroup(0, nids, null);
      g.matches.forEach((m) => { m.homeGoals = 1; m.awayGoals = 0; });
      return g;
    };

    // Eight groups: the World Cup's sixteen-nation bracket.
    const eight = Array.from({ length: 8 }, (_, g) => played([g * 4, g * 4 + 1, g * 4 + 2, g * 4 + 3]));
    expect(seedBracket(eight)).toHaveLength(INTL_KO_SIZE);

    // Four groups: an eight-nation bracket (the World Cup's old shape, and the
    // largest a confederation cup draws).
    const four = [played([0, 1, 2, 3]), played([4, 5, 6, 7]), played([8, 9, 10, 11]), played([12, 13, 14, 15])];
    expect(seedBracket(four)).toHaveLength(8);

    // Two groups: a four-nation bracket, still crossing winner with runner-up.
    const two = [played([0, 1, 2, 3]), played([4, 5, 6, 7])];
    expect(seedBracket(two)).toHaveLength(4);

    // One group: its top two go straight to the final.
    const one = [played([0, 1, 2, 3, 4])];
    expect(seedBracket(one)).toHaveLength(2);
  });

  it("puts a group's two qualifiers in opposite halves, so they can only meet in the final", () => {
    // Each group's winner is its lowest nid: every fixture is a home win, and
    // buildGroup's round-robin gives the lower nids more home games.
    const played = (nids: number[]) => {
      const g = buildGroup(0, nids, null);
      g.matches.forEach((m) => { m.homeGoals = 1; m.awayGoals = 0; });
      return g;
    };
    for (const groupCount of [2, 4, 8]) {
      const groups = Array.from({ length: groupCount }, (_, g) =>
        played([g * 4, g * 4 + 1, g * 4 + 2, g * 4 + 3]));
      const bracket = seedBracket(groups);
      const half = bracket.length / 2;
      // The two nations out of any one group must not share a half of the draw,
      // or they replay their group fixture before the final.
      for (let g = 0; g < groupCount; g++) {
        const fromGroup = bracket
          .map((nid, i) => ({ nid, top: i < half }))
          .filter((e) => Math.floor(e.nid / 4) === g);
        expect(fromGroup).toHaveLength(2);
        expect(fromGroup[0].top).not.toBe(fromGroup[1].top);
      }
      // And nobody meets a nation from their own group in the first round.
      for (let i = 0; i + 1 < bracket.length; i += 2) {
        expect(Math.floor(bracket[i] / 4)).not.toBe(Math.floor(bracket[i + 1] / 4));
      }
    }
  });
});

describe("nation history derivations", () => {
  // A hand-built archived tournament: Brazil beat France in the final; the
  // losing semi-finalists were Spain and Argentina; the losing quarter-finalists
  // Germany, Italy, England, Netherlands; Belgium exited in the group stage.
  const field = [
    "Brazil", "France", "Spain", "Argentina", "Germany", "Italy", "England", "Netherlands",
    "Belgium", "Croatia", "Uruguay", "Mexico", "Japan", "Senegal", "United States", "Denmark",
  ];
  const summary: IntlTournamentSummary = {
    season: 2,
    name: "World Cup",
    champion: "Brazil",
    runnerUp: "France",
    finalScore: { champion: 2, runnerUp: 1, pens: null },
    topScorer: null,
    field,
    groups: [],
    knockout: [
      { round: 0, home: "Brazil", away: "Germany", homeGoals: 2, awayGoals: 0, winner: "Brazil", pens: null },
      { round: 0, home: "Spain", away: "Italy", homeGoals: 1, awayGoals: 0, winner: "Spain", pens: null },
      { round: 0, home: "France", away: "England", homeGoals: 1, awayGoals: 0, winner: "France", pens: null },
      { round: 0, home: "Argentina", away: "Netherlands", homeGoals: 1, awayGoals: 0, winner: "Argentina", pens: null },
      { round: 1, home: "Brazil", away: "Spain", homeGoals: 2, awayGoals: 1, winner: "Brazil", pens: null },
      { round: 1, home: "France", away: "Argentina", homeGoals: 1, awayGoals: 0, winner: "France", pens: null },
      { round: 2, home: "Brazil", away: "France", homeGoals: 2, awayGoals: 1, winner: "Brazil", pens: null },
    ],
  };

  it("reads each nation's finish from the field, champion and knockout scorelines", () => {
    expect(finishOf(summary, "Brazil")).toBe("Champions");
    expect(finishOf(summary, "France")).toBe("Runners-up");
    expect(finishOf(summary, "Spain")).toBe("Semi-finals"); // lost the semi
    expect(finishOf(summary, "Germany")).toBe("Quarter-finals"); // lost the quarter
    expect(finishOf(summary, "Belgium")).toBe("Group stage"); // in the field, no knockout
    expect(finishOf(summary, "Kenya")).toBeNull(); // never qualified
  });

  it("aggregates records across tournaments, ranked by honours", () => {
    const records = nationRecords([summary, summary]); // same edition twice
    const brazil = records.find((r) => r.nation === "Brazil")!;
    expect(brazil.titles).toBe(2);
    expect(brazil.finals).toBe(2);
    expect(brazil.tournaments).toBe(2);
    expect(brazil.bestFinish).toBe("Champions");
    // Brazil (2 titles) ranks ahead of France (0 titles, 2 finals).
    expect(records[0].nation).toBe("Brazil");
    const france = records.find((r) => r.nation === "France")!;
    expect(france.titles).toBe(0);
    expect(france.finals).toBe(2);
    expect(france.bestFinish).toBe("Runners-up");
    // A group-stage nation still shows an appearance and a "Group stage" best.
    const belgium = records.find((r) => r.nation === "Belgium")!;
    expect(belgium.tournaments).toBe(2);
    expect(belgium.bestFinish).toBe("Group stage");
  });
});
