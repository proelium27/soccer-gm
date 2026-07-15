import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../../src/engine/rng.js";
import { createLeagueState } from "../../../src/core/leagueState.js";
import { deriveLeagueContexts } from "../../../src/core/ai/clubContext.js";
import { wouldRefuseExtension } from "../../../src/core/ai/breakoutRefusal.js";
import type { StoredTeam } from "../../../src/core/teams/clubs.js";

const USER_TID = 0;

describe("wouldRefuseExtension", () => {
  it("never refuses for a Division 1 player, regardless of ability", () => {
    const league = createLeagueState(USER_TID, mulberry32(11));
    const d1Team = league.teams.find((t) => t.division === 0)!;
    const target = league.players.find((p) => d1Team.roster.includes(p.pid))!;
    const boosted = { ...target, ovr: 95 };
    const players = league.players.map((p) => (p.pid === target.pid ? boosted : p));
    const contexts = deriveLeagueContexts({ ...league, players });
    expect(wouldRefuseExtension(boosted, d1Team, league.teams, contexts)).toBe(false);
  });

  it("does not refuse a weak Division 2 player no Division 1 club would chase", () => {
    // An arbitrary unmodified player isn't a reliable "no club wants him"
    // fixture: a decent player at a position some D1 club is desperately
    // thin at can already clear AI_MARKET_MIN_SURPLUS via the needMult
    // multiplier alone (the same dynamic the AI transfer market already
    // relies on for ordinary transfers). Use an explicitly weak player
    // instead, low enough that no positional-need multiplier could plausibly
    // make him a Division 1 target.
    const league = createLeagueState(USER_TID, mulberry32(11));
    const d2Team = league.teams.find((t) => t.division === 1)!;
    const target = league.players.find((p) => d2Team.roster.includes(p.pid))!;
    const weak = { ...target, ovr: 35, potential: 35 };
    const players = league.players.map((p) => (p.pid === target.pid ? weak : p));
    const contexts = deriveLeagueContexts({ ...league, players });
    expect(wouldRefuseExtension(weak, d2Team, league.teams, contexts)).toBe(false);
  });

  it("refuses a Division 2 breakout star that a rich Division 1 club can afford and values well above his own club", () => {
    const league = createLeagueState(USER_TID, mulberry32(11));
    const d2Team = league.teams.find((t) => t.division === 1 && t.tid !== USER_TID)!;
    const d1Team = league.teams.find((t) => t.division === 0 && t.tid !== USER_TID)!;
    const target = league.players.find((p) => d2Team.roster.includes(p.pid))!;

    // A clear breakout: make him elite while his own club stays poor D2-scale.
    const star = { ...target, ovr: 88, potential: 90 };
    const players = league.players.map((p) => (p.pid === target.pid ? star : p));

    // Give the D1 club deep pockets so affordability can't be the blocker.
    const teams: StoredTeam[] = league.teams.map((t) =>
      t.tid === d1Team.tid ? { ...t, budget: 300_000_000 } : t,
    );

    const contexts = deriveLeagueContexts({ ...league, teams, players });
    expect(wouldRefuseExtension(star, d2Team, teams, contexts)).toBe(true);
  });

  it("is deterministic: repeated calls with the same inputs agree", () => {
    const league = createLeagueState(USER_TID, mulberry32(11));
    const d2Team = league.teams.find((t) => t.division === 1 && t.tid !== USER_TID)!;
    const target = league.players.find((p) => d2Team.roster.includes(p.pid))!;
    const star = { ...target, ovr: 88, potential: 90 };
    const players = league.players.map((p) => (p.pid === target.pid ? star : p));
    const contexts = deriveLeagueContexts({ ...league, players });
    const first = wouldRefuseExtension(star, d2Team, league.teams, contexts);
    const second = wouldRefuseExtension(star, d2Team, league.teams, contexts);
    expect(first).toBe(second);
  });
});
