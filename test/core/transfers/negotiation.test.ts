import { describe, it, expect } from "vitest";
import {
  respondToOffer, reservationPrice, scoutedValue, isForSale, windowSeed,
  makeTransferOffer, acceptCounterOffer, currentNegotiations,
} from "../../../src/core/transfers/negotiation.js";
import { transferWindowState } from "../../../src/core/transfers/window.js";
import { trueTransferValue } from "../../../src/core/finance/valuation.js";
import { createLeagueState, type LeagueStore } from "../../../src/core/leagueState.js";
import { mulberry32 } from "../../../src/engine/rng.js";
import {
  RESERVATION_FACTOR_MIN, RESERVATION_FACTOR_MAX,
  NEGOTIATION_LOWBALL_FACTOR, NEGOTIATION_MAX_ROUNDS,
  SCOUTING_SPEND_MAX,
} from "../../../src/core/constants.js";

/** A league sitting in the winter window with a rich user club. */
function windowLeague(seed = 1): LeagueStore {
  const league = createLeagueState(0, mulberry32(seed));
  return {
    ...league,
    schedule: league.schedule.filter((g) => g.matchday >= 20),
    teams: league.teams.map((t) =>
      t.tid === 0 ? { ...t, budget: 500_000_000 } : t,
    ),
  };
}

function firstTarget(league: LeagueStore): { pid: number; sellerTid: number } {
  const seller = league.teams[1];
  const playerMap = new Map(league.players.map((p) => [p.pid, p]));
  const pid = seller.roster.find((q) => isForSale(seller, playerMap, q))!;
  return { pid, sellerTid: seller.tid };
}

describe("respondToOffer", () => {
  const reservation = 10_000_000;

  it("accepts any offer at or above the reservation price", () => {
    expect(respondToOffer(reservation, reservation, [])).toEqual({
      kind: "accepted", fee: reservation,
    });
    expect(respondToOffer(reservation, reservation * 2, []).kind).toBe("accepted");
  });

  it("ends talks outright on a way-off lowball", () => {
    const lowball = reservation * NEGOTIATION_LOWBALL_FACTOR - 1;
    expect(respondToOffer(reservation, lowball, [])).toEqual({ kind: "collapsed" });
  });

  it("counters a reasonable-but-low offer, above the reservation price", () => {
    const outcome = respondToOffer(reservation, reservation * 0.8, []);
    expect(outcome.kind).toBe("countered");
    if (outcome.kind === "countered") {
      expect(outcome.counter).toBeGreaterThan(reservation);
    }
  });

  it("converges counters toward the reservation price over rounds", () => {
    const first = respondToOffer(reservation, reservation * 0.7, []);
    const second = respondToOffer(reservation, reservation * 0.8, [reservation * 0.7]);
    if (first.kind !== "countered" || second.kind !== "countered") {
      throw new Error("expected counters");
    }
    expect(second.counter).toBeLessThan(first.counter);
    expect(second.counter).toBeGreaterThan(reservation);
  });

  it("ends talks when a new offer does not improve on the previous one", () => {
    const offer = reservation * 0.8;
    expect(respondToOffer(reservation, offer, [offer])).toEqual({ kind: "collapsed" });
    expect(respondToOffer(reservation, offer - 1, [offer])).toEqual({ kind: "collapsed" });
  });

  it("runs out of patience after the max number of rounds", () => {
    const priors = Array.from(
      { length: NEGOTIATION_MAX_ROUNDS - 1 },
      (_, i) => reservation * (0.7 + i * 0.01),
    );
    const offer = reservation * 0.9;
    expect(respondToOffer(reservation, offer, priors)).toEqual({ kind: "collapsed" });
  });
});

describe("reservationPrice / scoutedValue", () => {
  it("stays within the configured factor band around true value", () => {
    const league = windowLeague();
    for (const p of league.players.slice(0, 50)) {
      const trueVal = trueTransferValue(p, league.season);
      const res = reservationPrice(league.lid, league.season, "winter", p);
      expect(res).toBeGreaterThanOrEqual(Math.floor(trueVal * RESERVATION_FACTOR_MIN));
      expect(res).toBeLessThanOrEqual(Math.ceil(trueVal * RESERVATION_FACTOR_MAX));
    }
  });

  it("is deterministic within a window and differs across windows", () => {
    const league = windowLeague();
    const p = league.players[0];
    const a = reservationPrice(league.lid, league.season, "winter", p);
    const b = reservationPrice(league.lid, league.season, "winter", p);
    expect(a).toBe(b);
    const summer = reservationPrice(league.lid, league.season, "summer", p);
    expect(summer).not.toBe(a);
  });

  it("scoutedValue tightens toward true value with max scouting spend", () => {
    const league = windowLeague();
    let errZero = 0;
    let errMax = 0;
    for (const p of league.players.slice(0, 100)) {
      const trueVal = trueTransferValue(p, league.season);
      if (trueVal === 0) continue;
      errZero += Math.abs(scoutedValue(league.lid, league.season, "winter", p, 0) - trueVal) / trueVal;
      errMax += Math.abs(scoutedValue(league.lid, league.season, "winter", p, SCOUTING_SPEND_MAX) - trueVal) / trueVal;
    }
    expect(errMax).toBeLessThan(errZero);
  });

  it("windowSeed varies with every component", () => {
    const base = windowSeed(0, 1, "winter", 5, 1);
    expect(windowSeed(1, 1, "winter", 5, 1)).not.toBe(base);
    expect(windowSeed(0, 2, "winter", 5, 1)).not.toBe(base);
    expect(windowSeed(0, 1, "summer", 5, 1)).not.toBe(base);
    expect(windowSeed(0, 1, "winter", 6, 1)).not.toBe(base);
    expect(windowSeed(0, 1, "winter", 5, 2)).not.toBe(base);
  });
});

