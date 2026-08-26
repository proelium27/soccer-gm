/**
 * The confederation cups (Euro / Copa / AFCON): which are held, when they are
 * staged, and that clicking through them matches simming through them. *
 * Split out of the international suite because these tests each advance a
 * league through several full seasons, which made one file ~12 minutes on CI —
 * long enough to set the whole build's wall-clock, since a shard can never be
 * faster than its slowest file. Vitest gives each file its own worker, so
 * splitting is what lets them run in parallel; `test/helpers/shardPartition.ts`
 * then keeps the pieces on different shards.
 */

import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { createLeagueState } from "../../src/core/leagueState.js";
import { simThrough } from "../../src/core/simThrough.js";
import { simOffseason } from "../../src/core/offseason.js";
import { roundsRemaining } from "../../src/core/international/tournament.js";
import { playIntlStage } from "../../src/core/international/staging.js";
import { CONFEDERATION_CUPS } from "../../src/core/international/confederations.js";
import { makeLeague } from "../helpers/league.js";
import { simThroughInternational } from "../../src/core/international/index.js";
import { initConfederationCups, playConfederationCupGroups, playConfederationCupKnockoutRound } from "../../src/core/international/confederationCup.js";
import { confederationOf } from "../../src/core/international/confederations.js";
import { playInternational } from "../helpers/intlLeague.js";
import {
  CONFEDERATION_CUP_MIN_NATIONS, isConfederationCupSeason,
} from "../../src/core/constants.js";

