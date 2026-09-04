import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { makeLeague } from "../helpers/league.js";
import type { LeagueStore } from "../../src/core/leagueState.js";
import type { ProposedClause, TransferClause } from "../../src/core/transfers/clauses.js";

/**
 * Render harness for the two add-ons surfaces. No DOM test env here, so server
 * rendering is the cheapest thing that catches a component-level throw — and it
 * does NOT run error boundaries, so a crash fails the test rather than quietly
 * rendering a fallback (same reasoning as financePrizeRender.test.tsx).
 *
 * What it is really guarding: `ClauseEditor` calls `clauseCashDiscount`, which
 * derives every club's context off the live league, and `ClauseLedger` resolves
 * player names and club links for arbitrary stored clauses. Both are easy to
 * break with a null league, an empty proposal, or a pid the save has forgotten,
 * and none of those paths is reachable from the core tests.
 */
const leagueRef: { current: LeagueStore | null } = { current: null };

vi.mock("../../src/ui/context/LeagueContext.js", () => ({
  useLeague: () => ({ league: leagueRef.current, simming: false }),
}));

const { ClauseEditor } = await import("../../src/ui/components/ClauseEditor.js");
const { ClauseLedger, PlayerClauseNote } = await import("../../src/ui/components/ClauseLedger.js");

function render(league: LeagueStore | null, node: React.ReactElement): string {
  leagueRef.current = league;
  return renderToStaticMarkup(createElement(MemoryRouter, null, node));
}

function editor(league: LeagueStore, value: ProposedClause[], baseFee = 10_000_000) {
  return createElement(ClauseEditor, {
    pid: league.teams[6].roster[0],
    obligorTid: league.teams[7].tid,
    baseFee,
    value,
    onChange: () => {},
    direction: "selling" as const,
  });
}

describe("ClauseEditor", () => {
  it("renders collapsed with no proposal", () => {
    const league = makeLeague(0, 1);
    const html = render(league, editor(league, []));
    expect(html).toContain("Add-ons");
    // Collapsed: the controls are not in the markup until it is opened.
    expect(html).not.toContain("Sell-on share");
  });

  it("renders with a proposal attached", () => {
    const league = makeLeague(0, 1);
    const html = render(league, editor(league, [{ kind: "sellOn", share: 0.2 }]));
    expect(html).toContain("Add-ons");
  });

  it("survives a non-finite fee rather than printing NaN", () => {
    const league = makeLeague(0, 1);
    const html = render(league, editor(league, [{ kind: "sellOn", share: 0.2 }], Number.NaN));
    expect(html).not.toContain("NaN");
  });

  it("does not throw with no league loaded", () => {
    const league = makeLeague(0, 1);
    expect(() => render(null, editor(league, []))).not.toThrow();
  });
});

describe("ClauseLedger", () => {
  const clause = (over: Partial<TransferClause> = {}): TransferClause => ({
    kind: "sellOn", pid: 1, beneficiaryTid: 0, obligorTid: 1,
    season: 1, expires: 6, baseFee: 1_000_000, share: 0.2, ...over,
  } as TransferClause);

  it("renders nothing at all when the club has no add-ons", () => {
    const league = makeLeague(0, 1);
    expect(render(league, createElement(ClauseLedger))).toBe("");
  });

  it("lists both directions", () => {
    const base = makeLeague(0, 1);
    const userTid = base.meta.userTid;
    const other = base.teams.find((t) => t.tid !== userTid)!.tid;
    const league: LeagueStore = {
      ...base,
      transferClauses: [
        clause({ pid: base.players[0].pid, beneficiaryTid: userTid, obligorTid: other }),
        clause({
          kind: "bonus", trigger: "goals", amount: 500_000,
          pid: base.players[1].pid, beneficiaryTid: other, obligorTid: userTid,
        }),
      ],
    };
    const html = render(league, createElement(ClauseLedger));
    expect(html).toContain("Transfer Add-ons");
    expect(html).toContain("You&#x27;re owed");
    expect(html).toContain("You owe");
  });

  it("renders a clause naming a player the save has forgotten", () => {
    const base = makeLeague(0, 1);
    const league: LeagueStore = {
      ...base,
      transferClauses: [clause({ pid: 999_999, beneficiaryTid: base.meta.userTid, obligorTid: 1 })],
    };
    expect(() => render(league, createElement(ClauseLedger))).not.toThrow();
  });
});

describe("PlayerClauseNote", () => {
  it("renders nothing for a player carrying none", () => {
    const league = makeLeague(0, 1);
    const html = render(
      league, createElement(PlayerClauseNote, { pid: league.players[0].pid }),
    );
    expect(html).toBe("");
  });

  it("describes a clause the user is owed", () => {
    const base = makeLeague(0, 1);
    const pid = base.players[0].pid;
    const league: LeagueStore = {
      ...base,
      transferClauses: [{
        kind: "sellOn", pid, beneficiaryTid: base.meta.userTid,
        obligorTid: base.teams.find((t) => t.tid !== base.meta.userTid)!.tid,
        season: 1, expires: 6, baseFee: 1_000_000, share: 0.25,
      }],
    };
    const html = render(league, createElement(PlayerClauseNote, { pid }));
    expect(html).toContain("25%");
    expect(html).toContain("profit");
  });
});
