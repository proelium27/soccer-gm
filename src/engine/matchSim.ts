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
  ENERGY_START,
  ENERGY_FLOOR,
  ENERGY_DECAY_PER_SECOND,
  STAMINA_DECAY_SPREAD,
  FATIGUE_PHYSICAL_WEIGHT,
  FATIGUE_TECHNICAL_WEIGHT,
  MAX_SUBS,
  SUB_CHECKPOINTS_ELAPSED,
  CORNER_FROM_MISS_PROB,
  PENALTY_GIVEN_FOUL,
  PENALTY_CONVERSION,
  INJURY_PROB_ON_TACKLE,
  HALF_SECONDS,
  STOPPAGE_MIN_SECONDS_PER_HALF,
  STOPPAGE_MAX_SECONDS_PER_HALF,
  STOPPAGE_SECONDS_PER_EVENT,
} from "./constants.js";
import type { Composites } from "./composites.js";
import type { MatchPlayer, MatchEvent, BoxScore, PlayerMatchLine } from "./attribution.js";
import {
  pickShooter,
  pickAssister,
  pickTackler,
  pickFouler,
  pickHeader,
  pickCarrier,
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

/** Per-second energy decay for a player, faster for low-stamina players, slower for high. */
function decayPerSecond(stamina: number): number {
  return ENERGY_DECAY_PER_SECOND * (1 + STAMINA_DECAY_SPREAD * ((50 - stamina) / 50));
}

/** Scale a side's composites down by its on-pitch XI's average energy deficit. */
function applyFatigue(c: Composites, avgEnergy: number): Composites {
  const deficit = ENERGY_START - avgEnergy; // 0 fresh .. ~0.4 exhausted
  const physical = 1 - FATIGUE_PHYSICAL_WEIGHT * deficit;
  const technical = 1 - FATIGUE_TECHNICAL_WEIGHT * deficit;
  return {
    ...c,
    attack: clamp(c.attack * physical),
    defense: clamp(c.defense * physical),
    control: clamp(c.control * physical),
    finishing: clamp(c.finishing * technical),
    keeping: clamp(c.keeping * technical),
  };
}

export const clamp = (x: number, lo = 0, hi = 1): number =>
  Math.max(lo, Math.min(hi, x));

/** 1-5 minutes per half, weighted by that half's notable-event count, per spec §5. */
function computeStoppageSeconds(eventCount: number): number {
  return clamp(
    STOPPAGE_MIN_SECONDS_PER_HALF + eventCount * STOPPAGE_SECONDS_PER_EVENT,
    STOPPAGE_MIN_SECONDS_PER_HALF,
    STOPPAGE_MAX_SECONDS_PER_HALF,
  );
}

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
  let half1Events = 0;
  let half2Events = 0;
  let stoppageApplied = false;
  const bumpEvent = () => {
    if (clock > HALF_SECONDS) half1Events++;
    else half2Events++;
  };

  while (clock > 0) {
    const dt = MIN_DT + rng() * (MAX_DT - MIN_DT);
    clock -= dt;

    if (!stoppageApplied && clock <= 0) {
      clock += computeStoppageSeconds(half1Events) + computeStoppageSeconds(half2Events);
      stoppageApplied = true;
    }

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
        bumpEvent();
      }
      // Edge-scaled so a fraction of fouls happen "in the box" (penalty) vs the
      // open-play free kick below — same edge scaling as the free kick itself,
      // to avoid the flat-rate gate-compression bug from step 1.
      const freeKickEdge = teams[poss].attack - teams[defSide].defense;
      const penaltyP = clamp(
        PENALTY_GIVEN_FOUL * (1 + STRENGTH_K * freeKickEdge),
        0.001,
        0.08,
      );
      if (rng() < penaltyP) {
        // Penalty: unopposed shot, no block/off-target stage.
        bumpEvent();
        stat[poss].shots++;
        stat[poss].sot++;
        const goalP = clamp(
          PENALTY_CONVERSION *
            (1 + 0.15 * (teams[poss].finishing - 0.5) - 0.15 * (teams[defSide].keeping - 0.5)),
          0.55,
          0.9,
        );
        if (rng() < goalP) {
          stat[poss].goals++;
          poss = defSide;
        }
        continue;
      }

      // free kick: bonus shot chance for the fouled (attacking) side, same tick.
      // Scaled by the same attack-vs-defense edge as the main chance gate, so it
      // doesn't dilute skill-driven spread by handing weak sides "free" chances.
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
          bumpEvent();
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
      bumpEvent();
      stat[poss].goals++;
      poss = defSide; // kickoff to conceding team
      continue;
    }

    if (
      (outcome === "blocked" || outcome === "off_target") &&
      rng() < CORNER_FROM_MISS_PROB
    ) {
      // Corner: one bonus shot, still gated through the normal cascade.
      bumpEvent();
      stat[poss].shots++;
      const cornerOutcome = resolveShot(rng, off, def);
      if (cornerOutcome === "saved" || cornerOutcome === "goal") stat[poss].sot++;
      if (cornerOutcome === "goal") {
        stat[poss].goals++;
        poss = defSide;
        continue;
      }
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
 * Same gate cascade as simMatch, but with player-level attribution, plus fatigue
 * and substitutions (M5) which need player identity and so live only here —
 * simMatch (composite-only) is unaffected.
 *
 * Every shot picks a shooter; goals pick an optional assister; saves credit
 * the GK; turnovers credit a defender. No scoreline math changes.
 */
export function simMatchDetailed(
  rng: () => number,
  home: Composites,
  away: Composites,
  homePlayers: MatchPlayer[],
  awayPlayers: MatchPlayer[],
  homeBench: MatchPlayer[] = [],
  awayBench: MatchPlayer[] = [],
): DetailedMatchResult {
  const homeEff: Composites = {
    ...home,
    attack: clamp(home.attack + HOME_ATTACK_BONUS),
  };
  const teams: Record<Side, Composites> = { home: homeEff, away };
  const redCards = { home: false, away: false };
  const yellowCounts = new Map<number, number>();

  // Currently on-pitch XI per side (mutated by red cards and substitutions).
  const onPitch: Record<Side, MatchPlayer[]> = { home: [...homePlayers], away: [...awayPlayers] };
  const bench: Record<Side, MatchPlayer[]> = { home: [...homeBench], away: [...awayBench] };
  const subsUsed = { home: 0, away: 0 };
  const firedCheckpoints = new Set<number>();

  const energy = new Map<number, number>();
  for (const p of [...homePlayers, ...awayPlayers, ...homeBench, ...awayBench]) {
    energy.set(p.pid, ENERGY_START);
  }

  const appeared: Record<Side, Set<number>> = {
    home: new Set(homePlayers.map((p) => p.pid)),
    away: new Set(awayPlayers.map((p) => p.pid)),
  };

  const other = (side: Side): Side => (side === "home" ? "away" : "home");

  let half1Events = 0;
  let half2Events = 0;
  let stoppageApplied = false;
  const bumpEvent = () => {
    if (clock > HALF_SECONDS) half1Events++;
    else half2Events++;
  };

  const avgEnergy = (side: Side): number => {
    const xi = onPitch[side];
    if (xi.length === 0) return ENERGY_START;
    let sum = 0;
    for (const p of xi) sum += energy.get(p.pid)!;
    return sum / xi.length;
  };

  function attemptSub(side: Side, checkpoint: number): void {
    if (subsUsed[side] >= MAX_SUBS || bench[side].length === 0) return;
    const outfield = onPitch[side].filter((p) => p.pos !== "GK");
    if (outfield.length === 0) return;

    const lowestEnergy = (candidates: MatchPlayer[]): MatchPlayer =>
      candidates.reduce((worst, p) => (energy.get(p.pid)! < energy.get(worst.pid)! ? p : worst));

    const trailing = stat[side].goals < stat[other(side)].goals;
    let off: MatchPlayer;
    let on: MatchPlayer;
    if (checkpoint === SUB_CHECKPOINTS_ELAPSED[SUB_CHECKPOINTS_ELAPSED.length - 1] && trailing) {
      // Attacking sub: bring on the bench's best finisher for a defensive-minded player.
      const defensive = outfield.filter((p) => p.pos === "CB" || p.pos === "FB" || p.pos === "DM");
      off = lowestEnergy(defensive.length > 0 ? defensive : outfield);
      on = bench[side].reduce((best, p) => (p.shooting > best.shooting ? p : best));
    } else {
      off = lowestEnergy(outfield);
      const samePos = bench[side].find((p) => p.pos === off.pos);
      on = samePos ?? bench[side][0];
    }

    onPitch[side] = onPitch[side].filter((p) => p.pid !== off.pid).concat(on);
    bench[side] = bench[side].filter((p) => p.pid !== on.pid);
    subsUsed[side]++;
    appeared[side].add(on.pid);
    energy.set(on.pid, ENERGY_START);
    bumpEvent();
    events.push({ clock, type: "substitution", side, pids: [off.pid, on.pid] });
  }

  /** An injured player must come off immediately, regardless of energy — unlike attemptSub, the outgoing player is fixed. */
  function forceInjurySub(side: Side, offPid: number): void {
    const off = onPitch[side].find((p) => p.pid === offPid);
    if (!off) return;
    onPitch[side] = onPitch[side].filter((p) => p.pid !== offPid);

    if (subsUsed[side] < MAX_SUBS && bench[side].length > 0) {
      const samePos = bench[side].find((p) => p.pos === off.pos);
      const on = samePos ?? bench[side][0];
      onPitch[side] = onPitch[side].concat(on);
      bench[side] = bench[side].filter((p) => p.pid !== on.pid);
      subsUsed[side]++;
      appeared[side].add(on.pid);
      energy.set(on.pid, ENERGY_START);
      bumpEvent();
      events.push({ clock, type: "substitution", side, pids: [off.pid, on.pid] });
    } else {
      // No sub available: play the rest of the match a man down.
      teams[side] = applyManDown(teams[side]);
    }
  }

  const stat = {
    home: { goals: 0, shots: 0, sot: 0, ticks: 0 } as TeamMatchStat,
    away: { goals: 0, shots: 0, sot: 0, ticks: 0 } as TeamMatchStat,
  };

  const lines = new Map<number, PlayerMatchLine>();
  for (const p of [...homePlayers, ...awayPlayers, ...homeBench, ...awayBench]) {
    lines.set(p.pid, emptyLine(p.pid));
  }

  const events: MatchEvent[] = [];

  let clock = MATCH_SECONDS;
  let poss: Side = rng() < 0.5 ? "home" : "away";

  while (clock > 0) {
    const dt = MIN_DT + rng() * (MAX_DT - MIN_DT);
    clock -= dt;
    const elapsed = MATCH_SECONDS - clock;

    if (!stoppageApplied && clock <= 0) {
      clock += computeStoppageSeconds(half1Events) + computeStoppageSeconds(half2Events);
      stoppageApplied = true;
    }

    for (const side of ["home", "away"] as const) {
      for (const p of onPitch[side]) {
        const next = energy.get(p.pid)! - decayPerSecond(p.stamina) * dt;
        energy.set(p.pid, clamp(next, ENERGY_FLOOR, ENERGY_START));
      }
    }

    for (const cp of SUB_CHECKPOINTS_ELAPSED) {
      if (!firedCheckpoints.has(cp) && elapsed >= cp) {
        firedCheckpoints.add(cp);
        attemptSub("home", cp);
        attemptSub("away", cp);
      }
    }

    const defSide: Side = poss === "home" ? "away" : "home";
    const off = applyFatigue(teams[poss], avgEnergy(poss));
    const def = applyFatigue(teams[defSide], avgEnergy(defSide));
    stat[poss].ticks++;

    const turnoverP = clamp(
      TURNOVER_BASE * (1 + 0.6 * (def.defense - off.control)),
      0.02,
      0.5,
    );
    if (rng() < turnoverP) {
      const tackler = pickTackler(rng, onPitch[defSide]);
      lines.get(tackler.pid)!.tackles++;
      events.push({ clock, type: "turnover", side: defSide, pids: [tackler.pid] });

      if (rng() < INJURY_PROB_ON_TACKLE) {
        const carrier = pickCarrier(rng, onPitch[poss]);
        bumpEvent();
        events.push({ clock, type: "injury", side: poss, pids: [carrier.pid] });
        forceInjurySub(poss, carrier.pid);
      }

      poss = defSide;
      continue;
    }

    if (rng() < FOUL_BASE) {
      const fouler = pickFouler(rng, onPitch[defSide]);
      const cardRoll = rng();
      if (cardRoll < RED_STRAIGHT_GIVEN_FOUL) {
        lines.get(fouler.pid)!.redCards++;
        onPitch[defSide] = onPitch[defSide].filter((p) => p.pid !== fouler.pid);
        redCards[defSide] = true;
        teams[defSide] = applyManDown(teams[defSide]);
        bumpEvent();
        events.push({ clock, type: "red_card", side: defSide, pids: [fouler.pid] });
      } else if (cardRoll < RED_STRAIGHT_GIVEN_FOUL + YELLOW_GIVEN_FOUL) {
        const priorYellows = yellowCounts.get(fouler.pid) ?? 0;
        yellowCounts.set(fouler.pid, priorYellows + 1);
        lines.get(fouler.pid)!.yellowCards++;
        bumpEvent();
        events.push({ clock, type: "yellow_card", side: defSide, pids: [fouler.pid] });
        if (priorYellows + 1 >= 2) {
          lines.get(fouler.pid)!.redCards++;
          onPitch[defSide] = onPitch[defSide].filter((p) => p.pid !== fouler.pid);
          redCards[defSide] = true;
          teams[defSide] = applyManDown(teams[defSide]);
          bumpEvent();
          events.push({ clock, type: "red_card", side: defSide, pids: [fouler.pid] });
        }
      }

      // Edge-scaled so a fraction of fouls happen "in the box" (penalty) vs the
      // open-play free kick below — same reasoning as the composite-only version.
      const freeKickEdge = off.attack - def.defense;
      const penaltyP = clamp(
        PENALTY_GIVEN_FOUL * (1 + STRENGTH_K * freeKickEdge),
        0.001,
        0.08,
      );
      if (rng() < penaltyP) {
        const shooter = pickShooter(rng, onPitch[poss]);
        const shooterLine = lines.get(shooter.pid)!;
        stat[poss].shots++;
        shooterLine.shots++;
        stat[poss].sot++;
        shooterLine.shotsOnTarget++;

        bumpEvent();
        events.push({ clock, type: "penalty", side: poss, pids: [shooter.pid] });

        const goalP = clamp(
          PENALTY_CONVERSION * (1 + 0.15 * (off.finishing - 0.5) - 0.15 * (def.keeping - 0.5)),
          0.55,
          0.9,
        );
        if (rng() < goalP) {
          stat[poss].goals++;
          shooterLine.goals++;
          events.push({ clock, type: "goal", side: poss, pids: [shooter.pid] });
          poss = defSide;
        } else {
          const gk = onPitch[defSide].find((p) => p.pos === "GK");
          if (gk) lines.get(gk.pid)!.saves++;
          events.push({ clock, type: "shot_saved", side: poss, pids: [shooter.pid] });
        }
        continue;
      }

      // free kick: bonus shot chance for the fouled (attacking) side, same tick.
      // Scaled by the same attack-vs-defense edge as the main chance gate, so it
      // doesn't dilute skill-driven spread by handing weak sides "free" chances.
      const freeKickP = clamp(
        FREE_KICK_CHANCE_BASE * (1 + STRENGTH_K * freeKickEdge),
        0.01,
        0.3,
      );
      if (rng() < freeKickP) {
        const shooter = pickShooter(rng, onPitch[poss]);
        const shooterLine = lines.get(shooter.pid)!;
        stat[poss].shots++;
        shooterLine.shots++;

        const outcome = resolveShot(rng, off, def);
        if (outcome === "saved" || outcome === "goal") {
          stat[poss].sot++;
          shooterLine.shotsOnTarget++;
        }
        if (outcome === "saved") {
          const gk = onPitch[defSide].find((p) => p.pos === "GK");
          if (gk) lines.get(gk.pid)!.saves++;
        }
        events.push({ clock, type: eventTypeFromShot(outcome), side: poss, pids: [shooter.pid] });
        if (outcome === "goal") {
          bumpEvent();
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

    const shooter = pickShooter(rng, onPitch[poss]);
    const shooterLine = lines.get(shooter.pid)!;
    stat[poss].shots++;
    shooterLine.shots++;

    const outcome = resolveShot(rng, off, def);

    if (outcome === "saved" || outcome === "goal") {
      stat[poss].sot++;
      shooterLine.shotsOnTarget++;
    }

    if (outcome === "saved") {
      const gk = onPitch[defSide].find((p) => p.pos === "GK");
      if (gk) lines.get(gk.pid)!.saves++;
    }

    const evtType = eventTypeFromShot(outcome);
    const pids = [shooter.pid];

    if (outcome === "goal") {
      bumpEvent();
      stat[poss].goals++;
      shooterLine.goals++;

      const assister = pickAssister(rng, onPitch[poss], shooter.pid);
      if (assister) {
        lines.get(assister.pid)!.assists++;
        pids.push(assister.pid);
      }

      events.push({ clock, type: evtType, side: poss, pids });
      poss = defSide;
      continue;
    }

    events.push({ clock, type: evtType, side: poss, pids });

    if (
      (outcome === "blocked" || outcome === "off_target") &&
      rng() < CORNER_FROM_MISS_PROB
    ) {
      bumpEvent();
      events.push({ clock, type: "corner", side: poss, pids: [] });
      const header = pickHeader(rng, onPitch[poss]);
      const headerLine = lines.get(header.pid)!;
      stat[poss].shots++;
      headerLine.shots++;

      const cornerOutcome = resolveShot(rng, off, def);
      if (cornerOutcome === "saved" || cornerOutcome === "goal") {
        stat[poss].sot++;
        headerLine.shotsOnTarget++;
      }
      if (cornerOutcome === "saved") {
        const gk = onPitch[defSide].find((p) => p.pos === "GK");
        if (gk) lines.get(gk.pid)!.saves++;
      }

      const cornerPids = [header.pid];
      if (cornerOutcome === "goal") {
        stat[poss].goals++;
        headerLine.goals++;
        const assister = pickAssister(rng, onPitch[poss], header.pid);
        if (assister) {
          lines.get(assister.pid)!.assists++;
          cornerPids.push(assister.pid);
        }
        events.push({ clock, type: "goal", side: poss, pids: cornerPids });
        poss = defSide;
        continue;
      }
      events.push({ clock, type: eventTypeFromShot(cornerOutcome), side: poss, pids: cornerPids });
    }

    if (rng() < REBOUND_PROB) {
      // attacker keeps possession
    } else {
      poss = defSide;
    }
  }

  const totalTicks = stat.home.ticks + stat.away.ticks;

  const homeLines = [...homePlayers, ...homeBench]
    .filter((p) => appeared.home.has(p.pid))
    .map((p) => lines.get(p.pid)!);
  const awayLines = [...awayPlayers, ...awayBench]
    .filter((p) => appeared.away.has(p.pid))
    .map((p) => lines.get(p.pid)!);

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
