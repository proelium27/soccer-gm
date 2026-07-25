import type { LeagueStore } from "../leagueState.js";
import type { Player } from "./types.js";
import {
  FREE_AGENT_CULL_MIN_AGE,
  FREE_AGENT_CULL_MAX_PEAK_OVR,
  FREE_AGENT_CULL_MAX_POT,
} from "../constants.js";

/**
 * Cull the unsigned free-agent pool, and scrub every reference to the players
 * it removes.
 *
 * Why this exists: retirement already deletes players outright (simOffseason
 * step 3), so a save holds no retired players — but nothing ever removed
 * *unsigned free agents*, so that pool grew forever. Measured on a 14-season
 * save: 9245 unsigned against 5996 rostered, 96% of them never having peaked
 * above ovr 55, together ~27% of an 88 MB save. Save size is the thing that
 * freezes the game (every mutation writes the whole league to IndexedDB and
 * every sim structuredClones it to the worker — both block the main thread),
 * so bounding this pool is the fix.
 *
 * **Consumes no rng.** It's a pure deterministic filter, so it can't perturb
 * the seeded streams the sim depends on (see CLAUDE.md's RNG-stream-order
 * invariant). It must still run at the very END of simOffseason: removing
 * entries from `players` would shift any later per-player rng draw.
 */

/** Best ovr a player ever reached, from his ratings history (current ovr included). */
export function careerPeakOvr(player: Player): number {
  let peak = player.ovr;
  for (const h of player.hist ?? []) {
    if (h.ovr > peak) peak = h.ovr;
  }
  return peak;
}

/**
 * Pids the cull would remove: on no roster, old enough to have stopped
 * developing, never any good, and not projected to become good.
 *
 * `protectedPids` is anything the caller wants kept regardless (award winners,
 * so no honours board can ever point at a deleted player).
 */
export function cullablePids(
  league: LeagueStore,
  protectedPids: ReadonlySet<number> = new Set(),
): Set<number> {
  const rostered = new Set<number>();
  for (const t of league.teams) {
    for (const pid of t.roster) rostered.add(pid);
    for (const pid of t.academyRoster) rostered.add(pid);
  }
  // A loaned player sits on the loanee's roster, so he's already covered above;
  // this is belt-and-braces in case a loan is ever mid-flight.
  for (const l of league.activeLoans) rostered.add(l.pid);

  const cull = new Set<number>();
  for (const p of league.players) {
    if (rostered.has(p.pid) || protectedPids.has(p.pid)) continue;
    if (league.season - p.born < FREE_AGENT_CULL_MIN_AGE) continue;
    if (careerPeakOvr(p) > FREE_AGENT_CULL_MAX_PEAK_OVR) continue;
    if (p.potential > FREE_AGENT_CULL_MAX_POT) continue;
    cull.add(p.pid);
  }
  return cull;
}

/** Every pid named by a stored award, which must never be deleted. */
export function awardedPids(league: LeagueStore): Set<number> {
  const pids = new Set<number>();
  const walk = (v: unknown) => {
    if (Array.isArray(v)) {
      for (const x of v) walk(x);
      return;
    }
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      if (typeof o.pid === "number") pids.add(o.pid);
      for (const x of Object.values(o)) walk(x);
    }
  };
  for (const h of league.seasonHistory) walk(h.awards);
  return pids;
}

/**
 * Remove the cullable free agents and scrub the references that would otherwise
 * dangle. A dangling pid isn't a crash (every reader guards the lookup) but it
 * renders as "Player 4821" in transfer history, so the rows go with the player.
 */
