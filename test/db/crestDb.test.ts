import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import {
  getDb, resetDb, resetWriteCache, saveLeague, deleteLeague,
  loadCrests, saveCrests, deleteCrests,
} from "../../src/db/index.js";
import type { LeagueStore } from "../../src/core/leagueState.js";

const PNG = "data:image/png;base64,AAAA";
const PNG2 = "data:image/png;base64,BBBB";

/**
 * A league record thin enough to save without generating a world. Nothing here
 * reads a player, and generating one costs ~5s — this file is about the crest
 * store, so it pays for none of that.
 */
function stubLeague(name: string): LeagueStore {
  return {
    lid: 0,
    season: 1,
    phase: "regular",
    meta: { name, created: Date.now(), userTid: 0 },
    teams: [],
    players: [],
    schedule: [],
    played: [],
  } as unknown as LeagueStore;
}

beforeEach(async () => {
  resetDb();
  resetWriteCache();
  const db = await getDb();
  for (const store of ["leagues", "players", "careers", "retirees", "crests"] as const) {
    await db.clear(store);
  }
});

describe("the crest store", () => {
  it("round-trips a league's badges", async () => {
    await saveCrests(7, new Map([[0, PNG], [3, PNG2]]));
    const back = await loadCrests(7);
    expect(back.get(0)).toBe(PNG);
    expect(back.get(3)).toBe(PNG2);
    expect(back.size).toBe(2);
  });

  it("is empty for a save that has none, rather than undefined", async () => {
    expect((await loadCrests(1)).size).toBe(0);
  });

  it("replaces rather than merges, so a badge can actually be removed", async () => {
    // The contract the callers rely on: they always hold the whole picture, and
    // a merge would make a badge un-deletable.
    await saveCrests(1, new Map([[0, PNG], [1, PNG2]]));
    await saveCrests(1, new Map([[0, PNG]]));
    const back = await loadCrests(1);
    expect(back.size).toBe(1);
    expect(back.has(1)).toBe(false);
  });

  it("keeps two leagues' badges apart", async () => {
    await saveCrests(1, new Map([[0, PNG]]));
    await saveCrests(2, new Map([[0, PNG2]]));
    expect((await loadCrests(1)).get(0)).toBe(PNG);
    expect((await loadCrests(2)).get(0)).toBe(PNG2);
  });

  it("holds badges for a negative tid", async () => {
    // Not reachable today — no club has one — but the key range has to bracket
    // them, because arrays sort after numbers and a bound that quietly excluded
    // half the number line would be a trap for whatever comes along next.
    await saveCrests(1, new Map([[-3, PNG]]));
    expect((await loadCrests(1)).get(-3)).toBe(PNG);
  });

  it("clears one league without touching another", async () => {
    await saveCrests(1, new Map([[0, PNG]]));
    await saveCrests(2, new Map([[0, PNG2]]));
    await deleteCrests(1);
    expect((await loadCrests(1)).size).toBe(0);
    expect((await loadCrests(2)).size).toBe(1);
  });
});

describe("deleting a league", () => {
  it("takes its badges with it, so a reused lid can't inherit them", async () => {
    const lid = await saveLeague(stubLeague("doomed"));
    await saveCrests(lid, new Map([[0, PNG]]));
    await deleteLeague(lid);
    expect((await loadCrests(lid)).size).toBe(0);
  });
});

describe("saving a league", () => {
  it("leaves the badges alone", async () => {
    // The whole reason they live in their own store: saveLeague runs on every
    // lineup change and rewrites the league record in full, and these must not
    // be part of what it rewrites — nor of what it can clear.
    const lid = await saveLeague(stubLeague("kept"));
    await saveCrests(lid, new Map([[0, PNG]]));
    await saveLeague({ ...stubLeague("kept"), lid });
    expect((await loadCrests(lid)).get(0)).toBe(PNG);
  });
});
