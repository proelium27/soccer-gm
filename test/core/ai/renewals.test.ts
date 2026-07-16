import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../../src/engine/rng.js";
import { createLeagueState } from "../../../src/core/leagueState.js";
import { runAIContractRenewals } from "../../../src/core/ai/renewals.js";
import { canExtend } from "../../../src/core/contracts.js";
import { ROSTER_COMPOSITION } from "../../../src/core/constants.js";
import type { StoredTeam } from "../../../src/core/teams/clubs.js";
import type { Player } from "../../../src/core/players/types.js";

const USER_TID = 0;

describe("runAIContractRenewals", () => {
  it("renews a clear keeper: a big upgrade at a thin position, in his prime, on a rich club", () => {
    const league = createLeagueState(USER_TID, mulberry32(21));
    const nextSeason = league.season + 1;
    const tid = 1;
    const team = league.teams.find((t) => t.tid === tid)!;

    const target = league.players
      .filter((p) => p.pos === "CM" && team.roster.includes(p.pid))
      .sort((a, b) => b.ovr - a.ovr)[0];
    const players = league.players.map((p) =>
      p.pid === target.pid
        ? { ...p, born: nextSeason - 26, ovr: 90, contract: { ...p.contract, expiresSeason: nextSeason } }
        : p,
    );
    const teams: StoredTeam[] = league.teams.map((t) => {
      if (t.tid !== tid) return t;
      const otherCms = new Set(
        players.filter((p) => p.pos === "CM" && p.pid !== target.pid && t.roster.includes(p.pid)).map((p) => p.pid),
      );
      return { ...t, budget: 300_000_000, roster: t.roster.filter((pid) => !otherCms.has(pid)) };
    });

    const result = runAIContractRenewals(teams, players, nextSeason, USER_TID, league.played, 42, league.competitions);
    const renewed = result.players.find((p) => p.pid === target.pid)!;
    expect(renewed.contract.expiresSeason).toBeGreaterThan(nextSeason);
  });

  it("does not renew a clearly expendable player: heavy surplus, old, low ovr, poor club", () => {
    const league = createLeagueState(USER_TID, mulberry32(22));
    const nextSeason = league.season + 1;
    const tid = 2;
    const team = league.teams.find((t) => t.tid === tid)!;

    const target = league.players.find((p) => p.pos === "FB" && team.roster.includes(p.pid))!;
    let players = league.players.map((p) =>
      p.pid === target.pid
        ? { ...p, born: nextSeason - 35, ovr: 45, contract: { ...p.contract, expiresSeason: nextSeason } }
        : p,
    );
    const filler: Player[] = Array.from({ length: 10 }, (_, i) => ({
      ...players.find((p) => p.pos === "FB")!,
      pid: 900_000 + i,
      ovr: 70,
      born: nextSeason - 24,
      contract: { salary: 1, expiresSeason: nextSeason + 5 },
    }));
    players = [...players, ...filler];
    const teams: StoredTeam[] = league.teams.map((t) =>
      t.tid === tid
        ? { ...t, budget: 0, roster: [...t.roster, ...filler.map((p) => p.pid)] }
        : t,
    );

    const result = runAIContractRenewals(teams, players, nextSeason, USER_TID, league.played, 42, league.competitions);
    const untouched = result.players.find((p) => p.pid === target.pid)!;
    expect(untouched.contract.expiresSeason).toBe(nextSeason);
  });

  it("leaves a player with more than one season left on his deal untouched", () => {
    const league = createLeagueState(USER_TID, mulberry32(23));
    const nextSeason = league.season + 1;
    const tid = 1;
    const target = league.players.find((p) =>
      league.teams.find((t) => t.tid === tid)!.roster.includes(p.pid),
    )!;
    const players = league.players.map((p) =>
      p.pid === target.pid
        ? { ...p, contract: { ...p.contract, expiresSeason: nextSeason + 3 } }
        : p,
    );
    expect(canExtend(players.find((p) => p.pid === target.pid)!, nextSeason)).toBe(false);

    const result = runAIContractRenewals(league.teams, players, nextSeason, USER_TID, league.played, 42, league.competitions);
    expect(result.players.find((p) => p.pid === target.pid)).toEqual(
      players.find((p) => p.pid === target.pid),
    );
  });

  it("never touches the user's team", () => {
    const league = createLeagueState(USER_TID, mulberry32(24));
    const nextSeason = league.season + 1;
    const userTeam = league.teams.find((t) => t.tid === USER_TID)!;
    const players = league.players.map((p) =>
      userTeam.roster.includes(p.pid)
        ? { ...p, contract: { ...p.contract, expiresSeason: nextSeason } }
        : p,
    );

    const result = runAIContractRenewals(league.teams, players, nextSeason, USER_TID, league.played, 42, league.competitions);
    for (const pid of userTeam.roster) {
      expect(result.players.find((p) => p.pid === pid)).toEqual(players.find((p) => p.pid === pid));
    }
  });

  it("is deterministic for the same inputs", () => {
    const league = createLeagueState(USER_TID, mulberry32(25));
    const nextSeason = league.season + 1;
    const players = league.players.map((p) => ({
      ...p,
      contract: { ...p.contract, expiresSeason: nextSeason },
    }));

    const a = runAIContractRenewals(league.teams, players, nextSeason, USER_TID, league.played, 42, league.competitions);
    const b = runAIContractRenewals(league.teams, players, nextSeason, USER_TID, league.played, 42, league.competitions);
    expect(a.players).toEqual(b.players);
  });

  it("returns the same team objects untouched (only player contracts change)", () => {
    const league = createLeagueState(USER_TID, mulberry32(26));
    const nextSeason = league.season + 1;
    const result = runAIContractRenewals(league.teams, league.players, nextSeason, USER_TID, league.played, 42, league.competitions);
    expect(result.teams).toBe(league.teams);
  });

  it("every ROSTER_COMPOSITION position is representable without crashing on a full league", () => {
    const league = createLeagueState(USER_TID, mulberry32(27));
    const nextSeason = league.season + 1;
    const players = league.players.map((p) => ({
      ...p,
      contract: { ...p.contract, expiresSeason: nextSeason },
    }));
    expect(() =>
      runAIContractRenewals(league.teams, players, nextSeason, USER_TID, league.played, 42, league.competitions),
    ).not.toThrow();
    expect(Object.keys(ROSTER_COMPOSITION).length).toBeGreaterThan(0);
  });
});
