import type { LeagueStore } from "../core/leagueState.js";
import { getDb } from "./database.js";
import { migrateLeague } from "./migrate.js";

/**
 * Save (put) a league into IndexedDB. Returns the lid (key).
 *
 * If the league has lid === 0 (new league), the lid property is stripped so
 * that IDB's autoIncrement generates a fresh key. The resulting lid is then
 * written back onto the stored record.
 *
 * If the league already has a positive lid, it is updated in place.
 */
export async function saveLeague(league: LeagueStore): Promise<number> {
  const db = await getDb();

  if (league.lid === 0) {
    // Strip lid so autoIncrement assigns a new key
    const { lid: _stripped, ...rest } = league;
    // idb types require the full value shape, but IDB will populate the
    // keyPath field from the auto-generated key.
    const newLid = await db.add(
      "leagues",
      rest as unknown as LeagueStore,
    );

    // Write the generated lid back into the stored record
    const stored = (await db.get("leagues", newLid))!;
    stored.lid = newLid;
    await db.put("leagues", stored);

    return newLid;
  }

  const lid = await db.put("leagues", league);
  return lid;
}

/**
 * Load a league by lid. Returns undefined if it does not exist.
 *
 * If migration shrank the record — the free-agent cull removed players, or a cup
 * was collapsed to stat lines — the smaller version is written straight back.
 * Without that the on-disk record stays as large as it was, so every single
 * startup would re-read the full size and re-run the aggregation over every
 * archived cup's box scores before first paint, which is exactly the main-thread
 * cost this was meant to remove.
 */
export async function loadLeague(
  lid: number,
): Promise<LeagueStore | undefined> {
  const db = await getDb();
  const stored = await db.get("leagues", lid);
  if (!stored) return undefined;
  const migrated = migrateLeague(stored);
  if (shrankOnLoad(stored, migrated)) await saveLeague(migrated);
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

/** List all leagues with minimal metadata (lid, name, created). */
export async function listLeagues(): Promise<
  Array<{ lid: number; name: string; created: number }>
> {
  const db = await getDb();
  const all = await db.getAll("leagues");
  return all.map((l) => ({
    lid: l.lid,
    name: l.meta.name,
    created: l.meta.created,
  }));
}

/** Delete a league by lid. */
export async function deleteLeague(lid: number): Promise<void> {
  const db = await getDb();
  await db.delete("leagues", lid);
}
