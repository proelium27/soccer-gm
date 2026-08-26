// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { makeLeague } from "../helpers/league.js";
import type { LeagueStore } from "../../src/core/leagueState.js";

/**
 * The first tests in this repo that actually *drive* a page.
 *
 * Everything else renders to a static string, which reaches markup but never
 * effects, state or event handlers — so the interactive half of the app has
 * been structurally untestable, and that is precisely where the long-standing
 * "the transfers tab keeps crashing" report lives (see CLAUDE.md). Every
 * candidate cause ruled out so far was ruled out by static means; the surfaces
 * that were never reachable are the ones exercised here: typing into the
 * debounced filters, sorting a column, and the `pinnedBuys` effect.
 *
 * Needs a DOM, hence the `@vitest-environment happy-dom` pragma above. It is
 * set per file on purpose rather than globally in the vitest config: the ~160
 * other test files are pure logic or server-rendered markup and would only pay
 * for an environment they never touch.
 */

const leagueRef: { current: LeagueStore | null } = { current: null };
const makeOfferAction = vi.fn();
const acceptCounterAction = vi.fn();

vi.mock("../../src/ui/context/LeagueContext.js", () => ({
  useLeague: () => ({
    league: leagueRef.current,
    makeOfferAction,
    acceptCounterAction,
    simming: false,
  }),
}));

const { Transfers } = await import("../../src/ui/pages/Transfers.js");

/** The page as the user meets it: a fresh league with the summer window open. */
function open(league: LeagueStore) {
  leagueRef.current = league;
  return render(createElement(MemoryRouter, null, createElement(Transfers)));
}

function freshLeague(): LeagueStore {
  const league = makeLeague(0, 12345);
  league.phase = "offseason";
  return league;
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

/** Let the 250ms `useDebounced` timer fire and React flush what it triggered. */
async function settleDebounce() {
  await act(async () => {
    vi.advanceTimersByTime(300);
  });
}

describe("Transfers page — interaction", () => {
  it("mounts and runs its effects without looping", () => {
    // A `useEffect` that sets state listed in its own dependency array is one
    // bad guard away from an infinite render, and React surfaces that as
    // "Maximum update depth exceeded" — a throw a static render can never see.
    // `pinnedBuys` has exactly that shape, so simply mounting is the assertion.
    open(freshLeague());
    expect(screen.getByText("Recommended Transfers")).toBeTruthy();
  });

  it("survives typing into every debounced filter", async () => {
    // Each keystroke re-runs a scan over every club's roster behind a 250ms
    // debounce. Typing was one of the named untested surfaces.
    const { container } = open(freshLeague());
    const numeric = container.querySelectorAll<HTMLInputElement>('input[type="number"]');
    expect(numeric.length).toBeGreaterThan(0);

    for (const input of Array.from(numeric)) {
      fireEvent.change(input, { target: { value: "70" } });
    }
    await settleDebounce();

    // Still standing, and the inputs kept what was typed (they are bound to the
    // undelayed state, which is what keeps typing feeling instant).
    expect(screen.getByText("Recommended Transfers")).toBeTruthy();
    for (const input of Array.from(numeric)) expect(input.value).toBe("70");
  });

  it("clears back to an unfiltered list when the filters are emptied", async () => {
    const { container } = open(freshLeague());
    const input = container.querySelector<HTMLInputElement>('input[type="number"]')!;

    fireEvent.change(input, { target: { value: "99" } });
    await settleDebounce();
    fireEvent.change(input, { target: { value: "" } });
    await settleDebounce();

    expect(input.value).toBe("");
    expect(screen.getByText("Recommended Transfers")).toBeTruthy();
  });

  it("sorts a column, and flips direction when the same header is clicked twice", () => {
    open(freshLeague());
    const ovr = screen.getAllByText("Ovr")[0].closest("th")!;

    // Unsorted to begin with: the default "recommended" key is a real ordering
    // (best-fit first), not a column.
    expect(ovr.getAttribute("aria-sort")).toBe("none");

    fireEvent.click(ovr);
    expect(ovr.getAttribute("aria-sort")).toBe("descending");

    fireEvent.click(ovr);
    expect(ovr.getAttribute("aria-sort")).toBe("ascending");
  });

  it("moves the sort indicator when a different column is chosen", () => {
    open(freshLeague());
    const ovr = screen.getAllByText("Ovr")[0].closest("th")!;
    const name = screen.getAllByText("Name")[0].closest("th")!;

    fireEvent.click(ovr);
    fireEvent.click(name);

    expect(ovr.getAttribute("aria-sort")).toBe("none");
    // Name opts into ascending first, being a text column.
    expect(name.getAttribute("aria-sort")).toBe("ascending");
  });

  it("keeps sorting and filtering working together", async () => {
    const { container } = open(freshLeague());
    const input = container.querySelector<HTMLInputElement>('input[type="number"]')!;

    fireEvent.click(screen.getAllByText("Ovr")[0].closest("th")!);
    fireEvent.change(input, { target: { value: "60" } });
    await settleDebounce();
    fireEvent.click(screen.getAllByText("Name")[0].closest("th")!);
    await settleDebounce();

    expect(screen.getByText("Recommended Transfers")).toBeTruthy();
  });
});
