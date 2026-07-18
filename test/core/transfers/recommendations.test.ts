import { describe, it, expect } from "vitest";
import { recommendedTransfers } from "../../../src/core/transfers/recommendations.js";
import { createLeagueState, type LeagueStore } from "../../../src/core/leagueState.js";
import { mulberry32 } from "../../../src/engine/rng.js";
import {
  RECOMMENDED_TRANSFERS_MIN, RECOMMENDED_TRANSFERS_MAX,
  RECOMMENDED_MAX_PER_POSITION, SCOUTING_SPEND_MAX,
} from "../../../src/core/constants.js";
import { trueTransferValue } from "../../../src/core/finance/valuation.js";

/**
 * A league sitting inside the winter window. The user club gets a generous
 * budget so tests measure recommendation/scouting behavior, not the
 * affordability cutoff (the real season-start budget is base − wages, and
 * tid 0 is the strongest, most expensive squad).
 */
function windowLeague(seed: number, scoutingSpend = 0): LeagueStore {
  const league = createLeagueState(0, mulberry32(seed));
  return {
    ...league,
    schedule: league.schedule.filter((g) => g.matchday >= 20),
    teams: league.teams.map((t) =>
      t.tid === 0 ? { ...t, scoutingSpend, budget: 200_000_000 } : t,
    ),
  };
}

describe("recommendedTransfers", () => {
  it("returns an empty list when no window is open", () => {
    const league = createLeagueState(0, mulberry32(1));
    const midAutumn = { ...league, schedule: league.schedule.filter((g) => g.matchday >= 10) };
    expect(recommendedTransfers(midAutumn)).toEqual([]);
  });

  it("lists 5-10 affordable players from other clubs", () => {
    const league = windowLeague(2);
    const targets = recommendedTransfers(league);
    expect(targets.length).toBeGreaterThanOrEqual(RECOMMENDED_TRANSFERS_MIN);
    expect(targets.length).toBeLessThanOrEqual(RECOMMENDED_TRANSFERS_MAX);

    const budget = league.teams[0].budget;
    const userRoster = new Set(league.teams[0].roster);
    for (const t of targets) {
      expect(t.sellerTid).not.toBe(0);
      expect(userRoster.has(t.player.pid)).toBe(false);
      expect(t.scoutedValue).toBeLessThanOrEqual(budget);
    }
  });

  it("keeps the list varied: at most a couple of targets per position", () => {
    for (const seed of [2, 3, 4, 5]) {
      const counts = new Map<string, number>();
      for (const t of recommendedTransfers(windowLeague(seed))) {
        counts.set(t.player.pos, (counts.get(t.player.pos) ?? 0) + 1);
      }
      for (const n of counts.values()) {
        expect(n).toBeLessThanOrEqual(RECOMMENDED_MAX_PER_POSITION);
      }
    }
  });

  it("regenerates the list for a pinned position, past the mixed-list cap", () => {
    // The mixed list caps each position at RECOMMENDED_MAX_PER_POSITION, so a
    // position filter must re-run the search (not just hide rows) to surface a
    // fuller list of that position.
    const league = windowLeague(2);
    const filtered = recommendedTransfers(league, 0, { position: "CB" });
    expect(filtered.length).toBeGreaterThan(0);
    for (const t of filtered) expect(t.player.pos).toBe("CB");
    // More CBs than the mixed list would ever show at that position.
    expect(filtered.length).toBeGreaterThan(RECOMMENDED_MAX_PER_POSITION);
  });

  it("applies numeric filters as hard candidate constraints", () => {
    const league = windowLeague(4);
    const targets = recommendedTransfers(league, 0, { minOvr: 70, maxAge: 25 });
    expect(targets.length).toBeGreaterThan(0);
    for (const t of targets) {
      expect(t.player.ovr).toBeGreaterThanOrEqual(70);
      expect(league.season - t.player.born).toBeLessThanOrEqual(25);
    }
  });

  it("is deterministic within a window", () => {
    const a = recommendedTransfers(windowLeague(3)).map((t) => t.player.pid);
    const b = recommendedTransfers(windowLeague(3)).map((t) => t.player.pid);
    expect(a).toEqual(b);
  });

  it("recommends players near the user's team level", () => {
    const league = windowLeague(4);
    const playerMap = new Map(league.players.map((p) => [p.pid, p]));
    const userOvrs = league.teams[0].roster
      .map((pid) => playerMap.get(pid)!.ovr)
      .sort((x, y) => y - x)
      .slice(0, 11);
    const xiAvg = userOvrs.reduce((s, v) => s + v, 0) / userOvrs.length;

    for (const t of recommendedTransfers(league)) {
      // Wider than the selection band to allow for the XI-average difference
      // between this rough estimate and the formation-based one.
      expect(Math.abs(t.player.ovr - xiAvg)).toBeLessThanOrEqual(14);
    }
  });

  it("drops a would-be target whose contract expires at the coming rollover", () => {
    const league: LeagueStore = {
      ...createLeagueState(0, mulberry32(8)),
      phase: "offseason",
    };
    const targets = recommendedTransfers(league);
    expect(targets.length).toBeGreaterThan(0);

    // He'd walk for free at Advance, so buying him would burn the fee.
    const pid = targets[0].player.pid;
    const expiring: LeagueStore = {
      ...league,
      players: league.players.map((p) =>
        p.pid === pid
          ? { ...p, contract: { ...p.contract, expiresSeason: league.season } }
          : p,
      ),
    };
    expect(recommendedTransfers(expiring).some((t) => t.player.pid === pid)).toBe(false);
  });

  it("surfaces better targets with max scouting than with none (across seeds)", () => {
    let spentBetter = 0;
    const seeds = [10, 11, 12, 13, 14, 15, 16, 17];
    for (const seed of seeds) {
      const avgTrueValue = (spend: number): number => {
        const league = windowLeague(seed, spend);
        const targets = recommendedTransfers(league);
        return (
          targets.reduce((s, t) => s + trueTransferValue(t.player, league.season), 0)
          / Math.max(1, targets.length)
        );
      };
      if (avgTrueValue(SCOUTING_SPEND_MAX) >= avgTrueValue(0)) spentBetter++;
    }
    // Good scouting should usually (not always — it's noise) find better players.
    expect(spentBetter).toBeGreaterThanOrEqual(5);
  });
});
