import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { makeLeague } from "../helpers/league.js";
import type { LeagueStore } from "../../src/core/leagueState.js";

/**
 * Render harness for Club History, covering the one thing that is easy to get
 * wrong: *which* club it shows.
 *
 * The club comes from the `tid` search param rather than component state,
 * because the club-season page links here for the club you were just looking
 * at. Held in state, that link could only ever land on your own club — which is
 * exactly the bug this pins.
 *
 * **Assert on the heading link and the selected option, never on the club's
 * name.** The picker renders an `<option>` for every club in the world, so
 * `toContain(name)` and `toContain('value="7"')` both pass whichever club the
 * page actually chose, and a test written that way is vacuous. Verified by
 * running these against the state-based version: the heading assertion fails
 * there, the name one does not.
 */
const leagueRef: { current: LeagueStore | null } = { current: null };

vi.mock("../../src/ui/context/LeagueContext.js", () => ({
  useLeague: () => ({ league: leagueRef.current, simming: false }),
}));

const { ClubHistory } = await import("../../src/ui/pages/ClubHistory.js");

function render(league: LeagueStore, search = ""): string {
  leagueRef.current = league;
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: [`/history${search}`] },
      createElement(ClubHistory),
    ),
  );
}

/** The club the page is actually about, read off its heading link. */
function shownTid(html: string): number | null {
  const m = html.match(/<h4[^>]*><a[^>]*href="\/club\/(\d+)\//);
  return m ? Number(m[1]) : null;
}

describe("Club History page render", () => {
  const base = makeLeague(0, 1);
  const userTid = base.meta.userTid;
  const otherTid = base.teams.find((t) => t.tid !== userTid)!.tid;

  it("shows your own club when no club is named", () => {
    const html = render(base);
    expect(shownTid(html)).toBe(userTid);
  });

  it("shows the club named in the URL, not your own", () => {
    const html = render(base, `?tid=${otherTid}`);
    expect(shownTid(html)).toBe(otherTid);
    // The picker has to agree with the heading, or the page contradicts itself.
    expect(html).toContain(`value="${otherTid}" selected=""`);
  });

  it("falls back to your club for a tid the save has never heard of", () => {
    expect(shownTid(render(base, "?tid=99999"))).toBe(userTid);
  });

  it("falls back to your club for a tid that isn't a number", () => {
    expect(shownTid(render(base, "?tid=banana"))).toBe(userTid);
  });

  describe("season rows", () => {
    // A club with at least one completed season, so there is a row to inspect.
    const played: LeagueStore = {
      ...base,
      season: base.season + 1,
      seasonHistory: [{
        season: base.season,
        table: base.teams.map((t, i) => ({
          tid: t.tid, played: 38, won: 38 - i, drawn: 0, lost: i,
          gf: 60, ga: 30, gd: 30, points: (38 - i) * 3,
        })),
        teamStats: [],
        awards: {},
        compsByTid: Object.fromEntries(base.teams.map((t) => [t.tid, t.compId])),
        championTidByCompId: {},
        world: { ballonDOr: [], worldTeamOfYear: [] },
      }],
    } as unknown as LeagueStore;

    it("marks each season row clickable and gives it a chevron", () => {
      const html = render(played);
      // Matched loosely on purpose: a title-winning season also carries
      // champion-highlight, and that pair is the case the hover CSS has to
      // stack two washes for rather than losing the gold one.
      expect(html).toMatch(/<tr class="season-row(?: champion-highlight)?"/);
      // The chevron is decoration, not information — the year link already says
      // where the row goes, and announcing it twice is noise.
      expect(html).toContain('<td class="season-row-go" aria-hidden="true">');
    });

    it("keeps the year a real anchor, not just a click handler", () => {
      // This is the regression that matters: a <tr> onClick cannot give you
      // cmd-click, middle-click, "open in new tab" or keyboard focus. Replacing
      // the anchor with a handler would look identical to a mouse user and
      // silently break all four.
      const html = render(played);
      expect(html).toMatch(new RegExp(`<a[^>]*href="/club/${userTid}/${base.season}"`));
    });
  });
});
