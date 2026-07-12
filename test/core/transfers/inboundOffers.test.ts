import { describe, it, expect } from "vitest";
import {
  inboundOfferCandidates, currentInboundOffers, respondToAsk,
  acceptInboundOffer, rejectInboundOffer, counterInboundOffer,
} from "../../../src/core/transfers/inboundOffers.js";
import { createLeagueState, type LeagueStore } from "../../../src/core/leagueState.js";
import { mulberry32 } from "../../../src/engine/rng.js";
import {
  NEGOTIATION_LOWBALL_FACTOR, NEGOTIATION_MAX_ROUNDS,
  AI_MARKET_MIN_SURPLUS, INBOUND_OFFERS_MAX,
} from "../../../src/core/constants.js";

/** A league sitting in the winter window (seed picked so the user gets inbound offers). */
function windowLeague(seed = 1): LeagueStore {
  const league = createLeagueState(0, mulberry32(seed));
  return { ...league, schedule: league.schedule.filter((g) => g.matchday >= 20) };
}

describe("respondToAsk", () => {
  const ceiling = 10_000_000;

  it("accepts any ask at or below the ceiling", () => {
    expect(respondToAsk(ceiling, ceiling, [])).toEqual({ kind: "accepted", fee: ceiling });
    expect(respondToAsk(ceiling, ceiling / 2, []).kind).toBe("accepted");
  });

  it("ends talks on a way-off ask (mirrors the lowball cutoff)", () => {
    const tooHigh = ceiling / NEGOTIATION_LOWBALL_FACTOR + 1;
    expect(respondToAsk(ceiling, tooHigh, [])).toEqual({ kind: "collapsed" });
  });

  it("counters a reasonable-but-high ask, below the ask but still above the ceiling floor logic", () => {
    const outcome = respondToAsk(ceiling, ceiling * 1.3, []);
    expect(outcome.kind).toBe("countered");
    if (outcome.kind === "countered") {
      expect(outcome.offer).toBeLessThan(ceiling * 1.3);
    }
  });

  it("converges counters toward the ceiling over rounds", () => {
    const first = respondToAsk(ceiling, ceiling * 1.3, []);
    const second = respondToAsk(ceiling, ceiling * 1.2, [ceiling * 1.3]);
    if (first.kind !== "countered" || second.kind !== "countered") {
      throw new Error("expected counters");
    }
    expect(second.offer).toBeGreaterThan(first.offer);
    expect(second.offer).toBeLessThan(ceiling);
  });

  it("ends talks when a new ask doesn't improve on the previous one", () => {
    const ask = ceiling * 1.3;
    expect(respondToAsk(ceiling, ask, [ask])).toEqual({ kind: "collapsed" });
    expect(respondToAsk(ceiling, ask + 1, [ask])).toEqual({ kind: "collapsed" });
  });

  it("runs out of patience after the max number of rounds", () => {
    const priors = Array.from(
      { length: NEGOTIATION_MAX_ROUNDS - 1 },
      (_, i) => ceiling * (1.3 - i * 0.01),
    );
    const ask = ceiling * 1.1;
    expect(respondToAsk(ceiling, ask, priors)).toEqual({ kind: "collapsed" });
  });
});

describe("inboundOfferCandidates", () => {
  it("is empty outside an open window", () => {
    const closed = { ...windowLeague(), schedule: createLeagueState(0, mulberry32(1)).schedule.filter((g) => g.matchday >= 10) };
    expect(inboundOfferCandidates(closed)).toEqual([]);
  });

  it("only offers on the user's own roster, clearing the min-surplus bar, capped at the max", () => {
    const league = windowLeague();
    const candidates = inboundOfferCandidates(league);
    expect(candidates.length).toBeLessThanOrEqual(INBOUND_OFFERS_MAX);
    const userRoster = new Set(league.teams.find((t) => t.tid === 0)!.roster);
    for (const c of candidates) {
      expect(userRoster.has(c.player.pid)).toBe(true);
      expect(c.buyerTid).not.toBe(0);
      expect(c.ceiling).toBeGreaterThanOrEqual(c.reservation * (1 + AI_MARKET_MIN_SURPLUS));
      expect(c.openingOffer).toBeGreaterThanOrEqual(Math.round(c.reservation));
      expect(c.openingOffer).toBeLessThanOrEqual(Math.round(c.ceiling));
    }
  });

  it("is deterministic within a window", () => {
    const league = windowLeague();
    expect(inboundOfferCandidates(league)).toEqual(inboundOfferCandidates(league));
  });
});

