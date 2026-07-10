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

// --- Cards (M5) ---
export const FOUL_BASE = 0.016; // per-tick prob the defending side commits a foul
export const FREE_KICK_CHANCE_BASE = 0.05; // bonus shot-chance prob for the fouled side, same tick

// simMatch (composite-only, no player identity): a foul sends the fouling side a man down
// with this flat probability, standing in for straight reds + accumulated second yellows.
export const RED_GIVEN_FOUL_SIMPLE = 0.004;

// simMatchDetailed (player identity available): distinguish yellow/red so bookings persist
// per player and a second yellow becomes a red, per spec.
export const YELLOW_GIVEN_FOUL = 0.11;
export const RED_STRAIGHT_GIVEN_FOUL = 0.003;

// Red card man-down penalty: recompute the short side's composites once, per spec §5.
export const RED_CARD_ATTACK_DELTA = -0.06;
export const RED_CARD_DEFENSE_DELTA = -0.06;
export const RED_CARD_CONTROL_DELTA = -0.04;

// --- Fatigue + substitutions (M5), simMatchDetailed only (needs player identity) ---
// Energy 1 -> ~0.6 over a full match for an average-stamina (50) player, per spec §5/§6.
export const ENERGY_START = 1;
export const ENERGY_FLOOR = 0.6;
export const ENERGY_DECAY_PER_SECOND = (ENERGY_START - ENERGY_FLOOR) / MATCH_SECONDS;
// How much a player's stamina rating (0..99, 50 = average) speeds/slows their own decay.
export const STAMINA_DECAY_SPREAD = 0.5;

// How much a side's average on-pitch energy deficit drags down its composites.
// Physical composites (attack/defense/control) feel fatigue more than technique.
export const FATIGUE_PHYSICAL_WEIGHT = 0.25;
export const FATIGUE_TECHNICAL_WEIGHT = 0.1;

// AI subs: 5 per side, at the 60' and 75' game-clock checkpoints (elapsed seconds).
export const MAX_SUBS = 5;
export const SUB_CHECKPOINTS_ELAPSED = [3600, 4500] as const;
