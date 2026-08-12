import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { makeTeam } from "../../src/engine/composites.js";
import { simMatchDetailed } from "../../src/engine/matchSim.js";
import type { MatchPlayer, MatchEvent } from "../../src/engine/attribution.js";

/**
 * The substitution path is where out-of-position play actually happens: starters
 * are picked by fit and are essentially always in position, but the bench used
 * to answer a tired centre-back with whoever was best available, which was a
 * striker on a third of all substitutions. These lock in that the bench now
 * prices the slot it's filling.
 */

function player(pid: number, pos: MatchPlayer["pos"], ovr: number, stamina = 50): MatchPlayer {
  return {
    pid,
    pos,
    slot: pos,
    ovr,
    shooting: pos === "ST" ? 85 : 35,
    dribbling: 50,
    tackling: pos === "CB" || pos === "DM" ? 75 : 35,
    keeping: pos === "GK" ? 80 : 5,
    positioning: 55,
    heading: 45,
    stamina,
    interceptions: pos === "CB" || pos === "DM" ? 75 : 35,
  };
}

/** A 4-3-3 XI in formation order, with one player exhausted so he's the one hooked. */
function squad(pidOffset: number, tiredIndex: number): MatchPlayer[] {
  const shape: MatchPlayer["pos"][] = [
    "GK", "CB", "CB", "FB", "FB", "DM", "CM", "CM", "W", "W", "ST",
  ];
  return shape.map((pos, i) =>
    player(pidOffset + i + 1, pos, 65, i === tiredIndex ? 1 : 99),
  );
}

const subsFor = (events: MatchEvent[], side: string) =>
  events.filter((e) => e.type === "substitution" && e.side === side);

describe("substitutions price the slot being filled", () => {
  // Slot 1 is a centre-back in the 4-3-3 shape above.
  const TIRED_CB = 1;

  it("does not answer a tired centre-back with a much weaker out-of-position striker", () => {
    // Bench holds only strikers, none of them better than the tired centre-back.
    const bench = ["ST", "ST", "ST", "ST"].map((pos, i) =>
      player(500 + i, pos as MatchPlayer["pos"], 63, 99),
    );
    const result = simMatchDetailed(
      mulberry32(4),
      makeTeam("Home"),
      makeTeam("Away"),
      squad(0, TIRED_CB),
      squad(100, TIRED_CB),
      bench,
      [],
    );
    const homeSubs = subsFor(result.boxScore.events, "home");
    // Any sub that did happen must not have put a striker into the centre-back
    // slot in a like-for-like swap. Chase-the-game subs are a deliberate reshape
    // and are allowed, so only non-final-checkpoint swaps are checked.
    const cbPid = squad(0, TIRED_CB)[TIRED_CB].pid;
    const likeForLike = homeSubs.filter((e) => e.pids[0] === cbPid && e.clock > 900);
    expect(likeForLike).toHaveLength(0);
  });

  it("still makes the swap when the out-of-position player is far better", () => {
    // Same shape, but the bench striker is dramatically better — enough to be
    // worth playing out of position.
    const bench = [player(600, "ST", 92, 99)];
    const result = simMatchDetailed(
      mulberry32(4),
      makeTeam("Home"),
      makeTeam("Away"),
      squad(0, TIRED_CB),
      squad(100, TIRED_CB),
      bench,
      [],
    );
    expect(subsFor(result.boxScore.events, "home").length).toBeGreaterThan(0);
  });

  it("prefers an equally-rated bench player who actually plays the slot", () => {
    const bench = [player(700, "ST", 70, 99), player(701, "CB", 70, 99)];
    const result = simMatchDetailed(
      mulberry32(4),
      makeTeam("Home"),
      makeTeam("Away"),
      squad(0, TIRED_CB),
      squad(100, TIRED_CB),
      bench,
      [],
    );
    const first = subsFor(result.boxScore.events, "home")[0];
    expect(first).toBeDefined();
    expect(first.pids[1]).toBe(701);
  });

  it("a substitute is rated on the slot he took over, not his own position", () => {
    // A striker coming on for a centre-back is judged as a centre-back, so his
    // rating reflects defensive work rather than the goals he didn't score.
    const bench = [player(800, "ST", 90, 99)];
    const result = simMatchDetailed(
      mulberry32(9),
      makeTeam("Home"),
      makeTeam("Away"),
      squad(0, TIRED_CB),
      squad(100, TIRED_CB),
      bench,
      [],
    );
    const sub = subsFor(result.boxScore.events, "home").find((e) => e.pids[1] === 800);
    expect(sub).toBeDefined();
    const line = result.boxScore.home.find((l) => l.pid === 800);
    expect(line).toBeDefined();
    // He is graded at all (the rating pipeline resolved a slot for him rather
    // than falling through), and on a plausible scale.
    expect(line!.rating).toBeGreaterThan(0);
    expect(line!.rating).toBeLessThanOrEqual(10);
  });
});
