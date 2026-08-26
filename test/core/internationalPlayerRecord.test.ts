/**
 * What an international campaign writes back onto players: caps and titles for
 * those who feature, and injuries carried into the new club season.
 *
 * One of three files the international campaign tests are split across. Each
 * test here advances a league through several full seasons, so a single file
 * ran long enough to set CI's whole wall-clock on its own — a shard can never
 * be faster than its slowest file. See `test/helpers/shardPartition.ts`.
 */

import { describe, it, expect } from "vitest";
import { isConfederationCupSeason } from "../../src/core/constants.js";
import { mulberry32 } from "../../src/engine/rng.js";
import { createLeagueState } from "../../src/core/leagueState.js";
import { simThrough } from "../../src/core/simThrough.js";
import { simOffseason } from "../../src/core/offseason.js";
import { playInternational, advance } from "../helpers/intlLeague.js";

describe("international — what a campaign leaves on players", () => {
  it("records caps and titles on players who feature", () => {
    const league = advance(7, 4);
    const capped = league.players.filter((p) => p.intl && p.intl.caps > 0);
    expect(capped.length).toBeGreaterThan(0);
    const champions = league.players.filter((p) => p.intl && p.intl.titles > 0);
    expect(champions.length).toBeGreaterThan(0);
    // A titled player was necessarily named in a tournament squad.
    for (const p of champions) expect(p.intl!.tournaments).toBeGreaterThanOrEqual(1);

    // The per-campaign breakdown must account for the career totals exactly —
    // every appearance is written to a line as it's earned.
    for (const p of capped) {
      const lines = p.intl!.seasons;
      expect(lines.length).toBeGreaterThan(0);
      const sum = (key: "caps" | "goals" | "assists") =>
        lines.reduce((total, l) => total + l[key], 0);
      expect(sum("caps")).toBe(p.intl!.caps);
      expect(sum("goals")).toBe(p.intl!.goals);
      expect(sum("assists")).toBe(p.intl!.assists);
      // One line per campaign played, labelled by the cadence: seasons 1-3
      // qualifying, season 4 the tournament — plus a confederation cup line in the
      // offseason that also stages the championships (season 2 of the cycle).
      for (const l of lines) {
        const allowed = l.season % 4 === 0
          ? ["tournament"]
          : isConfederationCupSeason(l.season) ? ["qualifying", "confederation"] : ["qualifying"];
        expect(allowed).toContain(l.kind);
      }
      expect(new Set(lines.map((l) => `${l.season}-${l.kind}`)).size).toBe(lines.length);
    }
    // Four seasons in, somebody has played both qualifying and the tournament.
    expect(capped.some((p) => p.intl!.seasons.some((l) => l.kind === "tournament"))).toBe(true);
    expect(capped.some((p) => p.intl!.seasons.some((l) => l.kind === "qualifying"))).toBe(true);
  });

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
