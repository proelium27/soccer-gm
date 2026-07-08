/** Every tunable engine value. Copied verbatim from the validated PoC. */
export const MATCH_SECONDS = 5400; // 90 minutes
export const MIN_DT = 2; // seconds per tick (min)
export const MAX_DT = 10; // seconds per tick (max)

export const BASE_CHANCE = 0.032; // per-tick prob the team on the ball creates a shot
export const STRENGTH_K = 0.8; // how much attack-vs-defense edge swings chance frequency

export const BLOCK_BASE = 0.28; // shot gets blocked
export const ONTARGET_BASE = 0.47; // unblocked shot is on target
export const SAVE_BASE = 0.68; // on-target shot is saved (else goal)

export const TURNOVER_BASE = 0.14; // per-tick prob possession changes hands
export const REBOUND_PROB = 0.12; // after a saved/blocked shot, attacker keeps it

export const HOME_ATTACK_BONUS = 0.1; // home advantage, applied to home attack composite
