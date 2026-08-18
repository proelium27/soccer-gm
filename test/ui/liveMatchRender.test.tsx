import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { LiveMatchOverlay } from "../../src/ui/components/LiveMatchOverlay.js";
import type { MatchEvent } from "../../src/engine/attribution.js";
import type { StoredTeam } from "../../src/core/teams/clubs.js";
import type { LiveMatch } from "../../src/ui/live/liveMatch.js";

/**
 * Render harness for the live viewer (the pattern from transfersRender.test.tsx:
 * there is no DOM test env here, so this pins the server-rendered markup).
 *
 * The property that matters is that the viewer shows the match as it stood at
 * the current minute and NOT how it finished. A static render lands on minute 0,
 * which is exactly the frame where a leak would be obvious: the final score is
 * sitting right there on the match object it was handed.
 */

function at(minute: number, type: MatchEvent["type"], side: MatchEvent["side"]): MatchEvent {
  return { clock: 5400 - (minute - 1) * 60 - 1, type, side, pids: [1, 2] };
}

function match(over: Partial<LiveMatch> = {}): LiveMatch {
  return {
    home: 1,
    away: 2,
    matchday: 7,
    events: [
      at(20, "goal", "home"),
      at(55, "goal", "away"),
      at(70, "goal", "home"),
      at(88, "goal", "home"),
    ],
    ...over,
  };
}

function team(tid: number, name: string, abbrev: string): StoredTeam {
  return { tid, name, abbrev, colors: ["#123456", "#654321"], compId: 0 } as StoredTeam;
}

const TEAMS = [team(1, "Ashford United", "ASH"), team(2, "Kestrel City", "KES"), team(3, "Marden", "MAR"), team(4, "Thorne", "THO")];

function render(node: Parameters<typeof renderToStaticMarkup>[0]): string {
  return renderToStaticMarkup(createElement(MemoryRouter, null, node));
}

function overlay(over: Record<string, unknown> = {}) {
  return createElement(LiveMatchOverlay, {
    open: true,
    match: match(),
    otherMatches: [],
    teams: TEAMS,
    playerName: (pid: number) => `Player ${pid}`,
    competitionName: "Premier Division",
    tableAtMinute: () => TEAMS.map((t) => ({ tid: t.tid, points: 0 })),
    onComplete: () => {},
    ...over,
  } as never);
}

describe("LiveMatchOverlay", () => {
  it("kicks off goalless rather than showing the final score", () => {
    const html = render(overlay());
    expect(html).toContain("0 - 0");
    // The match finished 3-1 and that number is on the object it was handed.
    expect(html).not.toContain("3 - 1");
  });

  it("has not revealed any of the match's events at kickoff", () => {
    const html = render(overlay());
    expect(html).not.toContain("Goal");
    expect(html).toContain("Just about to kick off");
  });

  it("names the competition and matchday", () => {
    const html = render(overlay());
    expect(html).toContain("Premier Division");
    expect(html).toContain("Matchday 7");
  });

  it("names both clubs", () => {
    const html = render(overlay());
    expect(html).toContain("Ashford United");
    expect(html).toContain("Kestrel City");
  });

  it("lists other matches on the rail by abbreviation", () => {
    const other = match({ home: 3, away: 4, matchday: 7 });
    const html = render(overlay({ otherMatches: [other] }));
    expect(html).toContain("Elsewhere");
    expect(html).toContain("MAR");
    expect(html).toContain("THO");
  });

  it("shows a live table covering the whole competition", () => {
    const html = render(overlay({ otherMatches: [match({ home: 3, away: 4 })] }));
    expect(html).toContain("Live table");
    // All four clubs in the competition appear, not just the two on the pitch.
    for (const abbrev of ["ASH", "KES", "MAR", "THO"]) expect(html).toContain(abbrev);
  });

  it("renders nothing at all when closed", () => {
    expect(render(overlay({ open: false }))).toBe("");
  });
});
