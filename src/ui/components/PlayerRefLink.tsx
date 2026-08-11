import { Link } from "react-router-dom";
import { useLeague } from "../context/LeagueContext.js";
import type { LeagueStore } from "../../core/leagueState.js";

/**
 * Everything a surface needs to render a player's name, whether he's still in
 * the pool or only in the retiree archive.
 */
export interface PlayerRef {
  pid: number;
  name: string;
  nationality: string;
  /** True when the only record of him left is his archived career. */
  retired: boolean;
}

/**
 * Cached per league object rather than per component.
 *
 * `PlayerRefLink` is rendered once per row on lists that run to dozens of rows,
 * and the map it needs has an entry per player in the world (~6000). A `useMemo`
 * inside the component would rebuild the whole thing for every row; a WeakMap on
 * the league builds it once. `LeagueContext` hands out a new league object on
 * every commit, so identity changes exactly when the contents do.
 */
const cache = new WeakMap<LeagueStore, Map<number, PlayerRef>>();

function refsFor(league: LeagueStore): Map<number, PlayerRef> {
  const hit = cache.get(league);
  if (hit) return hit;

  const map = new Map<number, PlayerRef>();
  for (const p of league.players) {
    map.set(p.pid, { pid: p.pid, name: p.name, nationality: p.nationality, retired: false });
  }
  // Archived second so a live player always wins. They can't collide today
  // (pids are never reissued — see LeagueStore.nextPid), but a live record is
  // the better one either way.
  for (const a of league.retiredPlayers ?? []) {
    if (!map.has(a.pid)) {
      map.set(a.pid, { pid: a.pid, name: a.name, nationality: a.nationality, retired: true });
    }
  }
  cache.set(league, map);
  return map;
}

/**
 * pid -> name lookup that covers retirees as well as living players.
 *
 * Retirement deletes a player from `league.players` outright, but history keeps
 * pointing at him — a transfer he was part of, a goal on the news feed, a World
 * Cup he top-scored at. Those surfaces used to fall back to "Player 4821"
 * because the pool was the only place they looked. The archive
 * (`league.retiredPlayers`) has his name and, now that retirees have a profile
 * page, somewhere to send you.
 *
 * The archive is bounded (RETIREE_ARCHIVE_LIMIT) and journeymen are dropped from
 * it, so a lookup can still miss — callers must keep a fallback.
 */
export function usePlayerRefs(): (pid: number) => PlayerRef | undefined {
  const { league } = useLeague();
  return (pid: number) => (league ? refsFor(league).get(pid) : undefined);
}

/**
 * A player's name linked to his profile, resolving retirees through the archive.
 *
 * Falls back to the muted "Player #pid" the call sites used before whenever the
 * save genuinely has no record of him left (a culled unsigned player, or a
 * retiree whose career didn't clear the archive bar).
 */
export function PlayerRefLink({ pid, fallback }: { pid: number; fallback?: string }) {
  const refOf = usePlayerRefs();
  const ref = refOf(pid);

  if (!ref) return <span className="text-muted">{fallback ?? `Player #${pid}`}</span>;
  return <Link to={`/player/${pid}`}>{ref.name}</Link>;
}
