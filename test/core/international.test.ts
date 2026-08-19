import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { createLeagueState } from "../../src/core/leagueState.js";
import { simThrough } from "../../src/core/simThrough.js";
import { simOffseason } from "../../src/core/offseason.js";
import { simThroughInternational, isIntlStagePending } from "../../src/core/international/index.js";
import { runTournament } from "../../src/core/international/tournament.js";
import {
  initContinental, playContinentalGroups, playContinentalKnockoutRound, roundsRemaining,
} from "../../src/core/international/continental.js";
import { playIntlStage } from "../../src/core/international/staging.js";
import { formatFor, knockoutRounds, TOURNAMENT_FORMATS } from "../../src/core/international/format.js";
import { seedBracket } from "../../src/core/international/simIntl.js";
import { CONTINENTAL_TOURNAMENTS } from "../../src/core/international/confederations.js";
import { makeLeague } from "../helpers/league.js";
import { buildSquads } from "../../src/core/international/squads.js";
import { allocateSlots, confederationOf } from "../../src/core/international/confederations.js";
import { roundRobin, groupTable, buildGroup, serpentineGroups, potDraw } from "../../src/core/international/groups.js";
import { namePoolFor } from "../../src/core/players/nationalities.js";
import * as Nats from "../../src/core/players/nationalities.js";
import type { LeagueStore } from "../../src/core/leagueState.js";
import { nationRecords, finishOf } from "../../src/core/international/index.js";
import type { IntlTournamentSummary } from "../../src/core/international/index.js";
import {
  INTL_FIELD_SIZE, INTL_KO_SIZE, INTL_GROUPS, CONTINENTAL_MIN_NATIONS, isContinentalSeason,
} from "../../src/core/constants.js";

/**
 * Play any staged international campaign that entering the offseason drew, in
 * full — the headless stand-in for the user clicking the stage buttons (or "sim
 * through"). A no-op in a non-international offseason.
 */
