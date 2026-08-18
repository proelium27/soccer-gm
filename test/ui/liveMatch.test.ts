import { describe, expect, it } from "vitest";
import type { MatchEvent } from "../../src/engine/attribution.js";
import {
  eventMinute,
  eventsThrough,
  finalMinute,
  REGULATION_MINUTES,
  scoreAtMinute,
  scoresAtMinute,
  splitTwoLeggedEvents,
  statsAtMinute,
  type LiveMatch,
} from "../../src/ui/live/liveMatch.js";

/**
 * The live viewer replays a recorded event stream, so every question it asks is
 * "what had happened by minute N". These pin that arithmetic — most importantly
 * that the clock counts DOWN, which is the easy thing to get backwards.
 */

/** An event at a given match minute, so the tests read in minutes not seconds. */
function at(minute: number, type: MatchEvent["type"], side: MatchEvent["side"] = "home"): MatchEvent {
  return { clock: 5400 - (minute - 1) * 60 - 1, type, side, pids: [1] };
}

describe("eventMinute", () => {
  it("counts the clock down from 5400, not up", () => {
    expect(eventMinute(5400)).toBe(1);
    expect(eventMinute(2700)).toBe(45);
    expect(eventMinute(0)).toBe(90);
  });

  it("puts stoppage time past 90, where a negative clock lands", () => {
    expect(eventMinute(-90)).toBe(92);
  });

  it("never reports a minute 0 — kickoff is the 1st minute", () => {
    expect(eventMinute(5400)).toBe(1);
    expect(eventMinute(5399)).toBe(1);
  });
});

describe("finalMinute", () => {
  it("is regulation length when nothing happened in stoppage", () => {
    expect(finalMinute([at(10, "goal"), at(80, "goal")])).toBe(REGULATION_MINUTES);
  });

  it("stretches to cover a stoppage-time event", () => {
    expect(finalMinute([at(10, "goal"), { clock: -150, type: "goal", side: "away", pids: [2] }])).toBe(93);
  });

  it("handles a match with no events at all", () => {
    expect(finalMinute([])).toBe(REGULATION_MINUTES);
  });
});

describe("eventsThrough", () => {
  const events = [at(10, "goal"), at(50, "yellow_card"), at(80, "substitution")];

  it("reveals only what had happened by the given minute", () => {
    expect(eventsThrough(events, 9)).toHaveLength(0);
    expect(eventsThrough(events, 10)).toHaveLength(1);
    expect(eventsThrough(events, 50)).toHaveLength(2);
    expect(eventsThrough(events, 90)).toHaveLength(3);
  });

  it("returns them chronologically even when the stream is out of order", () => {
    const shuffled = [at(80, "substitution"), at(10, "goal"), at(50, "yellow_card")];
    expect(eventsThrough(shuffled, 90).map((e) => eventMinute(e.clock))).toEqual([10, 50, 80]);
  });
});

describe("scoreAtMinute", () => {
  const events = [at(10, "goal", "home"), at(55, "goal", "away"), at(70, "goal", "home")];

  it("counts only goals scored by that minute", () => {
    expect(scoreAtMinute(events, 5)).toEqual({ home: 0, away: 0 });
    expect(scoreAtMinute(events, 10)).toEqual({ home: 1, away: 0 });
    expect(scoreAtMinute(events, 60)).toEqual({ home: 1, away: 1 });
    expect(scoreAtMinute(events, 90)).toEqual({ home: 2, away: 1 });
  });

  it("ignores everything that is not a goal", () => {
    expect(scoreAtMinute([at(10, "shot_saved"), at(20, "corner")], 90)).toEqual({ home: 0, away: 0 });
  });
});

