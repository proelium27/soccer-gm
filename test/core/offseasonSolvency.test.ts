/**
 * Offseason: the league stays solvent and grows season over season.
 *
 * On its own because it is the one offseason test that chains *three* seasons
 * rather than one, which made it roughly as expensive as the other five
 * finance tests combined. Splitting it out is the same move, for the same
 * reason, as the rest of the offseason suite — see the note in
 * `test/core/offseason.test.ts`.
 */

import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { simOffseason } from "../../src/core/offseason.js";
import { playFullSeason, playSeason } from "../helpers/offseasonLeague.js";

describe("simOffseason — solvency over multiple seasons", () => {
  it("keeps every AI club solvent and grows the league's total budget each season", () => {
    // Since AI clubs now trade with each other, an individual club's budget no
    // longer only ever grows — a net buyer spends cash on fees. The design
    // invariants that must still hold: no AI club is ever driven into deficit,
    // and the league-wide total budget still climbs every season (transfer
    // fees just move money between clubs; season settlement injects it).
    const rng = mulberry32(11);
    let league = playFullSeason(rng);
    const userTid = league.meta.userTid;
    const total = (l: typeof league) => l.teams.reduce((s, t) => s + t.budget, 0);

    for (let s = 0; s < 2; s++) {
      const totalBefore = total(league);
      league = simOffseason(league, rng);
      for (const team of league.teams) {
        if (team.tid !== userTid) expect(team.budget).toBeGreaterThanOrEqual(0);
      }
      expect(total(league)).toBeGreaterThan(totalBefore);
      league = playSeason(league, rng);
    }
  });
});
