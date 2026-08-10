import { describe, it, expect } from "vitest";
import { makeLeague } from "../helpers/league.js";
import type { LeagueStore } from "../../src/core/leagueState.js";
import type { Player } from "../../src/core/players/types.js";
import { simThrough } from "../../src/core/simThrough.js";
import { mulberry32 } from "../../src/engine/rng.js";
import { signFreeAgent, releasePlayer, freeAgentPids } from "../../src/core/freeAgency.js";
import { extendContract } from "../../src/core/contracts.js";

/**
 * Guards the assumption the split-player-store design rests on
 * (docs/save-performance-plan.md): the core never mutates a player in place, so
 * a change to a player always comes with a new object identity.
 *
 * Why this test is the gate rather than a nice-to-have. Once saves write only
 * the players whose identity changed, a player mutated in place is invisible to
 * the diff and its change is silently never persisted — no type error, no
 * crash, just an edit that vanishes on reload. Nothing else in the suite would
 * notice. So the invariant is pinned here, before anything depends on it.
 *
 * Note the asymmetry: writing a player that did not really change is merely
 * wasteful, so `identity ⊇ content` is the requirement, not equality.
 */

const USER_TID = 0;

/** Player content keyed by pid, deep enough to catch an in-place edit. */
function snapshot(players: Player[]): Map<number, string> {
  return new Map(players.map((p) => [p.pid, JSON.stringify(p)]));
}

/** Pids whose object identity differs from `before` (what a dirty-set write would send). */
function newIdentities(before: Player[], after: Player[]): Set<number> {
  const prev = new Map(before.map((p) => [p.pid, p]));
  const out = new Set<number>();
  for (const p of after) {
    const old = prev.get(p.pid);
    if (old === undefined || old !== p) out.add(p.pid);
  }
  return out;
}

/** Pids whose content differs from `was` (what actually needs persisting). */
function contentChanges(was: Map<number, string>, after: Player[]): Set<number> {
  const out = new Set<number>();
  for (const p of after) {
    const before = was.get(p.pid);
    if (before === undefined || before !== JSON.stringify(p)) out.add(p.pid);
  }
  return out;
}

function apply(league: LeagueStore, fn: (l: LeagueStore) => LeagueStore) {
  const was = snapshot(league.players);
  const after = fn(league);
  const identity = newIdentities(league.players, after.players);
  const content = contentChanges(was, after.players);
  return { after, identity, content };
}

/** Every player the action really changed must carry a new identity. */
function expectNoMissedWrites(identity: Set<number>, content: Set<number>) {
  const missed = [...content].filter((pid) => !identity.has(pid));
  expect(missed).toEqual([]);
}

describe("player object identity tracks content changes", () => {
  it("holds when a contract is extended, and touches exactly one player", () => {
    const league = makeLeague(USER_TID, 1);
    const pid = league.teams.find((t) => t.tid === USER_TID)!.roster[0];

    const { identity, content } = apply(league, (l) => ({
      ...l,
      players: extendContract(l.players, pid, l.season),
    }));

    expectNoMissedWrites(identity, content);
    expect([...identity]).toEqual([pid]);
  });

  it("holds when a free agent is signed, and touches exactly one player", () => {
    const fresh = makeLeague(USER_TID, 1);
    // A newly generated world has every player under contract — free agents only
    // appear from the first offseason on — so release one to have someone to sign.
    const pid = fresh.teams.find((t) => t.tid === USER_TID)!.roster[0];
    const league: LeagueStore = {
      ...fresh,
      teams: releasePlayer(fresh.teams, fresh.players, USER_TID, pid),
    };
    expect(freeAgentPids(league.teams, league.players, league.activeLoans).has(pid)).toBe(true);

    const { identity, content } = apply(league, (l) => {
      const { teams, players } = signFreeAgent(
        l.teams, l.players, USER_TID, pid, l.season, l.phase, l.activeLoans,
      );
      return { ...l, teams, players };
    });

    expectNoMissedWrites(identity, content);
    expect([...identity]).toEqual([pid]);
  });

  it("holds across a simulated matchday, where most of the pool changes", () => {
    const league = makeLeague(USER_TID, 1);

    const { identity, content } = apply(league, (l) =>
      simThrough(l, "game", mulberry32(11)),
    );

    expectNoMissedWrites(identity, content);
    // Sanity: a matchday must genuinely change players, or the assertion above
    // is passing on an empty set and proving nothing.
    expect(content.size).toBeGreaterThan(0);
  });

  /**
   * The performance half of the design, and the tripwire for the plan's risk 4:
   * these actions touch only `teams`, so they should write no players at all. If
   * something later starts copying the pool defensively, correctness still holds
   * but the benefit quietly evaporates — that regression shows up here.
   */
  it("writes no players for actions that only touch teams", () => {
    const league = makeLeague(USER_TID, 1);
    const team = league.teams.find((t) => t.tid === USER_TID)!;

    const lineup = apply(league, (l) => ({
      ...l,
      teams: l.teams.map((t) =>
        t.tid === USER_TID ? { ...t, starters: team.roster.slice(0, 11) } : t,
      ),
    }));
    expect(lineup.identity.size).toBe(0);
    expect(lineup.content.size).toBe(0);

    const scouting = apply(league, (l) => ({
      ...l,
      teams: l.teams.map((t) =>
        t.tid === USER_TID ? { ...t, nextScoutingSpend: 1 } : t,
      ),
    }));
    expect(scouting.identity.size).toBe(0);

    const released = apply(league, (l) => ({
      ...l,
      teams: releasePlayer(l.teams, l.players, USER_TID, team.roster[0]),
    }));
    expect(released.identity.size).toBe(0);
  });
});
