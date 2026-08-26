import { mulberry32 } from "../../src/engine/rng.js";
import { createLeagueState, type LeagueStore } from "../../src/core/leagueState.js";
import { simThrough } from "../../src/core/simThrough.js";
import { simOffseason } from "../../src/core/offseason.js";
import { simThroughInternational } from "../../src/core/international/index.js";

/**
 * Play any staged international campaign that entering the offseason drew, in
 * full — the headless stand-in for the user clicking the stage buttons (or "sim
 * through"). A no-op in a non-international offseason.
 */
export function playInternational(league: LeagueStore): LeagueStore {
  const r = simThroughInternational(league.international, league.players, league.lid, league.season);
  return { ...league, international: r.international, players: r.players };
}

/**
 * Advance a fresh league by `n` full seasons, running each offseason.
 *
 * Threads one rng through generation and every season, so it can't use the
 * cached `makeLeague` fixture — see the note on `test/helpers/league.ts`. At
 * roughly a minute a season it is the whole cost of the international campaign
 * tests, which is why those live in their own file (see
 * `test/core/internationalCampaign.test.ts`).
 */
export function advance(seed: number, seasons: number) {
  const rng = mulberry32(seed);
  let league = createLeagueState(0, rng);
  for (let s = 0; s < seasons; s++) {
    league = simThrough(league, "season", rng);
    league = simThrough(league, "season", rng); // clear the cup-final halt
    league = playInternational(league); // international plays out before the advance
    league = simOffseason(league, rng);
  }
  return league;
}
