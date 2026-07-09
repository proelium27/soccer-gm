import { openDB, type IDBPDatabase, type DBSchema } from "idb";
import type { LeagueStore } from "../core/leagueState.js";

const DB_NAME = "soccer-gm";
const DB_VERSION = 1;

export interface SoccerGMDB extends DBSchema {
  leagues: {
    key: number;
    value: LeagueStore;
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
