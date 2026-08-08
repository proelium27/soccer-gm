import type { Player } from "../players/types.js";
import type { ClubContext } from "../ai/clubContext.js";
import {
  PLAYER_WILL_CARE_FLOOR, PLAYER_WILL_CARE_CEILING,
  PLAYER_WILL_DROP_STRENGTH, PLAYER_WILL_REFUSAL_DROP, PLAYER_WILL_RISE_BONUS,
  PLAYER_SETTLED_BONUS, PLAYER_SETTLED_SEASONS,
} from "../constants.js";

/**
 * The player's own say in a transfer.
 *
 * Every valuation in the sim is a *club's* view of a player. That is only half
 * of a real transfer, and leaving out the other half produced the single worst
 * realism bug in the game: because club valuation keys off how much a player
 * would upgrade the buyer, the clubs that valued a superstar most were always
 * the weakest ones in the world, so stars poured downhill into small clubs.
 * Football has no salary cap to justify that (basketball does — cap space
 * really can send a star to a small market), so this module supplies the
 * missing constraint: a good player will not drop down, whatever the money.
 *
 * Two independent frictions live here:
 *   - `moveAppeal`, whether he fancies the destination at all, and
 *   - `settledMultiplier`, how hard he is to move again having just arrived.
 *
 * Both are pure functions of state — no rng draw of any kind — so they can be
 * called anywhere in the market without disturbing the shared RNG stream order
 * the sim's determinism depends on.
 */

/** Clamp into [0,1]. */
function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * How much this player weighs club stature at all, [0,1]. A squad filler will
 * go wherever there's a game; a genuine star cares enormously. Ramps between
 * PLAYER_WILL_CARE_FLOOR and PLAYER_WILL_CARE_CEILING.
 */
export function statureSensitivity(playerOvr: number): number {
  return clamp01(
    (playerOvr - PLAYER_WILL_CARE_FLOOR) /
      (PLAYER_WILL_CARE_CEILING - PLAYER_WILL_CARE_FLOOR),
  );
}

/**
 * Would this player flatly refuse to join `toStature`, coming from `fromStature`?
 * A step down bigger than PLAYER_WILL_REFUSAL_DROP (scaled by how much he cares)
 * is a non-starter at any price — this is the hard gate that keeps a
 * world-class player out of a small club entirely rather than merely making him
 * expensive.
 */
export function refusesMove(playerOvr: number, fromStature: number, toStature: number): boolean {
  const care = statureSensitivity(playerOvr);
  if (care <= 0) return false;
  const drop = fromStature - toStature;
  return drop > PLAYER_WILL_REFUSAL_DROP / care;
}

/**
 * Multiplier applied to a buying club's valuation to account for whether the
 * player actually wants the move: ~0 for a step down he'd refuse, <1 for one he
 * merely dislikes, slightly >1 for a real step up (ambition helps a deal along).
 *
 * Applied to the *buyer's* value rather than as a separate veto so it flows
 * naturally through the rest of the market: a reluctant target's valuation
 * falls below the seller's reservation and the deal simply never assembles,
 * and a grudging move doesn't get bid up into a headline fee.
 */
export function moveAppeal(playerOvr: number, fromStature: number, toStature: number): number {
  const care = statureSensitivity(playerOvr);
  if (care <= 0) return 1;
  if (refusesMove(playerOvr, fromStature, toStature)) return 0;

  const delta = toStature - fromStature;
  if (delta >= 0) return 1 + care * PLAYER_WILL_RISE_BONUS * delta;
  return Math.max(0, 1 - care * PLAYER_WILL_DROP_STRENGTH * -delta);
}

/** `moveAppeal` for a concrete pair of clubs. */
export function moveAppealBetween(
  player: Player,
  from: ClubContext,
  to: ClubContext,
): number {
  return moveAppeal(player.ovr, from.stature, to.stature);
}

/**
 * Keep-value multiplier for how recently the player joined: a man who has only
 * just signed is much harder to prise away again. Decays linearly from
 * 1 + PLAYER_SETTLED_BONUS in the season he arrives to 1.0 after
 * PLAYER_SETTLED_SEASONS.
 *
 * `joinedSeason` is undefined for a player who has never moved (an academy
 * graduate, or anyone predating the transfer log), which is treated as fully
 * settled — a homegrown player is not a flight risk.
 */
export function settledMultiplier(
  joinedSeason: number | undefined,
  season: number,
): number {
  if (joinedSeason === undefined) return 1;
  const elapsed = season - joinedSeason;
  if (elapsed >= PLAYER_SETTLED_SEASONS || elapsed < 0) return 1;
  const remaining = 1 - elapsed / PLAYER_SETTLED_SEASONS;
  return 1 + PLAYER_SETTLED_BONUS * remaining;
}

/**
 * Season each player last arrived at his current club, derived from the
 * transfer log. Free-agent arrivals (the FREE_AGENT_TID sentinel) count — a
 * player who just signed on a free is every bit as newly-arrived — but loan
 * moves and loan returns do not, since they don't change who owns him.
 *
 * Derived rather than persisted so old saves get it for free and there is no
 * new field to migrate.
 */
export function joinedSeasons(
  transfers: readonly {
    pid: number;
    season: number;
    loanSeasons?: number;
    loanReturn?: boolean;
  }[],
): Map<number, number> {
  const joined = new Map<number, number>();
  for (const t of transfers) {
    if (t.loanSeasons || t.loanReturn) continue;
    const prev = joined.get(t.pid);
    if (prev === undefined || t.season > prev) joined.set(t.pid, t.season);
  }
  return joined;
}
