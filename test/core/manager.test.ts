import { describe, it, expect } from "vitest";
import { makeLeague } from "../helpers/league.js";
import { switchClub } from "../../src/core/manager/switchClub.js";
import { judgeSeason, confidenceMood } from "../../src/core/manager/confidence.js";
import { generateJobOffers, managerReputation } from "../../src/core/manager/jobOffers.js";
import { deriveExpectations } from "../../src/core/manager/expectation.js";
import { reviewSeason } from "../../src/core/manager/index.js";
import { emptyManagerState, type ManagerStint } from "../../src/core/manager/types.js";
import { academyContractTerms } from "../../src/core/contracts.js";
import {
  MANAGER_START_CONFIDENCE, MANAGER_GRACE_SEASONS, DIFFICULTIES,
} from "../../src/core/constants.js";
import type { LeagueStore } from "../../src/core/leagueState.js";
import { AUTOPILOT_TID } from "../../src/core/autopilot.js";

const USER = 0;
const OTHER = 7;

function baseFacts(over: {
  finish?: number; expectedRank?: number; clubs?: number; demand?: number;
  titles?: number; trophies?: number; promoted?: boolean; relegated?: boolean;
} = {}) {
  return {
    finish: 10,
    expectedRank: 10,
    clubs: 20,
    demand: 0.5,
    titles: 0,
    trophies: 0,
    promoted: false,
    relegated: false,
    ...over,
  };
}

describe("switchClub handover", () => {
  function withAcademy(league: LeagueStore): LeagueStore {
    // Move two senior players into the user's academy so the dissolution has
    // something to do. Academy pids are otherwise only created by youth intake.
    const user = league.teams.find((t) => t.tid === USER)!;
    const moved = user.roster.slice(0, 2);
    return {
      ...league,
      teams: league.teams.map((t) =>
        t.tid === USER
          ? {
            ...t,
            roster: t.roster.filter((pid) => !moved.includes(pid)),
            academyRoster: moved,
            starters: null,
            transferListed: [t.roster[3]],
            moreMinutes: [t.roster[4]],
            scoutingObserved: { [t.roster[5]]: 1 },
          }
          : t,
      ),
    };
  }

  it("empties the departing club's academy onto its senior roster", () => {
    const league = withAcademy(makeLeague(USER, 11));
    const before = league.teams.find((t) => t.tid === USER)!;
    const academyPids = [...before.academyRoster];
    expect(academyPids.length).toBe(2);

    const after = switchClub(league, OTHER, "left");
    const old = after.teams.find((t) => t.tid === USER)!;

    // The zombie case: an AI club never promotes from `academyRoster`, never
    // fields those players and never releases them, yet still pays them.
    expect(old.academyRoster).toEqual([]);
    for (const pid of academyPids) expect(old.roster).toContain(pid);
  });

  it("puts the graduating academy players on senior contracts", () => {
    const withStipends = withAcademy(makeLeague(USER, 11));
    const academyPids = withStipends.teams.find((t) => t.tid === USER)!.academyRoster;
    const stipend = academyContractTerms(withStipends.season);
    const league: LeagueStore = {
      ...withStipends,
      players: withStipends.players.map((p) =>
        academyPids.includes(p.pid)
          ? { ...p, contract: { salary: stipend.salary, expiresSeason: stipend.expiresSeason } }
          : p,
      ),
    };

    const after = switchClub(league, OTHER, "left");
    for (const pid of academyPids) {
      const salary = after.players.find((p) => p.pid === pid)!.contract.salary;
      // A senior wage is cubic in ovr; the academy stipend is a flat pittance.
      expect(salary).toBeGreaterThan(stipend.salary);
    }
  });

  it("strips every user-only field from the club being handed over", () => {
    const league = withAcademy(makeLeague(USER, 11));
    const after = switchClub(league, OTHER, "left");
    const old = after.teams.find((t) => t.tid === USER)!;

    expect(old.starters).toBeNull();
    expect(old.transferListed).toEqual([]);
    expect(old.moreMinutes).toEqual([]);
    expect(old.scoutingObserved).toEqual({});
    expect(old.nextScoutingSpend).toBe(old.scoutingSpend);
  });

  it("fogs the new squad as of the current season", () => {
    const league = makeLeague(USER, 11);
    const after = switchClub(league, OTHER, "left");
    const now = after.teams.find((t) => t.tid === OTHER)!;

    expect(Object.keys(now.scoutingObserved).length).toBe(now.roster.length);
    for (const pid of now.roster) expect(now.scoutingObserved[pid]).toBe(league.season);
  });

  it("clears pending business that belonged to the old club", () => {
    const league: LeagueStore = {
      ...makeLeague(USER, 11),
      loanListings: [{ pid: 1, seasons: 1 }] as LeagueStore["loanListings"],
    };
    const after = switchClub(league, OTHER, "left");

    expect(after.negotiations).toEqual([]);
    expect(after.inboundOffers).toEqual([]);
    expect(after.loanListings).toEqual([]);
    expect(after.loanRejections).toEqual([]);
  });

  it("closes the old stint and opens a new one at the new club", () => {
    const league = makeLeague(USER, 11);
    const after = switchClub(league, OTHER, "sacked");

    expect(after.meta.userTid).toBe(OTHER);
    expect(after.manager.stints).toHaveLength(2);
    expect(after.manager.stints[0]).toMatchObject({
      tid: USER, endSeason: league.season, ending: "sacked",
    });
    expect(after.manager.stints[1]).toMatchObject({
      tid: OTHER, endSeason: null, ending: null, seasons: 0,
    });
    // A new job starts the season after the one just finished.
    expect(after.manager.stints[1].startSeason).toBe(league.season + 1);
    expect(after.manager.confidence).toBe(MANAGER_START_CONFIDENCE);
    expect(after.manager.sacked).toBe(false);
    expect(after.manager.offers).toEqual([]);
  });

  it("is a no-op for a switch to the same club or an unknown tid", () => {
    const league = makeLeague(USER, 11);
    expect(switchClub(league, USER, "left")).toBe(league);
    expect(switchClub(league, 99999, "left")).toBe(league);
  });
});

