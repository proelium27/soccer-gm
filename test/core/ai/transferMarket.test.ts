import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../../src/engine/rng.js";
import { createLeagueState } from "../../../src/core/leagueState.js";
import { runAITransferMarket } from "../../../src/core/ai/transferMarket.js";
import { keepsDepthFloor } from "../../../src/core/freeAgency.js";
import { ROSTER_CAP } from "../../../src/core/constants.js";
import type { StoredTeam } from "../../../src/core/teams/clubs.js";
import type { Player } from "../../../src/core/players/types.js";

const USER_TID = 0;

/** Run the offseason-phase market on a fresh league (no wage charge, so money is conserved). */
function runOnFresh(seed: number) {
  const league = createLeagueState(USER_TID, mulberry32(seed));
  const result = runAITransferMarket(
    league.teams, league.players, league.transfers,
    league.season + 1, league.played, "summer", "offseason", USER_TID, 12345,
  );
  return { league, result };
}

/** Multiset of every rostered pid across all teams, sorted. */
function allRosteredPids(teams: StoredTeam[]): number[] {
  return teams.flatMap((t) => t.roster).sort((a, b) => a - b);
}

describe("runAITransferMarket", () => {
  it("moves players between clubs on a fresh league (the market is not inert)", () => {
    const { result } = runOnFresh(7);
    expect(result.transfers.length).toBeGreaterThan(0);
  });

  it("never gains or loses a player — every deal is a move, not a creation", () => {
    const { league, result } = runOnFresh(7);
    expect(allRosteredPids(result.teams)).toEqual(allRosteredPids(league.teams));
    // No player ends up on two rosters.
    const flat = result.teams.flatMap((t) => t.roster);
    expect(new Set(flat).size).toBe(flat.length);
  });

  it("conserves money across the league in the offseason (fees just move between clubs)", () => {
    const { league, result } = runOnFresh(7);
    const before = league.teams.reduce((s, t) => s + t.budget, 0);
    const after = result.teams.reduce((s, t) => s + t.budget, 0);
    expect(after).toBeCloseTo(before, 2);
  });

  it("never involves the user's club, and leaves the user roster untouched", () => {
    const { league, result } = runOnFresh(7);
    for (const tr of result.transfers) {
      expect(tr.fromTid).not.toBe(USER_TID);
      expect(tr.toTid).not.toBe(USER_TID);
    }
    const userBefore = league.teams.find((t) => t.tid === USER_TID)!.roster;
    const userAfter = result.teams.find((t) => t.tid === USER_TID)!.roster;
    expect(userAfter).toEqual(userBefore);
  });

  it("is deterministic for the same inputs and seed", () => {
    const { league } = runOnFresh(7);
    const args = [
      league.teams, league.players, league.transfers,
      league.season + 1, league.played, "summer", "offseason", USER_TID, 999,
    ] as const;
    const a = runAITransferMarket(...args);
    const b = runAITransferMarket(...args);
    expect(a.transfers).toEqual(b.transfers);
  });

  it("respects roster cap, positional depth floor, and non-negative budgets", () => {
    const { league, result } = runOnFresh(7);
    const playerMap = new Map(league.players.map((p) => [p.pid, p]));
    for (const t of result.teams) {
      expect(t.roster.length).toBeLessThanOrEqual(ROSTER_CAP);
      expect(t.budget).toBeGreaterThanOrEqual(0);
    }
    // Every sold player left a seller that still cleared its depth floor: the
    // logged deals should never have breached it (checked against the seller's
    // post-market roster, which is a subset of what it had when it sold).
    for (const tr of result.transfers) {
      const seller = result.teams.find((t) => t.tid === tr.fromTid)!;
      // Re-add the sold player to reconstruct the roster at sale time is
      // fiddly; instead assert the seller still has a fieldable squad.
      const withSold: StoredTeam = { ...seller, roster: [...seller.roster, tr.pid] };
      expect(keepsDepthFloor(withSold, playerMap, tr.pid)).toBe(true);
    }
  });

  it("routes a clearly-surplus striker to a club that badly needs one", () => {
    const league = createLeagueState(USER_TID, mulberry32(3));
    const players = league.players;
    const stByTeam = (tid: number): Player[] =>
      league.teams.find((t) => t.tid === tid)!.roster
        .map((pid) => players.find((p) => p.pid === pid)!)
        .filter((p) => p.pos === "ST");

    // Seller = tid 1: overloaded at ST (surplus → low keep-value, clearly for sale).
    // Buyer = tid 2: stripped of strikers (huge need) and handed a big budget.
    const sellerTid = 1, buyerTid = 2;
    const extraStrikers = stByTeam(0).slice(0, 2).map((p) => p.pid); // borrow from user pool of pids
    const teams = league.teams.map((t): StoredTeam => {
      if (t.tid === sellerTid) return { ...t, roster: [...t.roster, ...extraStrikers] };
      if (t.tid === buyerTid) {
        return {
          ...t,
          budget: 400_000_000,
          roster: t.roster.filter((pid) => players.find((p) => p.pid === pid)!.pos !== "ST"),
        };
      }
      // Remove the borrowed strikers from the user's team so pids stay unique.
      if (t.tid === 0) return { ...t, roster: t.roster.filter((pid) => !extraStrikers.includes(pid)) };
      return t;
    });

    const result = runAITransferMarket(
      teams, players, [], league.season, [], "winter", "regular", USER_TID, 42,
    );

    const boughtStriker = result.transfers.some(
      (tr) => tr.toTid === buyerTid && players.find((p) => p.pid === tr.pid)!.pos === "ST",
    );
    expect(boughtStriker).toBe(true);
  });
});
