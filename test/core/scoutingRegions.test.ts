import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { createLeagueState } from "../../src/core/leagueState.js";
import { simThrough } from "../../src/core/simThrough.js";
import { simOffseason } from "../../src/core/offseason.js";
import {
  sanitizeScoutingRegions, scoutedNationalityWeights,
} from "../../src/core/scouting/scoutingRegions.js";
import { pickNationality } from "../../src/core/players/nationalities.js";
import {
  SCOUTING_REGION_MAX, SCOUTING_REGION_SHARE,
} from "../../src/core/constants.js";
import type { LeagueStore } from "../../src/core/leagueState.js";

describe("sanitizeScoutingRegions", () => {
  it("caps the list, drops duplicates, and keeps the order picked", () => {
    const many = ["Brazil", "Brazil", "Argentina", "France", "Spain", "Italy"];
    const clean = sanitizeScoutingRegions(many);
    expect(clean).toHaveLength(SCOUTING_REGION_MAX);
    expect(clean[0]).toBe("Brazil");
    expect(new Set(clean).size).toBe(clean.length);
  });

  it("drops a nation the game has no names for", () => {
    // generateName falls back to synthesized nonsense words for an unknown
    // nationality, so an unrecognised entry would produce made-up names.
    expect(sanitizeScoutingRegions(["Atlantis", "Brazil"])).toEqual(["Brazil"]);
    expect(sanitizeScoutingRegions(undefined)).toEqual([]);
  });
});

describe("scoutedNationalityWeights", () => {
  const home = { England: 60, France: 20, Spain: 20 };

  it("leaves the table alone when no scouts have been sent", () => {
    expect(scoutedNationalityWeights(home, [])).toBe(home);
  });

  it("gives the targets SCOUTING_REGION_SHARE of the draw between them", () => {
    const table = scoutedNationalityWeights(home, ["Brazil", "Argentina"]);
    const total = Object.values(table).reduce((a, b) => a + b, 0);
    const targeted = table.Brazil + table.Argentina;
    expect(targeted / total).toBeCloseTo(SCOUTING_REGION_SHARE, 6);
    // Split evenly: the player picked them and no ranking between them exists.
    expect(table.Brazil).toBeCloseTo(table.Argentina, 6);
  });

  it("keeps the home mix's internal proportions, just scaled down", () => {
    // A blend, not an override: the club still produces local players, and
    // their relative frequencies are untouched.
    const table = scoutedNationalityWeights(home, ["Brazil"]);
    expect(table.England / table.France).toBeCloseTo(home.England / home.France, 6);
    const total = Object.values(table).reduce((a, b) => a + b, 0);
    expect((total - table.Brazil) / total).toBeCloseTo(1 - SCOUTING_REGION_SHARE, 6);
  });

  it("adds to a target already present in the home mix rather than replacing it", () => {
    const table = scoutedNationalityWeights(home, ["France"]);
    const total = Object.values(table).reduce((a, b) => a + b, 0);
    expect(table.France / total).toBeGreaterThan(home.France / (60 + 20 + 20));
  });

  it("survives a home table that sums to nothing", () => {
    const table = scoutedNationalityWeights({}, ["Brazil"]);
    expect(Object.keys(table)).toEqual(["Brazil"]);
  });

  it("actually skews the draw", () => {
    // The arithmetic above is the contract; this is the contract observed
    // through the thing that consumes it.
    const table = scoutedNationalityWeights(home, ["Brazil"]);
    const rng = mulberry32(3);
    let brazilians = 0;
    for (let i = 0; i < 2000; i++) {
      if (pickNationality(rng, "England", table) === "Brazil") brazilians++;
    }
    expect(brazilians / 2000).toBeCloseTo(SCOUTING_REGION_SHARE, 1);
  });
});

describe("scouting regions through a real offseason", () => {
  function intake(regions: string[]): { nationalities: string[]; league: LeagueStore } {
    const rng = mulberry32(4);
    let league = createLeagueState(0, rng);
    league = {
      ...league,
      teams: league.teams.map((t) =>
        t.tid === league.meta.userTid ? { ...t, scoutingRegions: regions } : t,
      ),
    };
    league = simOffseason(simThrough(league, "season", rng), rng);
    const byPid = new Map(league.players.map((p) => [p.pid, p]));
    const group = league.teams.find((t) => t.tid === league.meta.userTid)!.youthTrialists ?? [];
    return { nationalities: group.map((pid) => byPid.get(pid)!.nationality), league };
  }

  it("fills most of the trial group from where the scouts were sent", () => {
    const { nationalities } = intake(["Brazil"]);
    expect(nationalities.length).toBeGreaterThan(0);
    const share = nationalities.filter((n) => n === "Brazil").length / nationalities.length;
    // A blend, so neither extreme: clearly skewed, never exclusive.
    expect(share).toBeGreaterThan(0.25);
    expect(share).toBeLessThan(1);
  });

  it("changes nobody else in the world", () => {
    // Nationality is re-drawn post-hoc on the trial stream precisely so it
    // cannot touch the shared rng — a different table handed to generation
    // would change the draw count, because drawFrom spends a second value when
    // the roll lands in the rest-of-world bucket.
    const plain = intake([]);
    const scouted = intake(["Brazil", "Argentina"]);
    const trial = new Set(
      scouted.league.teams.find((t) => t.tid === scouted.league.meta.userTid)!.youthTrialists ?? [],
    );
    const fingerprint = (l: LeagueStore) =>
      l.players
        .filter((p) => !trial.has(p.pid))
        .map((p) => `${p.pid}:${p.name}:${p.nationality}:${p.ovr}:${p.potential}`)
        .join("|");
    expect(fingerprint(scouted.league)).toBe(fingerprint(plain.league));
  });

  it("leaves the group's ratings untouched — scouts find different players, not better ones", () => {
    const plain = intake([]);
    const scouted = intake(["Brazil"]);
    const ovrsOf = (r: ReturnType<typeof intake>) => {
      const byPid = new Map(r.league.players.map((p) => [p.pid, p]));
      const group = r.league.teams.find((t) => t.tid === r.league.meta.userTid)!.youthTrialists!;
      return group.map((pid) => byPid.get(pid)!.ovr);
    };
    expect(ovrsOf(scouted)).toEqual(ovrsOf(plain));
  });
});
