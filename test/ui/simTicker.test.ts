import { describe, it, expect } from "vitest";
import { tickerItemsFor } from "../../src/ui/components/SimOverlay.js";
import type { SimProgress } from "../../src/ui/useSimWorker.js";
import type { CupTie } from "../../src/core/cup/types.js";
import type { DomesticTieResult } from "../../src/core/simThrough.js";

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
