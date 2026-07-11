import type { Player } from "./players/types.js";
import { mulberry32, hashInts } from "../engine/rng.js";
import {
  WAGE_WEEKLY_MIN, WAGE_OVR_FLOOR, WAGE_WEEKLY_COEFF, WAGE_VARIATION,
  EXTENSION_LENGTH_YOUNG, EXTENSION_LENGTH_MID, EXTENSION_LENGTH_OLD,
  EXTENSION_AGE_MID, EXTENSION_AGE_OLD,
} from "./constants.js";

/** Stored salaries are per-season totals; the UI presents them weekly. */
export const WEEKS_PER_SEASON = 52;

export function weeklyWage(seasonSalary: number): number {
  return Math.round(seasonSalary / WEEKS_PER_SEASON);
}

/**
 * The per-season salary a contract signed in `seasonSigned` pays a player of
 * this ovr: a cubic weekly wage above WAGE_OVR_FLOOR (see the WAGE_* constants
 * for the Premier League calibration) times a ±WAGE_VARIATION factor that is
 * deterministic per (pid, seasonSigned) — the one-button contract UI shows
 * terms before signing, so the roll can't differ between preview and deal,
 * but the same player re-signing in a different season lands a new deal.
 */
export function seasonSalaryForOvr(ovr: number, pid: number, seasonSigned: number): number {
  const merit = WAGE_WEEKLY_COEFF * Math.max(0, ovr - WAGE_OVR_FLOOR) ** 3;
  const factor = 1 - WAGE_VARIATION + 2 * WAGE_VARIATION * mulberry32(hashInts(pid, seasonSigned))();
  const weekly = Math.round((WAGE_WEEKLY_MIN + merit * factor) / 100) * 100;
  return weekly * WEEKS_PER_SEASON;
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
    salary: seasonSalaryForOvr(player.ovr, player.pid, season),
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
