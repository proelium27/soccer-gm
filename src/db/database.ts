import { openDB, type IDBPDatabase, type DBSchema } from "idb";
import type { LeagueStore } from "../core/leagueState.js";
import type { Player } from "../core/players/types.js";
import type { ArchivedPlayer } from "../core/players/archive.js";

const DB_NAME = "soccer-gm";
/**
 * 2 split `players` out of the league record. See docs/save-performance-plan.md:
 * with one record per league, every mutation rewrote the entire world, so the
 * cost of any action grew with how long the save had been played.
 *
 * 3 split `retiredPlayers` out for the same reason, and it is the same bug one
 * field along: `saveLeague` writes the whole non-player record every time, so
 * the archive was re-serialised on every lineup change and signing. Measured at
 * 2,204 bytes a row that is 11ms per save at the old 2,000-row cap and 91ms at
 * 20,000, before mobile's 5-10x. The cap exists to bound *that*, not disk, so
 * splitting the store is what lets it rise (RETIREE_ARCHIVE_LIMIT).
 *
 * 4 split each player's `stats`/`hist` into `careers`. Different goal from 2
 * and 3, and worth being clear about: those two were about **write** cost,
 * and both deliberately left `loadLeague` reassembling one ordinary
 * `LeagueStore` so nothing above the db layer had to change. That is exactly
 * why the pool is still fully resident. Measured on the reported season-60
 * save: a player's identity is 4.5 MB across the whole world while the career
 * records are 45.2 MB, ten to one, and the ratio worsens every season. This
 * version is the storage half; `docs/lazy-career-plan.md` phase 3 is what
 * stops loading them. It buys one thing immediately — a contract change or a
 * transfer rewrites identity without re-serialising a career.
 */
const DB_VERSION = 4;

/**
 * A league as it sits on disk.
 *
 * `players` is optional because both shapes exist: v2 records keep the pool in
 * the `players` store, while v1 records written before the split still carry it
 * inline until `loadLeague` next rewrites them. Nothing above the db layer sees
 * this — `loadLeague` reassembles a normal `LeagueStore` either way.
 */
/**
 * A player as he sits in the `players` store: everything except his career.
 *
 * `stats`/`hist` are optional rather than gone because both shapes exist on
 * disk — a v2/v3 row still carries them inline until `loadLeague` splits it, in
 * the same lazy way v1's inline pool was handled.
 */
export type StoredPlayer = Omit<Player, "stats" | "hist"> & {
  stats?: Player["stats"];
  hist?: Player["hist"];
};

/** The half of a player that grows without bound: one row in `careers`. */
export interface PlayerCareer {
  stats: Player["stats"];
  hist: Player["hist"];
}

export type StoredLeague = Omit<LeagueStore, "players" | "retiredPlayers"> & {
  players?: Player[];
  /**
   * Same story one field along: v3 records keep the archive in the `retirees`
   * store, while v1/v2 records still carry it inline until `loadLeague` next
   * rewrites them. Also absent on a save old enough to predate the archive.
   */
  retiredPlayers?: ArchivedPlayer[];
  /**
   * Bumped on every write. Lets `saveLeague` prove the pool on disk is still the
   * one it last wrote before trusting an incremental write — if another tab saved
   * in between, the counter will not match and it falls back to a full rewrite.
   * Absent on v1 records and on any league last written before this existed.
   */
  writeSeq?: number;
};

export interface SoccerGMDB extends DBSchema {
  leagues: {
    key: number;
    value: StoredLeague;
  };
  /**
   * One record per player, keyed `[lid, pid]`. The compound key is what makes a
   * league's pool a single range query, so no secondary index is needed.
   *
   * Since v4 this is identity only — `stats`/`hist` live in `careers`. They stay
   * optional on the type because v2/v3 rows still carry them inline until
   * `loadLeague` next rewrites them.
   */
  players: {
    key: [number, number];
    value: StoredPlayer;
  };
  /**
   * One player's career record, keyed `[lid, pid]` like the other two.
   *
   * Split from `players` rather than left on it because the two have completely
   * different read patterns and completely different sizes: identity is wanted
   * on every load and is 4.5 MB across a whole world, while the career is wanted
   * by a handful of cold surfaces and is 45.2 MB. Keeping them in one record
   * means a league's pool query drags ten times its own weight along with it,
   * which is what `docs/lazy-career-plan.md` phase 3 exists to stop.
   */
  careers: {
    key: [number, number];
    value: PlayerCareer;
  };
  /**
   * One record per archived retiree, keyed `[lid, pid]` exactly like `players`.
   *
   * Separate from `players` rather than sharing it: the two are read at
   * different times (the pool on every load, the archive only by the all-time
   * surfaces) and a shared store would make the pool's range query drag the
   * archive along with it.
   */
  retirees: {
    key: [number, number];
    value: ArchivedPlayer;
  };
}

let dbPromise: Promise<IDBPDatabase<SoccerGMDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<SoccerGMDB>> {
  if (!dbPromise) {
    dbPromise = openDB<SoccerGMDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("leagues")) {
          db.createObjectStore("leagues", {
            keyPath: "lid",
            autoIncrement: true,
          });
        }
        if (!db.objectStoreNames.contains("players")) {
          // No keyPath: the key is the out-of-line pair [lid, pid], which a
          // Player does not carry (it has no idea which save it belongs to).
          // Splitting existing v1 records is deliberately NOT done here —
          // loadLeague does it lazily, so the work is testable and a large
          // save can't stall a versionchange transaction on startup.
          db.createObjectStore("players");
        }
        if (!db.objectStoreNames.contains("retirees")) {
          // Same out-of-line `[lid, pid]` key as `players`, and split from the
          // league record lazily in loadLeague for the same reasons.
          db.createObjectStore("retirees");
        }
        if (!db.objectStoreNames.contains("careers")) {
          // Same out-of-line `[lid, pid]` key again, and split out of the
          // existing player rows lazily in loadLeague — a season-60 save has
          // ~11k careers to move and a versionchange transaction is the worst
          // possible place to discover that.
          db.createObjectStore("careers");
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Reset the cached DB promise. Useful in tests to get a fresh connection.
 */
export function resetDb(): void {
  dbPromise = null;
}
