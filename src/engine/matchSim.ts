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
  FOUL_BASE,
  FREE_KICK_CHANCE_BASE,
  RED_GIVEN_FOUL_SIMPLE,
  YELLOW_GIVEN_FOUL,
  RED_STRAIGHT_GIVEN_FOUL,
  RED_CARD_ATTACK_DELTA,
  RED_CARD_DEFENSE_DELTA,
  RED_CARD_CONTROL_DELTA,
} from "./constants.js";
import type { Composites } from "./composites.js";
import type { MatchPlayer, MatchEvent, BoxScore, PlayerMatchLine } from "./attribution.js";
import {
  pickShooter,
  pickAssister,
  pickTackler,
  pickFouler,
  eventTypeFromShot,
  emptyLine,
} from "./attribution.js";

type Side = "home" | "away";

/** Recompute a side's composites after it goes down a man, per spec §5. Applied once. */
function applyManDown(c: Composites): Composites {
  return {
    ...c,
    attack: clamp(c.attack + RED_CARD_ATTACK_DELTA),
    defense: clamp(c.defense + RED_CARD_DEFENSE_DELTA),
    control: clamp(c.control + RED_CARD_CONTROL_DELTA),
  };
}

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
  redCards: { home: boolean; away: boolean };
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
  const teams: Record<Side, Composites> = { home: homeEff, away };
  const redCards = { home: false, away: false };

  const stat = {
    home: { goals: 0, shots: 0, sot: 0, ticks: 0 } as TeamMatchStat,
    away: { goals: 0, shots: 0, sot: 0, ticks: 0 } as TeamMatchStat,
  };

  let clock = MATCH_SECONDS;
  let poss: Side = rng() < 0.5 ? "home" : "away";

  while (clock > 0) {
    const dt = MIN_DT + rng() * (MAX_DT - MIN_DT);
    clock -= dt;

    const off = teams[poss];
    const defSide: Side = poss === "home" ? "away" : "home";
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

    if (rng() < FOUL_BASE) {
      // defending side commits a foul; no player identity here, so a foul either goes
      // unpunished, or (rarely) sends the fouling side a man down for the rest of the match.
      if (!redCards[defSide] && rng() < RED_GIVEN_FOUL_SIMPLE) {
        redCards[defSide] = true;
        teams[defSide] = applyManDown(teams[defSide]);
      }
      // free kick: bonus shot chance for the fouled (attacking) side, same tick.
      // Scaled by the same attack-vs-defense edge as the main chance gate, so it
      // doesn't dilute skill-driven spread by handing weak sides "free" chances.
      const freeKickEdge = teams[poss].attack - teams[defSide].defense;
      const freeKickP = clamp(
        FREE_KICK_CHANCE_BASE * (1 + STRENGTH_K * freeKickEdge),
        0.01,
        0.3,
      );
      if (rng() < freeKickP) {
        stat[poss].shots++;
        const outcome = resolveShot(rng, teams[poss], teams[defSide]);
        if (outcome === "saved" || outcome === "goal") stat[poss].sot++;
        if (outcome === "goal") {
          stat[poss].goals++;
          poss = defSide;
        }
      }
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
    redCards,
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
  const teams: Record<Side, Composites> = { home: homeEff, away };
  const squads = { home: homePlayers, away: awayPlayers } as const;
  const redCards = { home: false, away: false };
  const sentOff: Record<Side, Set<number>> = { home: new Set(), away: new Set() };
  const yellowCounts = new Map<number, number>();

  const active = (side: Side): MatchPlayer[] =>
    squads[side].filter((p) => !sentOff[side].has(p.pid));

  const stat = {
    home: { goals: 0, shots: 0, sot: 0, ticks: 0 } as TeamMatchStat,
    away: { goals: 0, shots: 0, sot: 0, ticks: 0 } as TeamMatchStat,
  };

  const lines = new Map<number, PlayerMatchLine>();
  for (const p of homePlayers) lines.set(p.pid, emptyLine(p.pid));
  for (const p of awayPlayers) lines.set(p.pid, emptyLine(p.pid));

  const events: MatchEvent[] = [];

  let clock = MATCH_SECONDS;
  let poss: Side = rng() < 0.5 ? "home" : "away";

  while (clock > 0) {
    const dt = MIN_DT + rng() * (MAX_DT - MIN_DT);
    clock -= dt;

    const off = teams[poss];
    const defSide: Side = poss === "home" ? "away" : "home";
    const def = teams[defSide];
    stat[poss].ticks++;

    const turnoverP = clamp(
      TURNOVER_BASE * (1 + 0.6 * (def.defense - off.control)),
      0.02,
      0.5,
    );
    if (rng() < turnoverP) {
      const tackler = pickTackler(rng, active(defSide));
      lines.get(tackler.pid)!.tackles++;
      events.push({ clock, type: "turnover", side: defSide, pids: [tackler.pid] });
      poss = defSide;
      continue;
    }

    if (rng() < FOUL_BASE) {
      const fouler = pickFouler(rng, active(defSide));
      const cardRoll = rng();
      if (cardRoll < RED_STRAIGHT_GIVEN_FOUL) {
        lines.get(fouler.pid)!.redCards++;
        sentOff[defSide].add(fouler.pid);
        redCards[defSide] = true;
        teams[defSide] = applyManDown(teams[defSide]);
        events.push({ clock, type: "red_card", side: defSide, pids: [fouler.pid] });
      } else if (cardRoll < RED_STRAIGHT_GIVEN_FOUL + YELLOW_GIVEN_FOUL) {
        const priorYellows = yellowCounts.get(fouler.pid) ?? 0;
        yellowCounts.set(fouler.pid, priorYellows + 1);
        lines.get(fouler.pid)!.yellowCards++;
        events.push({ clock, type: "yellow_card", side: defSide, pids: [fouler.pid] });
        if (priorYellows + 1 >= 2) {
          lines.get(fouler.pid)!.redCards++;
          sentOff[defSide].add(fouler.pid);
          redCards[defSide] = true;
          teams[defSide] = applyManDown(teams[defSide]);
          events.push({ clock, type: "red_card", side: defSide, pids: [fouler.pid] });
        }
      }

      // free kick: bonus shot chance for the fouled (attacking) side, same tick.
      // Scaled by the same attack-vs-defense edge as the main chance gate, so it
      // doesn't dilute skill-driven spread by handing weak sides "free" chances.
      const freeKickEdge = teams[poss].attack - teams[defSide].defense;
      const freeKickP = clamp(
        FREE_KICK_CHANCE_BASE * (1 + STRENGTH_K * freeKickEdge),
        0.01,
        0.3,
      );
      if (rng() < freeKickP) {
        const shooter = pickShooter(rng, active(poss));
        const shooterLine = lines.get(shooter.pid)!;
        stat[poss].shots++;
        shooterLine.shots++;

        const outcome = resolveShot(rng, teams[poss], teams[defSide]);
        if (outcome === "saved" || outcome === "goal") {
          stat[poss].sot++;
          shooterLine.shotsOnTarget++;
        }
        if (outcome === "saved") {
          const gk = squads[defSide].find((p) => p.pos === "GK");
          if (gk) lines.get(gk.pid)!.saves++;
        }
        events.push({ clock, type: eventTypeFromShot(outcome), side: poss, pids: [shooter.pid] });
        if (outcome === "goal") {
          stat[poss].goals++;
          shooterLine.goals++;
          poss = defSide;
        }
      }
      continue;
    }

    const edge = off.attack - def.defense;
    const chanceP = clamp(BASE_CHANCE * (1 + STRENGTH_K * edge), 0.002, 0.2);
    if (rng() >= chanceP) {
      continue;
    }

    const shooter = pickShooter(rng, active(poss));
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

      const assister = pickAssister(rng, active(poss), shooter.pid);
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
    redCards,
    boxScore: {
      home: homeLines,
      away: awayLines,
      events,
    },
  };
}
