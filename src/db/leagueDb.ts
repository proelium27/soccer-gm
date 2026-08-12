import type { LeagueStore } from "../core/leagueState.js";
import type { Player } from "../core/players/types.js";
import { getDb, type StoredLeague } from "./database.js";
import { migrateLeague } from "./migrate.js";

/**
 * Every player row for one league.
 *
 * Keys are `[lid, pid]`, and IndexedDB orders arrays lexicographically with any
 * array sorting after any number, so `[lid]` falls below every `[lid, pid]` and
 * `[lid, []]` falls above every one of them. That brackets exactly one league's
 * pool without needing an index or a sentinel pid.
 */
function playerRange(lid: number): IDBKeyRange {
  return IDBKeyRange.bound([lid], [lid, []]);
}

/**
 * The pool exactly as this tab last wrote it, so the next save can work out what
 * changed. Holds references, not copies — the whole point is that an unchanged
 * player is the *same object*, so this costs one pointer per player and comparing
 * is a pointer check.
 *
 * Deliberately **one league, not a map**. A map would keep every league opened
 * this session alive: the entries are references, but they pin the ~26 MB of
 * Player objects behind them, so switching saves would leak the old one. The app
 * only ever has one active league, so a single slot loses nothing — the one cost
 * is that saving some *other* league (customizeTeams can) evicts this and makes
 * the next save of the active one full, which is merely slower.
 *
 * Deliberately not populated by `loadLeague`: migration rebuilds player objects,
 * so a freshly loaded pool cannot be assumed identical to what is on disk. Leaving
 * it empty makes the first save of a session a full write and every later one
 * incremental, which is both obviously correct and cheap.
 */
let lastWritten: { lid: number; seq: number; players: Player[] } | null = null;

/** Exported for tests: forget what this tab thinks is on disk. */
export function resetWriteCache(): void {
  lastWritten = null;
}

/**
 * Which rows a save has to touch. `full` forces a rewrite of the whole pool,
 * which is the safe answer whenever we cannot prove what is on disk.
 */
function playersToWrite(
  lid: number,
  players: Player[],
  storedSeq: number | undefined,
): { write: Player[]; remove: number[]; full: boolean } {
  const cached = lastWritten;
  // Only trust the cache if it describes this league and the record on disk is
  // still the one we wrote: a second tab saving in between makes our idea of the
  // pool stale, and an incremental write on top of that would merge two states
  // into one that never existed.
  if (!cached || cached.lid !== lid || storedSeq === undefined || cached.seq !== storedSeq) {
    return { write: players, remove: [], full: true };
  }

  const prev = new Map(cached.players.map((p) => [p.pid, p]));
  const write: Player[] = [];
  for (const p of players) {
    const old = prev.get(p.pid);
    if (old === undefined || old !== p) write.push(p);
    prev.delete(p.pid);
  }
  return { write, remove: [...prev.keys()], full: false };
}

/**
 * Save a league into IndexedDB. Returns the lid (key).
 *
 * The league record and the player rows are written in **one** transaction. That
 * is a correctness requirement, not tidiness: `teams[].roster` holds pids, so a
 * crash between the two writes would leave rosters pointing at players that do
 * not exist — a corrupt save rather than a merely stale one.
 *
 * Only players whose object identity changed since this tab's last write are
 * written (docs/save-performance-plan.md phase 2). That is sound because the core
 * is purely functional — it never mutates a player in place, so a changed player
 * always arrives as a new object. `test/db/playerIdentity.test.ts` is what holds
 * that invariant up; if it ever breaks, edits would silently stop persisting.
 *
 * If the league has no lid yet (0, or missing on a hand-made or imported record),
 * the lid property is stripped so IDB's autoIncrement generates a fresh key, which
 * is then written back onto the record. Note this is the ONE branch that can add a
 * save rather than update one, so anything calling it has to be sure it means to
 * create a league: a caller that fires twice makes two of them.
 */
