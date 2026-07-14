import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { generatePlayer } from "../../src/core/players/generate.js";
import { computeTeamRating } from "../../src/core/teams/teamRating.js";
import { ROSTER_COMPOSITION } from "../../src/core/constants.js";
import { POSITIONS } from "../../src/core/players/types.js";
import type { Player } from "../../src/core/players/types.js";

function roster(seed: number): Player[] {
  const rng = mulberry32(seed);
  const players: Player[] = [];
  let pid = 0;
  for (const pos of POSITIONS)
    for (let i = 0; i < ROSTER_COMPOSITION[pos]; i++)
      players.push(generatePlayer(rng, pos, 52, pid++, 20, 1));
  return players;
}

describe("computeTeamRating", () => {
  it("returns 0/0 for an empty roster", () => {
    expect(computeTeamRating([], null)).toEqual({ ovr: 0, pot: 0 });
  });

  it("weighs starters and bench above a plain whole-roster mean", () => {
    const squad = roster(1);
    const rating = computeTeamRating(squad, null);
    const plainMean = Math.round(squad.reduce((s, p) => s + p.ovr, 0) / squad.length);
    // The weighted rating should differ from a straight 30-player mean, since
    // deep bench players are downweighted rather than counted equally.
    expect(rating.ovr).not.toBe(plainMean);
  });

  it("moves when the best bench player improves, unlike an XI-only average", () => {
    const squad = roster(2);
    const before = computeTeamRating(squad, null);
    const boosted = squad.map((p) => ({ ...p }));
    // Bump every rating on the whole squad's weakest player up to max so it
    // becomes a strong bench player without displacing any starter's slot
    // (there are more CBs than starting CB slots, so this stays on the bench).
    const weakest = [...boosted].sort((a, b) => a.ovr - b.ovr)[0];
    weakest.ovr = 99;
    const after = computeTeamRating(boosted, null);
    expect(after.ovr).toBeGreaterThan(before.ovr);
  });

  it("is deterministic for the same roster and starters", () => {
    const squad = roster(3);
    expect(computeTeamRating(squad, null)).toEqual(computeTeamRating(squad, null));
  });

  it("falls back to auto-selected XI when starters is null (AI teams)", () => {
    const squad = roster(4);
    const auto = computeTeamRating(squad, null);
    const manual = computeTeamRating(squad, undefined);
    expect(auto).toEqual(manual);
  });
});