describe("board confidence", () => {
  const patience = DIFFICULTIES.normal.boardPatience;

  it("rises for beating expectation and falls for missing it", () => {
    const good = judgeSeason(baseFacts({ finish: 4, expectedRank: 10 }), 50, 3, true, patience);
    const bad = judgeSeason(baseFacts({ finish: 16, expectedRank: 10 }), 50, 3, true, patience);
    expect(good.confidence).toBeGreaterThan(50);
    expect(bad.confidence).toBeLessThan(50);
  });

  it("punishes a demanding board's manager harder for the same finish", () => {
    const facts = baseFacts({ finish: 16, expectedRank: 10 });
    const superclub = judgeSeason({ ...facts, demand: 1 }, 60, 3, true, patience);
    const minnow = judgeSeason({ ...facts, demand: 0 }, 60, 3, true, patience);
    expect(superclub.confidence).toBeLessThan(minnow.confidence);
  });

  it("credits a demanding board's manager less for the same overachievement", () => {
    const facts = baseFacts({ finish: 4, expectedRank: 10 });
    const superclub = judgeSeason({ ...facts, demand: 1 }, 40, 3, true, patience);
    const minnow = judgeSeason({ ...facts, demand: 0 }, 40, 3, true, patience);
    expect(superclub.confidence).toBeLessThan(minnow.confidence);
  });

  it("scales with the save's difficulty", () => {
    // Mild enough that neither verdict clamps at the ends of the 0-100 scale,
    // which is what makes the comparison meaningful.
    const facts = baseFacts({ finish: 12, expectedRank: 9, demand: 0.3 });
    const easy = judgeSeason(facts, 60, 3, true, DIFFICULTIES.easy.boardPatience);
    const brutal = judgeSeason(facts, 60, 3, true, DIFFICULTIES.brutal.boardPatience);
    expect(brutal.confidence).toBeLessThan(easy.confidence);
  });

  it("never sacks when sacking is switched off", () => {
    const disaster = baseFacts({ finish: 20, expectedRank: 1, relegated: true });
    expect(judgeSeason(disaster, 5, 9, true, patience).sacked).toBe(true);
    expect(judgeSeason(disaster, 5, 9, false, patience).sacked).toBe(false);
  });

  it("honours the grace period at a new club", () => {
    const disaster = baseFacts({ finish: 20, expectedRank: 1, relegated: true });
    const rookie = judgeSeason(disaster, 5, MANAGER_GRACE_SEASONS - 1, true, patience);
    const veteran = judgeSeason(disaster, 5, MANAGER_GRACE_SEASONS, true, patience);
    expect(rookie.sacked).toBe(false);
    expect(veteran.sacked).toBe(true);
  });

  it("lets a banked reputation survive a relegation", () => {
    // Overachieved for years, then went down: goodwill absorbs it. A flat
    // "relegated = fired" rule could not express this.
    const banked = judgeSeason(
      baseFacts({ finish: 18, expectedRank: 20, relegated: true }), 100, 6, true, patience,
    );
    expect(banked.sacked).toBe(false);
    expect(banked.confidence).toBeGreaterThan(0);
  });

  it("reads as secure whenever sacking is off, however low the number", () => {
    expect(confidenceMood(1, false)).toBe("secure");
    expect(confidenceMood(1, true)).toBe("danger");
  });
});