export async function saveLeague(league: LeagueStore): Promise<number> {
  const db = await getDb();
  const { players, ...rest } = league;

  const tx = db.transaction(["leagues", "players"], "readwrite");
  const leagues = tx.objectStore("leagues");
  const playerStore = tx.objectStore("players");

  let lid: number;
  let storedSeq: number | undefined;
  let seq: number;
  if (!league.lid) {
    // Strip lid so autoIncrement assigns a new key; leaving lid: 0 in place
    // would make IDB store the record under key 0 instead of generating one.
    // `!lid` rather than `=== 0` so an absent lid takes this path too — it used
    // to fall through to the update branch and look up key `undefined`.
    const { lid: _stripped, ...fresh } = rest;
    seq = 1;
    lid = await leagues.add({ ...fresh, writeSeq: seq } as StoredLeague);
    const stored = (await leagues.get(lid))!;
    stored.lid = lid;
    await leagues.put(stored);
  } else {
    lid = league.lid;
    storedSeq = (await leagues.get(lid))?.writeSeq;
    seq = (storedSeq ?? 0) + 1;
    await leagues.put({ ...rest, writeSeq: seq } as StoredLeague);
  }

  const { write, remove, full } = playersToWrite(lid, players, storedSeq);
  // A full write clears first, so players dropped since the last save
  // (retirement, the free-agent cull) cannot linger as orphan rows. An
  // incremental one deletes exactly the pids that went away.
  if (full) await playerStore.delete(playerRange(lid));
  await Promise.all([
    ...remove.map((pid) => playerStore.delete([lid, pid])),
    ...write.map((p) => playerStore.put(p, [lid, p.pid])),
  ]);

  await tx.done;
  lastWritten = { lid, seq, players };
  return lid;
}

/**
 * Load a league by lid. Returns undefined if it does not exist.
 *
 * Reassembles the split record into an ordinary `LeagueStore`, so everything
 * above this layer — migrate, export, the worker, every page — keeps working
 * against one in-memory players array and needs no knowledge of the split.
 *
 * Two cases trigger an immediate write-back:
 *   - a v1 record still carrying `players` inline, which is split here (the
 *     lazy migration; see database.ts for why not in `upgrade`);
 *   - migration shrinking the record, as before.
 * Without the write-back the on-disk record keeps its old shape and every
 * startup redoes this work before first paint.
 */
export async function loadLeague(
  lid: number,
): Promise<LeagueStore | undefined> {
  const db = await getDb();

  const tx = db.transaction(["leagues", "players"], "readonly");
  const stored = await tx.objectStore("leagues").get(lid);
  if (!stored) return undefined;
  const rows = await tx.objectStore("players").getAll(playerRange(lid));
  await tx.done;

  const { players: inline, ...meta } = stored;
  const assembled = { ...meta, players: inline ?? rows } as LeagueStore;

  const migrated = migrateLeague(assembled);
  if (inline !== undefined || shrankOnLoad(assembled, migrated)) {
    await saveLeague(migrated);
  }
  return migrated;
}

/**
 * Whether migration actually made the record smaller, so the write-back is worth
 * it. Deliberately cheap: comparing sizes would mean serializing the whole league
 * twice, which on an aged save is the very cost being avoided.
 */
function shrankOnLoad(before: LeagueStore, after: LeagueStore): boolean {
  if (after.players.length < before.players.length) return true;
  const storedCups = before.cupHistory ?? [];
  return (after.cupHistory ?? []).some((cup, i) => cup.statLines !== storedCups[i]?.statLines);
}

/**
 * List all leagues with minimal metadata (lid, name, created, season).
 *
 * Cheap since the split: the league records no longer contain the player pool,
 * so this stopped deserializing tens of MB per save to render a few rows.
 *
 * `season` is here so the picker can tell two saves of the same club apart —
 * they're named after the club, so a name and a date alone make near-identical
 * rows out of anything started on the same day.
 */
export async function listLeagues(): Promise<
  Array<{ lid: number; name: string; created: number; season: number }>
> {
  const db = await getDb();
  const all = await db.getAll("leagues");
  return all.map((l) => ({
    lid: l.lid,
    name: l.meta.name,
    created: l.meta.created,
    season: l.season,
  }));
}

/** Delete a league by lid, along with all of its player rows. */
export async function deleteLeague(lid: number): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(["leagues", "players"], "readwrite");
  await Promise.all([
    tx.objectStore("leagues").delete(lid),
    tx.objectStore("players").delete(playerRange(lid)),
  ]);
  await tx.done;
  // Drop the pool we were holding for it, rather than pinning a deleted
  // league's players in memory for the rest of the session.
  if (lastWritten?.lid === lid) lastWritten = null;
}

/** Exported for tests: the player rows currently stored for a league. */
export async function storedPlayerRows(lid: number): Promise<Player[]> {
  const db = await getDb();
  return db.getAll("players", playerRange(lid));
}
