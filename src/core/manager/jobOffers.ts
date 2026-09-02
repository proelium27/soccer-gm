/**
 * Reputation, and which clubs come calling because of it.
 *
 * Offers are drawn on a dedicated seeded stream (`hashInts` off lid + season),
 * never the shared `rng` — the same rule every other post-hoc system in the sim
 * follows. Drawing from the shared stream here would shift every downstream roll
 * in the world according to whether a club happened to offer the user a job,
 * which is exactly the class of bug the rule exists to prevent.
 */
import { mulberry32, hashInts } from "../../engine/rng.js";
import {
  MANAGER_MAX_OFFERS,
  MANAGER_OFFER_BAND,
  MANAGER_OFFER_LATERAL_BAND,
  MANAGER_OFFER_BASE_CHANCE,
  MANAGER_OFFER_FORM_WEIGHT,
  MANAGER_OFFER_MAX_CHANCE,
  MANAGER_SACKED_PRESTIGE_PENALTY,
  MANAGER_REP_BASE,
  MANAGER_REP_TITLE_WEIGHT,
  MANAGER_REP_TROPHY_WEIGHT,
  MANAGER_REP_OVERPERFORMANCE_WEIGHT,
  MANAGER_REP_SEASON_WEIGHT,
  MANAGER_REP_SEASON_CAP,
  MANAGER_REP_SACKING_PENALTY,
} from "../constants.js";
import type { ClubExpectation } from "./expectation.js";
import type { JobOffer, ManagerStint } from "./types.js";

const MANAGER_OFFER_STREAM = 970;

/**
 * A manager's standing in the game, 0-100 — derived from the stint record, never
 * stored, so the formula can be retuned without rewriting anyone's career.
 *
 * Longevity is capped on purpose: surviving fifteen seasons at a quiet club is
 * a career, but it shouldn't out-argue a manager who won things.
 */
export function managerReputation(stints: ManagerStint[]): number {
  let score = MANAGER_REP_BASE;
  let seasons = 0;
  let sackings = 0;
  for (const s of stints) {
    score += s.titles * MANAGER_REP_TITLE_WEIGHT;
    score += s.trophies * MANAGER_REP_TROPHY_WEIGHT;
    score += s.overperformance * MANAGER_REP_OVERPERFORMANCE_WEIGHT;
    seasons += s.seasons;
    if (s.ending === "sacked") sackings++;
  }
  score += Math.min(seasons, MANAGER_REP_SEASON_CAP) * MANAGER_REP_SEASON_WEIGHT;
  score -= sackings * MANAGER_REP_SACKING_PENALTY;
  return Math.min(100, Math.max(0, score));
}

