/**
 * The four-year cycle's shape: qualifying spread over three offseasons, then a
 * World Cup in the fourth.
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
import { isIntlStagePending } from "../../src/core/international/index.js";
import {
  INTL_FIELD_SIZE, INTL_KO_SIZE, INTL_GROUPS,
} from "../../src/core/constants.js";
import { playInternational, advance } from "../helpers/intlLeague.js";

describe("international — qualifying cadence", () => {
  it("qualifies a full field over three offseasons then plays the World Cup, on the four-year cadence", () => {
    const league = advance(7, 4); // seasons 1-3 qualify, season 4 is the tournament
    const intl = league.international;
    expect(intl.qualifying?.qualified).toHaveLength(INTL_FIELD_SIZE);
    expect(intl.tournament).not.toBeNull();
    expect(intl.tournament!.nations).toHaveLength(INTL_FIELD_SIZE);
    expect(intl.tournament!.championNid).not.toBeNull();
    expect(intl.tournament!.bracket).toHaveLength(INTL_KO_SIZE);
    expect(intl.history).toHaveLength(1);
    expect(intl.history[0].champion).toBeTruthy();

    // Light archival is populated as the campaigns finish.
    expect(intl.qualifyingHistory).toHaveLength(1); // one completed campaign (seasons 1-3)
    expect(intl.qualifyingHistory[0].qualified).toHaveLength(INTL_FIELD_SIZE);
    expect(intl.powerRankings.length).toBeGreaterThanOrEqual(4); // a snapshot each offseason
    expect(intl.history[0].groups).toHaveLength(INTL_GROUPS); // 8 final group tables
    expect(intl.history[0].knockout).toHaveLength(15); // 8 R16 + 4 QF + 2 SF + 1 final
  });

  it("draws a qualifying campaign and finishes it across three offseasons", () => {
    const rng = mulberry32(3);
    let league = createLeagueState(0, rng);

    // Season 1: the campaign is drawn and its first leg is pending.
    league = simThrough(league, "season", rng);
    league = simThrough(league, "season", rng); // clear any cup-final halt
    expect(league.phase).toBe("offseason");
    expect(league.international.stage).toBe("qualifying");
    expect(isIntlStagePending(league.international)).toBe(true);

    // One leg per offseason: the 16 qualifiers aren't decided until the third.
    league = playInternational(league); // leg 1
    expect(league.international.qualifying!.qualified).toHaveLength(0);
    league = simOffseason(league, rng);
    expect(league.season).toBe(2);

    // Seasons 2 and 3 play legs 2 and 3; after the third, the field is set.
    for (let s = 0; s < 2; s++) {
      league = simThrough(league, "season", rng);
      league = simThrough(league, "season", rng);
      league = playInternational(league);
      league = simOffseason(league, rng);
    }
    expect(league.season).toBe(4);
    expect(league.international.qualifying!.qualified).toHaveLength(INTL_FIELD_SIZE);
    expect(league.international.qualifyingHistory).toHaveLength(1);
  });
});