describe("isForSale", () => {
  it("refuses to sell below half the target complement at a position", () => {
    const league = windowLeague();
    const seller = league.teams[1];
    const playerMap = new Map(league.players.map((p) => [p.pid, p]));
    const gks = seller.roster.filter((pid) => playerMap.get(pid)?.pos === "GK");
    // Full complement (3 GKs): selling one leaves 2 = ceil(3/2), allowed.
    expect(isForSale(seller, playerMap, gks[0])).toBe(true);
    // Down to 2 GKs: selling one would leave 1 < 2, refused.
    const thinned = { ...seller, roster: seller.roster.filter((pid) => pid !== gks[0]) };
    expect(isForSale(thinned, playerMap, gks[1])).toBe(false);
  });

  it("is false for players not on the club's roster", () => {
    const league = windowLeague();
    const playerMap = new Map(league.players.map((p) => [p.pid, p]));
    const otherClubsPid = league.teams[2].roster[0];
    expect(isForSale(league.teams[1], playerMap, otherClubsPid)).toBe(false);
  });
});

describe("makeTransferOffer / acceptCounterOffer", () => {
  it("executes an accepted offer: rosters swap, money is conserved, contract survives", () => {
    const league = windowLeague();
    const { pid, sellerTid } = firstTarget(league);
    const player = league.players.find((p) => p.pid === pid)!;
    const reservation = reservationPrice(league.lid, league.season, "winter", player);
    const before = league.teams.reduce((s, t) => s + t.budget, 0);
    const contractBefore = { ...player.contract };

    const after = makeTransferOffer(league, pid, reservation);

    const user = after.teams.find((t) => t.tid === 0)!;
    const seller = after.teams.find((t) => t.tid === sellerTid)!;
    expect(user.roster).toContain(pid);
    expect(seller.roster).not.toContain(pid);
    expect(user.budget).toBe(500_000_000 - reservation);
    expect(after.teams.reduce((s, t) => s + t.budget, 0)).toBe(before);
    expect(after.players.find((p) => p.pid === pid)!.contract).toEqual(contractBefore);
    expect(after.transfers).toHaveLength(1);
    expect(after.transfers[0]).toMatchObject({ pid, fromTid: sellerTid, toTid: 0, fee: reservation });
    expect(currentNegotiations(after)[0]).toMatchObject({ pid, status: "accepted" });
  });

  it("records a counter for a low-but-reasonable offer, and accepting it completes the deal", () => {
    const league = windowLeague();
    const { pid } = firstTarget(league);
    const player = league.players.find((p) => p.pid === pid)!;
    const reservation = reservationPrice(league.lid, league.season, "winter", player);

    const countered = makeTransferOffer(league, pid, Math.round(reservation * 0.8));
    const negotiation = currentNegotiations(countered)[0];
    expect(negotiation).toMatchObject({ pid, status: "open" });
    expect(negotiation.counter).toBeGreaterThan(reservation);

    const done = acceptCounterOffer(countered, pid);
    expect(done.teams.find((t) => t.tid === 0)!.roster).toContain(pid);
    expect(done.transfers[0].fee).toBe(negotiation.counter);
  });

  it("keeps talks collapsed for the rest of the window", () => {
    const league = windowLeague();
    const { pid } = firstTarget(league);
    const player = league.players.find((p) => p.pid === pid)!;
    const reservation = reservationPrice(league.lid, league.season, "winter", player);

    const collapsed = makeTransferOffer(league, pid, Math.max(1, Math.round(reservation * 0.1)));
    expect(currentNegotiations(collapsed)[0]).toMatchObject({ pid, status: "collapsed" });

    // Even a full-price follow-up is ignored this window.
    const retry = makeTransferOffer(collapsed, pid, reservation * 2);
    expect(retry).toBe(collapsed);
  });

  it("is a no-op outside a window, over budget, or for the user's own player", () => {
    const closed = { ...windowLeague(), schedule: createLeagueState(0, mulberry32(1)).schedule.filter((g) => g.matchday >= 10) };
    expect(transferWindowState(closed).open).toBe(false);
    const { pid } = firstTarget(closed);
    expect(makeTransferOffer(closed, pid, 1_000_000)).toBe(closed);

    const league = windowLeague();
    const poor = {
      ...league,
      teams: league.teams.map((t) => (t.tid === 0 ? { ...t, budget: 1000 } : t)),
    };
    const target = firstTarget(poor);
    expect(makeTransferOffer(poor, target.pid, 1_000_000)).toBe(poor);

    const ownPid = league.teams[0].roster[0];
    expect(makeTransferOffer(league, ownPid, 1_000_000)).toBe(league);
  });

  it("re-checks the depth floor when accepting a counter", () => {
    const league = windowLeague();
    const seller = league.teams[1];
    const playerMap = new Map(league.players.map((p) => [p.pid, p]));
    const gks = seller.roster.filter((q) => playerMap.get(q)?.pos === "GK");
    const pid = gks[0];
    expect(isForSale(seller, playerMap, pid)).toBe(true);

    const player = league.players.find((p) => p.pid === pid)!;
    const reservation = reservationPrice(league.lid, league.season, "winter", player);
    const countered = makeTransferOffer(league, pid, Math.round(reservation * 0.8));
    expect(currentNegotiations(countered)[0]).toMatchObject({ pid, status: "open" });

    // Another GK leaves the seller while the counter sits on the table; the
    // sale would now strip the club below the depth floor, so accepting it
    // must be refused rather than executed.
    const thinned = {
      ...countered,
      teams: countered.teams.map((t) =>
        t.tid === seller.tid ? { ...t, roster: t.roster.filter((q) => q !== gks[1]) } : t,
      ),
    };
    expect(acceptCounterOffer(thinned, pid)).toBe(thinned);
  });

  it("cannot accept a counter the budget no longer covers", () => {
    const league = windowLeague();
    const { pid } = firstTarget(league);
    const player = league.players.find((p) => p.pid === pid)!;
    const reservation = reservationPrice(league.lid, league.season, "winter", player);

    const countered = makeTransferOffer(league, pid, Math.round(reservation * 0.8));
    const negotiation = currentNegotiations(countered)[0];
    const broke = {
      ...countered,
      teams: countered.teams.map((t) =>
        t.tid === 0 ? { ...t, budget: negotiation.counter! - 1 } : t,
      ),
    };
    expect(acceptCounterOffer(broke, pid)).toBe(broke);
  });
});

