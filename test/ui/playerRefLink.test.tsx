import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import type { LeagueStore } from "../../src/core/leagueState.js";

/**
 * The pid -> name lookup every historical surface renders through.
 *
 * Both things pinned here fail *silently*, which is the whole reason the file
 * exists. Get the fallback order wrong and a page shows a stale name instead of
 * the current one — no throw, no type error. Lose the per-league cache (the
 * obvious "simplification" being a `useMemo` inside the component) and every
 * page still renders correctly, just slowly: the map holds an entry per player
 * in the world, and `PlayerRefLink` is rendered once per row on lists that run
 * to thousands of rows. Neither shows up in any other test.
 */

const leagueRef: { current: LeagueStore | null } = { current: null };

vi.mock("../../src/ui/context/LeagueContext.js", () => ({
  useLeague: () => ({ league: leagueRef.current }),
}));

const { playerRefIndex, PlayerRefLink } = await import("../../src/ui/components/PlayerRefLink.js");

/**
 * The same pid recorded in all five places at once, each with a different name,
 * so a single lookup reveals which tier won.
 */
function leagueWithAllTiers(pid: number): LeagueStore {
  return {
    players: [{ pid, name: "Live Player", nationality: "England" }],
    retiredPlayers: [{ pid, name: "Archived Player", nationality: "Spain" }],
    playerNames: [{ pid, name: "Name Table Player", nationality: "Italy" }],
    seasonHistory: [
      {
        awardWinners: [{ pid, name: "Award Player", nationality: "France" }],
        retirements: { notable: [{ pid, name: "Farewell Player", nationality: "Brazil" }] },
      },
    ],
  } as unknown as LeagueStore;
}

/** Drop the higher-priority sources one at a time to expose the next tier down. */
function without(pid: number, ...drop: Array<"players" | "retiredPlayers" | "playerNames" | "awardWinners">) {
  const l = leagueWithAllTiers(pid) as unknown as Record<string, unknown>;
  if (drop.includes("players")) l.players = [];
  if (drop.includes("retiredPlayers")) l.retiredPlayers = [];
  if (drop.includes("playerNames")) l.playerNames = [];
  if (drop.includes("awardWinners")) {
    (l.seasonHistory as { awardWinners: unknown[] }[])[0].awardWinners = [];
  }
  return l as unknown as LeagueStore;
}

const render = (league: LeagueStore, pid: number, fallback?: string) => {
  leagueRef.current = league;
  return renderToStaticMarkup(
    createElement(MemoryRouter, null, createElement(PlayerRefLink, { pid, fallback })),
  );
};

describe("playerRefIndex — which record wins", () => {
  it("prefers the live pool over every archived record", () => {
    expect(playerRefIndex(leagueWithAllTiers(7)).get(7)).toMatchObject({
      name: "Live Player", retired: false, linkable: true,
    });
  });

  it("falls back to the retiree archive, which still has a profile page", () => {
    expect(playerRefIndex(without(7, "players")).get(7)).toMatchObject({
      name: "Archived Player", retired: true, linkable: true,
    });
  });

  it("then the name table — a name only, so not linkable", () => {
    expect(playerRefIndex(without(7, "players", "retiredPlayers")).get(7)).toMatchObject({
      name: "Name Table Player", retired: true, linkable: false,
    });
  });

  it("then the award snapshot, for a winner the archive dropped", () => {
    expect(playerRefIndex(without(7, "players", "retiredPlayers", "playerNames")).get(7)).toMatchObject({
      name: "Award Player", retired: true, linkable: false,
    });
  });

  it("and last the farewell list, which reaches players who never won anything", () => {
    const l = without(7, "players", "retiredPlayers", "playerNames", "awardWinners");
    expect(playerRefIndex(l).get(7)).toMatchObject({
      name: "Farewell Player", retired: true, linkable: false,
    });
  });

  it("returns nothing for a pid the save has genuinely forgotten", () => {
    expect(playerRefIndex(leagueWithAllTiers(7)).get(999)).toBeUndefined();
  });

  it("tolerates a save predating the archive and name-table fields", () => {
    // Both are optional and absent on old saves; reading them must not throw.
    const old = { players: [{ pid: 1, name: "Old", nationality: "England" }], seasonHistory: [] };
    expect(playerRefIndex(old as unknown as LeagueStore).get(1)?.name).toBe("Old");
  });
});

describe("playerRefIndex — caching", () => {
  it("builds the map once per league object, not once per lookup", () => {
    const league = leagueWithAllTiers(7);
    // Identity, not equality: a `useMemo` per component (or no cache at all)
    // would hand back a fresh map here, rebuilding ~6000 entries per row.
    expect(playerRefIndex(league)).toBe(playerRefIndex(league));
  });

  it("rebuilds for a new league object, so a commit is never served stale names", () => {
    // LeagueContext hands out a new object on every commit, which is exactly
    // when the contents can have changed — so identity is the right key.
    const before = playerRefIndex(leagueWithAllTiers(7));
    const after = playerRefIndex(leagueWithAllTiers(7));
    expect(after).not.toBe(before);
  });
});

describe("PlayerRefLink — rendering", () => {
  it("links a player who has a profile page", () => {
    const html = render(leagueWithAllTiers(7), 7);
    expect(html).toContain('href="/player/7"');
    expect(html).toContain("Live Player");
  });

  it("prints a name-only record as plain text, gating on linkable not existence", () => {
    // The bug this guards: call sites testing `refOf(pid)` for truthiness link
    // a player with no page behind him. Existence is not linkability.
    const html = render(without(7, "players", "retiredPlayers"), 7);
    expect(html).toContain("Name Table Player");
    expect(html).not.toContain("href");
  });

  it("falls back to the muted pid when the save has no record at all", () => {
    const html = render(leagueWithAllTiers(7), 999);
    expect(html).toContain("Player #999");
    expect(html).toContain("text-muted");
    expect(html).not.toContain("href");
  });

  it("uses a caller's fallback text when given one", () => {
    expect(render(leagueWithAllTiers(7), 999, "Unknown player")).toContain("Unknown player");
  });
});