describe("statsAtMinute", () => {
  it("counts a goal and a save as on target, a block and a miss as not", () => {
    const events = [
      at(10, "goal", "home"),
      at(20, "shot_saved", "home"),
      at(30, "shot_blocked", "home"),
      at(40, "shot_off_target", "home"),
    ];
    const { home } = statsAtMinute(events, 90);
    expect(home.shots).toBe(4);
    expect(home.onTarget).toBe(2);
    expect(home.goals).toBe(1);
  });

  it("keeps the two sides apart", () => {
    const events = [at(10, "goal", "home"), at(20, "yellow_card", "away"), at(30, "corner", "away")];
    const { home, away } = statsAtMinute(events, 90);
    expect(home.goals).toBe(1);
    expect(home.yellows).toBe(0);
    expect(away.yellows).toBe(1);
    expect(away.corners).toBe(1);
  });

  it("accumulates as the minutes pass rather than jumping to the final total", () => {
    const events = [at(10, "shot_saved"), at(70, "shot_saved")];
    expect(statsAtMinute(events, 30).home.shots).toBe(1);
    expect(statsAtMinute(events, 90).home.shots).toBe(2);
  });
});

describe("splitTwoLeggedEvents", () => {
  /**
   * A finished two-legged cup tie stores [...leg1, ...leg2] on ONE box score,
   * and both legs count down from the same 5400. Replaying that merged stream
   * would cram 180 minutes onto a 90-minute clock, so the viewer splits it back
   * apart at the one point where the clock jumps back up.
   */
  it("splits a merged tie at the point the clock restarts", () => {
    const leg1 = [at(10, "goal", "home"), at(80, "goal", "away")];
    const leg2 = [at(5, "goal", "home"), at(60, "yellow_card", "away"), at(88, "goal", "home")];
    const [first, second] = splitTwoLeggedEvents([...leg1, ...leg2]);
    expect(first).toEqual(leg1);
    expect(second).toEqual(leg2);
  });

  it("scores each leg separately once split, rather than as one long match", () => {
    const leg1 = [at(10, "goal", "home")];
    const leg2 = [at(5, "goal", "home"), at(70, "goal", "home")];
    const [first, second] = splitTwoLeggedEvents([...leg1, ...leg2]);
    expect(scoreAtMinute(first, 90)).toEqual({ home: 1, away: 0 });
    expect(scoreAtMinute(second, 90)).toEqual({ home: 2, away: 0 });
    // The merged stream would have read as a single 3-0 match.
    expect(scoreAtMinute([...leg1, ...leg2], 90)).toEqual({ home: 3, away: 0 });
  });

  it("treats a single-leg tie as one leg with nothing after it", () => {
    const only = [at(10, "goal", "home"), at(80, "goal", "away")];
    expect(splitTwoLeggedEvents(only)).toEqual([only, []]);
  });

  it("handles an empty stream", () => {
    expect(splitTwoLeggedEvents([])).toEqual([[], []]);
  });

  it("splits on the first restart only, so a long second leg stays whole", () => {
    const leg1 = [at(30, "goal", "home")];
    const leg2 = [at(2, "goal", "away"), at(40, "goal", "home"), at(90, "goal", "away")];
    const [, second] = splitTwoLeggedEvents([...leg1, ...leg2]);
    expect(second).toHaveLength(3);
  });
});

describe("scoresAtMinute", () => {
  function match(events: MatchEvent[]): LiveMatch {
    return { home: 1, away: 2, matchday: 1, events };
  }

  it("reports every match on the rail at the same shared minute", () => {
    const rail = scoresAtMinute([match([at(20, "goal", "home")]), match([at(70, "goal", "away")])], 30);
    expect(rail[0].score).toEqual({ home: 1, away: 0 });
    expect(rail[1].score).toEqual({ home: 0, away: 0 });
  });

  it("flags a goal on exactly this minute so the rail can flash it", () => {
    const rail = scoresAtMinute([match([at(20, "goal", "home")])], 20);
    expect(rail[0].justScored).toBe(true);
    expect(scoresAtMinute([match([at(20, "goal", "home")])], 21)[0].justScored).toBe(false);
  });
});