describe("the summer window across the season rollover", () => {
  /** A league in the offseason phase (next season's schedule already drawn). */
  function offseasonLeague(seed = 6): LeagueStore {
    const league = createLeagueState(0, mulberry32(seed));
    return {
      ...league,
      phase: "offseason",
      teams: league.teams.map((t) =>
        t.tid === 0 ? { ...t, budget: 500_000_000 } : t,
      ),
    };
  }

  it("keeps negotiations, prices, and the transfer log intact through Advance", () => {
    const league = offseasonLeague();
    const { pid } = firstTarget(league);
    const player = league.players.find((p) => p.pid === pid)!;
    const ws = transferWindowState(league);
    if (!ws.open) throw new Error("expected an open summer window");
    const reservation = reservationPrice(league.lid, ws.season, "summer", player);

    const countered = makeTransferOffer(league, pid, Math.round(reservation * 0.8));
    const negotiation = currentNegotiations(countered)[0];
    expect(negotiation).toMatchObject({ pid, status: "open", season: league.season + 1 });

    // What Advance does to the calendar: new season, back to regular play
    // with matchday 1 up next — the same summer window, so nothing rerolls.
    const advanced: LeagueStore = {
      ...countered,
      season: countered.season + 1,
      phase: "regular",
    };
    expect(currentNegotiations(advanced)).toEqual([negotiation]);

    const done = acceptCounterOffer(advanced, pid);
    expect(done.teams.find((t) => t.tid === 0)!.roster).toContain(pid);
    expect(done.transfers[0].fee).toBe(negotiation.counter);
    // The completed deal is attributed to the same window identity.
    expect(done.transfers[0].season).toBe(negotiation.season);
  });

  it("won't sell a player whose contract expires at the coming rollover", () => {
    const league = offseasonLeague();
    const { pid } = firstTarget(league);
    const expiring: LeagueStore = {
      ...league,
      players: league.players.map((p) =>
        p.pid === pid
          ? { ...p, contract: { ...p.contract, expiresSeason: league.season } }
          : p,
      ),
    };
    // He walks for free days from now; a full-budget offer is still refused.
    expect(makeTransferOffer(expiring, pid, 500_000_000)).toBe(expiring);
  });
});
