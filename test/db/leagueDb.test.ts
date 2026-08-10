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
  resetWriteCache,
  storedPlayerRows,
} from "../../src/db/index.js";

// Generating a world costs ~4s, and every test here wants an identical one, so
// build it once and hand out copies (tests mutate what they are given).
let base: ReturnType<typeof createLeagueState> | null = null;
function makeLeague() {
  base ??= createLeagueState(3, mulberry32(42));
  return structuredClone(base);
}

// Clear all leagues between tests so each test starts with an empty store.
beforeEach(async () => {
  const db = await getDb();
  await db.clear("leagues");
  await db.clear("players");
  // Otherwise this tab still believes the pool it wrote in the previous test is
  // on disk, and would write only a diff against a store that was just wiped.
  resetWriteCache();
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

  it("persists a one-player edit on a later, incremental save", async () => {
    const league = makeLeague();
    const lid = await saveLeague(league);

    // A second save of an almost-identical league writes only the changed
    // player. Mirrors the core's style: unchanged players keep their identity.
    const pid = league.players[5].pid;
    const edited = {
      ...league,
      lid,
      players: league.players.map((p) => (p.pid === pid ? { ...p, ovr: 99 } : p)),
    };
    await saveLeague(edited);

    const loaded = await loadLeague(lid);
    expect(loaded!.players.find((p) => p.pid === pid)!.ovr).toBe(99);
    expect(loaded!.players).toHaveLength(league.players.length);
  });

  it("removes players dropped since the last save", async () => {
    const league = makeLeague();
    const lid = await saveLeague(league);
    const gone = league.players[0].pid;

    await saveLeague({
      ...league,
      lid,
      players: league.players.filter((p) => p.pid !== gone),
    });

    const rows = await storedPlayerRows(lid);
    expect(rows).toHaveLength(league.players.length - 1);
    expect(rows.some((p) => p.pid === gone)).toBe(false);
  });

  /**
   * The incremental write is only valid while the pool on disk is the one this
   * tab last wrote. Another tab saving in between invalidates that, and merging
   * a diff onto someone else's state would produce a league that never existed.
   */
  it("falls back to a full rewrite when another writer touched the record", async () => {
    const league = makeLeague();
    const lid = await saveLeague(league);

    // Stand in for a second tab: bump the counter and wipe a row behind our back.
    const db = await getDb();
    const stored = (await db.get("leagues", lid))!;
    await db.put("leagues", { ...stored, writeSeq: (stored.writeSeq ?? 0) + 7 });
    await db.delete("players", [lid, league.players[0].pid]);

    await saveLeague({ ...league, lid });

    const rows = await storedPlayerRows(lid);
    expect(rows).toHaveLength(league.players.length);
  });

  it("splits a pre-split save that still has players inline", async () => {
    const league = makeLeague();
    const lid = await saveLeague(league);

    // Rewrite it in the old shape: everything in one record, no player rows.
    const db = await getDb();
    const stored = (await db.get("leagues", lid))!;
    await db.put("leagues", { ...stored, players: league.players, writeSeq: undefined });
    await db.delete("players", IDBKeyRange.bound([lid], [lid, []]));
    expect(await storedPlayerRows(lid)).toHaveLength(0);

    const loaded = await loadLeague(lid);
    expect(loaded!.players).toHaveLength(league.players.length);

    // Loading must have migrated it: players now live in their own store and
    // are no longer duplicated inside the league record.
    expect(await storedPlayerRows(lid)).toHaveLength(league.players.length);
    expect((await db.get("leagues", lid))!.players).toBeUndefined();
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
