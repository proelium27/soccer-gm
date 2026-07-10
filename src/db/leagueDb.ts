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

/** Load a league by lid. Returns undefined if it does not exist. */
export async function loadLeague(
  lid: number,
): Promise<LeagueStore | undefined> {
  const db = await getDb();
  const league = await db.get("leagues", lid);
  return league && migrateLeague(league);
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