/** Fisher-Yates on a seeded stream, so an offer list is stable across reloads. */
function shuffled<T>(items: T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const toOffer = (e: ClubExpectation, moves: OfferMoves): JobOffer => {
  const moving = moves.promoted.has(e.tid) ? "promoted"
    : moves.relegated.has(e.tid) ? "relegated"
      : null;
  return {
    tid: e.tid,
    compId: moves.nextCompId.get(e.tid) ?? e.compId,
    moving,
    prestige: e.prestige,
    // Rank stays relative to the division just played, which is the only one it
    // was measured in. The UI says which division that was, so a promoted
    // club's "1st of 20" can't be misread as a top-flight ranking.
    expectedRank: e.expectedRank,
    clubs: e.clubs,
  };
};

/** Where each club ends up once the offseason applies promotion and relegation. */
export interface OfferMoves {
  promoted: Set<number>;
  relegated: Set<number>;
  nextCompId: Map<number, number>;
}

export const NO_MOVES: OfferMoves = {
  promoted: new Set(),
  relegated: new Set(),
  nextCompId: new Map(),
};

export interface OfferInputs {
  lid: number;
  season: number;
  currentTid: number;
  expectations: Map<number, ClubExpectation>;
  /** The board has dismissed you, so offers are guaranteed and drawn a rung down. */
  sacked: boolean;
  reputation: number;
  /** Last season's finish-versus-expectation — a good season gets you noticed. */
  lastOverperformance: number;
  /** Promotion/relegation about to be applied, so an offer names the right division. */
  moves?: OfferMoves;
}

/**
 * Which clubs want you this offseason.
 *
 * While you're employed the list is deliberately restricted to jobs at least as
 * big as your current one: an offer to drop down a level is not an opportunity,
 * it's noise, and a list full of them makes the real ones hard to spot. Once
 * you're sacked the rule inverts — the clubs that will take you are a rung below
 * the one that let you go.
 *
 * **The band is centred on the bigger of your reputation and your current club,
 * and that `max` is load-bearing rather than defensive.** The two filters below
 * live on different scales — the band is an absolute window in world prestige,
 * the step-up filter is relative to the job you hold — so centring the band on
 * reputation alone made them stop overlapping the moment you managed a club
 * bigger than your reputation "deserved". The intersection is empty whenever
 * `currentPrestige > reputation/100 + MANAGER_OFFER_BAND`, which is reachable
 * two ways and was reported from a real save both times: a *new* manager handed
 * a big club (reputation 30, prestige 0.9) and, worse, a *decorated* one who had
 * climbed to the top (reputation caps at 100, so the band tops out at 1.2 while
 * the best club in the world sits at prestige 1.000). Measured on a fresh
 * 626-club world, mean offers per season by club world rank at reputation 100:
 * rank 1 **0.00**, rank 3 0.75, rank 10 2.83, rank 25 3.33. The better you did,
 * the fewer offers you got, until they stopped.
 *
 * Reputation still does the job it exists for — it is what lets a small club's
 * manager be offered the biggest jobs in the world — it simply no longer *caps*
 * how big a job may approach you.
 */
export function generateJobOffers(input: OfferInputs): JobOffer[] {
  const { expectations, currentTid, sacked } = input;
  const current = expectations.get(currentTid);
  const currentPrestige = current?.prestige ?? 0;

  // A sacking is "a rung down" from where you were, so the penalty applies to
  // the centred target rather than to reputation in isolation — measuring the
  // drop against reputation is the same category error the band had.
  const target = Math.min(
    1,
    Math.max(
      0,
      Math.max(input.reputation / 100, currentPrestige)
      - (sacked ? MANAGER_SACKED_PRESTIGE_PENALTY : 0),
    ),
  );

  const others = [...expectations.values()].filter((e) => e.tid !== currentTid);
  const byCloseness = (a: ClubExpectation, b: ClubExpectation): number =>
    Math.abs(a.prestige - target) - Math.abs(b.prestige - target);

  let pool = others
    .filter((e) => Math.abs(e.prestige - target) <= MANAGER_OFFER_BAND)
    // A strict `>=` is unsatisfiable for the one club normalization puts at
    // 1.000, so a lateral allowance lets the summit hear from its peers. The
    // sacked side needs none — it is already permissive downward.
    .filter((e) => (sacked
      ? e.prestige <= currentPrestige
      : e.prestige >= currentPrestige - MANAGER_OFFER_LATERAL_BAND))
    .sort(byCloseness);

  const rng = mulberry32(hashInts(input.lid, input.season, MANAGER_OFFER_STREAM));
  const moves = input.moves ?? NO_MOVES;

  if (sacked) {
    // No roll and no empty list: the save cannot continue without a club, so
    // fall back to whichever clubs sit closest to the target if the band and
    // the step-down filter between them left nothing.
    if (pool.length === 0) pool = [...others].sort(byCloseness);
    return shuffled(pool.slice(0, MANAGER_MAX_OFFERS * 3), rng)
      .slice(0, MANAGER_MAX_OFFERS)
      .sort((a, b) => b.prestige - a.prestige)
      .map((e) => toOffer(e, moves));
  }

  const chance = Math.min(
    MANAGER_OFFER_MAX_CHANCE,
    Math.max(0, MANAGER_OFFER_BASE_CHANCE + input.lastOverperformance * MANAGER_OFFER_FORM_WEIGHT),
  );

  const offers: ClubExpectation[] = [];
  for (const club of shuffled(pool.slice(0, MANAGER_MAX_OFFERS * 4), rng)) {
    if (offers.length >= MANAGER_MAX_OFFERS) break;
    if (rng() < chance) offers.push(club);
  }
  return offers.sort((a, b) => b.prestige - a.prestige).map((e) => toOffer(e, moves));
}