describe("confederation cups", () => {
  it("holds a championship only where the world can field one", () => {
    const league = makeLeague(0, 11);
    const drawn = initConfederationCups(league.players, 2, league.lid);
    const byConfederation = new Map(drawn.map((t) => [t.confederation, t]));

    // Every player is generated from a European league's nationality table, so
    // Europe and Africa field tournaments and the thin confederations do not.
    expect(byConfederation.has("Europe")).toBe(true);
    expect(byConfederation.has("Africa")).toBe(true);

    for (const t of drawn) {
      // Its field is real, its shape is coherent, and nothing is played yet.
      expect(t.nations.length).toBeGreaterThanOrEqual(CONFEDERATION_CUP_MIN_NATIONS);
      expect(t.squads).toHaveLength(t.nations.length);
      expect(t.groups.flatMap((g) => g.nids)).toHaveLength(t.nations.length);
      expect(t.bracket).toHaveLength(0);
      expect(t.ties).toHaveLength(0);
      expect(t.championNid).toBeNull();
      // Every entrant belongs to the confederation whose championship it is.
      for (const nation of t.nations) expect(confederationOf(nation)).toBe(t.confederation);
      // And it is called what the spec table says.
      const spec = CONFEDERATION_CUPS.find((c) => c.confederation === t.confederation)!;
      expect(t.name).toBe(spec.name);
      expect(t.nations.length).toBeLessThanOrEqual(spec.targetField);
    }
    // Nations are strongest-first, so the field is the confederation's best.
    const europe = byConfederation.get("Europe")!;
    for (let i = 1; i < europe.squads.length; i++) {
      expect(europe.squads[i - 1].rating).toBeGreaterThanOrEqual(europe.squads[i].rating);
    }
  });

  it("plays every championship to a champion, with the finals on the same stage", () => {
    const league = makeLeague(0, 11);
    const drawn = initConfederationCups(league.players, 2, league.lid);
    expect(drawn.length).toBeGreaterThan(1); // otherwise there is no alignment to test

    let tournaments = playConfederationCupGroups(drawn, league.players, league.lid).tournaments;
    for (const t of tournaments) {
      expect(t.bracket.length).toBeGreaterThanOrEqual(2);
      expect(t.groups.every((g) => g.matches.every((m) => m.homeGoals >= 0))).toBe(true);
    }

    // Play knockout rounds until they are all done, recording how many each
    // tournament was left with at every stage.
    const remainingByStage: number[][] = [];
    for (let guard = 0; tournaments.some((t) => roundsRemaining(t) > 0) && guard < 6; guard++) {
      remainingByStage.push(tournaments.map(roundsRemaining));
      tournaments = playConfederationCupKnockoutRound(tournaments, league.players, league.lid).tournaments;
    }

    // Everyone has a champion, and nobody was still running when the last
    // stage finished — that is what "the finals land together" means.
    for (const t of tournaments) {
      expect(t.championNid).not.toBeNull();
      expect(roundsRemaining(t)).toBe(0);
    }
    // A shorter tournament waits: on the stage before the last, every live
    // tournament has exactly one round to go.
    const beforeLast = remainingByStage[remainingByStage.length - 1];
    for (const r of beforeLast) expect(r === 0 || r === 1).toBe(true);
  });

  it("stages the championships after the qualifying leg, in the middle season of the cycle", () => {
    const rng = mulberry32(21);
    let league = createLeagueState(0, rng);
    // Season 1 draws qualifying only; season 2 is the confederation cup season.
    for (let s = 0; s < 2; s++) {
      league = simThrough(league, "season", rng);
      league = simThrough(league, "season", rng);
      if (league.season === 1) {
        expect(league.international.confederationCups).toHaveLength(0);
        league = playInternational(league);
        league = simOffseason(league, rng);
      }
    }
    expect(league.season).toBe(2);
    expect(isConfederationCupSeason(league.season)).toBe(true);
    expect(league.international.confederationCups.length).toBeGreaterThan(0);

    // Click through the stages one at a time and record the sequence.
    const stages: string[] = [String(league.international.stage)];
    let intl = league.international;
    let players = league.players;
    for (let g = 0; g < 12 && intl.stage != null && intl.stage !== "done"; g++) {
      const r = playIntlStage(intl, players, league.lid, league.season);
      intl = r.international;
      players = r.players;
      stages.push(String(intl.stage));
    }
    expect(stages[0]).toBe("qualifying");
    expect(stages[1]).toBe("confederation-groups");
    expect(stages.filter((x) => x === "confederation-ko").length).toBeGreaterThanOrEqual(1);
    expect(stages[stages.length - 1]).toBe("done");

    // Every championship is archived, and the winners' medals are recorded on
    // the *confederation cup* counters rather than the World Cup ones.
    expect(intl.confederationCupHistory.length).toBe(intl.confederationCups.length);
    for (const h of intl.confederationCupHistory) {
      expect(h.champion).toBeTruthy();
      expect(h.confederation).toBeTruthy();
      expect(h.knockout.length).toBeGreaterThan(0);
    }
    const withMedal = players.filter((p) => (p.intl?.confederationCupTitles ?? 0) > 0);
    expect(withMedal.length).toBeGreaterThan(0);
    for (const p of players) {
      // No World Cup has been played, so those counters must still be zero.
      expect(p.intl?.titles ?? 0).toBe(0);
      expect(p.intl?.tournaments ?? 0).toBe(0);
    }
    // A champion's nation matches one of the archived winners.
    const champions = new Set(intl.confederationCupHistory.map((h) => h.champion));
    for (const p of withMedal) expect(champions.has(p.nationality)).toBe(true);
  });

  it("clicking through the championships matches simming through them", () => {
    const rng = mulberry32(31);
    let league = createLeagueState(0, rng);
    league = simThrough(league, "season", rng);
    league = simThrough(league, "season", rng);
    league = playInternational(league);
    league = simOffseason(league, rng);
    league = simThrough(league, "season", rng);
    league = simThrough(league, "season", rng);
    expect(league.season).toBe(2);
    expect(league.international.confederationCups.length).toBeGreaterThan(0);

    // Clicked: one stage at a time.
    let intl = league.international;
    let players = league.players;
    for (let g = 0; g < 12 && intl.stage != null && intl.stage !== "done"; g++) {
      const r = playIntlStage(intl, players, league.lid, league.season);
      intl = r.international;
      players = r.players;
    }
    // Simmed: every remaining stage in one pass.
    const bulk = simThroughInternational(
      league.international, league.players, league.lid, league.season,
    );

    expect(bulk.international.confederationCups).toEqual(intl.confederationCups);
    expect(bulk.international.confederationCupHistory).toEqual(intl.confederationCupHistory);
    expect(bulk.players.map((p) => p.intl)).toEqual(players.map((p) => p.intl));
  });
});