function playInternational(league: LeagueStore): LeagueStore {
  const r = simThroughInternational(league.international, league.players, league.lid, league.season);
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

describe("offseason cycle", () => {
  it("qualifies 16 over three offseasons then plays the World Cup, on the four-year cadence", () => {
    const league = advance(7, 4); // seasons 1-3 qualify, season 4 is the tournament
    const intl = league.international;
    expect(intl.qualifying?.qualified).toHaveLength(INTL_FIELD_SIZE);
    expect(intl.tournament).not.toBeNull();
    expect(intl.tournament!.nations).toHaveLength(INTL_FIELD_SIZE);
    expect(intl.tournament!.championNid).not.toBeNull();
    expect(intl.tournament!.bracket).toHaveLength(INTL_KO_SIZE);
    expect(intl.history).toHaveLength(1);
    expect(intl.history[0].champion).toBeTruthy();

    // Light archival is populated as the campaigns finish.
    expect(intl.qualifyingHistory).toHaveLength(1); // one completed campaign (seasons 1-3)
    expect(intl.qualifyingHistory[0].qualified).toHaveLength(INTL_FIELD_SIZE);
    expect(intl.powerRankings.length).toBeGreaterThanOrEqual(4); // a snapshot each offseason
    expect(intl.history[0].groups).toHaveLength(INTL_GROUPS); // 4 final group tables
    expect(intl.history[0].knockout).toHaveLength(7); // 4 QF + 2 SF + 1 final
  });

  it("records caps and titles on players who feature", () => {
    const league = advance(7, 4);
    const capped = league.players.filter((p) => p.intl && p.intl.caps > 0);
    expect(capped.length).toBeGreaterThan(0);
    const champions = league.players.filter((p) => p.intl && p.intl.titles > 0);
    expect(champions.length).toBeGreaterThan(0);
    // A titled player was necessarily named in a tournament squad.
    for (const p of champions) expect(p.intl!.tournaments).toBeGreaterThanOrEqual(1);

    // The per-campaign breakdown must account for the career totals exactly —
    // every appearance is written to a line as it's earned.
    for (const p of capped) {
      const lines = p.intl!.seasons;
      expect(lines.length).toBeGreaterThan(0);
      const sum = (key: "caps" | "goals" | "assists") =>
        lines.reduce((total, l) => total + l[key], 0);
      expect(sum("caps")).toBe(p.intl!.caps);
      expect(sum("goals")).toBe(p.intl!.goals);
      expect(sum("assists")).toBe(p.intl!.assists);
      // One line per campaign played, labelled by the cadence: seasons 1-3
      // qualifying, season 4 the tournament — plus a continental line in the
      // offseason that also stages the championships (season 2 of the cycle).
      for (const l of lines) {
        const allowed = l.season % 4 === 0
          ? ["tournament"]
          : isContinentalSeason(l.season) ? ["qualifying", "continental"] : ["qualifying"];
        expect(allowed).toContain(l.kind);
      }
      expect(new Set(lines.map((l) => `${l.season}-${l.kind}`)).size).toBe(lines.length);
    }
    // Four seasons in, somebody has played both qualifying and the tournament.
    expect(capped.some((p) => p.intl!.seasons.some((l) => l.kind === "tournament"))).toBe(true);
    expect(capped.some((p) => p.intl!.seasons.some((l) => l.kind === "qualifying"))).toBe(true);
  });

  it("draws a qualifying campaign and finishes it across three offseasons", () => {
    const rng = mulberry32(3);
    let league = createLeagueState(0, rng);

    // Season 1: the campaign is drawn and its first leg is pending.
    league = simThrough(league, "season", rng);
    league = simThrough(league, "season", rng); // clear any cup-final halt
    expect(league.phase).toBe("offseason");
    expect(league.international.stage).toBe("qualifying");
    expect(isIntlStagePending(league.international)).toBe(true);

    // One leg per offseason: the 16 qualifiers aren't decided until the third.
    league = playInternational(league); // leg 1
    expect(league.international.qualifying!.qualified).toHaveLength(0);
    league = simOffseason(league, rng);
    expect(league.season).toBe(2);

    // Seasons 2 and 3 play legs 2 and 3; after the third, the field is set.
    for (let s = 0; s < 2; s++) {
      league = simThrough(league, "season", rng);
      league = simThrough(league, "season", rng);
      league = playInternational(league);
      league = simOffseason(league, rng);
    }
    expect(league.season).toBe(4);
    expect(league.international.qualifying!.qualified).toHaveLength(INTL_FIELD_SIZE);
    expect(league.international.qualifyingHistory).toHaveLength(1);
  });

  it("advancing without playing the campaign gives the same results (the Dashboard skip button)", () => {
    const rng = mulberry32(5);
    let league = createLeagueState(0, rng);
    league = simThrough(league, "season", rng);
    league = simThrough(league, "season", rng); // clear any cup-final halt
    expect(isIntlStagePending(league.international)).toBe(true);

    // Watched: play every stage by hand, then advance.
    const watched = simOffseason(playInternational(league), mulberry32(99));
    // Skipped: advance straight from the pending stage — simOffseason opens by
    // playing whatever is left, on the same seeded streams.
    const skipped = simOffseason(league, mulberry32(99));

    expect(isIntlStagePending(skipped.international)).toBe(false);
    expect(skipped.international).toEqual(watched.international);
    // ...and the caps/goals earned land on the same players either way.
    const caps = (l: LeagueStore) =>
      l.players.filter((p) => (p.intl?.caps ?? 0) > 0).map((p) => [p.pid, p.intl!.caps, p.intl!.goals]);
    expect(caps(skipped).length).toBeGreaterThan(0);
    expect(caps(skipped)).toEqual(caps(watched));
  });

  it("carries injuries from the summer's internationals into the new club season", () => {
    const rng = mulberry32(7);
    let league = createLeagueState(0, rng);
    league = simThrough(league, "season", rng); // season 1 ends → qualifying drawn
    league = simThrough(league, "season", rng); // clear any cup-final halt
    league = playInternational(league); // play qualifying (many matches → injuries happen)

    const injuredPids = league.international.stageInjuries;
    expect(injuredPids.length).toBeGreaterThan(0);

    const next = simOffseason(league, rng);
    expect(next.international.stageInjuries).toHaveLength(0); // consumed at the rollover

    // Some of those injured at the tournament still carry it into the new season
    // (the shorter knocks heal over the summer break). Progression healed the
    // club-season knocks first, so any injury present now is an international one.
    const carried = injuredPids
      .map((pid) => next.players.find((p) => p.pid === pid))
      .filter((p) => p !== undefined && p.injury !== null);
    expect(carried.length).toBeGreaterThan(0);
  });

  it("staged play matches a one-pass runTournament on the same field", () => {
    const rng = mulberry32(11);
    let league = createLeagueState(0, rng);
    // Seasons 1-3: qualify (one leg each).
    for (let s = 0; s < 3; s++) {
      league = simThrough(league, "season", rng);
      league = simThrough(league, "season", rng);
      league = playInternational(league);
      league = simOffseason(league, rng);
    }
    // Season 4: entering the offseason draws the tournament (stage "groups").
    league = simThrough(league, "season", rng);
    league = simThrough(league, "season", rng);
    expect(league.international.stage).toBe("groups");

    // Play it in stages...
    const staged = simThroughInternational(league.international, league.players, league.lid, league.season);
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

    // Four groups: the World Cup's eight-nation bracket, unchanged.
    const four = [played([0, 1, 2, 3]), played([4, 5, 6, 7]), played([8, 9, 10, 11]), played([12, 13, 14, 15])];
    expect(seedBracket(four)).toHaveLength(INTL_KO_SIZE);

    // Two groups: a four-nation bracket, still crossing winner with runner-up.
    const two = [played([0, 1, 2, 3]), played([4, 5, 6, 7])];
    expect(seedBracket(two)).toHaveLength(4);

    // One group: its top two go straight to the final.
    const one = [played([0, 1, 2, 3, 4])];
    expect(seedBracket(one)).toHaveLength(2);
  });
});

describe("continental championships", () => {
  it("holds a championship only where the world can field one", () => {
    const league = makeLeague(0, 11);
    const drawn = initContinental(league.players, 2, league.lid);
    const byConfederation = new Map(drawn.map((t) => [t.confederation, t]));

    // Every player is generated from a European league's nationality table, so
    // Europe and Africa field tournaments and the thin confederations do not.
    expect(byConfederation.has("Europe")).toBe(true);
    expect(byConfederation.has("Africa")).toBe(true);

    for (const t of drawn) {
      // Its field is real, its shape is coherent, and nothing is played yet.
      expect(t.nations.length).toBeGreaterThanOrEqual(CONTINENTAL_MIN_NATIONS);
      expect(t.squads).toHaveLength(t.nations.length);
      expect(t.groups.flatMap((g) => g.nids)).toHaveLength(t.nations.length);
      expect(t.bracket).toHaveLength(0);
      expect(t.ties).toHaveLength(0);
      expect(t.championNid).toBeNull();
      // Every entrant belongs to the confederation whose championship it is.
      for (const nation of t.nations) expect(confederationOf(nation)).toBe(t.confederation);
      // And it is called what the spec table says.
      const spec = CONTINENTAL_TOURNAMENTS.find((c) => c.confederation === t.confederation)!;
      expect(t.name).toBe(spec.name);
      expect(t.nations.length).toBeLessThanOrEqual(spec.targetField);
    }
    // Nations are strongest-first, so the field is the confederation's best.
    const europe = byConfederation.get("Europe")!;
    for (let i = 1; i < europe.squads.length; i++) {
      expect(europe.squads[i - 1].rating).toBeGreaterThanOrEqual(europe.squads[i].rating);
    }
  });

  it("plays every championship to a champion, with the finals on the same stage", () => {
    const league = makeLeague(0, 11);
    const drawn = initContinental(league.players, 2, league.lid);
    expect(drawn.length).toBeGreaterThan(1); // otherwise there is no alignment to test

    let tournaments = playContinentalGroups(drawn, league.players, league.lid).tournaments;
    for (const t of tournaments) {
      expect(t.bracket.length).toBeGreaterThanOrEqual(2);
      expect(t.groups.every((g) => g.matches.every((m) => m.homeGoals >= 0))).toBe(true);
    }

    // Play knockout rounds until they are all done, recording how many each
    // tournament was left with at every stage.
    const remainingByStage: number[][] = [];
    for (let guard = 0; tournaments.some((t) => roundsRemaining(t) > 0) && guard < 6; guard++) {
      remainingByStage.push(tournaments.map(roundsRemaining));
      tournaments = playContinentalKnockoutRound(tournaments, league.players, league.lid).tournaments;
    }

    // Everyone has a champion, and nobody was still running when the last
    // stage finished — that is what "the finals land together" means.
    for (const t of tournaments) {
      expect(t.championNid).not.toBeNull();
      expect(roundsRemaining(t)).toBe(0);
    }
    // A shorter tournament waits: on the stage before the last, every live
    // tournament has exactly one round to go.
    const beforeLast = remainingByStage[remainingByStage.length - 1];
    for (const r of beforeLast) expect(r === 0 || r === 1).toBe(true);
  });

  it("stages the championships after the qualifying leg, in the middle season of the cycle", () => {
    const rng = mulberry32(21);
    let league = createLeagueState(0, rng);
    // Season 1 draws qualifying only; season 2 is the continental season.
    for (let s = 0; s < 2; s++) {
      league = simThrough(league, "season", rng);
      league = simThrough(league, "season", rng);
      if (league.season === 1) {
        expect(league.international.continental).toHaveLength(0);
        league = playInternational(league);
        league = simOffseason(league, rng);
      }
    }
    expect(league.season).toBe(2);
    expect(isContinentalSeason(league.season)).toBe(true);
    expect(league.international.continental.length).toBeGreaterThan(0);

    // Click through the stages one at a time and record the sequence.
    const stages: string[] = [String(league.international.stage)];
    let intl = league.international;
    let players = league.players;
    for (let g = 0; g < 12 && intl.stage != null && intl.stage !== "done"; g++) {
      const r = playIntlStage(intl, players, league.lid, league.season);
      intl = r.international;
      players = r.players;
      stages.push(String(intl.stage));
    }
    expect(stages[0]).toBe("qualifying");
    expect(stages[1]).toBe("continental-groups");
    expect(stages.filter((x) => x === "continental-ko").length).toBeGreaterThanOrEqual(1);
    expect(stages[stages.length - 1]).toBe("done");

    // Every championship is archived, and the winners' medals are recorded on
    // the *continental* counters rather than the World Cup ones.
    expect(intl.continentalHistory.length).toBe(intl.continental.length);
    for (const h of intl.continentalHistory) {
      expect(h.champion).toBeTruthy();
      expect(h.confederation).toBeTruthy();
      expect(h.knockout.length).toBeGreaterThan(0);
    }
    const withMedal = players.filter((p) => (p.intl?.continentalTitles ?? 0) > 0);
    expect(withMedal.length).toBeGreaterThan(0);
    for (const p of players) {
      // No World Cup has been played, so those counters must still be zero.
      expect(p.intl?.titles ?? 0).toBe(0);
      expect(p.intl?.tournaments ?? 0).toBe(0);
    }
    // A champion's nation matches one of the archived winners.
    const champions = new Set(intl.continentalHistory.map((h) => h.champion));
    for (const p of withMedal) expect(champions.has(p.nationality)).toBe(true);
  });

  it("clicking through the championships matches simming through them", () => {
    const rng = mulberry32(31);
    let league = createLeagueState(0, rng);
    league = simThrough(league, "season", rng);
    league = simThrough(league, "season", rng);
    league = playInternational(league);
    league = simOffseason(league, rng);
    league = simThrough(league, "season", rng);
    league = simThrough(league, "season", rng);
    expect(league.season).toBe(2);
    expect(league.international.continental.length).toBeGreaterThan(0);

    // Clicked: one stage at a time.
    let intl = league.international;
    let players = league.players;
    for (let g = 0; g < 12 && intl.stage != null && intl.stage !== "done"; g++) {
      const r = playIntlStage(intl, players, league.lid, league.season);
      intl = r.international;
      players = r.players;
    }
    // Simmed: every remaining stage in one pass.
    const bulk = simThroughInternational(
      league.international, league.players, league.lid, league.season,
    );

    expect(bulk.international.continental).toEqual(intl.continental);
    expect(bulk.international.continentalHistory).toEqual(intl.continentalHistory);
    expect(bulk.players.map((p) => p.intl)).toEqual(players.map((p) => p.intl));
  });
});
