import { Link } from "react-router-dom";
import { useLeague } from "../context/LeagueContext.js";
import type { LeagueStore } from "../../core/leagueState.js";
import { farewellIndex } from "../../core/players/retirements.js";
import { playerNameIndex } from "../../core/players/playerNames.js";

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
  /**
   * Whether there's a profile page behind the name.
   *
   * False for a player known only from an award he won: the season history
   * keeps the winner's name (see core/awardWinners.ts) long after the pool and
   * the capped archive have both let go of him, which is enough to print but
   * not enough to build a career page from.
   */
  linkable: boolean;
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

/**
 * pid -> ref for every player the save can still name, built once per league.
 *
 * Exported for the sake of `playerRefLink.test.tsx`, which asserts the two
 * things about this that nothing else can catch: the resolution *order* of the
 * five fallbacks below, and that repeat calls hand back the same map rather
 * than rebuilding it. Both fail silently — a wrong order gives a stale name,
 * and losing the cache gives a correct page that is merely slow.
 */
export function playerRefIndex(league: LeagueStore): Map<number, PlayerRef> {
  const hit = cache.get(league);
  if (hit) return hit;

  const map = new Map<number, PlayerRef>();
  for (const p of league.players) {
    map.set(p.pid, {
      pid: p.pid, name: p.name, nationality: p.nationality, retired: false, linkable: true,
    });
  }
  // Archived second so a live player always wins. They can't collide today
  // (pids are never reissued — see LeagueStore.nextPid), but a live record is
  // the better one either way.
  for (const a of league.retiredPlayers ?? []) {
    if (!map.has(a.pid)) {
      map.set(a.pid, {
        pid: a.pid, name: a.name, nationality: a.nationality, retired: true, linkable: true,
      });
    }
  }
  // The name table: every retiree the save's own history still points at, kept
  // at retirement precisely so this lookup can't fail (see
  // core/players/playerNames.ts). It is the broadest of the fallbacks and the
  // one that makes the rest belt-and-braces on any save new enough to have it.
  // A name and nothing else, so `linkable: false`.
  for (const [pid, n] of playerNameIndex(league.playerNames)) {
    if (!map.has(pid)) {
      map.set(pid, {
        pid, name: n.name, nationality: n.nationality, retired: true, linkable: false,
      });
    }
  }
  // Next: the winners' names copied onto each season's awards. This is the only
  // record of most award winners on a long save — the archive is capped and
  // drops the modest careers that win a second division's Player of the Season
  // — so without it a century of honours boards reads "Player #4821". He has no
  // profile page, hence `linkable: false`.
  for (const h of league.seasonHistory) {
    for (const w of h.awardWinners ?? []) {
      if (!map.has(w.pid)) {
        map.set(w.pid, {
          pid: w.pid, name: w.name, nationality: w.nationality, retired: true, linkable: false,
        });
      }
    }
  }
  // Last of all: the Season Preview's farewell lists, the other place a name is
  // kept as a copy rather than a pid. These reach the players the award
  // snapshots can't — anyone who never won anything — and, unlike those
  // snapshots, they are already in saves written long before either field
  // existed, so an old save gets these names back on load with nothing to
  // migrate. Bounded at RETIREMENT_NOTABLE_LIMIT a season; a name only, hence
  // `linkable: false`. See core/players/retirements.ts `farewellIndex`.
  for (const [pid, r] of farewellIndex(league.seasonHistory)) {
    if (!map.has(pid)) {
      map.set(pid, {
        pid, name: r.name, nationality: r.nationality, retired: true, linkable: false,
      });
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
 * it, so a lookup can still miss — callers must keep a fallback. Award winners
 * are the one class of forgotten player who keep their name anyway, off the
 * season history; they come back with `linkable: false` because a name is all
 * there is.
 */
export function usePlayerRefs(): (pid: number) => PlayerRef | undefined {
  const { league } = useLeague();
  return (pid: number) => (league ? playerRefIndex(league).get(pid) : undefined);
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
  if (!ref.linkable) return <span>{ref.name}</span>;
  return <Link to={`/player/${pid}`}>{ref.name}</Link>;
}
