/**
 * What an international campaign writes back onto players: injuries carried
 * into the new club season.
 *
 * The caps-and-titles half of this subject lives in
 * `internationalCampaign.test.ts` instead. It needs a completed four-year cycle
 * — `advance(7, 4)` — and so does the cadence test there, and the two files ran
 * that identical chain once each: same seed, same season count, ~450s a piece,
 * for two tests that only read the result. Vitest gives every file its own
 * worker, so nothing in-process can share across that boundary; putting the two
 * consumers in one file is what makes one run serve both.
 *
 * One of three files the international campaign tests are split across. Each
 * test here advances a league through several full seasons, so a single file
 * ran long enough to set CI's whole wall-clock on its own — a shard can never
 * be faster than its slowest file. See `test/helpers/shardPartition.ts`.
 */

import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { createLeagueState } from "../../src/core/leagueState.js";
import { simThrough } from "../../src/core/simThrough.js";
import { simOffseason } from "../../src/core/offseason.js";
import { playInternational } from "../helpers/intlLeague.js";

describe("international — what a campaign leaves on players", () => {
  it("carries injuries from the summer's internationals into the new club season", () => {
    const rng = mulberry32(7);
    let league = createLeagueState(0, rng);
    league = simThrough(league, "season", rng); // season 1 ends → qualifying drawn
    league = simThrough(league, "season", rng); // clear any cup-final halt
    league = playInternational(league); // play qualifying (many matches → injuries happen)

    const injuredPids = league.international.stageInjuries;
    expect(injuredPids.length).toBeGreaterThan(0);

    const next = simOffseason(league, rng);
    expect(next.international.stageInjuries).toHaveLength(0); // consumed at the rollover

    // Some of those injured at the tournament still carry it into the new season
    // (the shorter knocks heal over the summer break). Progression healed the
    // club-season knocks first, so any injury present now is an international one.
    const carried = injuredPids
      .map((pid) => next.players.find((p) => p.pid === pid))
      .filter((p) => p !== undefined && p.injury !== null);
    expect(carried.length).toBeGreaterThan(0);
  });
});
