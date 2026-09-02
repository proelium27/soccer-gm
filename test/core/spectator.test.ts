import { describe, it, expect } from "vitest";
import { makeLeague } from "../helpers/league.js";
import { mulberry32 } from "../../src/engine/rng.js";
import { createLeagueState } from "../../src/core/leagueState.js";
import { simThrough } from "../../src/core/simThrough.js";
import { simOffseason } from "../../src/core/offseason.js";
import { reviewSeason } from "../../src/core/manager/index.js";
import { reviewNationalCampaign } from "../../src/core/nationalManager/index.js";
import { emptyManagerState } from "../../src/core/manager/types.js";
import { SPECTATOR_TID, isSpectator, isSpectatorTid } from "../../src/core/spectator.js";
import { AUTOPILOT_TID, beginAutopilot, endAutopilot } from "../../src/core/autopilot.js";
import { FREE_AGENT_TID } from "../../src/core/transfers/negotiation.js";
import type { LeagueStore } from "../../src/core/leagueState.js";

function withTid(league: LeagueStore, tid: number): LeagueStore {
  return { ...league, meta: { ...league.meta, userTid: tid } };
}

describe("spectator: the sentinel", () => {
  /**
   * All three negatives mean different things and are read in the same places.
   * `FREE_AGENT_TID` is a live value in a transfer's from/to, `AUTOPILOT_TID`
   * is the temporary stand-in a season jump runs under, and this one persists.
   * Collide any two and "no club at all", "the AI has it for now" and "nobody
   * owns him" become the same statement.
   */
  it("is distinct from the other two negative tids", () => {
    expect(new Set([SPECTATOR_TID, AUTOPILOT_TID, FREE_AGENT_TID]).size).toBe(3);
    expect(SPECTATOR_TID).toBeLessThan(0);
  });

  it("recognises a spectator save and nothing else", () => {
    expect(isSpectatorTid(SPECTATOR_TID)).toBe(true);
    expect(isSpectatorTid(AUTOPILOT_TID)).toBe(false);
    expect(isSpectatorTid(FREE_AGENT_TID)).toBe(false);
    expect(isSpectatorTid(0)).toBe(false);
    expect(isSpectator({ meta: { userTid: SPECTATOR_TID } })).toBe(true);
    expect(isSpectator({ meta: { userTid: 4 } })).toBe(false);
  });
});

describe("spectator: a save with no manager", () => {
  it("opens no stint, so there is no career to judge", () => {
    expect(emptyManagerState(SPECTATOR_TID, 1).stints).toEqual([]);
    // The managed case is untouched.
    expect(emptyManagerState(0, 1).stints).toHaveLength(1);
  });

  it("matches no club in the world it generates", () => {
    const league = makeLeague(SPECTATOR_TID, 1);
    expect(league.teams.some((t) => t.tid === league.meta.userTid)).toBe(false);
    expect(league.manager.stints).toEqual([]);
    expect(league.manager.sacked).toBe(false);
    // Every club still exists and is stocked — nobody managing is not the same
    // as nobody playing.
    expect(league.teams.length).toBeGreaterThan(0);
    expect(league.teams.every((t) => t.roster.length > 0)).toBe(true);
  });

  /**
   * `createLeagueState` forces the country null rather than trusting the one
   * screen that offers the choice, so "a spectator manages nothing" holds
   * against every caller.
   */
  it("refuses a national job even when one is passed in", () => {
    const league = createLeagueState(
      SPECTATOR_TID, mulberry32(3), 0, "normal", undefined, true, "England",
    );
    expect(league.nationalManager.nation).toBeNull();
    expect(league.nationalManager.stints).toEqual([]);
  });

  it("is never sacked and is never offered a job", () => {
    const league = makeLeague(SPECTATOR_TID, 1);
    const reviewed = reviewSeason({
      league,
      teams: league.teams,
      players: league.players,
      played: league.played,
      cup: league.cup,
      shield: league.shield,
      domesticCups: league.domesticCups,
    });
    // No stint, so there is nothing to judge and the board never convenes.
    expect(reviewed.verdict).toBeNull();
    expect(reviewed.manager.sacked).toBe(false);
    expect(reviewed.manager.offers).toEqual([]);

    // No federation comes calling either — a spectator holds no jobs at all,
    // and the offer pass does not otherwise depend on holding one.
    const staged: LeagueStore = { ...league, phase: "offseason" };
    expect(reviewNationalCampaign(staged).nationalManager.offers).toEqual([]);
  });
});

