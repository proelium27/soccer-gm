import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { createLeagueState } from "../../src/core/leagueState.js";
import { playSeason } from "../helpers/offseasonLeague.js";
import { simOffseason } from "../../src/core/offseason.js";
import {
  sanitizeScoutingRegions, sanitizeScoutPositions, scoutedNationalityWeights,
} from "../../src/core/scouting/scoutDirections.js";
import {
  applyProfileTilt, sanitizeScoutProfile, SCOUT_PROFILES, SCOUT_PROFILE_SKILLS,
  type ScoutProfile,
} from "../../src/core/scouting/scoutProfile.js";
import { pickNationality } from "../../src/core/players/nationalities.js";
import { generatePlayer } from "../../src/core/players/generate.js";
import { computeOvr } from "../../src/core/players/ovr.js";
import { POSITIONS, type Position } from "../../src/core/players/types.js";
import { OVR_WEIGHTS } from "../../src/core/players/templates.js";
import {
  SCOUTING_REGION_MAX, SCOUTING_REGION_SHARE, SCOUT_POSITION_MAX,
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

describe("scout directions through a real offseason", () => {
  interface Directions {
    regions?: string[];
    positions?: Position[];
    profile?: ScoutProfile | null;
  }
  interface Intake {
    nationalities: string[];
    positions: Position[];
    league: LeagueStore;
  }

  // Each call builds a world and plays a season through its offseason, ~75s a
  // time, and four of the cases below want the same untargeted baseline. The
  // helper is deterministic — one fixed seed, directions the only input — so
  // caching on the directions is exact rather than an approximation, and the
  // tests only ever read what comes back.
  const cache = new Map<string, Intake>();

  function intake(d: Directions): Intake {
    const key = JSON.stringify([d.regions ?? [], d.positions ?? [], d.profile ?? null]);
    const hit = cache.get(key);
    if (hit) return hit;
    const built = buildIntake(d);
    cache.set(key, built);
    return built;
  }

  function buildIntake(d: Directions): Intake {
    const rng = mulberry32(4);
    let league = createLeagueState(0, rng);
    league = {
      ...league,
      teams: league.teams.map((t) => (t.tid === league.meta.userTid
        ? {
          ...t,
          scoutingRegions: d.regions ?? [],
          scoutingPositions: d.positions ?? [],
          scoutingProfile: d.profile ?? null,
        }
        : t)),
    };
    // playSeason, not one simThrough: it halts before the user's cup final, and
    // a half-played season makes simOffseason a silent no-op — no trial group,
    // and a failure that points at the wrong thing.
    league = simOffseason(playSeason(league, rng), rng);
    const byPid = new Map(league.players.map((p) => [p.pid, p]));
    const group = league.teams.find((t) => t.tid === league.meta.userTid)!.youthTrialists ?? [];
    return {
      nationalities: group.map((pid) => byPid.get(pid)!.nationality),
      positions: group.map((pid) => byPid.get(pid)!.pos),
      league,
    };
  }

  it("fills most of the trial group from where the scouts were sent", () => {
    const { nationalities } = intake({ regions: ["Brazil"] });
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
    const plain = intake({});
    const scouted = intake({ regions: ["Brazil", "Argentina"] });
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

  it("skews the group toward the positions the scouts were told to look for", () => {
    const targets: Position[] = ["GK", "DM", "AM"];
    // Deliberately the three RAREST positions: ROSTER_COMPOSITION keeps only
    // two of each, so an untargeted intake produces few of them and the skew
    // has somewhere to show. Targeting CB/FB/CM would be measuring the baseline.
    const plain = intake({});
    const scouted = intake({ positions: targets });

    const share = (r: Intake) =>
      r.positions.filter((pos) => targets.includes(pos)).length / r.positions.length;

    expect(scouted.positions.length).toBeGreaterThan(0);
    expect(share(scouted)).toBeGreaterThan(share(plain));
    // A skew and not a filter: the academy's own intake is untargeted and the
    // scouted part still leaves a quarter of its draw to everyone else, so the
    // group can never be all one thing.
    expect(share(scouted)).toBeLessThan(1);
  });

  it("changes nobody else in the world, whatever the scouts were told", () => {
    // The containment claim above covers countries, which are a post-hoc
    // relabel. Positions and the profile are the harder case: both change how a
    // player is GENERATED, and a position changes which tier row his ratings
    // are rolled from, whose draw counts differ (a keeper costs 23 rating draws
    // against an outfielder's 27). They are safe only because they reach the
    // extras alone, which are drawn on the trial stream — so this is the test
    // that would fail if that ever stopped being true.
    const plain = intake({});
    const directed = intake({
      regions: ["Brazil"],
      positions: ["GK", "ST"],
      profile: "physical",
    });
    const trial = new Set(
      directed.league.teams.find((t) => t.tid === directed.league.meta.userTid)!.youthTrialists ?? [],
    );
    const fingerprint = (l: LeagueStore) =>
      l.players
        .filter((p) => !trial.has(p.pid))
        .map((p) => `${p.pid}:${p.name}:${p.pos}:${p.ovr}:${p.potential}`)
        .join("|");
    expect(fingerprint(directed.league)).toBe(fingerprint(plain.league));
  });

  it("leaves the group's ratings untouched — scouts find different players, not better ones", () => {
    const plain = intake({});
    const scouted = intake({ regions: ["Brazil"] });
    const ovrsOf = (r: ReturnType<typeof intake>) => {
      const byPid = new Map(r.league.players.map((p) => [p.pid, p]));
      const group = r.league.teams.find((t) => t.tid === r.league.meta.userTid)!.youthTrialists!;
      return group.map((pid) => byPid.get(pid)!.ovr);
    };
    expect(ovrsOf(scouted)).toEqual(ovrsOf(plain));
  });
});

describe("sanitizeScoutPositions", () => {
  it("caps the list, drops duplicates, and keeps the order picked", () => {
    const clean = sanitizeScoutPositions(["ST", "ST", "CB", "GK", "CM", "W"]);
    expect(clean).toHaveLength(SCOUT_POSITION_MAX);
    expect(clean[0]).toBe("ST");
    expect(new Set(clean).size).toBe(clean.length);
  });

  it("drops anything that isn't a position", () => {
    // Persisted state, so it can arrive from an older build or a hand edit. An
    // unrecognised entry would take a share of the draw that then went nowhere,
    // quietly weakening every real target beside it.
    expect(sanitizeScoutPositions(["Striker", "ST"])).toEqual(["ST"]);
    expect(sanitizeScoutPositions(undefined)).toEqual([]);
  });
});

describe("sanitizeScoutProfile", () => {
  it("keeps a real profile and rejects everything else", () => {
    expect(sanitizeScoutProfile("physical")).toBe("physical");
    expect(sanitizeScoutProfile("pacey")).toBeNull();
    expect(sanitizeScoutProfile(undefined)).toBeNull();
    expect(sanitizeScoutProfile(3)).toBeNull();
  });
});

describe("applyProfileTilt", () => {
  /**
   * The invariant the whole feature rests on, checked at every position for
   * every profile across the full range of academy strengths: a scouting
   * profile changes the KIND of player and never how good he is. If this ever
   * fails, the profile has become a balance lever — it would move wages (cubic
   * in ovr), valuation and team rating — and would need a dynasty audit it has
   * deliberately not been given.
   */
  it("never moves OVR, at any position, profile or academy strength", () => {
    for (const pos of POSITIONS) {
      for (const profile of SCOUT_PROFILES) {
        // base 1 is a third-division academy on the softplus floor, where the
        // paying side has almost no headroom; 60 is a big-four club.
        for (const base of [1, 5, 15, 30, 45, 60]) {
          const rng = mulberry32(base * 100 + POSITIONS.indexOf(pos));
          for (let i = 0; i < 12; i++) {
            const p = generatePlayer(rng, pos, base, 1000 + i, 16, 5);
            const tilted = { ...p.ratings };
            applyProfileTilt(tilted, pos, p.heightCm, profile);
            expect(computeOvr(pos, tilted, p.heightCm)).toBe(p.ovr);
          }
        }
      }
    }
  });

  it("leaves every rating a whole number", () => {
    // clampRating rounds at generation and in progression, so fractional
    // ratings are not a thing this codebase has — and the compensating side of
    // the trade is fractional before it is settled.
    const rng = mulberry32(11);
    for (const pos of POSITIONS) {
      const p = generatePlayer(rng, pos, 40, 2000, 16, 5);
      const tilted = { ...p.ratings };
      applyProfileTilt(tilted, pos, p.heightCm, "technical");
      for (const v of Object.values(tilted)) expect(Number.isInteger(v)).toBe(true);
    }
  });

  it("actually moves the profile's skills up, and pays for them", () => {
    // A neutral no-op would pass the OVR invariant above perfectly, so this is
    // what stops the whole thing quietly becoming one.
    const rng = mulberry32(7);
    let moved = 0;
    for (const pos of POSITIONS) {
      const p = generatePlayer(rng, pos, 45, 3000 + POSITIONS.indexOf(pos), 16, 5);
      const tilted = { ...p.ratings };
      applyProfileTilt(tilted, pos, p.heightCm, "physical");

      const weighted = (k: string) => (OVR_WEIGHTS[pos] as Record<string, number>)[k] ?? 0;
      const wantedHere = SCOUT_PROFILE_SKILLS.physical.filter((k) => weighted(k) > 0);
      // Every position weights at least one skill of every shipped profile —
      // that is the rule the three profiles were chosen by.
      expect(wantedHere.length).toBeGreaterThan(0);

      const up = wantedHere.filter((k) => tilted[k] > p.ratings[k]).length;
      const paid = (Object.keys(tilted) as (keyof typeof tilted)[])
        .filter((k) => weighted(k) > 0 && !wantedHere.includes(k))
        .filter((k) => tilted[k] < p.ratings[k]).length;
      if (up > 0) {
        moved++;
        expect(paid).toBeGreaterThan(0);
      }
    }
    // Not "every position" — a rating already at the ceiling or the floor
    // legitimately leaves nothing to trade, and reverting is the honest answer.
    expect(moved).toBeGreaterThan(POSITIONS.length / 2);
  });

  it("takes nothing from a skill the position isn't judged on", () => {
    // Paying out of an unweighted skill would be a free OVR rise, which is the
    // exploit the weighting exists to prevent.
    const rng = mulberry32(13);
    const p = generatePlayer(rng, "ST", 45, 4000, 16, 5);
    const tilted = { ...p.ratings };
    applyProfileTilt(tilted, "ST", p.heightCm, "physical");
    const unweighted = (Object.keys(tilted) as (keyof typeof tilted)[])
      .filter((k) => ((OVR_WEIGHTS.ST as Record<string, number>)[k] ?? 0) === 0);
    expect(unweighted.length).toBeGreaterThan(0);
    for (const k of unweighted) expect(tilted[k]).toBe(p.ratings[k]);
  });
});
