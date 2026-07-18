import type { PlayedMatch } from "../standings.js";
import {
  POWER_EXPECTED_POINTS_SLOPE,
  POWER_GD_WEIGHT,
  POWER_GD_CAP,
  POWER_PERFORMANCE_WEIGHT,
} from "../constants.js";

export interface TeamFormStats {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  /** OVR-scale bonus/penalty from current-season form; 0 for a team with no matches played yet. */
  performanceBonus: number;
}

/** Points a team "should" earn against a given opponent, purely from the OVR gap — see POWER_* in constants.ts. */
function expectedPoints(ownOvr: number, oppOvr: number): number {
  const raw = 1.5 + POWER_EXPECTED_POINTS_SLOPE * (ownOvr - oppOvr);
  return Math.min(3, Math.max(0, raw));
}

/**
 * A team's record and current-season form bonus, from every match in
 * `matches` that involves `tid` (no pre-filtering required — matches
 * against teams outside the caller's interest are simply skipped). See
 * the POWER_* constants block in constants.ts for the formula.
 */
export function computeTeamForm(
  tid: number,
  ownOvr: number,
  matches: PlayedMatch[],
  ovrByTid: Map<number, number>,
): TeamFormStats {
  let played = 0;
  let won = 0;
  let drawn = 0;
  let lost = 0;
  let gf = 0;
  let ga = 0;
  let performanceTotal = 0;

  for (const m of matches) {
    let oppTid: number;
    let ownGoals: number;
    let oppGoals: number;
    if (m.home === tid) {
      oppTid = m.away;
      ownGoals = m.homeGoals;
      oppGoals = m.awayGoals;
    } else if (m.away === tid) {
      oppTid = m.home;
      ownGoals = m.awayGoals;
      oppGoals = m.homeGoals;
    } else {
      continue;
    }

    played++;
    gf += ownGoals;
    ga += oppGoals;
    if (ownGoals > oppGoals) won++;
    else if (ownGoals === oppGoals) drawn++;
    else lost++;

    const oppOvr = ovrByTid.get(oppTid) ?? ownOvr;
    const actualPoints = ownGoals > oppGoals ? 3 : ownGoals === oppGoals ? 1 : 0;
    const cappedGd = Math.min(POWER_GD_CAP, Math.max(-POWER_GD_CAP, ownGoals - oppGoals));
    performanceTotal += (actualPoints - expectedPoints(ownOvr, oppOvr)) + POWER_GD_WEIGHT * cappedGd;
  }

  return {
    played, won, drawn, lost, gf, ga, gd: gf - ga,
    performanceBonus: played > 0 ? (performanceTotal / played) * POWER_PERFORMANCE_WEIGHT : 0,
  };
}
