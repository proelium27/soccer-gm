import type { StoredTeam } from "../teams/clubs.js";
import {
  HYPE_MAX, HYPE_MIN, SCOUTING_SPEND_MAX,
  YOUTH_TRIAL_HYPE_SWING, YOUTH_TRIAL_SCOUTING_SWING,
} from "../constants.js";

/**
 * How much better the user's youth trial group is for the club being well run:
 * an ovr bonus added to his academy anchor at intake time.
 *
 * Two inputs, chosen because they are things the manager actually decides and
 * neither reached youth intake before:
 *
 *  - **scouting spend**, which is what finds young players in the first place.
 *    Before this it bought nothing but a narrower potential fog, so a manager
 *    who valued youth had no way to invest in it.
 *  - **hype**, so a club people are excited about attracts the better kids.
 *
 * Each is normalized to 0..1 across its own range and pays half the total
 * swing, so full spend and maximum hype earns all of it and neither earns
 * nothing. `scoutingSpend` is the LOCKED current-season figure, not
 * `nextScoutingSpend` — you are paid for what you actually spent while these
 * players were being found, which also closes the same peek-then-lower dodge
 * the locked field exists for.
 *
 * **A bonus only, never a penalty.** The anchor already encodes the club's
 * standing and ACADEMY_FORM_SWING already pushes both ways on results; a third
 * lever that also subtracted would stack three penalties on a struggling club's
 * cheapest route back. Being one-sided and reaching one club in a world of 420,
 * it cannot move a league's mean, which is what lets it ship without a dynasty
 * audit — see YOUTH_TRIAL_SCOUTING_SWING.
 *
 * Pure, rng-free, and never written back into `academyBase` (the anti-inflation
 * anchor, also read by promotion convergence and roster-import realignment).
 */
export function academyFacilitiesBonus(team: StoredTeam): number {
  const spend = clamp01(team.scoutingSpend / SCOUTING_SPEND_MAX);
  const hype = clamp01((team.hype - HYPE_MIN) / (HYPE_MAX - HYPE_MIN));
  return spend * YOUTH_TRIAL_SCOUTING_SWING + hype * YOUTH_TRIAL_HYPE_SWING;
}

/** The most this can be worth, for the Youth Intake screen's explanation. */
export const ACADEMY_FACILITIES_MAX = YOUTH_TRIAL_SCOUTING_SWING + YOUTH_TRIAL_HYPE_SWING;

function clamp01(x: number): number {
  return Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0;
}
