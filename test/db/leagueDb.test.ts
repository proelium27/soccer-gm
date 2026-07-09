import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { createLeagueState } from "../../src/core/leagueState.js";
import { mulberry32 } from "../../src/engine/rng.js";
import {
  saveLeague,
  loadLeague,
  listLeagues,
  deleteLeague,
  getDb,
  resetDb,
} from "../../src/db/index.js";

function makeLeague() {
  return createLeagueState(3, mulberry32(42));
}

// Clear all leagues between tests so each test starts with an empty store.
beforeEach(async () => {
  const db = await getDb();
  await db.clear("leagues");
  // Close & reset so autoIncrement counters start fresh
  db.close();
  resetDb();
});

describe("leagueDb", () => {
  it("saves a league and returns a lid > 0", async () => {
    const league = makeLeague();
    const lid = await saveLeague(league);
    expect(typeof lid).toBe("number");
    expect(lid).toBeGreaterThan(0);
  });

  it("loads a saved league by lid", async () => {
    const league = makeLeague();
    const lid = await saveLeague(league);
    const loaded = await loadLeague(lid);
    expect(loaded).toBeDefined();
    expect(loaded!.meta.name).toBe(league.meta.name);
    expect(loaded!.meta.userTid).toBe(league.meta.userTid);
    expect(loaded!.teams).toHaveLength(league.teams.length);
    expect(loaded!.players).toHaveLength(league.players.length);
  });

  it("returns undefined for a non-existent lid", async () => {
    const loaded = await loadLeague(999);
    expect(loaded).toBeUndefined();
  });

  it("lists leagues with correct count and metadata", async () => {
    const league1 = makeLeague();
    const league2 = makeLeague();
    league2.meta.name = "Second League";

    await saveLeague(league1);
    await saveLeague(league2);

    const list = await listLeagues();
    expect(list).toHaveLength(2);
    expect(list[0]).toHaveProperty("lid");
    expect(list[0]).toHaveProperty("name");
    expect(list[0]).toHaveProperty("created");
    expect(list.map((l) => l.name)).toContain("My League");
    expect(list.map((l) => l.name)).toContain("Second League");
  });

  it("deletes a league so subsequent load returns undefined", async () => {
    const league = makeLeague();
    const lid = await saveLeague(league);
    expect(await loadLeague(lid)).toBeDefined();

    await deleteLeague(lid);
    expect(await loadLeague(lid)).toBeUndefined();
  });

  it("round-trip: create -> save -> load -> verify all fields", async () => {
    const league = makeLeague();
    const lid = await saveLeague(league);
    const loaded = await loadLeague(lid);

    expect(loaded).toBeDefined();
    expect(loaded!.lid).toBe(lid);
    expect(loaded!.meta.name).toBe(league.meta.name);
    expect(loaded!.meta.created).toBe(league.meta.created);
    expect(loaded!.meta.userTid).toBe(league.meta.userTid);
    expect(loaded!.season).toBe(league.season);
    expect(loaded!.phase).toBe(league.phase);
    expect(loaded!.teams).toEqual(league.teams);
    expect(loaded!.players).toEqual(league.players);
    expect(loaded!.schedule).toEqual(league.schedule);
    expect(loaded!.played).toEqual(league.played);
  });
});
