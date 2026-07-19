import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../../src/engine/rng.js";
import { createLeagueState } from "../../../src/core/leagueState.js";
import { enforceDivision2Ceiling } from "../../../src/core/ai/divisionCeiling.js";
import { ROSTER_CAP, DIVISION_2_REFUSAL_OVR_THRESHOLD } from "../../../src/core/constants.js";
import { tierOf } from "../../../src/core/competitions.js";

const USER_TID = 0;

describe("enforceDivision2Ceiling", () => {
  it("moves an AI Division 2 player at/above the OVR threshold to a Division 1 club", () => {
    const league = createLeagueState(USER_TID, mulberry32(11));
    const d2Team = league.teams.find((t) => t.compId === 1 && t.tid !== USER_TID)!;
    const target = league.players.find((p) => d2Team.roster.includes(p.pid))!;
    const star = { ...target, ovr: DIVISION_2_REFUSAL_OVR_THRESHOLD };
    const players = league.players.map((p) => (p.pid === target.pid ? star : p));

    const { teams, transfers } = enforceDivision2Ceiling(
      league.teams, players, league.activeLoans, league.transfers, league.season, USER_TID, league.competitions,
    );
    const newTeam = teams.find((t) => t.roster.includes(star.pid))!;
    // The receiving pool is every tier-1 club worldwide (not just England's),
    // so the destination competition can be any country's Division 1.
    expect(tierOf(league.competitions, newTeam.compId)).toBe(1);
    expect(newTeam.tid).not.toBe(USER_TID);
    expect(transfers.some((t) => t.pid === star.pid && t.fee > 0)).toBe(true);
  });

  it("charges the buyer the market fee and credits the seller", () => {
    const league = createLeagueState(USER_TID, mulberry32(11));
    const d2Team = league.teams.find((t) => t.compId === 1 && t.tid !== USER_TID)!;
    const target = league.players.find((p) => d2Team.roster.includes(p.pid))!;
    const star = { ...target, ovr: DIVISION_2_REFUSAL_OVR_THRESHOLD };
    const players = league.players.map((p) => (p.pid === target.pid ? star : p));

    const { teams, transfers } = enforceDivision2Ceiling(
      league.teams, players, league.activeLoans, league.transfers, league.season, USER_TID, league.competitions,
    );
    const deal = transfers.find((t) => t.pid === star.pid)!;
    const buyerBefore = league.teams.find((t) => t.tid === deal.toTid)!;
    const buyerAfter = teams.find((t) => t.tid === deal.toTid)!;
    const sellerBefore = league.teams.find((t) => t.tid === deal.fromTid)!;
    const sellerAfter = teams.find((t) => t.tid === deal.fromTid)!;

    expect(deal.fee).toBeGreaterThan(0);
    expect(deal.fee).toBeLessThanOrEqual(buyerBefore.budget);
    expect(buyerAfter.budget).toBe(buyerBefore.budget - deal.fee);
    expect(sellerAfter.budget).toBeGreaterThan(sellerBefore.budget);
  });

  it("never pushes the buyer's budget negative even when it can't afford the full fee", () => {
    const league = createLeagueState(USER_TID, mulberry32(11));
    const d2Team = league.teams.find((t) => t.compId === 1 && t.tid !== USER_TID)!;
    const target = league.players.find((p) => d2Team.roster.includes(p.pid))!;
    const star = { ...target, ovr: 90 };
    const players = league.players.map((p) => (p.pid === target.pid ? star : p));
    // Impoverish every Division 1 club worldwide (any tier-1 competition,
    // not just England's) so no buyer can afford a 90-ovr fee.
    const teams = league.teams.map((t) =>
      tierOf(league.competitions, t.compId) === 1 ? { ...t, budget: 1000 } : t,
    );

    const { teams: updated, transfers } = enforceDivision2Ceiling(
      teams, players, league.activeLoans, league.transfers, league.season, USER_TID, league.competitions,
    );
    const deal = transfers.find((t) => t.pid === star.pid)!;
    expect(deal.fee).toBe(1000);
    for (const t of updated) expect(t.budget).toBeGreaterThanOrEqual(0);
    // The move itself still happens regardless of affordability.
    expect(tierOf(league.competitions, updated.find((t) => t.roster.includes(star.pid))!.compId)).toBe(1);
  });

  it("leaves a Division 2 player below the threshold in place", () => {
    const league = createLeagueState(USER_TID, mulberry32(11));
    const d2Team = league.teams.find((t) => t.compId === 1 && t.tid !== USER_TID)!;
    const target = league.players.find((p) => d2Team.roster.includes(p.pid))!;
    const weak = { ...target, ovr: DIVISION_2_REFUSAL_OVR_THRESHOLD - 1 };
    const players = league.players.map((p) => (p.pid === target.pid ? weak : p));

    const { teams } = enforceDivision2Ceiling(
      league.teams, players, league.activeLoans, league.transfers, league.season, USER_TID, league.competitions,
    );
    const team = teams.find((t) => t.roster.includes(weak.pid))!;
    expect(team.tid).toBe(d2Team.tid);
  });

  it("never moves a player off the user's own Division 2 roster", () => {
    const league = createLeagueState(USER_TID, mulberry32(11));
    const userTeam = league.teams.find((t) => t.tid === USER_TID)!;
    // Force the user's own club into Division 2 for this test.
    const teams = league.teams.map((t) => (t.tid === USER_TID ? { ...t, compId: 1 } : t));
    const target = league.players.find((p) => userTeam.roster.includes(p.pid))!;
    const star = { ...target, ovr: 95 };
    const players = league.players.map((p) => (p.pid === target.pid ? star : p));

    const { teams: updated } = enforceDivision2Ceiling(
      teams, players, league.activeLoans, league.transfers, league.season, USER_TID, league.competitions,
    );
    const team = updated.find((t) => t.roster.includes(star.pid))!;
    expect(team.tid).toBe(USER_TID);
  });

  it("never force-adds a player onto the user's Division 1 roster", () => {
    const league = createLeagueState(USER_TID, mulberry32(11));
    const d2Team = league.teams.find((t) => t.compId === 1 && t.tid !== USER_TID)!;
    const target = league.players.find((p) => d2Team.roster.includes(p.pid))!;
    const star = { ...target, ovr: 95 };
    const players = league.players.map((p) => (p.pid === target.pid ? star : p));

    const { teams } = enforceDivision2Ceiling(
      league.teams, players, league.activeLoans, league.transfers, league.season, USER_TID, league.competitions,
    );
    const userTeam = teams.find((t) => t.tid === USER_TID)!;
    expect(userTeam.roster.includes(star.pid)).toBe(false);
  });

  it("releases the receiving club's weakest player if it's already at ROSTER_CAP", () => {
    const league = createLeagueState(USER_TID, mulberry32(11));
    const d2Team = league.teams.find((t) => t.compId === 1 && t.tid !== USER_TID)!;
    const target = league.players.find((p) => d2Team.roster.includes(p.pid))!;
    const star = { ...target, ovr: 90 };
    let players = league.players.map((p) => (p.pid === target.pid ? star : p));

    // Pad the weakest Division 1 club worldwide (whichever ends up as the buyer) to ROSTER_CAP.
    const d1TeamsByOvr = league.teams
      .filter((t) => tierOf(league.competitions, t.compId) === 1 && t.tid !== USER_TID)
      .map((t) => {
        const ovrs = t.roster.map((pid) => league.players.find((p) => p.pid === pid)!.ovr);
        return { tid: t.tid, avg: ovrs.reduce((s, o) => s + o, 0) / ovrs.length };
      })
      .sort((a, b) => a.avg - b.avg);
    const weakestD1Tid = d1TeamsByOvr[0].tid;

    let nextPid = Math.max(...players.map((p) => p.pid)) + 1;
    const padPids: number[] = [];
    const filler = { ...league.players[0] };
    while (
      (league.teams.find((t) => t.tid === weakestD1Tid)!.roster.length + padPids.length) < ROSTER_CAP
    ) {
      const pid = nextPid++;
      players.push({ ...filler, pid, ovr: 1, pos: star.pos });
      padPids.push(pid);
    }
    const teams = league.teams.map((t) =>
      t.tid === weakestD1Tid ? { ...t, roster: [...t.roster, ...padPids] } : t,
    );
    expect(teams.find((t) => t.tid === weakestD1Tid)!.roster.length).toBe(ROSTER_CAP);

    const { teams: updated } = enforceDivision2Ceiling(
      teams, players, league.activeLoans, league.transfers, league.season, USER_TID, league.competitions,
    );
    const buyer = updated.find((t) => t.roster.includes(star.pid))!;
    expect(buyer.roster.length).toBeLessThanOrEqual(ROSTER_CAP);
  });

  it("never sweeps a player who is out on loan (a borrowed D2 player would be duplicated on loan return)", () => {
    const league = createLeagueState(USER_TID, mulberry32(11));
    const d2Team = league.teams.find((t) => t.compId === 1 && t.tid !== USER_TID)!;
    const target = league.players.find((p) => d2Team.roster.includes(p.pid))!;
    // Comfortably above the threshold — without the loan flag he'd be swept
    // (see the first test in this file), so this proves the guard, not luck.
    const star = { ...target, ovr: DIVISION_2_REFUSAL_OVR_THRESHOLD + 5 };
    const players = league.players.map((p) => (p.pid === target.pid ? star : p));
    // He's only on this D2 club on loan — owned by someone else, due back next
    // season — so the sweep must leave him where he is.
    const activeLoans = [{
      pid: star.pid, parentTid: -1, loaneeTid: d2Team.tid,
      startSeason: league.season, seasons: 1 as const, returnSeason: league.season + 1, fee: 0,
    }];

    const { teams, transfers } = enforceDivision2Ceiling(
      league.teams, players, activeLoans, league.transfers, league.season, USER_TID, league.competitions,
    );
    expect(teams.find((t) => t.roster.includes(star.pid))!.tid).toBe(d2Team.tid);
    expect(transfers.some((t) => t.pid === star.pid)).toBe(false);
  });

  it("is deterministic for the same inputs", () => {
    const league = createLeagueState(USER_TID, mulberry32(11));
    const d2Team = league.teams.find((t) => t.compId === 1 && t.tid !== USER_TID)!;
    const target = league.players.find((p) => d2Team.roster.includes(p.pid))!;
    const star = { ...target, ovr: 88 };
    const players = league.players.map((p) => (p.pid === target.pid ? star : p));

    const a = enforceDivision2Ceiling(league.teams, players, league.activeLoans, league.transfers, league.season, USER_TID, league.competitions);
    const b = enforceDivision2Ceiling(league.teams, players, league.activeLoans, league.transfers, league.season, USER_TID, league.competitions);
    expect(a.teams).toEqual(b.teams);
  });
});