export function cullFreeAgentPool(league: LeagueStore): LeagueStore {
  const cull = cullablePids(league, awardedPids(league));
  if (cull.size === 0) return league;

  return {
    ...league,
    players: league.players.filter((p) => !cull.has(p.pid)),
    transfers: league.transfers.filter((t) => !cull.has(t.pid)),
    newsEvents: league.newsEvents.filter(
      (e) => !("pid" in e && typeof e.pid === "number" && cull.has(e.pid)),
    ),
    negotiations: league.negotiations.filter((n) => !cull.has(n.pid)),
    inboundOffers: league.inboundOffers.filter((o) => !cull.has(o.pid)),
    loanListings: league.loanListings.filter((l) => !cull.has(l.pid)),
    loanRejections: league.loanRejections.filter((l) => !cull.has(l.pid)),
    teams: league.teams.map((t) => {
      // Fog-of-war bookkeeping is a pid-keyed map, so it needs the same scrub.
      const observed = t.scoutingObserved;
      if (!observed || Object.keys(observed).length === 0) return t;
      const kept = Object.fromEntries(
        Object.entries(observed).filter(([pid]) => !cull.has(Number(pid))),
      );
      return { ...t, scoutingObserved: kept };
    }),
    // Cup tie box scores keep per-player lines; drop the culled players' lines
    // so a historical tie never lists a player who no longer exists.
    cupHistory: league.cupHistory.map((cup) => scrubCupLines(cup, cull)),
    cup: league.cup ? scrubCupLines(league.cup, cull) : league.cup,
    international: scrubInternational(league.international, cull),
  };
}

/**
 * Drop culled pids from the current campaign's named squads.
 *
 * Only the live qualifying campaign and tournament hold squads at all (archived
 * campaigns already discard them), and by the time the cull runs the campaign
 * has finished playing, so these lists are display-only — the National Teams
 * Rosters tab. A weak nation genuinely can name a sub-65 player, so this is
 * reachable, and a squad listing a player who no longer exists is worse than one
 * listing a player fewer. `stageInjuries` is scrubbed for the same reason: it's
 * consumed at rollover to carry an injury onto a player who may now be gone.
 */
function scrubInternational(
  intl: LeagueStore["international"],
  cull: ReadonlySet<number>,
): LeagueStore["international"] {
  const scrubSquads = <T extends { squads: { pids: number[] }[] }>(c: T): T => {
    if (!c.squads.some((s) => s.pids.some((pid) => cull.has(pid)))) return c;
    return {
      ...c,
      squads: c.squads.map((s) =>
        s.pids.some((pid) => cull.has(pid))
          ? { ...s, pids: s.pids.filter((pid) => !cull.has(pid)) }
          : s,
      ),
    };
  };
  return {
    ...intl,
    qualifying: intl.qualifying ? scrubSquads(intl.qualifying) : intl.qualifying,
    tournament: intl.tournament ? scrubSquads(intl.tournament) : intl.tournament,
    stageInjuries: intl.stageInjuries.filter((pid) => !cull.has(pid)),
  };
}

function scrubCupLines<T extends LeagueStore["cupHistory"][number]>(
  cup: T,
  cull: ReadonlySet<number>,
): T {
  let touched = false;
  const ties = cup.ties.map((tie) => {
    const home = tie.boxScore.home.filter((l) => !cull.has(l.pid));
    const away = tie.boxScore.away.filter((l) => !cull.has(l.pid));
    if (home.length === tie.boxScore.home.length && away.length === tie.boxScore.away.length) {
      return tie;
    }
    touched = true;
    return { ...tie, boxScore: { ...tie.boxScore, home, away } };
  });
  return touched ? { ...cup, ties } : cup;
}

/**
 * Drop the per-player box scores from a finished cup's league-phase matches.
 *
 * These are 14.8 MB of a 14-season save (17% of the whole thing) and **nothing
 * reads them**: `cupStatsForPlayer` (the Player Profile Cup tab) iterates only
 * `cup.ties`; Cup.tsx never touches `boxScore` and builds its table via
 * `leaguePhaseTable` from the stored scorelines; clubHistory only keys cups by
 * season. The scorelines, the table and the knockout ties all survive, so this
 * costs no displayed information.
 */
export function stripLeaguePhaseBoxScores<T extends LeagueStore["cupHistory"][number]>(
  cup: T,
): T {
  if (!cup.leaguePhase) return cup;
  if (!cup.leaguePhase.matches.some((m) => m.boxScore !== null)) return cup;
  return {
    ...cup,
    leaguePhase: {
      ...cup.leaguePhase,
      matches: cup.leaguePhase.matches.map((m) =>
        m.boxScore === null ? m : { ...m, boxScore: null },
      ),
    },
  };
}
