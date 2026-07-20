import type { Composites } from "../../engine/composites.js";
import type { MatchPlayer, PlayerMatchLine, BoxScore } from "../../engine/attribution.js";
import type { TeamMatchData } from "../league/composites.js";
import type { CupState, CupTie } from "./types.js";
import { simMatchDetailed, resolveShot } from "../../engine/matchSim.js";
import { pickShooter, pickAssister, emptyLine } from "../../engine/attribution.js";
import { mulberry32, hashInts } from "../../engine/rng.js";
import { completedRounds, matchupsForRound, applyPlayIn } from "./cup.js";
import {
  CUP_ET_CHANCES_PER_SIDE, CUP_PEN_BEST_OF, CUP_PEN_BASE_CONVERSION,
  CUP_FINAL_ROUND, CUP_ROUND_MATCHDAYS, CUP_PRIZE_WIN_BY_ROUND,
  CUP_PRIZE_PARTICIPATION, CUP_PRIZE_RUNNER_UP, CUP_PRIZE_WIN_PLAYIN,
} from "../constants.js";

/** Play-in ties are tagged with this round index (they live in cup.playIn.ties, not cup.ties). */
const PLAYIN_ROUND = -1;

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/** Find a side's box-score line by pid, creating a fresh one if the player has none yet. */
function lineFor(lines: PlayerMatchLine[], pid: number): PlayerMatchLine {
  let line = lines.find((l) => l.pid === pid);
  if (!line) {
    line = emptyLine(pid);
    lines.push(line);
  }
  return line;
}

/**
 * Extra time: each side takes CUP_ET_CHANCES_PER_SIDE shots resolved with the
 * same block→off-target→save→goal cascade as regulation, attributed to a
 * picked shooter/assister and (for goals/xGA) the defending keeper, mutating
 * the existing box score in place. Returns the extra-time goals added per side.
 */
function playExtraTime(
  rng: () => number,
  homeComp: Composites,
  awayComp: Composites,
  homeXI: MatchPlayer[],
  awayXI: MatchPlayer[],
  box: BoxScore,
): { homeGoals: number; awayGoals: number } {
  const sideGoals = (
    offComp: Composites,
    defComp: Composites,
    attackers: MatchPlayer[],
    offLines: PlayerMatchLine[],
    defXI: MatchPlayer[],
    defLines: PlayerMatchLine[],
  ): number => {
    let goals = 0;
    const gk = defXI.find((p) => p.pos === "GK");
    for (let i = 0; i < CUP_ET_CHANCES_PER_SIDE; i++) {
      const shot = resolveShot(rng, offComp, defComp);
      const shooter = pickShooter(rng, attackers);
      const line = lineFor(offLines, shooter.pid);
      line.shots++;
      line.xg += shot.xg;
      if (gk) lineFor(defLines, gk.pid).xga += shot.xg;
      if (shot.outcome === "saved") {
        line.shotsOnTarget++;
        if (gk) lineFor(defLines, gk.pid).saves++;
      } else if (shot.outcome === "goal") {
        line.shotsOnTarget++;
        line.goals++;
        goals++;
        if (gk) lineFor(defLines, gk.pid).goalsAgainst++;
        const assister = pickAssister(rng, attackers, shooter.pid);
        if (assister) lineFor(offLines, assister.pid).assists++;
      }
    }
    return goals;
  };

  const homeGoals = sideGoals(homeComp, awayComp, homeXI, box.home, awayXI, box.away);
  const awayGoals = sideGoals(awayComp, homeComp, awayXI, box.away, homeXI, box.home);
  return { homeGoals, awayGoals };
}

/** Penalty shootout (best-of-CUP_PEN_BEST_OF, then sudden death). Shootout kicks are NOT counted as goals. */
function playShootout(
  rng: () => number,
  homeComp: Composites,
  awayComp: Composites,
): { homePens: number; awayPens: number } {
  const convProb = (off: Composites, def: Composites): number =>
    clamp(
      CUP_PEN_BASE_CONVERSION + 0.1 * (off.finishing - 0.5) - 0.15 * (def.keeping - 0.5),
      0.5,
      0.95,
    );
  const pHome = convProb(homeComp, awayComp);
  const pAway = convProb(awayComp, homeComp);
  let home = 0;
  let away = 0;
  for (let i = 0; i < CUP_PEN_BEST_OF; i++) {
    if (rng() < pHome) home++;
    if (rng() < pAway) away++;
  }
  while (home === away) {
    if (rng() < pHome) home++;
    if (rng() < pAway) away++;
  }
  return { homePens: home, awayPens: away };
}

/**
 * Play one knockout tie: 90' via simMatchDetailed, then extra time if level,
 * then a penalty shootout if still level. The box score carries regulation +
 * extra-time attribution; shootout kicks decide the winner only.
 */
