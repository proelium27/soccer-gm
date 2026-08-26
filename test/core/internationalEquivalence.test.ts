/**
 * The campaign can be clicked through a stage at a time, simmed through in one
 * pass, or skipped entirely, and all three must land on identical results —
 * each stage owns its seed. This is what makes the Dashboard's skip button
 * safe.
 *
 * One of three files the international campaign tests are split across. Each
 * test here advances a league through several full seasons, so a single file
 * ran long enough to set CI's whole wall-clock on its own — a shard can never
 * be faster than its slowest file. See `test/helpers/shardPartition.ts`.
 */

import { describe, it, expect } from "vitest";
import type { LeagueStore } from "../../src/core/leagueState.js";
import { mulberry32 } from "../../src/engine/rng.js";
import { createLeagueState } from "../../src/core/leagueState.js";
import { simThrough } from "../../src/core/simThrough.js";
import { simOffseason } from "../../src/core/offseason.js";
import { isIntlStagePending, simThroughInternational } from "../../src/core/international/index.js";
import { runTournament } from "../../src/core/international/tournament.js";
import { playInternational } from "../helpers/intlLeague.js";

describe("international — staged play matches playing it in one pass", () => {
  it("advancing without playing the campaign gives the same results (the Dashboard skip button)", () => {
    const rng = mulberry32(5);
    let league = createLeagueState(0, rng);
    league = simThrough(league, "season", rng);
    league = simThrough(league, "season", rng); // clear any cup-final halt
    expect(isIntlStagePending(league.international)).toBe(true);

    // Watched: play every stage by hand, then advance.
    const watched = simOffseason(playInternational(league), mulberry32(99));
    // Skipped: advance straight from the pending stage — simOffseason opens by
    // playing whatever is left, on the same seeded streams.
    const skipped = simOffseason(league, mulberry32(99));

    expect(isIntlStagePending(skipped.international)).toBe(false);
    expect(skipped.international).toEqual(watched.international);
    // ...and the caps/goals earned land on the same players either way.
    const caps = (l: LeagueStore) =>
      l.players.filter((p) => (p.intl?.caps ?? 0) > 0).map((p) => [p.pid, p.intl!.caps, p.intl!.goals]);
    expect(caps(skipped).length).toBeGreaterThan(0);
    expect(caps(skipped)).toEqual(caps(watched));
  });

  it("staged play matches a one-pass runTournament on the same field", () => {
    const rng = mulberry32(11);
    let league = createLeagueState(0, rng);
    // Seasons 1-3: qualify (one leg each).
    for (let s = 0; s < 3; s++) {
      league = simThrough(league, "season", rng);
      league = simThrough(league, "season", rng);
      league = playInternational(league);
      league = simOffseason(league, rng);
    }
    // Season 4: entering the offseason draws the tournament (stage "groups").
    league = simThrough(league, "season", rng);
    league = simThrough(league, "season", rng);
    expect(league.international.stage).toBe("groups");

    // Play it in stages...
    const staged = simThroughInternational(league.international, league.players, league.lid, league.season);
    // ...versus one bulk pass over the very same qualifiers and players.
    const bulk = runTournament(
      league.international.qualifying!.qualified,
      league.players,
      league.season,
      league.lid,
    );

    expect(bulk).not.toBeNull();
    const st = staged.international.tournament!;
    expect(st.championNid).toBe(bulk!.tournament.championNid);
    // Every knockout scoreline agrees, so the per-round seeds line up exactly.
    expect(st.ties.map((t) => [t.round, t.homeGoals, t.awayGoals])).toEqual(
      bulk!.tournament.ties.map((t) => [t.round, t.homeGoals, t.awayGoals]),
    );
  });
});