describe("acceptInboundOffer / rejectInboundOffer / counterInboundOffer", () => {
  it("accepting the opening offer executes the sale: roster moves, fee to user, wages to buyer", () => {
    const league = windowLeague();
    const candidate = inboundOfferCandidates(league)[0];
    const buyerBefore = league.teams.find((t) => t.tid === candidate.buyerTid)!.budget;
    const userBefore = league.teams.find((t) => t.tid === 0)!.budget;
    const player = league.players.find((p) => p.pid === candidate.player.pid)!;
    const contractBefore = { ...player.contract };

    const after = acceptInboundOffer(league, candidate.player.pid);

    const buyer = after.teams.find((t) => t.tid === candidate.buyerTid)!;
    const user = after.teams.find((t) => t.tid === 0)!;
    expect(buyer.roster).toContain(candidate.player.pid);
    expect(user.roster).not.toContain(candidate.player.pid);
    expect(user.budget).toBe(userBefore + candidate.openingOffer);
    // Winter window during the regular phase: buyer also eats the season wage.
    expect(buyer.budget).toBe(buyerBefore - candidate.openingOffer - player.contract.salary);
    expect(after.players.find((p) => p.pid === candidate.player.pid)!.contract).toEqual(contractBefore);
    expect(after.transfers).toHaveLength(1);
    expect(after.transfers[0]).toMatchObject({
      pid: candidate.player.pid, fromTid: 0, toTid: candidate.buyerTid, fee: candidate.openingOffer,
    });
    expect(currentInboundOffers(after)[0]).toMatchObject({ pid: candidate.player.pid, status: "accepted" });
  });

  it("rejecting persists so the same offer doesn't reappear as open", () => {
    const league = windowLeague();
    const candidate = inboundOfferCandidates(league)[0];

    const after = rejectInboundOffer(league, candidate.player.pid);
    expect(currentInboundOffers(after)[0]).toMatchObject({ pid: candidate.player.pid, status: "rejected" });

    // A second reject/accept/counter against a non-open negotiation is a no-op.
    expect(acceptInboundOffer(after, candidate.player.pid)).toBe(after);
    expect(counterInboundOffer(after, candidate.player.pid, 1)).toBe(after);
  });

  it("a moderate counter-ask gets countered upward but below the ask, and accepting it sells", () => {
    const league = windowLeague();
    const candidate = inboundOfferCandidates(league)[0];
    const ask = Math.round(candidate.ceiling * 1.1);

    const countered = counterInboundOffer(league, candidate.player.pid, ask);
    const negotiation = currentInboundOffers(countered)[0];
    expect(negotiation).toMatchObject({ pid: candidate.player.pid, status: "open" });
    expect(negotiation.offers.at(-1)!).toBeGreaterThan(candidate.openingOffer);
    expect(negotiation.offers.at(-1)!).toBeLessThan(ask);

    const sold = acceptInboundOffer(countered, candidate.player.pid);
    expect(sold.teams.find((t) => t.tid === candidate.buyerTid)!.roster).toContain(candidate.player.pid);
    expect(sold.transfers[0].fee).toBe(negotiation.offers.at(-1));
  });

  it("an ask at or below the ceiling is accepted immediately and executes the sale", () => {
    const league = windowLeague();
    const candidate = inboundOfferCandidates(league)[0];
    const ask = Math.round(candidate.ceiling * 0.9);

    const after = counterInboundOffer(league, candidate.player.pid, ask);
    expect(currentInboundOffers(after)[0]).toMatchObject({ pid: candidate.player.pid, status: "accepted" });
    expect(after.teams.find((t) => t.tid === candidate.buyerTid)!.roster).toContain(candidate.player.pid);
    expect(after.transfers[0].fee).toBe(ask);
  });

  it("a way-off ask collapses talks for the window", () => {
    const league = windowLeague();
    const candidate = inboundOfferCandidates(league)[0];
    const wayHigh = Math.round(candidate.ceiling / NEGOTIATION_LOWBALL_FACTOR) + 1_000_000;

    const collapsed = counterInboundOffer(league, candidate.player.pid, wayHigh);
    expect(currentInboundOffers(collapsed)[0]).toMatchObject({ pid: candidate.player.pid, status: "collapsed" });

    // Even a reasonable follow-up ask is ignored this window.
    const retry = counterInboundOffer(collapsed, candidate.player.pid, candidate.ceiling);
    expect(retry).toBe(collapsed);
  });

  it("is a no-op outside a window or for a nonexistent offer", () => {
    const closed = { ...windowLeague(), schedule: createLeagueState(0, mulberry32(1)).schedule.filter((g) => g.matchday >= 10) };
    expect(acceptInboundOffer(closed, 1)).toBe(closed);
    expect(rejectInboundOffer(closed, 1)).toBe(closed);
    expect(counterInboundOffer(closed, 1, 1)).toBe(closed);

    const league = windowLeague();
    const notOffered = league.teams.find((t) => t.tid === 0)!.roster.find(
      (pid) => !inboundOfferCandidates(league).some((c) => c.player.pid === pid),
    )!;
    expect(acceptInboundOffer(league, notOffered)).toBe(league);
  });
});
