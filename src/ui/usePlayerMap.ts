import { useMemo } from "react";
import type { Player } from "../core/players/types.js";

/**
 * Memoized pid -> player lookup over the whole world's pool.
 *
 * Nearly every page needs this map, and each one used to rebuild it inline in
 * its render body — ~6000 entries re-allocated on every keystroke, drag tick and
 * dropdown change. Keyed on the array identity, so it's rebuilt only when the
 * league is actually committed.
 *
 * Takes the array (not the league) so it can be called before a page's
 * `if (!league)` guard, which is where a hook has to live.
 */
export function usePlayerMap(players: readonly Player[] | undefined): Map<number, Player> {
  return useMemo(() => new Map((players ?? []).map((p) => [p.pid, p])), [players]);
}
