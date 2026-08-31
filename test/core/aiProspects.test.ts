import { describe, it, expect } from "vitest";
import { makeLeague } from "../helpers/league.js";
import { mulberry32 } from "../../src/engine/rng.js";
import { trimRosterSurplus, runAIFreeAgency } from "../../src/core/freeAgency.js";
import {
  ROSTER_COMPOSITION, AI_PROSPECT_SLOTS, AI_PROSPECT_MIN_POT,
} from "../../src/core/constants.js";
import type { Player } from "../../src/core/players/types.js";

/**
 * AI clubs keep their wonderkids. Before this, `trimRosterSurplus` ranked
 * purely on current ovr and a 16-year-old is always bottom of his position's
 * depth chart, so 84-86% of every club's youth intake was released in the
 * offseason it arrived — 80% of the POT>=70 prospects among them — and neither
 * pass of AI free agency valued potential enough to sign them back. See
 * AI_PROSPECT_SLOTS.
 */
describe("AI prospect retention", () => {
  // Deliberately low ovr: that is what makes him bottom of the depth chart,
  // and so the exact player the old trim always released.
  const makeProspect = (pid: number, season: number, potential: number): Player =>
    ({
      pid,
      name: `Prospect ${pid}`,
      pos: "CB",
      born: season - 17,
      ovr: 30,
      potential,
      nationality: "England",
      contract: { salary: 100_000, expiresSeason: season + 3 },
      hist: [],
      stats: [],
    }) as unknown as Player;

  it("keeps a club's wonderkids through the trim, without displacing the depth chart", () => {
    const league = makeLeague(0, 1);
    const season = league.season;
    const target = league.teams[1];

    // Who the ovr depth chart keeps at CB, measured before the prospects exist.
    const pmap = new Map(league.players.map((p) => [p.pid, p]));
    const keptOnOvr = target.roster
      .map((pid) => pmap.get(pid)!)
      .filter((p) => p.pos === "CB")
      .sort((a, b) => b.ovr - a.ovr)
      .slice(0, ROSTER_COMPOSITION.CB)
      .map((p) => p.pid);

    const prospects = [9_000_001, 9_000_002].map((pid) =>
      makeProspect(pid, season, AI_PROSPECT_MIN_POT + 5),
    );
    const players = [...league.players, ...prospects];
    const teams = league.teams.map((t) =>
      t.tid === target.tid ? { ...t, roster: [...t.roster, ...prospects.map((p) => p.pid)] } : t,
    );

    const roster = trimRosterSurplus(teams, players, /* userTid */ -1, season)
      .find((t) => t.tid === target.tid)!.roster;

    for (const p of prospects) expect(roster).toContain(p.pid);
    // ...and everyone the depth chart would have kept is still there. Retention
    // is additive, so selectXI's input is unchanged — that is the whole point.
    for (const pid of keptOnOvr) expect(roster).toContain(pid);
  });

  it("retains at most AI_PROSPECT_SLOTS of them, best potential first", () => {
    const league = makeLeague(0, 1);
    const season = league.season;
    const target = league.teams[1];

    // One more prospect than there are slots, each a point better than the last.
    const prospects = Array.from({ length: AI_PROSPECT_SLOTS + 1 }, (_, i) =>
      makeProspect(9_100_000 + i, season, AI_PROSPECT_MIN_POT + i),
    );
    const players = [...league.players, ...prospects];
    const teams = league.teams.map((t) =>
      t.tid === target.tid ? { ...t, roster: [...t.roster, ...prospects.map((p) => p.pid)] } : t,
    );

    const roster = new Set(
      trimRosterSurplus(teams, players, -1, season).find((t) => t.tid === target.tid)!.roster,
    );
    const survivors = prospects.filter((p) => roster.has(p.pid));
    expect(survivors).toHaveLength(AI_PROSPECT_SLOTS);
    // The one dropped is the weakest, not whoever happened to come last in the
    // roster array — the sort is a total order for exactly this reason.
    expect(survivors.map((p) => p.pid)).not.toContain(prospects[0].pid);
  });

  it("leaves an ordinary low-potential youngster to be released", () => {
    const league = makeLeague(0, 1);
    const season = league.season;
    const target = league.teams[1];

    const filler = makeProspect(9_200_001, season, AI_PROSPECT_MIN_POT - 1);
    const players = [...league.players, filler];
    const teams = league.teams.map((t) =>
      t.tid === target.tid ? { ...t, roster: [...t.roster, filler.pid] } : t,
    );

    const roster = trimRosterSurplus(teams, players, -1, season)
      .find((t) => t.tid === target.tid)!.roster;
    expect(roster).not.toContain(filler.pid);
  });

  it("signs an unsigned wonderkid out of the pool", () => {
    const league = makeLeague(0, 1);
    const season = league.season;
    const wonderkid = makeProspect(9_300_001, season, AI_PROSPECT_MIN_POT + 5);
    const players = [...league.players, wonderkid];

    const { teams } = runAIFreeAgency(
      league.teams,
      players,
      season,
      mulberry32(9),
      -1,
      league.teams.map((t) => t.tid),
    );
    expect(teams.some((t) => t.roster.includes(wonderkid.pid))).toBe(true);
  });

  it("takes no shared-rng draws to sign him", () => {
    // If the prospect pass drew from the shared stream, adding one prospect to
    // the pool would change the draw count and shift every downstream draw with
    // it — the RNG-stream-order invariant youth generation rests on.
    const league = makeLeague(0, 1);
    const season = league.season;
    const wonderkid = makeProspect(9_400_001, season, AI_PROSPECT_MIN_POT + 5);

    const draws = (pool: Player[]): number => {
      let n = 0;
      const inner = mulberry32(9);
      runAIFreeAgency(
        league.teams,
        pool,
        season,
        () => {
          n++;
          return inner();
        },
        -1,
        league.teams.map((t) => t.tid),
      );
      return n;
    };
    expect(draws([...league.players, wonderkid])).toBe(draws(league.players));
  });
});
