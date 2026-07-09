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
import type { MatchPlayer, MatchEvent, BoxScore, PlayerMatchLine } from "./attribution.js";
import {
  pickShooter,
  pickAssister,
  pickTackler,
  eventTypeFromShot,
  emptyLine,
} from "./attribution.js";

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

export interface DetailedMatchResult extends MatchResult {
  boxScore: BoxScore;
}

/**
 * Same gate cascade as simMatch, but with player-level attribution.
 * Every shot picks a shooter; goals pick an optional assister; saves credit
 * the GK; turnovers credit a defender. No scoreline math changes.
 */
export function simMatchDetailed(
  rng: () => number,
  home: Composites,
  away: Composites,
  homePlayers: MatchPlayer[],
  awayPlayers: MatchPlayer[],
): DetailedMatchResult {
  const homeEff: Composites = {
    ...home,
    attack: clamp(home.attack + HOME_ATTACK_BONUS),
  };
  const teams = { home: homeEff, away } as const;
  const squads = { home: homePlayers, away: awayPlayers } as const;

  const stat = {
    home: { goals: 0, shots: 0, sot: 0, ticks: 0 } as TeamMatchStat,
    away: { goals: 0, shots: 0, sot: 0, ticks: 0 } as TeamMatchStat,
  };

  const lines = new Map<number, PlayerMatchLine>();
  for (const p of homePlayers) lines.set(p.pid, emptyLine(p.pid));
  for (const p of awayPlayers) lines.set(p.pid, emptyLine(p.pid));

  const events: MatchEvent[] = [];

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
      const tackler = pickTackler(rng, squads[defSide]);
      lines.get(tackler.pid)!.tackles++;
      events.push({ clock, type: "turnover", side: defSide, pids: [tackler.pid] });
      poss = defSide;
      continue;
    }

    const edge = off.attack - def.defense;
    const chanceP = clamp(BASE_CHANCE * (1 + STRENGTH_K * edge), 0.002, 0.2);
    if (rng() >= chanceP) {
      continue;
    }

    const shooter = pickShooter(rng, squads[poss]);
    const shooterLine = lines.get(shooter.pid)!;
    stat[poss].shots++;
    shooterLine.shots++;

    const outcome = resolveShot(rng, off, def);

    if (outcome === "saved" || outcome === "goal") {
      stat[poss].sot++;
      shooterLine.shotsOnTarget++;
    }

    if (outcome === "saved") {
      const gk = squads[defSide].find((p) => p.pos === "GK");
      if (gk) lines.get(gk.pid)!.saves++;
    }

    const evtType = eventTypeFromShot(outcome);
    const pids = [shooter.pid];

    if (outcome === "goal") {
      stat[poss].goals++;
      shooterLine.goals++;

      const assister = pickAssister(rng, squads[poss], shooter.pid);
      if (assister) {
        lines.get(assister.pid)!.assists++;
        pids.push(assister.pid);
      }

      events.push({ clock, type: evtType, side: poss, pids });
      poss = defSide;
      continue;
    }

    events.push({ clock, type: evtType, side: poss, pids });

    if (rng() < REBOUND_PROB) {
      // attacker keeps possession
    } else {
      poss = defSide;
    }
  }

  const totalTicks = stat.home.ticks + stat.away.ticks;

  const homeLines = homePlayers.map((p) => lines.get(p.pid)!);
  const awayLines = awayPlayers.map((p) => lines.get(p.pid)!);

  return {
    home: stat.home.goals,
    away: stat.away.goals,
    possessionHome: totalTicks === 0 ? 0.5 : stat.home.ticks / totalTicks,
    stat,
    boxScore: {
      home: homeLines,
      away: awayLines,
      events,
    },
  };
}