describe("reputation", () => {
  const stint = (over: Partial<ManagerStint>): ManagerStint => ({
    tid: 0, startSeason: 1, endSeason: null, seasons: 0,
    titles: 0, trophies: 0, overperformance: 0, ending: null, ...over,
  });

  it("rewards trophies over longevity", () => {
    const winner = managerReputation([stint({ seasons: 3, titles: 3 })]);
    const survivor = managerReputation([stint({ seasons: 15 })]);
    expect(winner).toBeGreaterThan(survivor);
  });

  it("caps the credit for a long quiet career", () => {
    const long = managerReputation([stint({ seasons: 40 })]);
    const longer = managerReputation([stint({ seasons: 80 })]);
    expect(long).toBe(longer);
  });

  it("counts a sacking against you", () => {
    const clean = managerReputation([stint({ seasons: 5, titles: 1 })]);
    const fired = managerReputation([stint({ seasons: 5, titles: 1, ending: "sacked" })]);
    expect(fired).toBeLessThan(clean);
  });

  it("stays inside 0-100", () => {
    expect(managerReputation([stint({ seasons: 50, titles: 50, trophies: 50 })])).toBe(100);
    expect(managerReputation([stint({ overperformance: -50, ending: "sacked" })])).toBe(0);
  });
});

describe("job offers", () => {
  const league = makeLeague(USER, 11);
  const expectations = deriveExpectations(league.teams, league.players, league.competitions);

  it("always gives a sacked manager somewhere to go", () => {
    // There is no unemployed state, so this list is load-bearing: an empty one
    // would leave the save with no way to continue.
    for (const reputation of [0, 25, 50, 75, 100]) {
      const offers = generateJobOffers({
        lid: league.lid, season: 4, currentTid: USER, expectations,
        sacked: true, reputation, lastOverperformance: -0.5,
      });
      expect(offers.length).toBeGreaterThan(0);
      expect(offers.every((o) => o.tid !== USER)).toBe(true);
    }
  });

  it("is deterministic for the same save and season", () => {
    const args = {
      lid: league.lid, season: 4, currentTid: USER, expectations,
      sacked: true, reputation: 60, lastOverperformance: 0.2,
    };
    expect(generateJobOffers(args)).toEqual(generateJobOffers(args));
  });

  it("offers a sacked manager a step down and an employed one a step up", () => {
    const current = expectations.get(USER)!;
    const sacked = generateJobOffers({
      lid: league.lid, season: 4, currentTid: USER, expectations,
      sacked: true, reputation: 60, lastOverperformance: -0.4,
    });
    expect(sacked.every((o) => o.prestige <= current.prestige)).toBe(true);

    const courted = generateJobOffers({
      lid: league.lid, season: 4, currentTid: USER, expectations,
      sacked: false, reputation: 90, lastOverperformance: 0.6,
    });
    expect(courted.every((o) => o.prestige >= current.prestige)).toBe(true);
  });

  it("names the division a club will actually play in, not the one it's leaving", () => {
    // Offers are made at the end of a season; promotion and relegation only
    // happen in the offseason that follows. Quoting the live compId would
    // advertise a just-relegated club as a top-flight job.
    const relegatedTid = [...expectations.values()].find((e) => e.tid !== USER)!.tid;
    const offers = generateJobOffers({
      lid: league.lid, season: 4, currentTid: USER, expectations,
      sacked: true, reputation: 60, lastOverperformance: -0.4,
      moves: {
        promoted: new Set<number>(),
        relegated: new Set([relegatedTid]),
        nextCompId: new Map([[relegatedTid, 999]]),
      },
    });
    const moved = offers.find((o) => o.tid === relegatedTid);
    if (moved) {
      expect(moved.compId).toBe(999);
      expect(moved.moving).toBe("relegated");
    }
    for (const o of offers.filter((x) => x.tid !== relegatedTid)) {
      expect(o.moving).toBeNull();
      expect(o.compId).toBe(expectations.get(o.tid)!.compId);
    }
  });

  it("caps how many clubs come calling at once", () => {
    const offers = generateJobOffers({
      lid: league.lid, season: 4, currentTid: USER, expectations,
      sacked: false, reputation: 70, lastOverperformance: 1,
    });
    expect(offers.length).toBeLessThanOrEqual(4);
  });
});

