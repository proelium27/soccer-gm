import { describe, it, expect } from "vitest";
import {
  maxValue, minValue, simTargetHint, targetMatchday,
} from "../../src/ui/simTarget.js";
import { TRANSFER_DEADLINE_MATCHDAY } from "../../src/core/calendar.js";

describe("targetMatchday", () => {
  it("'to' mode passes the entered matchday straight through", () => {
    expect(targetMatchday("to", 22, 9)).toBe(22);
  });

  it("'forward 1' plays the matchday you're standing on, not the next one", () => {
    expect(targetMatchday("forward", 1, 9)).toBe(9);
    expect(targetMatchday("forward", 4, 9)).toBe(12);
  });
});

describe("input bounds", () => {
  it("'to' mode can't be asked to go backwards or past the final matchday", () => {
    expect(minValue("to", 9)).toBe(9);
    expect(maxValue("to", 9, 38)).toBe(38);
  });

  it("'forward' mode caps at the number of matchdays left", () => {
    expect(minValue("forward", 36)).toBe(1);
    expect(maxValue("forward", 36, 38)).toBe(3);
  });
});

describe("simTargetHint", () => {
  it("names the span, the count and the month it ends in", () => {
    expect(simTargetHint("to", 12, 9, 38)).toContain("matchdays 9-12");
    expect(simTargetHint("to", 12, 9, 38)).toContain("4 matchdays");
    expect(simTargetHint("to", 12, 9, 38)).toContain("October");
  });

  it("uses the singular when only one matchday is played", () => {
    const hint = simTargetHint("forward", 1, 9, 38);
    expect(hint).toContain("matchday 9");
    expect(hint).toContain("1 matchday)");
  });

  it("flags that stopping short of deadline day keeps the winter window open", () => {
    expect(simTargetHint("to", TRANSFER_DEADLINE_MATCHDAY - 1, 9, 38))
      .toContain("deadline day with the winter window still open");
  });

  it("warns when the run plays through deadline day and shuts the window", () => {
    expect(simTargetHint("to", TRANSFER_DEADLINE_MATCHDAY, 9, 38))
      .toContain("shutting the winter window");
    expect(simTargetHint("to", 30, 9, 38)).toContain("shutting the winter window");
  });

  it("says nothing about the window once deadline day is behind you", () => {
    expect(simTargetHint("to", 30, 25, 38)).not.toContain("window");
  });

  it("asks for a number in range instead of describing an impossible sim", () => {
    expect(simTargetHint("to", 5, 9, 38)).toBe("Pick a matchday between 9 and 38.");
    expect(simTargetHint("to", 39, 9, 38)).toBe("Pick a matchday between 9 and 38.");
    expect(simTargetHint("to", NaN, 9, 38)).toBe("Pick a matchday between 9 and 38.");
    expect(simTargetHint("to", 9.5, 9, 38)).toBe("Pick a matchday between 9 and 38.");
    expect(simTargetHint("forward", 0, 9, 38)).toBe("Pick a number between 1 and 30.");
  });
});
