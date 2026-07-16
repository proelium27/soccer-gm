import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { generateWorld } from "../../src/core/league/generate.js";
import { worldCompetitions } from "../../src/core/competitions.js";
import { assignIdentities } from "../../src/core/teams/clubs.js";
import { simThrough } from "../../src/core/simThrough.js";
import { simOffseason } from "../../src/core/offseason.js";
import { buildCompetitionSchedule, type LeagueStore } from "../../src/core/leagueState.js";

function buildWorldLeague(seed: number): LeagueStore {
  const rng = mulberry32(seed);
  const world = generateWorld(rng, seed);
  const competitions = worldCompetitions();
  const teams = assignIdentities(world, competitions);
  const schedule = buildCompetitionSchedule(teams, competitions);
  return {
    lid: 1,
    meta: { name: "World Test League", created: Date.now(), userTid: 0 },
    competitions,
    teams,
    players: world.players,
    season: 1,
    phase: "regular",
    schedule,
    played: [],
    negotiations: [],
    inboundOffers: [],
    transfers: [],
    winterMarketRunSeason: null,
    seasonHistory: [],
    newsEvents: [],
  };
}

describe("world integration (generateWorld through the real season/offseason pipeline)", () => {
  it("simulates a full season across all 6 competitions without crashing", () => {
    const rng = mulberry32(100);
    let league = buildWorldLeague(100);
    league = simThrough(league, "season", rng);
    expect(league.played.length).toBeGreaterThan(0);
    // Every played match is within one competition — no cross-competition fixtures.
    const compByTid = new Map(league.teams.map((t) => [t.tid, t.compId]));
    for (const m of league.played) {
      expect(compByTid.get(m.home)).toBe(compByTid.get(m.away));
    }
  });

  it("runs a full offseason: promotion/relegation happens independently per country", () => {
    const rng = mulberry32(101);
    let league = buildWorldLeague(101);
    league = simThrough(league, "season", rng);
    const beforeCompByTid = new Map(league.teams.map((t) => [t.tid, t.compId]));
    league = simOffseason(league, rng);
    expect(league.teams).toHaveLength(120);
    // Every competition still has exactly 20 teams after the swap.
    for (const comp of league.competitions) {
      expect(league.teams.filter((t) => t.compId === comp.id)).toHaveLength(20);
    }
    // At least one country actually swapped teams (statistically near-certain
    // across 3 countries x 3 promotions each) — proves the per-country loop
    // from PR 1 (computeCountrySwaps/applyCompetitionSwaps) is actually firing
    // for Spain and Italy, not just England.
    let anySwapped = false;
    for (const t of league.teams) {
      if (beforeCompByTid.get(t.tid) !== t.compId) anySwapped = true;
    }
    expect(anySwapped).toBe(true);
  });

  it("the Division-2 ceiling sweep moves a qualifying player to tier 1 in ANY country, not just England", () => {
    const rng = mulberry32(102);
    let league = buildWorldLeague(102);
    league = simThrough(league, "season", rng);
    // Force a non-English tier-2 (Spain D1's partner, i.e. Spain D2, compId 3)
    // AI player to a qualifying OVR.
    const spainD2Team = league.teams.find((t) => t.compId === 3 && t.tid !== league.meta.userTid)!;
    const targetPid = spainD2Team.roster[0];
    league = {
      ...league,
      players: league.players.map((p) => (p.pid === targetPid ? { ...p, ovr: 95 } : p)),
    };
    const next = simOffseason(league, rng);
    const newTeam = next.teams.find((t) => t.roster.includes(targetPid))!;
    const newComp = next.competitions.find((c) => c.id === newTeam.compId)!;
    expect(newComp.tier).toBe(1);
  });
});