describe("expectations", () => {
  const league = makeLeague(USER, 11);
  const expectations = deriveExpectations(league.teams, league.players, league.competitions);

  it("ranks every club inside its own competition", () => {
    expect(expectations.size).toBe(league.teams.length);
    for (const comp of league.competitions) {
      const members = [...expectations.values()].filter((e) => e.compId === comp.id);
      const ranks = members.map((e) => e.expectedRank).sort((a, b) => a - b);
      expect(ranks).toEqual(members.map((_, i) => i + 1));
    }
  });

  it("keeps prestige and demand inside their stated ranges", () => {
    for (const e of expectations.values()) {
      expect(e.prestige).toBeGreaterThanOrEqual(0);
      expect(e.prestige).toBeLessThanOrEqual(1);
      expect(e.demand).toBeGreaterThanOrEqual(0);
      expect(e.demand).toBeLessThanOrEqual(1);
    }
  });

  it("makes a strong league's clubs more demanding than a weak league's equivalents", () => {
    // Compare each competition's own strongest club: the top job in a stronger
    // league should carry a more demanding board than the top job in a weaker one.
    const topByComp = new Map<number, number>();
    for (const e of expectations.values()) {
      if (e.expectedRank === 1) topByComp.set(e.compId, e.demand);
    }
    const demands = [...topByComp.values()];
    expect(Math.max(...demands)).toBeGreaterThan(Math.min(...demands));
  });
});

describe("reviewSeason", () => {
  it("leaves the manager state alone while the AI is in charge", () => {
    // A multi-season jump parks userTid at AUTOPILOT_TID, so the board has no
    // club to judge. Without this the jump could end with `sacked` set and
    // offers from a season the user is no longer in, which nothing can answer.
    const base = makeLeague(USER, 11);
    const league: LeagueStore = {
      ...base,
      meta: { ...base.meta, userTid: AUTOPILOT_TID },
    };
    const review = reviewSeason({
      league, teams: league.teams, players: league.players, played: league.played,
      cup: null, shield: null, domesticCups: [],
    });
    expect(review.verdict).toBeNull();
    expect(review.manager).toBe(league.manager);
  });

  it("leaves the board alone when no season was played", () => {
    const league = makeLeague(USER, 11);
    const review = reviewSeason({
      league, teams: league.teams, players: league.players, played: [],
      cup: null, shield: null, domesticCups: [],
    });
    expect(review.verdict).toBeNull();
    expect(review.manager).toBe(league.manager);
  });

  it("does not disturb a manager state it cannot judge", () => {
    const league: LeagueStore = { ...makeLeague(USER, 11), manager: emptyManagerState(USER, 1) };
    const review = reviewSeason({
      league, teams: league.teams, players: league.players, played: [],
      cup: null, shield: null, domesticCups: [],
    });
    expect(review.manager.confidence).toBe(MANAGER_START_CONFIDENCE);
    expect(review.manager.sacked).toBe(false);
  });
});
