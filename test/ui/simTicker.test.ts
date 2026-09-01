import { describe, it, expect } from "vitest";
import { tickerItemsFor } from "../../src/ui/components/SimOverlay.js";
import type { SimProgress } from "../../src/ui/useSimWorker.js";
import type { CupTie } from "../../src/core/cup/types.js";
import type { DomesticTieResult } from "../../src/core/simThrough.js";
import type { PlayedMatch } from "../../src/core/standings.js";
import { SPECTATOR_TID } from "../../src/core/spectator.js";

const USER = 120; // a German club, in this fixture

function tie(home: number, away: number): CupTie {
  return {
    round: 1, matchday: 9, home, away, homeGoals: 2, awayGoals: 1,
    wentToExtraTime: false, wentToPens: false, homePens: 0, awayPens: 0,
    winner: home, boxScore: null,
  };
}

function domestic(cupName: string, isUserCountry: boolean, home: number, away: number): DomesticTieResult {
  return { tie: tie(home, away), cupName, roundName: "Round of 32", isUserCountry };
}

/**
 * Ties arrive in competition-table order, so England's are always first. A save
 * in any other country must never be shown England's cup.
 */
function progress(domesticTies: DomesticTieResult[]): SimProgress {
  return {
    matchday: 9, matchdayIndex: 0, totalMatchdays: 38,
    results: [], cupTies: [], domesticTies,
  };
}

describe("sim ticker — domestic cup labelling", () => {
  it("shows the user's own country's cup when his club isn't playing a tie", () => {
    const items = tickerItemsFor(progress([
      domestic("English Cup", false, 3, 4),
      domestic("German Cup", true, 121, 122),
      domestic("Spanish Cup", false, 41, 42),
    ]), USER);

    const marker = items.find((i) => i.kind === "cup-marker");
    expect(marker).toBeDefined();
    // The bug this pins: taking the first tie showed "English Cup" to everyone.
    expect(marker!.kind === "cup-marker" && marker!.label).toBe("German Cup");
  });

  it("shows his own tie, with his own cup's name, when he is playing", () => {
    const items = tickerItemsFor(progress([
      domestic("English Cup", false, 3, 4),
      domestic("German Cup", true, USER, 122),
    ]), USER);

    const card = items.find((i) => i.kind === "cup");
    expect(card).toBeDefined();
    expect(card!.kind === "cup" && card!.label).toBe("German Cup");
    expect(card!.kind === "cup" && card!.tie.home).toBe(USER);
  });

  it("shows no domestic marker at all when the user's country has no tie that day", () => {
    // Only reachable if countries ever stop sharing cup matchdays. Showing
    // another country's cup would be worse than showing nothing.
    const items = tickerItemsFor(progress([domestic("English Cup", false, 3, 4)]), USER);
    expect(items.some((i) => i.kind === "cup-marker")).toBe(false);
  });

  it("is unbothered by a matchday with no domestic ties", () => {
    expect(() => tickerItemsFor(progress([]), USER)).not.toThrow();
    expect(tickerItemsFor(progress([]), USER)).toEqual([]);
  });
});

/**
 * A spectator save has no club, so the ticker's whole premise — your league
 * match, your cup tie — comes up empty and the strip sat on a placeholder for
 * the length of a season sim. It shows the matchday's standout result instead.
 */
describe("sim ticker — a save with no club", () => {
  function match(home: number, away: number, homeGoals: number, awayGoals: number): PlayedMatch {
    return { matchday: 9, home, away, homeGoals, awayGoals } as PlayedMatch;
  }

  function withResults(results: PlayedMatch[]): SimProgress {
    return { matchday: 9, matchdayIndex: 0, totalMatchdays: 38, results, cupTies: [], domesticTies: [] };
  }

  it("leads with the widest winning margin", () => {
    const items = tickerItemsFor(withResults([
      match(1, 2, 1, 0),
      match(3, 4, 5, 0),   // margin 5
      match(5, 6, 4, 3),   // more goals, smaller margin
    ]), SPECTATOR_TID);

    const card = items.find((i) => i.kind === "result");
    expect(card).toBeDefined();
    expect(card!.kind === "result" && card!.game.home).toBe(3);
  });

  it("counts an away thrashing too", () => {
    const items = tickerItemsFor(withResults([
      match(1, 2, 2, 0),
      match(3, 4, 0, 4),
    ]), SPECTATOR_TID);
    const card = items.find((i) => i.kind === "result");
    expect(card!.kind === "result" && card!.game.home).toBe(3);
  });

  /**
   * Two identical margins must always resolve the same way, or the same simmed
   * matchday shows a different card each time it is replayed.
   */
  it("breaks a tie on goals, then on tid, so a replay shows the same match", () => {
    const byGoals = tickerItemsFor(withResults([
      match(1, 2, 3, 0),
      match(3, 4, 4, 1),  // same margin, more goals
    ]), SPECTATOR_TID);
    expect(byGoals[0].kind === "result" && byGoals[0].game.home).toBe(3);

    // Held in a const: narrowing `kind` does not carry across two separate
    // calls, so `[0].game` off a second call is a type error.
    const byTid = tickerItemsFor(
      withResults([match(7, 8, 3, 0), match(2, 9, 3, 0)]), SPECTATOR_TID,
    );
    expect(byTid[0].kind === "result" && byTid[0].game.home).toBe(2);
  });

  it("still marks the cup round being played that day", () => {
    const md = withResults([match(1, 2, 1, 0)]);
    md.cupTies = [tie(3, 4)];
    const items = tickerItemsFor(md, SPECTATOR_TID);
    expect(items.some((i) => i.kind === "result")).toBe(true);
    expect(items.some((i) => i.kind === "cup-marker")).toBe(true);
  });

  it("shows nothing rather than throwing on a matchday with no matches", () => {
    expect(tickerItemsFor(withResults([]), SPECTATOR_TID)).toEqual([]);
  });

  it("leaves the managed case alone", () => {
    const items = tickerItemsFor(withResults([
      match(1, 2, 6, 0),        // a bigger result than the user's
      match(USER, 4, 1, 1),
    ]), USER);
    // His own match, not the standout, and drawn as his.
    expect(items[0].kind).toBe("league");
    expect(items[0].kind === "league" && items[0].game.home).toBe(USER);
    expect(items.some((i) => i.kind === "result")).toBe(false);
  });
});
