import type { Player } from "./players/types.js";
import type { PlayedMatch } from "./standings.js";
import { INJURY_GAMES_MIN, INJURY_GAMES_MAX } from "./constants.js";

const INJURY_TYPES = ["knock", "muscle strain", "ankle sprain"] as const;

function rollInjury(rng: () => number): { gamesRemaining: number; type: string } {
  const gamesRemaining =
    INJURY_GAMES_MIN + Math.floor(rng() * (INJURY_GAMES_MAX - INJURY_GAMES_MIN + 1));
  const type = INJURY_TYPES[Math.floor(rng() * INJURY_TYPES.length)];
  return { gamesRemaining, type };
}

/**
 * Stamp a fresh injury on every player in `pids` — used to carry injuries picked
 * up at the summer's internationals into the new club season, applied *after*
 * the offseason has healed everyone's club-season knocks (see offseason.ts). The
 * caller passes a dedicated seeded rng, never the shared offseason stream, so
 * durations are deterministic without perturbing progression or match results.
 * The player then misses the opening `gamesRemaining` matchdays, ticking down
 * through `applyInjuries` exactly like any other injury.
 */
export function carryIntlInjuries(players: Player[], pids: number[], rng: () => number): Player[] {
  if (pids.length === 0) return players;
  const set = new Set(pids);
  return players.map((p) => (set.has(p.pid) ? { ...p, injury: rollInjury(rng) } : p));
}

/**
 * Multi-game injury recovery (spec §5/§6): the engine only decides whether a
 * player gets hurt in a given match (forcing a sub) and logs an "injury"
 * event; this is where that becomes a persistent games-out countdown. Called
 * once per matchday after that matchday's games are simmed — new injuries
 * from this matchday start their countdown, and every player already
 * carrying one ticks down by a game (whether they played or not), clearing
 * once healed.
 */
export function applyInjuries(
  rng: () => number,
  players: Player[],
  matches: PlayedMatch[],
): Player[] {
  const injuredThisMatchday = new Set<number>();
  for (const m of matches) {
    for (const e of m.boxScore.events) {
      if (e.type === "injury") injuredThisMatchday.add(e.pids[0]);
    }
  }

  return players.map((p) => {
    if (injuredThisMatchday.has(p.pid)) {
      return { ...p, injury: rollInjury(rng) };
    }
    if (p.injury) {
      const gamesRemaining = p.injury.gamesRemaining - 1;
      return { ...p, injury: gamesRemaining > 0 ? { ...p.injury, gamesRemaining } : null };
    }
    return p;
  });
}
