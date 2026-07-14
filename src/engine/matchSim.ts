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
  TACKLE_CREDIT_PROB,
  INTERCEPTION_CREDIT_PROB,
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
  PENALTY_MISS_SAVED_PROB,
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
  pickInterceptor,
  pickFouler,
  pickHeader,
  pickCarrier,
  eventTypeFromShot,
  emptyLine,
} from "./attribution.js";
import { computeMatchRating } from "./matchRating.js";

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
export function computeStoppageSeconds(eventCount: number): number {
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
}

export type ShotOutcome = "blocked" | "off_target" | "saved" | "goal";

export interface ShotResult {
  outcome: ShotOutcome;
  /**
   * The chance's quality, independent of who's taking it: what an
   * average-finishing attacker would be expected to score against this same
   * defense. Deliberately excludes `off.finishing` (see xgOnTargetP/xgSaveP
   * below) — an elite finisher's shots must NOT score higher xG just because
   * he's an elite finisher, or "goals vs xG" could never reveal finishing
   * skill (his actual conversion rate would just track his own inflated
   * baseline). blockP/saveP still reflect the actual defense/keeper faced,
   * since that's genuine chance difficulty, not shooter identity.
   */
  xg: number;
}

/** Shot resolution cascade: block -> off target -> save -> goal. (PoC lines 57-73) */
export function resolveShot(
  rng: () => number,
  off: Composites,
  def: Composites,
): ShotResult {
  const blockP = clamp(BLOCK_BASE * (1 + 0.6 * (def.defense - 0.5)), 0.05, 0.6);
  const onTargetP = clamp(
    ONTARGET_BASE * (1 + 0.5 * (off.finishing - 0.5)),
    0.1,
    0.9,
  );
  const saveP = clamp(
    SAVE_BASE * (1 + 0.5 * (def.keeping - 0.5)) - 0.3 * (off.finishing - 0.5),
    0.2,
    0.95,
  );

  // xG-only probabilities: same cascade, but with the shooter's finishing
  // held at a neutral 0.5 (the "average attacker" baseline every composite
  // is centered on elsewhere in this file). These never drive the RNG rolls
  // below — only the real onTargetP/saveP (which do include off.finishing)
  // decide the actual outcome, so match balance/tuning is untouched.
  const xgOnTargetP = clamp(ONTARGET_BASE, 0.1, 0.9);
  const xgSaveP = clamp(SAVE_BASE * (1 + 0.5 * (def.keeping - 0.5)), 0.2, 0.95);
  const xg = (1 - blockP) * xgOnTargetP * (1 - xgSaveP);

  if (rng() < blockP) return { outcome: "blocked", xg };
  if (rng() >= onTargetP) return { outcome: "off_target", xg };
  if (rng() < saveP) return { outcome: "saved", xg };
  return { outcome: "goal", xg };
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
  const manDown = { home: false, away: false };

  const stat = {
    home: { goals: 0, shots: 0, sot: 0, ticks: 0 } as TeamMatchStat,
    away: { goals: 0, shots: 0, sot: 0, ticks: 0 } as TeamMatchStat,
  };

  let clock = MATCH_SECONDS;
  let poss: Side = rng() < 0.5 ? "home" : "away";
  let half1Events = 0;
  let half2Events = 0;
  let stoppageApplied = false;
  let stoppageBudget = 0;
  const bumpEvent = () => {
    if (clock > HALF_SECONDS) half1Events++;
    else half2Events++;
  };

  for (;;) {
    const dt = MIN_DT + rng() * (MAX_DT - MIN_DT);
    clock -= dt;

    if (!stoppageApplied && clock <= 0) {
      stoppageBudget = computeStoppageSeconds(half1Events) + computeStoppageSeconds(half2Events);
      stoppageApplied = true;
    }
    if (stoppageApplied && clock <= -stoppageBudget) break;

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
      if (!manDown[defSide] && rng() < RED_GIVEN_FOUL_SIMPLE) {
        manDown[defSide] = true;
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
        // Penalty: unopposed shot, no block stage. A miss is either saved (on
        // target) or off target, so SoT isn't unconditionally inflated.
        bumpEvent();
        stat[poss].shots++;
        const goalP = clamp(
          PENALTY_CONVERSION *
            (1 + 0.15 * (teams[poss].finishing - 0.5) - 0.15 * (teams[defSide].keeping - 0.5)),
          0.55,
          0.9,
        );
        if (rng() < goalP) {
          stat[poss].sot++;
          stat[poss].goals++;
          poss = defSide;
        } else if (rng() < PENALTY_MISS_SAVED_PROB) {
          stat[poss].sot++;
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
        const { outcome } = resolveShot(rng, teams[poss], teams[defSide]);
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
    const { outcome } = resolveShot(rng, off, def);

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
      const { outcome: cornerOutcome } = resolveShot(rng, off, def);
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
  };
}

export interface DetailedMatchResult extends MatchResult {
  boxScore: BoxScore;
}

export interface SimMatchOptions {
  /**
   * Per-side hooks to re-roll normalized composites from the current on-pitch
   * group (spec §4: "before each match, and after subs/red cards"). Without a
   * hook, personnel changes fall back to the fixed man-down delta alone and
   * substitutions affect only stat attribution and energy.
   */
  recompute?: Partial<Record<Side, (onPitch: MatchPlayer[]) => Composites>>;
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
  opts: SimMatchOptions = {},
): DetailedMatchResult {
  const homeEff: Composites = {
    ...home,
    attack: clamp(home.attack + HOME_ATTACK_BONUS),
  };
  const teams: Record<Side, Composites> = { home: homeEff, away };
  const manDown = { home: false, away: false };
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

  // Clock value (counts down from MATCH_SECONDS) at which each player entered
  // and left the match, for minutes-played math. Starters enter at kickoff;
  // a player with no exit entry was still on the pitch at the final whistle.
  const enterClock = new Map<number, number>();
  const exitClock = new Map<number, number>();
  for (const p of [...homePlayers, ...awayPlayers]) enterClock.set(p.pid, MATCH_SECONDS);

  const other = (side: Side): Side => (side === "home" ? "away" : "home");

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

  let half1Events = 0;
  let half2Events = 0;
  let stoppageApplied = false;
  let stoppageBudget = 0;
  const bumpEvent = () => {
    if (clock > HALF_SECONDS) half1Events++;
    else half2Events++;
  };

  /**
   * Re-roll a side's composites from its current on-pitch group after any
   * personnel change (sub, red card, unreplaced injury), per spec §4. The
   * man-down delta and home attack bonus are re-applied on top. No-op when the
   * caller supplied no recompute hook (composites then only change via the
   * fixed man-down delta, applied at the call sites).
   */
  function rebuildTeam(side: Side): void {
    const rc = opts.recompute?.[side];
    if (!rc) return;
    let c = rc(onPitch[side]);
    if (side === "home") c = { ...c, attack: clamp(c.attack + HOME_ATTACK_BONUS) };
    teams[side] = manDown[side] ? applyManDown(c) : c;
  }

  const avgEnergy = (side: Side): number => {
    const xi = onPitch[side];
    if (xi.length === 0) return ENERGY_START;
    let sum = 0;
    for (const p of xi) sum += energy.get(p.pid)!;
    return sum / xi.length;
  };

  /** Pick a bench replacement for a departing player, never fielding a GK out of goal (or vice versa). */
  function pickReplacement(side: Side, offPos: MatchPlayer["pos"]): MatchPlayer | undefined {
    const samePos = bench[side].find((p) => p.pos === offPos);
    if (samePos) return samePos;
    const pool = offPos === "GK" ? bench[side] : bench[side].filter((p) => p.pos !== "GK");
    return pool[0];
  }

  function attemptSub(side: Side, checkpoint: number): void {
    if (subsUsed[side] >= MAX_SUBS || bench[side].length === 0) return;
    const outfield = onPitch[side].filter((p) => p.pos !== "GK");
    if (outfield.length === 0) return;

    const lowestEnergy = (candidates: MatchPlayer[]): MatchPlayer =>
      candidates.reduce((worst, p) => (energy.get(p.pid)! < energy.get(worst.pid)! ? p : worst));

    const trailing = stat[side].goals < stat[other(side)].goals;
    let off: MatchPlayer;
    let on: MatchPlayer | undefined;
    if (checkpoint === SUB_CHECKPOINTS_ELAPSED[SUB_CHECKPOINTS_ELAPSED.length - 1] && trailing) {
      // Attacking sub: bring on the bench's best (outfield) finisher for a defensive-minded player.
      const defensive = outfield.filter((p) => p.pos === "CB" || p.pos === "FB" || p.pos === "DM");
      off = lowestEnergy(defensive.length > 0 ? defensive : outfield);
      const outfieldBench = bench[side].filter((p) => p.pos !== "GK");
      on = outfieldBench.length > 0
        ? outfieldBench.reduce((best, p) => (p.shooting > best.shooting ? p : best))
        : undefined;
    } else {
      off = lowestEnergy(outfield);
      on = pickReplacement(side, off.pos);
    }
    if (!on) return; // no valid (non-GK) bench replacement available

    onPitch[side] = onPitch[side].filter((p) => p.pid !== off.pid).concat(on);
    bench[side] = bench[side].filter((p) => p.pid !== on!.pid);
    subsUsed[side]++;
    appeared[side].add(on.pid);
    energy.set(on.pid, ENERGY_START);
    exitClock.set(off.pid, clock);
    enterClock.set(on.pid, clock);
    rebuildTeam(side);
    bumpEvent();
    events.push({ clock, type: "substitution", side, pids: [off.pid, on.pid] });
  }

  /** An injured player must come off immediately, regardless of energy — unlike attemptSub, the outgoing player is fixed. */
  function forceInjurySub(side: Side, offPid: number): void {
    const off = onPitch[side].find((p) => p.pid === offPid);
    if (!off) return;
    onPitch[side] = onPitch[side].filter((p) => p.pid !== offPid);
    exitClock.set(off.pid, clock);

    const on = subsUsed[side] < MAX_SUBS ? pickReplacement(side, off.pos) : undefined;
    if (on) {
      onPitch[side] = onPitch[side].concat(on);
      bench[side] = bench[side].filter((p) => p.pid !== on.pid);
      subsUsed[side]++;
      appeared[side].add(on.pid);
      energy.set(on.pid, ENERGY_START);
      enterClock.set(on.pid, clock);
      bumpEvent();
      events.push({ clock, type: "substitution", side, pids: [off.pid, on.pid] });
    } else if (!manDown[side]) {
      // No valid sub available: play the rest of the match a man down.
      // Applied once per side, matching the red-card semantics.
      manDown[side] = true;
      teams[side] = applyManDown(teams[side]);
    }
    rebuildTeam(side);
  }

  for (;;) {
    const dt = MIN_DT + rng() * (MAX_DT - MIN_DT);
    clock -= dt;
    const elapsed = MATCH_SECONDS - clock;

    if (!stoppageApplied && clock <= 0) {
      stoppageBudget = computeStoppageSeconds(half1Events) + computeStoppageSeconds(half2Events);
      stoppageApplied = true;
    }
    if (stoppageApplied && clock <= -stoppageBudget) break;

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
    let def = applyFatigue(teams[defSide], avgEnergy(defSide));
    stat[poss].ticks++;

    const turnoverP = clamp(
      TURNOVER_BASE * (1 + 0.6 * (def.defense - off.control)),
      0.02,
      0.5,
    );
    if (rng() < turnoverP) {
      const creditRoll = rng();
      let tacklerPid: number | null = null;
      if (creditRoll < TACKLE_CREDIT_PROB) {
        const tackler = pickTackler(rng, onPitch[defSide]);
        lines.get(tackler.pid)!.tackles++;
        tacklerPid = tackler.pid;
      } else if (creditRoll < TACKLE_CREDIT_PROB + INTERCEPTION_CREDIT_PROB) {
        const tackler = pickInterceptor(rng, onPitch[defSide]);
        lines.get(tackler.pid)!.interceptions++;
        tacklerPid = tackler.pid;
      }
      // No-credit turnovers skip player selection entirely — BoxScore.tsx
      // filters all "turnover" events out of the displayed play-by-play, so
      // there's no consumer of a pid here to justify the weighted-pick cost.
      events.push({ clock, type: "turnover", side: defSide, pids: tacklerPid !== null ? [tacklerPid] : [] });

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
        exitClock.set(fouler.pid, clock);
        if (!manDown[defSide]) {
          manDown[defSide] = true;
          teams[defSide] = applyManDown(teams[defSide]);
        }
        rebuildTeam(defSide);
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
          exitClock.set(fouler.pid, clock);
          if (!manDown[defSide]) {
            manDown[defSide] = true;
            teams[defSide] = applyManDown(teams[defSide]);
          }
          rebuildTeam(defSide);
          bumpEvent();
          events.push({ clock, type: "red_card", side: defSide, pids: [fouler.pid] });
        }
      }

      // A red card just issued this tick may have mutated teams[defSide] above —
      // re-derive the fatigue-adjusted defensive composite so the free-kick/penalty
      // odds for this same foul reflect the man-down side, not the stale pre-card one.
      def = applyFatigue(teams[defSide], avgEnergy(defSide));

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

        bumpEvent();
        events.push({ clock, type: "penalty", side: poss, pids: [shooter.pid] });

        // Conversion hinges on the actual taker vs. the actual keeper (both
        // 0..100 ratings), not the fatigue-adjusted team composites — the
        // taker picked by pickShooter is the one who shoots.
        const gk = onPitch[defSide].find((p) => p.pos === "GK");
        const gkKeeping = gk ? gk.keeping : 50;
        const goalP = clamp(
          PENALTY_CONVERSION *
            (1 + 0.15 * (shooter.shooting / 100 - 0.5) - 0.15 * (gkKeeping / 100 - 0.5)),
          0.55,
          0.9,
        );
        // xG excludes the taker's own shooting rating, same reasoning as
        // resolveShot's xgOnTargetP/xgSaveP: an ace penalty-taker's spot
        // kicks shouldn't score higher xG just because he's an ace, or he'd
        // never show up as beating expectation. goalP (with his rating)
        // still drives the actual roll below.
        const xgP = clamp(PENALTY_CONVERSION * (1 - 0.15 * (gkKeeping / 100 - 0.5)), 0.55, 0.9);
        shooterLine.xg += xgP;
        if (rng() < goalP) {
          stat[poss].sot++;
          shooterLine.shotsOnTarget++;
          stat[poss].goals++;
          shooterLine.goals++;
          events.push({ clock, type: "goal", side: poss, pids: [shooter.pid] });
          poss = defSide;
        } else if (rng() < PENALTY_MISS_SAVED_PROB) {
          stat[poss].sot++;
          shooterLine.shotsOnTarget++;
          if (gk) lines.get(gk.pid)!.saves++;
          events.push({ clock, type: "shot_saved", side: poss, pids: [shooter.pid] });
        } else {
          events.push({ clock, type: "shot_off_target", side: poss, pids: [shooter.pid] });
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

        const { outcome, xg } = resolveShot(rng, off, def);
        shooterLine.xg += xg;
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

    const { outcome, xg } = resolveShot(rng, off, def);
    shooterLine.xg += xg;

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

      const { outcome: cornerOutcome, xg: cornerXg } = resolveShot(rng, off, def);
      headerLine.xg += cornerXg;
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

  const finalClock = clock;
  const minutesFor = (pid: number): number => {
    const enter = enterClock.get(pid) ?? MATCH_SECONDS;
    const exit = exitClock.get(pid) ?? finalClock;
    return Math.max(0, Math.round((enter - exit) / 60));
  };

  const finishLines = (
    roster: MatchPlayer[],
    appearedSet: Set<number>,
    teamGoalsAgainst: number,
  ): PlayerMatchLine[] =>
    roster
      .filter((p) => appearedSet.has(p.pid))
      .map((p) => {
        const line = lines.get(p.pid)!;
        line.minutesPlayed = minutesFor(p.pid);
        line.rating = computeMatchRating(line, p.pos, line.minutesPlayed, teamGoalsAgainst);
        return line;
      });

  const homeLines = finishLines([...homePlayers, ...homeBench], appeared.home, stat.away.goals);
  const awayLines = finishLines([...awayPlayers, ...awayBench], appeared.away, stat.home.goals);

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
