import type { Player } from "./players/types.js";
import {
  SALARY_PER_OVR,
  EXTENSION_LENGTH_YOUNG, EXTENSION_LENGTH_MID, EXTENSION_LENGTH_OLD,
  EXTENSION_AGE_MID, EXTENSION_AGE_OLD,
} from "./constants.js";

/** Stored salaries are per-season totals; the UI presents them weekly. */
export const WEEKS_PER_SEASON = 52;

export function weeklyWage(seasonSalary: number): number {
  return Math.round(seasonSalary / WEEKS_PER_SEASON);
}

export interface ContractTerms {
  /** Per-season total (presented weekly in the UI). */
  salary: number;
  lengthSeasons: number;
  expiresSeason: number;
}

/**
 * The one-button contract terms (design: contracts are never negotiated).
 * Salary is the standard rate for the player's current ovr; length is
 * deterministic by age — long deals for the young, short for the old — so
 * the extend/sign button can state exactly what it does.
 */
export function contractTerms(player: Player, season: number): ContractTerms {
  const age = season - player.born;
  const lengthSeasons =
    age < EXTENSION_AGE_MID ? EXTENSION_LENGTH_YOUNG
    : age < EXTENSION_AGE_OLD ? EXTENSION_LENGTH_MID
    : EXTENSION_LENGTH_OLD;
  return {
    salary: SALARY_PER_OVR * player.ovr,
    lengthSeasons,
    expiresSeason: season + lengthSeasons,
  };
}

/** A contract "needs extending" once the player is in its final season. */
export function canExtend(player: Player, season: number): boolean {
  return player.contract.expiresSeason <= season;
}

/** Re-sign a player to fresh one-button terms, effective immediately. */
export function extendContract(players: Player[], pid: number, season: number): Player[] {
  return players.map((p) => {
    if (p.pid !== pid) return p;
    const terms = contractTerms(p, season);
    return { ...p, contract: { salary: terms.salary, expiresSeason: terms.expiresSeason } };
  });
}