/**
 * A season plus an offseason, played twice on the same world: once with nobody
 * managing, once with the club-less tid a jump uses. Both cases below read the
 * same pair, because playing a 420-club season is the whole cost of this file
 * and the two questions are asked of one run.
 */
let played: { spectated: LeagueStore; autopiloted: LeagueStore } | null = null;
function playBothWays() {
  if (played) return played;
  const base = makeLeague(0, 1);
  const run = (tid: number) => simOffseason(
    simThrough(withTid(base, tid), "season", mulberry32(9)),
    mulberry32(21),
  );
  played = { spectated: run(SPECTATOR_TID), autopiloted: run(AUTOPILOT_TID) };
  return played;
}

describe("spectator: the sim", () => {
  /**
   * The load-bearing invariant for the whole feature, and the reason it needed
   * almost no sim code.
   *
   * Spectating is not a new mode the sim has to understand — it is the state
   * `jumpSeasons` already puts a save into for the length of a jump, made
   * permanent. So a spectated season must be bit-identical to an autopiloted
   * one: same matches, same transfers, same offseason, same everything. If this
   * ever fails, something has started branching on *which* club-less tid it is
   * looking at, and the claim that a spectator sees the football the world
   * would have played anyway is no longer true.
   */
  it("plays exactly the season an autopiloted save would", () => {
    const { spectated, autopiloted } = playBothWays();

    expect(spectated.players).toEqual(autopiloted.players);
    expect(spectated.teams).toEqual(autopiloted.teams);
    expect(spectated.transfers).toEqual(autopiloted.transfers);
    expect(spectated.seasonHistory).toEqual(autopiloted.seasonHistory);
    expect(spectated.activeLoans).toEqual(autopiloted.activeLoans);
    expect(spectated.international).toEqual(autopiloted.international);
  });

  /**
   * The point of the mode: with `userTid` matching no club, every "except the
   * user's club" carve-out falls through and the AI really does run all of
   * them. Trading is the visible proof — a managed save's own club is the one
   * the market never touches on its own.
   */
  it("lets the AI trade on behalf of every club in the world", () => {
    const base = makeLeague(0, 1);
    const after = playBothWays().spectated;

    const moved = after.transfers.filter((t) => t.season === base.season);
    expect(moved.length).toBeGreaterThan(0);

    // No club sat the window out because it was "the user's".
    const clubsThatDealt = new Set<number>();
    for (const t of moved) {
      clubsThatDealt.add(t.fromTid);
      clubsThatDealt.add(t.toTid);
    }
    expect(clubsThatDealt.size).toBeGreaterThan(base.teams.length / 4);
  });

  /**
   * A jump swaps the autopilot tid in and back out again, and a spectator has
   * no real tid to come back to — so "restore what was there" has to mean the
   * spectator sentinel rather than some club. Exercised on the two functions
   * that do the swapping rather than through `jumpSeasons`, which would play a
   * whole extra season to prove a property that lives entirely in these two.
   */
  it("is still a spectator save either side of a jump's handover", () => {
    const league = withTid(makeLeague(0, 1), SPECTATOR_TID);

    const during = beginAutopilot(league);
    expect(during.meta.userTid).toBe(AUTOPILOT_TID);

    const after = endAutopilot(during, league.meta.userTid);
    expect(after.meta.userTid).toBe(SPECTATOR_TID);
    expect(isSpectator(after)).toBe(true);
    // Nothing to hand back means nothing was disturbed on the way through.
    expect(after.teams).toEqual(league.teams);
    expect(after.players).toEqual(league.players);
  });
});