export function resolveCupTie(
  rng: () => number,
  home: number,
  away: number,
  hd: TeamMatchData,
  ad: TeamMatchData,
  round: number,
  matchday: number,
): CupTie {
  const result = simMatchDetailed(rng, hd.composites, ad.composites, hd.xi, ad.xi, hd.bench, ad.bench, {
    recompute: { home: hd.recompute, away: ad.recompute },
  });
  const box = result.boxScore;
  let homeGoals = result.home;
  let awayGoals = result.away;
  let wentToExtraTime = false;
  let wentToPens = false;
  let homePens = 0;
  let awayPens = 0;

  if (homeGoals === awayGoals) {
    wentToExtraTime = true;
    const et = playExtraTime(rng, hd.composites, ad.composites, hd.xi, ad.xi, box);
    homeGoals += et.homeGoals;
    awayGoals += et.awayGoals;
    if (homeGoals === awayGoals) {
      wentToPens = true;
      ({ homePens, awayPens } = playShootout(rng, hd.composites, ad.composites));
    }
  }

  const winner =
    homeGoals > awayGoals ? home
      : awayGoals > homeGoals ? away
        : homePens > awayPens ? home
          : away;

  return { round, matchday, home, away, homeGoals, awayGoals, wentToExtraTime, wentToPens, homePens, awayPens, winner, boxScore: box };
}

/**
 * Play the next due knockout round in full (all its ties), advancing the
 * bracket and returning the prize money each club earned this round (keyed by
 * tid; the caller credits budgets). Each round uses its own seeded rng
 * (derived from lid/season/round) so cup results are deterministic and
 * independent of the league's own match stream.
 */
export function playCupRound(
  cup: CupState,
  matchData: Map<number, TeamMatchData>,
  lid: number,
): { cup: CupState; prizes: Map<number, number> } {
  const round = completedRounds(cup);
  const rng = mulberry32(hashInts(lid, cup.season, round, 30));
  const matchups = matchupsForRound(cup, round);
  const matchday = CUP_ROUND_MATCHDAYS[round];

  const prizes = new Map<number, number>();
  const addPrize = (tid: number, amount: number): void => {
    prizes.set(tid, (prizes.get(tid) ?? 0) + amount);
  };

  // Everyone in the bracket earns the participation fee, credited once as the
  // first round is played — but the two play-in winners already collected it in
  // the play-in, so credit only the byes here (all 16 when there's no play-in).
  if (round === 0) {
    const playInTeams = new Set(cup.playIn?.teams ?? []);
    for (const tid of cup.teams) if (!playInTeams.has(tid)) addPrize(tid, CUP_PRIZE_PARTICIPATION);
  }

  const newTies: CupTie[] = [];
  let championTid = cup.championTid;
  for (const [home, away] of matchups) {
    const hd = matchData.get(home);
    const ad = matchData.get(away);
    if (!hd || !ad) continue; // defensive: a qualifier should always be in matchData
    const tie = resolveCupTie(rng, home, away, hd, ad, round, matchday);
    newTies.push(tie);
    addPrize(tie.winner, CUP_PRIZE_WIN_BY_ROUND[round]);
    if (round === CUP_FINAL_ROUND) {
      championTid = tie.winner;
      const runnerUp = tie.winner === home ? away : home;
      addPrize(runnerUp, CUP_PRIZE_RUNNER_UP);
    }
  }

  return { cup: { ...cup, ties: [...cup.ties, ...newTies], championTid }, prizes };
}

/**
 * Play the preliminary play-in round in full: each tie (a weakest big-four
 * qualifier vs a weak-league champion) is resolved, its winner written into the
 * bracket's pending slot. Every play-in club earns the participation fee here
 * (so the byes get it at R16 instead — see playCupRound), and each winner earns
 * a play-in win bonus. Uses its own seeded rng, like every other cup round.
 */
export function playPlayIn(
  cup: CupState,
  matchData: Map<number, TeamMatchData>,
  lid: number,
): { cup: CupState; prizes: Map<number, number> } {
  const pi = cup.playIn;
  if (!pi) return { cup, prizes: new Map() };
  const rng = mulberry32(hashInts(lid, cup.season, PLAYIN_ROUND, 30));
  const prizes = new Map<number, number>();
  const addPrize = (tid: number, amount: number): void => {
    prizes.set(tid, (prizes.get(tid) ?? 0) + amount);
  };
  for (const tid of pi.teams) addPrize(tid, CUP_PRIZE_PARTICIPATION);

  const ties: CupTie[] = [];
  for (let i = 0; i + 1 < pi.teams.length; i += 2) {
    const home = pi.teams[i];
    const away = pi.teams[i + 1];
    const hd = matchData.get(home);
    const ad = matchData.get(away);
    if (!hd || !ad) continue; // defensive: a qualifier should always be in matchData
    const tie = resolveCupTie(rng, home, away, hd, ad, PLAYIN_ROUND, pi.matchday);
    ties.push(tie);
    addPrize(tie.winner, CUP_PRIZE_WIN_PLAYIN);
  }
  return { cup: applyPlayIn(cup, ties), prizes };
}
