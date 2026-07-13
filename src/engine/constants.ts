/** Every tunable engine value. Copied verbatim from the validated PoC. */
export const MATCH_SECONDS = 5400; // 90 minutes
export const MIN_DT = 2; // seconds per tick (min)
export const MAX_DT = 10; // seconds per tick (max)

export const BASE_CHANCE = 0.0304; // per-tick prob the team on the ball creates a shot
export const STRENGTH_K = 0.8; // how much attack-vs-defense edge swings chance frequency

export const BLOCK_BASE = 0.28; // shot gets blocked
export const ONTARGET_BASE = 0.47; // unblocked shot is on target
export const SAVE_BASE = 0.68; // on-target shot is saved (else goal)

export const TURNOVER_BASE = 0.14; // per-tick prob possession changes hands
// Of every turnover (see TURNOVER_BASE above), the share credited as a
// stat-worthy defensive action at all vs. no credit (a real match has plenty
// of misplaced passes/loose balls no box score attributes to anyone), and of
// that credited share, the split between a tackle and a clean interception.
// These are the two independent tunables; TACKLE_CREDIT_PROB/
// INTERCEPTION_CREDIT_PROB below are derived so matchSim.ts's per-turnover
// roll doesn't need to know about the split. Starting values chosen so a busy
// center-back lands in the real-world plausible ~2-6 tackles and ~2-5
// interceptions per match instead of the pre-fix high-teens blowout —
// pending audit-tuning per the design doc.
export const CREDITED_TURNOVER_PROB = 0.4;
export const INTERCEPTION_SHARE_OF_CREDIT = 0.5;
export const TACKLE_CREDIT_PROB = CREDITED_TURNOVER_PROB * (1 - INTERCEPTION_SHARE_OF_CREDIT);
export const INTERCEPTION_CREDIT_PROB = CREDITED_TURNOVER_PROB * INTERCEPTION_SHARE_OF_CREDIT;
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

// --- Set pieces + penalties (M5) ---
// Fraction of blocked/off-target run-of-play shots that earn a corner (one bonus
// shot, heading-weighted attribution). Resolved via the normal off/def composites
// so it stays correlated with team quality (unlike the flat-rate free-kick bug
// from step 1 that compressed the table-spread gate).
export const CORNER_FROM_MISS_PROB = 0.008;

// Fraction of fouls that are "in the box" -> penalty instead of an ordinary free
// kick. Edge-scaled by the same attack-vs-defense edge as the main chance gate,
// for the same reason as above.
export const PENALTY_GIVEN_FOUL = 0.005;
export const PENALTY_CONVERSION = 0.76; // baseline penalty goal probability, per spec
// Of missed penalties, the share the keeper saves (rest fly off target). Only a
// saved penalty counts as a shot on target and credits the GK a save.
export const PENALTY_MISS_SAVED_PROB = 0.65;

// --- Injuries (M5), simMatchDetailed only (needs player identity + a bench to sub into) ---
// Small probability the tackled ball carrier gets hurt on a given turnover, per spec
// ("small per-tick probability, weighted to tackled players" — modeled as conditional on
// the tackle itself, since that's the sim's only notion of player-on-player contact).
export const INJURY_PROB_ON_TACKLE = 0.003;

// --- Stoppage time (M5) ---
// The engine's tick loop has no halftime break to insert extra time into, so
// both halves' stoppage is computed from their own event counts (goals,
// cards, subs, corners, penalties, injuries) and played out together at the
// very end — statistically equivalent to inserting it mid-match, since every
// per-tick roll is memoryless, and it avoids reworking clock semantics.
export const HALF_SECONDS = MATCH_SECONDS / 2;
export const STOPPAGE_MIN_SECONDS_PER_HALF = 60; // 1 minute floor, per spec
export const STOPPAGE_MAX_SECONDS_PER_HALF = 300; // 5 minute ceiling, per spec
export const STOPPAGE_SECONDS_PER_EVENT = 20;
