import {
  MATCH_SECONDS,
  MIN_DT,
  MAX_DT,
  BASE_CHANCE,
  STRENGTH_K,
  BLOCK_BASE,
  ONTARGET_BASE,
  SAVE_BASE,
  TURNOVER_BASE,
  REBOUND_PROB,
  HOME_ATTACK_BONUS,
} from "./constants.js";
import type { Composites } from "./composites.js";

export const clamp = (x: number, lo = 0, hi = 1): number =>
  Math.max(lo, Math.min(hi, x));

export interface TeamMatchStat {
  goals: number;
  shots: number;
  sot: number;
  ticks: number;
}

export interface MatchResult {
  home: number; // home goals
  away: number; // away goals
  possessionHome: number; // 0..1, home ticks / total ticks
  stat: { home: TeamMatchStat; away: TeamMatchStat };
}

export type ShotOutcome = "blocked" | "off_target" | "saved" | "goal";

/** Shot resolution cascade: block -> off target -> save -> goal. (PoC lines 57-73) */
export function resolveShot(
  rng: () => number,
  off: Composites,
  def: Composites,
): ShotOutcome {
  const blockP = clamp(BLOCK_BASE * (1 + 0.6 * (def.defense - 0.5)), 0.05, 0.6);
  if (rng() < blockP) return "blocked";

  const onTargetP = clamp(
    ONTARGET_BASE * (1 + 0.5 * (off.finishing - 0.5)),
    0.1,
    0.9,
  );
  if (rng() >= onTargetP) return "off_target";

  const saveP = clamp(
    SAVE_BASE * (1 + 0.5 * (def.keeping - 0.5)) - 0.3 * (off.finishing - 0.5),
    0.2,
    0.95,
  );
  if (rng() < saveP) return "saved";

  return "goal";
}

/** Simulate one match. (PoC lines 76-141) */
export function simMatch(
  rng: () => number,
  home: Composites,
  away: Composites,
): MatchResult {
  const homeEff: Composites = {
    ...home,
    attack: clamp(home.attack + HOME_ATTACK_BONUS),
  };
  const teams = { home: homeEff, away } as const;

  const stat = {
    home: { goals: 0, shots: 0, sot: 0, ticks: 0 } as TeamMatchStat,
    away: { goals: 0, shots: 0, sot: 0, ticks: 0 } as TeamMatchStat,
  };

  let clock = MATCH_SECONDS;
  let poss: "home" | "away" = rng() < 0.5 ? "home" : "away";

  while (clock > 0) {
    const dt = MIN_DT + rng() * (MAX_DT - MIN_DT);
    clock -= dt;

    const off = teams[poss];
    const defSide: "home" | "away" = poss === "home" ? "away" : "home";
    const def = teams[defSide];
    stat[poss].ticks++;

    const turnoverP = clamp(
      TURNOVER_BASE * (1 + 0.6 * (def.defense - off.control)),
      0.02,
      0.5,
    );
    if (rng() < turnoverP) {
      poss = defSide;
      continue;
    }

    const edge = off.attack - def.defense;
    const chanceP = clamp(BASE_CHANCE * (1 + STRENGTH_K * edge), 0.002, 0.2);
    if (rng() >= chanceP) {
      continue; // isNothing() — the escape valve
    }

    stat[poss].shots++;
    const outcome = resolveShot(rng, off, def);

    if (outcome === "saved" || outcome === "goal") stat[poss].sot++;

    if (outcome === "goal") {
      stat[poss].goals++;
      poss = defSide; // kickoff to conceding team
      continue;
    }

    if (rng() < REBOUND_PROB) {
      // attacker keeps possession (poss unchanged)
    } else {
      poss = defSide;
    }
  }

  const totalTicks = stat.home.ticks + stat.away.ticks;
  return {
    home: stat.home.goals,
    away: stat.away.goals,
    possessionHome: totalTicks === 0 ? 0.5 : stat.home.ticks / totalTicks,
    stat,
  };
}
