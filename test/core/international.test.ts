import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { createLeagueState } from "../../src/core/leagueState.js";
import { simThrough } from "../../src/core/simThrough.js";
import { simOffseason } from "../../src/core/offseason.js";
import { simThroughInternational, isIntlStagePending } from "../../src/core/international/index.js";
import { runTournament } from "../../src/core/international/tournament.js";
import { buildSquads } from "../../src/core/international/squads.js";
import { allocateSlots, confederationOf } from "../../src/core/international/confederations.js";
import { roundRobin, groupTable, buildGroup, serpentineGroups, potDraw } from "../../src/core/international/groups.js";
import { namePoolFor } from "../../src/core/players/nationalities.js";
import * as Nats from "../../src/core/players/nationalities.js";
import type { LeagueStore } from "../../src/core/leagueState.js";
import { INTL_FIELD_SIZE, INTL_KO_SIZE } from "../../src/core/constants.js";

/**
 * Play any staged international campaign that entering the offseason drew, in
 * full — the headless stand-in for the user clicking the stage buttons (or "sim
 * through"). A no-op in a non-international offseason.
 */
function playInternational(league: LeagueStore): LeagueStore {
  const r = simThroughInternational(league.international, league.players, league.lid);
  return { ...league, international: r.international, players: r.players };
}

/** Advance a fresh league by `n` full seasons, running each offseason. */
function advance(seed: number, seasons: number) {
  const rng = mulberry32(seed);
  let league = createLeagueState(0, rng);
  for (let s = 0; s < seasons; s++) {
    league = simThrough(league, "season", rng);
    league = simThrough(league, "season", rng); // clear the cup-final halt
    league = playInternational(league); // international plays out before the advance
    league = simOffseason(league, rng);
  }
  return league;
}

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

describe("offseason cycle", () => {
  it("qualifies 16 then plays a completed tournament, on the two-year cadence", () => {
    const league = advance(7, 2);
    const intl = league.international;
    // After seasons 1 (qualifying) and 2 (tournament):
    expect(intl.qualifying?.qualified).toHaveLength(INTL_FIELD_SIZE);
    expect(intl.tournament).not.toBeNull();
    expect(intl.tournament!.nations).toHaveLength(INTL_FIELD_SIZE);
    expect(intl.tournament!.championNid).not.toBeNull();
    expect(intl.tournament!.bracket).toHaveLength(INTL_KO_SIZE);
    expect(intl.history).toHaveLength(1);
    expect(intl.history[0].champion).toBeTruthy();
  });

  it("records caps and titles on players who feature", () => {
    const league = advance(7, 2);
    const capped = league.players.filter((p) => p.intl && p.intl.caps > 0);
    expect(capped.length).toBeGreaterThan(0);
    const champions = league.players.filter((p) => p.intl && p.intl.titles > 0);
    expect(champions.length).toBeGreaterThan(0);
    // A titled player was necessarily named in a tournament squad.
    for (const p of champions) expect(p.intl!.tournaments).toBeGreaterThanOrEqual(1);
  });

  it("draws the campaign on entering the offseason, and the advance plays it out", () => {
    const rng = mulberry32(3);
    let league = createLeagueState(0, rng);
    league = simThrough(league, "season", rng); // season 1 ends → qualifying drawn
    league = simThrough(league, "season", rng); // clear any cup-final halt
    expect(league.phase).toBe("offseason");
    // Drawn but unplayed: the fixtures exist, and the UI holds "Advance" on this.
    expect(league.international.stage).toBe("qualifying");
    expect(isIntlStagePending(league.international)).toBe(true);

    // Advancing plays the pending campaign through, then rolls the season over
    // (self-contained: a headless advance doesn't need the stages played by hand).
    const next = simOffseason(league, rng);
    expect(next.season).toBe(2);
    expect(next.international.qualifying?.qualified).toHaveLength(INTL_FIELD_SIZE);
    expect(next.international.stage).toBeNull();
  });

  it("staged play matches a one-pass runTournament on the same field", () => {
    const rng = mulberry32(11);
    let league = createLeagueState(0, rng);
    // Season 1: qualify.
    league = simThrough(league, "season", rng);
    league = simThrough(league, "season", rng);
    league = playInternational(league);
    league = simOffseason(league, rng);
    // Season 2: entering the offseason draws the tournament (stage "groups").
    league = simThrough(league, "season", rng);
    league = simThrough(league, "season", rng);
    expect(league.international.stage).toBe("groups");

    // Play it in stages...
    const staged = simThroughInternational(league.international, league.players, league.lid);
    // ...versus one bulk pass over the very same qualifiers and players.
    const bulk = runTournament(
      league.international.qualifying!.qualified,
      league.players,
      league.season,
      league.lid,
    );

    expect(bulk).not.toBeNull();
    const st = staged.international.tournament!;
    expect(st.championNid).toBe(bulk!.tournament.championNid);
    // Every knockout scoreline agrees, so the per-round seeds line up exactly.
    expect(st.ties.map((t) => [t.round, t.homeGoals, t.awayGoals])).toEqual(
      bulk!.tournament.ties.map((t) => [t.round, t.homeGoals, t.awayGoals]),
    );
  });
});
