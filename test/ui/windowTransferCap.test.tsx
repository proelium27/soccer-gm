import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { createLeagueState, type LeagueStore } from "../../src/core/leagueState.js";
import { mulberry32 } from "../../src/engine/rng.js";
import { transferWindowState } from "../../src/core/transfers/window.js";
import { WINDOW_TRANSFER_LIMIT } from "../../src/core/constants.js";

/**
 * Guards the fix for the /transfers freeze.
 *
 * "Completed This Window" used to render every transfer in the window. A 240-club
 * world moves thousands per summer, and a real 5-season save produced 2056 rows,
 * 2066 flag images and 10684 DOM elements — about 1 MB of SVG flag art, drawn at
 * 13px. The JS render was only 147ms, so the cost was entirely layout, image
 * decode and paint, which is why it never showed up in profiling and why only
 * this page froze.
 */
const leagueRef: { current: LeagueStore | null } = { current: null };

vi.mock("../../src/ui/context/LeagueContext.js", () => ({
  useLeague: () => ({
    league: leagueRef.current,
    makeOfferAction: () => {},
    acceptCounterAction: () => {},
    simming: false,
  }),
}));

const { Transfers } = await import("../../src/ui/pages/Transfers.js");

/** A league whose current window contains `count` AI-to-AI transfers. */
function leagueWithWindowTransfers(count: number): LeagueStore {
  const league = createLeagueState(0, mulberry32(99));
  league.phase = "offseason";
  const ws = transferWindowState(league);
  if (!ws.open) throw new Error("expected the summer window to be open");

  const others = league.teams.filter((t) => t.tid !== league.meta.userTid);
  league.transfers = Array.from({ length: count }, (_, i) => ({
    pid: league.players[i % league.players.length].pid,
    fromTid: others[i % others.length].tid,
    toTid: others[(i + 1) % others.length].tid,
    fee: 1_000_000 + i, // ascending, so the "biggest" pick is well-defined
    season: ws.season,
    window: ws.window,
  }));
  return league;
}

function render(league: LeagueStore): string {
  leagueRef.current = league;
  return renderToStaticMarkup(
    createElement(MemoryRouter, null, createElement(Transfers)),
  );
}

const countOf = (html: string, re: RegExp) => (html.match(re) ?? []).length;

describe("Completed This Window", () => {
  it("caps the rows instead of rendering the whole window", () => {
    const html = render(leagueWithWindowTransfers(2000));
    expect(countOf(html, /<li>/g)).toBeLessThanOrEqual(WINDOW_TRANSFER_LIMIT);
  });

  it("keeps the DOM small enough that layout and paint stay cheap", () => {
    // The real save that froze rendered 10684 elements and 2066 flag images.
    const html = render(leagueWithWindowTransfers(2000));
    expect(countOf(html, /<[a-z]/g)).toBeLessThan(1500);
    expect(countOf(html, /class="player-flag"/g)).toBeLessThan(150);
  });

  it("says how many it left out, and points at the News Feed", () => {
    const html = render(leagueWithWindowTransfers(2000));
    expect(html).toContain("more went through around the league");
    expect(html).toContain('href="/news"');
  });

  it("shows every one of the user's own deals, however busy the window", () => {
    const league = leagueWithWindowTransfers(2000);
    const ws = transferWindowState(league);
    if (!ws.open) throw new Error("expected an open window");
    const userTid = league.meta.userTid;
    // Cheap AI-to-user deals: they must survive a cap that ranks others by fee.
    const mine = league.players.slice(0, 5).map((p, i) => ({
      pid: p.pid,
      fromTid: league.teams.find((t) => t.tid !== userTid)!.tid,
      toTid: userTid,
      fee: 1, // deliberately the smallest fees in the window
      season: ws.season,
      window: ws.window,
      _i: i,
    }));
    league.transfers = [...league.transfers, ...mine.map(({ _i, ...t }) => t)];

    const html = render(league);
    for (const t of mine) {
      const player = league.players.find((p) => p.pid === t.pid)!;
      expect(html).toContain(player.name);
    }
  });

  it("leaves a quiet window untouched, with no truncation note", () => {
    const html = render(leagueWithWindowTransfers(5));
    expect(countOf(html, /<li>/g)).toBe(5);
    expect(html).not.toContain("more went through around the league");
  });
});
