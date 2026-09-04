import { getDb, type StoredCrest } from "./database.js";

/**
 * Reading and writing the custom club badges a logo pack installs.
 *
 * A separate module from `leagueDb.ts` rather than two more functions in it,
 * because the two have nothing to say to each other: `saveLeague` runs on every
 * mutation and its whole design is working out the least it can write, while
 * these run twice in a save's life — once when a pack is imported, once when the
 * league is loaded. Keeping them apart is also what guarantees the first can
 * never accidentally start paying for the second.
 *
 * Crests are never part of a `LeagueStore`, so nothing above this layer carries
 * them around: `LeagueContext` loads them alongside the league and hands them to
 * `ClubCrest` through a context. See src/db/database.ts for why.
 */

/**
 * Every crest row for one league.
 *
 * Same trick as `playerRange`: IndexedDB orders arrays lexicographically and
 * sorts any array after any number, so `[lid]` falls below every `[lid, tid]`
 * and `[lid, []]` above every one of them. That brackets exactly one league
 * without an index — and it works for negative tids too, which matters here in
 * a way it does not for pids: `SPECTATOR_TID` and `FREE_AGENT_TID` are negative,
 * and while neither is a club that could hold a badge, a bound that quietly
 * excluded them would be a trap for whatever does come along.
 */
function crestRange(lid: number): IDBKeyRange {
  return IDBKeyRange.bound([lid], [lid, []]);
}

/** Every custom badge stored for a league, as tid -> data URL. Empty when there are none. */
export async function loadCrests(lid: number): Promise<Map<number, string>> {
  const db = await getDb();
  const rows = await db.getAll("crests", crestRange(lid));
  return new Map(rows.map((r) => [r.tid, r.image]));
}

/**
 * Replace a league's badges with exactly this set.
 *
 * Replace rather than merge, and that is the useful contract: the caller always
 * holds the full picture (the packs the user has loaded resolve to one map), so
 * "these are the badges now" is both what every caller means and the only rule
 * under which removing one is expressible. A merge would make a badge
 * un-deletable, which is the same trap `resolveXI`'s all-or-nothing rule avoids
 * one level up.
 *
 * One transaction, so a crash can't leave a league wearing half of two sets.
 */
export async function saveCrests(
  lid: number,
  byTid: ReadonlyMap<number, string>,
): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("crests", "readwrite");
  const store = tx.objectStore("crests");
  await store.delete(crestRange(lid));
  const rows: StoredCrest[] = [...byTid].map(([tid, image]) => ({ tid, image }));
  await Promise.all(rows.map((row) => store.put(row, [lid, row.tid])));
  await tx.done;
}

/** Drop every badge for a league. Called when the league itself is deleted. */
export async function deleteCrests(lid: number): Promise<void> {
  const db = await getDb();
  await db.delete("crests", crestRange(lid));
}
