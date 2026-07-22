/** Every tunable engine value. Copied verbatim from the validated PoC. */
export const MATCH_SECONDS = 5400; // 90 minutes
export const MIN_DT = 2; // seconds per tick (min)
export const MAX_DT = 10; // seconds per tick (max)

export const BASE_CHANCE = 0.0304; // per-tick prob the team on the ball creates a shot
export const STRENGTH_K = 0.8; // how much attack-vs-defense edge swings chance frequency

export const BLOCK_BASE = 0.28; // shot gets blocked
export const ONTARGET_BASE = 0.47; // unblocked shot is on target
export const SAVE_BASE = 0.68; // on-target shot is saved (else goal)

// simMatchDetailed only: how much the individual finisher's own skill shifts a
// shot's conversion, relative to his TEAM's average finisher (shooting for
// open-play shots, heading for corner headers). Centered on the team average,
// so this redistributes a team's goals toward its best finishers without
// changing league-wide scoring — a standout finisher on a weak side scores
// well above his team's baseline; a poor finisher on a strong side underscores.
// Applied to onTargetP/saveP in resolveShot, never to xG (so goals-vs-xG still
// reveals finishing skill). The fast composite-only simMatch is unaffected.
export const SHOOTER_FINISH_WEIGHT = 0.3;

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

// --- Decorative touch attribution (passes / crosses), simMatchDetailed only ---
// Synthesized after the match on a separate rng stream (see attributeTouchStats),
// so they never affect scorelines. Calibrated to real top-flight per-team volumes:
// ~470 passes/team at ~82% completion, ~16 crosses/team. A side plays ~470 ticks.
export const PASSES_PER_TICK = 1.0; // passes attempted per possession tick
export const PASS_ATTEMPT_NOISE = 0.08; // ± fractional noise on a team's pass total
export const PASS_COMPLETION_BASE = 0.82; // league-average completion rate
export const PASS_COMPLETION_CONTROL_K = 0.35; // control composite's pull on completion
export const CROSSES_PER_TICK = 0.034; // crosses attempted per possession tick
export const CROSS_NOISE = 0.15; // ± fractional noise on a team's cross total

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

// How much a player's live match rating (see engine/matchRating.ts) sways who gets
// subbed off, alongside fatigue: a below-baseline rating (deficit/10, roughly -0.4..0.6)
// is added to the player's energy deficit (0..0.4) when ranking sub candidates, so a
// tired player having a great game is less likely to be pulled than an equally tired
// one having a poor game, and vice versa. Kept smaller than the energy deficit's own
// range so fatigue stays the primary driver and rating only nudges the choice.
export const SUB_RATING_INFLUENCE = 0.5;

// A substitution is only made when the fresh bench player is actually worth
// bringing on. Bringing on fresh legs is worth a small quality cost, but not a
// big one — and the more gassed the outgoing starter, the bigger the downgrade
// we'll accept to rest him. Concretely, we allow the replacement's ovr to fall
// short of the starter's ovr by up to:
//   SUB_FRESHNESS_BONUS + SUB_QUALITY_MARGIN + SUB_FATIGUE_RELIEF × fatigue
// where fatigue is the starter's energy deficit normalized to 0..1 (0 fresh, 1
// exhausted). Below that we sub; a larger drop-off keeps the tired starter on.
// Net effect: strong benches rotate freely (their replacements aren't a big
// downgrade), weak benches hold their starters on rather than gut their quality,
// and a genuinely exhausted player comes off even for a lesser sub. Tuned so
// roughly one sub in ten is now held back vs the old always-sub behavior.
export const SUB_FRESHNESS_BONUS = 1.5;
export const SUB_QUALITY_MARGIN = 1;
export const SUB_FATIGUE_RELIEF = 2.5;

// "Give more minutes": a bench player the user has flagged is credited this many
// extra ovr points in the sub decision (both when choosing who to bring on and
// when clearing the worth-it gate above), so he's subbed in more readily — even
// slightly ahead of a marginally better un-flagged option. Deliberately modest:
// it tips close calls, it doesn't force a clearly-worse player onto the pitch.
export const SUB_MINUTES_BOOST = 6;

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
