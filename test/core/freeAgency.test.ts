import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { createLeagueState } from "../../src/core/leagueState.js";
import {
  freeAgentPids, releaseExpiredContracts, runAIFreeAgency, signFreeAgent,
} from "../../src/core/freeAgency.js";
import { ROSTER_COMPOSITION, ROSTER_CAP } from "../../src/core/constants.js";

describe("freeAgentPids", () => {
  it("is empty when every player is rostered", () => {
    const league = createLeagueState(0, mulberry32(1));
    expect(freeAgentPids(league.teams, league.players).size).toBe(0);
  });
});

describe("releaseExpiredContracts", () => {
  it("removes players with expired contracts from every roster", () => {
    const league = createLeagueState(0, mulberry32(1));
    const someTeam = league.teams[0];
    const pid = someTeam.roster[0];
    const player = league.players.find((p) => p.pid === pid)!;
    player.contract.expiresSeason = 1; // force expiry at season 1

    const teams = releaseExpiredContracts(league.teams, league.players, 1);
    const updatedTeam = teams.find((t) => t.tid === someTeam.tid)!;
    expect(updatedTeam.roster).not.toContain(pid);
    expect(freeAgentPids(teams, league.players).has(pid)).toBe(true);
  });
});

describe("runAIFreeAgency", () => {
  it("fills a positional shortfall for a non-user team from the free agent pool", () => {
    const league = createLeagueState(0, mulberry32(2));
    const targetTid = 1;
    const target = league.teams.find((t) => t.tid === targetTid)!;

    // Force-release all GKs from the target team, leaving a shortfall.
    const gkPids = new Set(
      league.players.filter((p) => p.pos === "GK" && target.roster.includes(p.pid)).map((p) => p.pid),
    );
    const teams = league.teams.map((t) =>
      t.tid === targetTid ? { ...t, roster: t.roster.filter((pid) => !gkPids.has(pid)) } : t,
    );

    const signingOrder = teams.map((t) => t.tid);
    const rng = mulberry32(3);
    const { teams: updatedTeams, players: updatedPlayers } = runAIFreeAgency(
      teams, league.players, 2, rng, /* userTid */ -1, signingOrder,
    );

    const updatedTarget = updatedTeams.find((t) => t.tid === targetTid)!;
    const playerMap = new Map(updatedPlayers.map((p) => [p.pid, p]));
    const gkCount = updatedTarget.roster.filter((pid) => playerMap.get(pid)?.pos === "GK").length;
    expect(gkCount).toBe(ROSTER_COMPOSITION.GK);
  });

  it("never signs a free agent to the user's team", () => {
    const league = createLeagueState(0, mulberry32(4));
    const userTid = 0;
    const rosterBefore = new Set(league.teams.find((t) => t.tid === userTid)!.roster);

    // Free up some players league-wide.
    const players = league.players.map((p, i) =>
      i % 20 === 0 ? { ...p, contract: { ...p.contract, expiresSeason: 1 } } : p,
    );
    const teams = releaseExpiredContracts(league.teams, players, 1);
    const signingOrder = teams.map((t) => t.tid);

    const { teams: updatedTeams } = runAIFreeAgency(
      teams, players, 2, mulberry32(5), userTid, signingOrder,
    );
    const updatedUser = updatedTeams.find((t) => t.tid === userTid)!;
    // Every pid still on the user's roster was there before; nothing new was signed.
    for (const pid of updatedUser.roster) expect(rosterBefore.has(pid)).toBe(true);
  });

  it("never signs the same free agent to two different teams", () => {
    const league = createLeagueState(0, mulberry32(6));
    const signingOrder = league.teams.map((t) => t.tid);
    const { teams } = runAIFreeAgency(
      league.teams, league.players, 2, mulberry32(7), -1, signingOrder,
    );
    const allPids = teams.flatMap((t) => t.roster);
    expect(new Set(allPids).size).toBe(allPids.length);
  });
});

describe("signFreeAgent", () => {
  it("adds a free agent to the given team's roster with a fresh contract", () => {
    const league = createLeagueState(0, mulberry32(8));
    const pid = league.teams[1].roster[0];
    const player = league.players.find((p) => p.pid === pid)!;
    player.contract.expiresSeason = 1;
    const teams = releaseExpiredContracts(league.teams, league.players, 1);

    const { teams: signedTeams, players: signedPlayers } = signFreeAgent(
      teams, league.players, 0, pid, 1,
    );
    expect(signedTeams.find((t) => t.tid === 0)!.roster).toContain(pid);
    const signed = signedPlayers.find((p) => p.pid === pid)!;
    expect(signed.contract.expiresSeason).toBeGreaterThan(1);
  });

  it("is a no-op if the pid is not actually a free agent", () => {
    const league = createLeagueState(0, mulberry32(10));
    const pid = league.teams[2].roster[0]; // still rostered on team 2
    const result = signFreeAgent(league.teams, league.players, 0, pid, 1);
    expect(result.teams).toBe(league.teams);
    expect(result.players).toBe(league.players);
  });

  it("is a no-op if the signing team is already at ROSTER_CAP", () => {
    const league = createLeagueState(0, mulberry32(11));
    const pid = league.teams[1].roster[0];
    const player = league.players.find((p) => p.pid === pid)!;
    player.contract.expiresSeason = 1;
    let teams = releaseExpiredContracts(league.teams, league.players, 1);

    // Pad team 0's roster up to the cap with fabricated pids.
    teams = teams.map((t) =>
      t.tid === 0
        ? { ...t, roster: [...t.roster, ...Array.from(
            { length: ROSTER_CAP - t.roster.length }, (_, i) => 100_000 + i,
          )] }
        : t,
    );
    expect(teams.find((t) => t.tid === 0)!.roster.length).toBe(ROSTER_CAP);

    const result = signFreeAgent(teams, league.players, 0, pid, 1);
    expect(result.teams).toBe(teams);
    expect(result.players).toBe(league.players);
  });
});
