import { describe, it, expect } from "vitest";
import { computeWorldAwards, type WorldAwardContext } from "../../src/core/worldAwards.js";
import { emptySeasonStats, type Player, type Position } from "../../src/core/players/types.js";
import type { CupState, CupTie } from "../../src/core/cup/types.js";
import type { BoxScore, PlayerMatchLine } from "../../src/engine/attribution.js";
import { FORMATIONS } from "../../src/core/lineup/formations.js";
import { BALLON_DOR_SHORTLIST, AWARD_MIN_APPEARANCES } from "../../src/core/constants.js";

const SEASON = 5;

/**
 * Two competitions of deliberately different quality: comp 0 is the strong
 * league (its players are generated at high ovr below), comp 1 the weak one.
 * Every club id below is its own club; compsByTid maps each into a league.
 */
function ctx(overrides: Partial<WorldAwardContext> = {}): WorldAwardContext {
  return {
    compsByTid: { 1: 0, 2: 0, 11: 1, 12: 1 },
    competitions: [
      { id: 0, country: "England", tier: 1, name: "Strong League" },
      { id: 1, country: "France", tier: 1, name: "Weak League" },
    ],
    championTidByCompId: {},
    cup: null,
    worldCupChampion: null,
    ...overrides,
  };
}

interface PlayerSpec {
  pid: number;
  tid: number;
  ovr: number;
  pos?: Position;
  goals?: number;
  assists?: number;
  avgRating?: number;
  appearances?: number;
  nationality?: string;
  intl?: Player["intl"];
}

function player(spec: PlayerSpec): Player {
  const appearances = spec.appearances ?? 30;
  const stats = {
    ...emptySeasonStats(SEASON, spec.tid),
    appearances,
    goals: spec.goals ?? 0,
    assists: spec.assists ?? 0,
    avgRating: spec.avgRating ?? 6.5,
    minutesPlayed: appearances * 90,
  };
  return {
    pid: spec.pid,
    name: `Player ${spec.pid}`,
    nationality: spec.nationality ?? "England",
    born: SEASON - 26,
    pos: spec.pos ?? "ST",
    ovr: spec.ovr,
    stats: [stats],
    // ovrDuringSeason reads the hist entry tagged `season - 1`.
    hist: [{ season: SEASON - 1, ovr: spec.ovr, potential: spec.ovr, academy: false, ratings: {} }],
    intl: spec.intl,
  } as unknown as Player;
}

/** A squad of filler players so every Team-of-the-Year slot has candidates. */
function squad(startPid: number, tid: number, ovr: number): Player[] {
  return FORMATIONS["4-3-3"].map((pos, i) =>
    player({ pid: startPid + i, tid, ovr, pos, avgRating: 6.4 }),
  );
}

function matchLine(pid: number, over: Partial<PlayerMatchLine> = {}): PlayerMatchLine {
  return {
    pid, goals: 0, assists: 0, shots: 0, shotsOnTarget: 0, xg: 0, goalsAgainst: 0, xga: 0,
    saves: 0, tackles: 0, interceptions: 0, passes: 0, passesCompleted: 0, crosses: 0,
    foulsCommitted: 0, yellowCards: 0, redCards: 0, minutesPlayed: 90, rating: 7,
    ...over,
  } as PlayerMatchLine;
}

function box(home: PlayerMatchLine[], away: PlayerMatchLine[]): BoxScore {
  return { home, away, events: [] } as unknown as BoxScore;
}

/**
 * A minimal Swiss-shaped cup: `winnerTid` beats `loserTid` in the final, both
 * having played `lpGames` league-phase matches. Only the fields the award pass
 * reads are filled.
 */
function cup(
  winnerTid: number,
  loserTid: number,
  lines: { tid: number; pid: number; goals?: number; rating?: number }[],
  lpGames = 6,
): CupState {
  const linesFor = (tid: number) =>
    lines.filter((l) => l.tid === tid).map((l) => matchLine(l.pid, { goals: l.goals ?? 0, rating: l.rating ?? 7 }));
  const finalTie: CupTie = {
    round: 2, matchday: 37, home: winnerTid, away: loserTid,
    homeGoals: 1, awayGoals: 0, wentToExtraTime: false, wentToPens: false,
    homePens: 0, awayPens: 0, winner: winnerTid,
    boxScore: box(linesFor(winnerTid), linesFor(loserTid)),
  };
  return {
    season: SEASON,
    name: "Continental Cup",
    teams: [winnerTid, loserTid],
    seeds: {},
    leaguePhase: {
      teams: [winnerTid, loserTid],
      matches: Array.from({ length: lpGames }, (_, round) => ({
        round, matchday: 3 + round * 4, home: winnerTid, away: loserTid,
        played: true, homeGoals: 1, awayGoals: 0,
        boxScore: box(linesFor(winnerTid), linesFor(loserTid)),
      })),
    },
    playoff: null,
    playIn: null,
    ties: [finalTie],
    championTid: winnerTid,
    twoLegged: false,
    koLegs: null,
  };
}

describe("computeWorldAwards — league strength correction", () => {
  it("ranks the strong league's player above an identical season in a weak league", () => {
    // Same stat line, same ovr, different leagues. The weak league's supporting
    // cast is 10 ovr worse, so its ratings are inflated by z-normalization —
    // which is exactly what the correction has to undo.
    const players = [
      player({ pid: 1, tid: 1, ovr: 80, goals: 25, avgRating: 7.5 }),
      player({ pid: 2, tid: 11, ovr: 80, goals: 25, avgRating: 7.5 }),
      ...squad(100, 2, 70),
      ...squad(200, 12, 60),
    ];
    const { ballonDOr } = computeWorldAwards(players, SEASON, ctx());
    expect(ballonDOr[0].pid).toBe(1);
    expect(ballonDOr[0].league).toBeGreaterThan(ballonDOr.find((e) => e.pid === 2)!.league);
  });

  it("does not let the correction outweigh a genuinely better player", () => {
    // A weak-league star who is 12 ovr better and scored far more still wins:
    // the correction is a unit conversion, not a blanket penalty on his league.
    const players = [
      player({ pid: 1, tid: 1, ovr: 72, goals: 12, avgRating: 6.9 }),
      player({ pid: 2, tid: 11, ovr: 84, goals: 30, avgRating: 7.8 }),
      ...squad(100, 2, 74),
      ...squad(200, 12, 62),
    ];
    expect(computeWorldAwards(players, SEASON, ctx()).ballonDOr[0].pid).toBe(2);
  });
});

describe("computeWorldAwards — cross-league competitions", () => {
  it("a winning cup run breaks a tie between two identical league seasons", () => {
    const base = [
      player({ pid: 1, tid: 1, ovr: 80, goals: 20, avgRating: 7.4 }),
      player({ pid: 2, tid: 2, ovr: 80, goals: 20, avgRating: 7.4 }),
      ...squad(100, 1, 74),
      ...squad(200, 2, 74),
    ];
    const noCup = computeWorldAwards(base, SEASON, ctx());
    // Without a cup they're separated only by the pid tiebreak.
    expect(noCup.ballonDOr[0].pid).toBe(1);
    expect(noCup.ballonDOr[0].cup).toBe(0);

    // Give #2's club the trophy and him the goals in it.
    const withCup = computeWorldAwards(
      base,
      SEASON,
      ctx({ cup: cup(2, 1, [{ tid: 2, pid: 2, goals: 2, rating: 8 }, { tid: 1, pid: 1, rating: 6 }]) }),
    );
    expect(withCup.ballonDOr[0].pid).toBe(2);
    expect(withCup.ballonDOr[0].cup).toBeGreaterThan(0);
  });

  it("counts the Swiss league phase, not just the knockout ties", () => {
    const players = [player({ pid: 1, tid: 1, ovr: 80, goals: 20 }), ...squad(100, 2, 74)];
    // Identical cups except for how many league-phase games were played.
    const short = computeWorldAwards(players, SEASON, ctx({ cup: cup(1, 2, [{ tid: 1, pid: 1, goals: 1 }], 0) }));
    const long = computeWorldAwards(players, SEASON, ctx({ cup: cup(1, 2, [{ tid: 1, pid: 1, goals: 1 }], 6) }));
    expect(long.ballonDOr[0].cup).toBeGreaterThan(short.ballonDOr[0].cup);
  });

  it("credits a World Cup campaign, and the winner's bonus only to the winning nation", () => {
    const line = { season: SEASON, kind: "tournament" as const, caps: 7, goals: 5, assists: 2 };
    const career = { caps: 7, goals: 5, assists: 2, tournaments: 1, titles: 1, seasons: [line] };
    const players = [
      player({ pid: 1, tid: 1, ovr: 80, goals: 20, nationality: "Brazil", intl: career }),
      player({ pid: 2, tid: 2, ovr: 80, goals: 20, nationality: "Wales", intl: career }),
      ...squad(100, 1, 74),
    ];
    const { ballonDOr } = computeWorldAwards(players, SEASON, ctx({ worldCupChampion: "Brazil" }));
    const brazil = ballonDOr.find((e) => e.pid === 1)!;
    const wales = ballonDOr.find((e) => e.pid === 2)!;
    expect(brazil.intl).toBeGreaterThan(wales.intl);
    expect(wales.intl).toBeGreaterThan(0); // still credited for playing the tournament
    expect(ballonDOr[0].pid).toBe(1);
  });

  it("weights a tournament campaign above an identical qualifying one", () => {
    const stats = { caps: 6, goals: 4, assists: 1 };
    const players = [
      player({ pid: 1, tid: 1, ovr: 80, goals: 20, intl: { caps: 6, goals: 4, assists: 1, tournaments: 1, titles: 0, seasons: [{ season: SEASON, kind: "tournament", ...stats }] } }),
      player({ pid: 2, tid: 2, ovr: 80, goals: 20, intl: { caps: 6, goals: 4, assists: 1, tournaments: 0, titles: 0, seasons: [{ season: SEASON, kind: "qualifying", ...stats }] } }),
      ...squad(100, 1, 74),
    ];
    const { ballonDOr } = computeWorldAwards(players, SEASON, ctx());
    expect(ballonDOr.find((e) => e.pid === 1)!.intl)
      .toBeGreaterThan(ballonDOr.find((e) => e.pid === 2)!.intl);
  });

  it("credits winning your own league, pro-rated by appearances", () => {
    const players = [
      player({ pid: 1, tid: 1, ovr: 80, goals: 20 }),
      player({ pid: 2, tid: 2, ovr: 80, goals: 20 }),
      // Same champion club, but he only played a handful of games.
      player({ pid: 3, tid: 1, ovr: 80, goals: 20, appearances: AWARD_MIN_APPEARANCES }),
      ...squad(100, 2, 74),
    ];
    const { ballonDOr } = computeWorldAwards(players, SEASON, ctx({ championTidByCompId: { 0: 1 } }));
    const champion = ballonDOr.find((e) => e.pid === 1)!;
    const runnerUp = ballonDOr.find((e) => e.pid === 2)!;
    const squadPlayer = ballonDOr.find((e) => e.pid === 3)!;
    expect(champion.title).toBeGreaterThan(0);
    expect(runnerUp.title).toBe(0);
    expect(squadPlayer.title).toBeGreaterThan(0);
    expect(squadPlayer.title).toBeLessThan(champion.title);
  });
});

describe("computeWorldAwards — shape and determinism", () => {
  it("fills every World Team of the Year slot with the right position and no repeats", () => {
    const players = [...squad(100, 1, 78), ...squad(200, 2, 74), ...squad(300, 11, 66)];
    const { worldTeamOfYear } = computeWorldAwards(players, SEASON, ctx());
    const byPid = new Map(players.map((p) => [p.pid, p]));
    expect(worldTeamOfYear).toHaveLength(11);
    worldTeamOfYear.forEach((pid, i) => {
      expect(pid).not.toBeNull();
      expect(byPid.get(pid!)!.pos).toBe(FORMATIONS["4-3-3"][i]);
    });
    expect(new Set(worldTeamOfYear).size).toBe(11);
  });

  it("picks the World XI from the strong league when the leagues are otherwise alike", () => {
    // Same ratings everywhere; only squad quality (and so league strength) differs.
    const players = [...squad(100, 1, 78), ...squad(300, 11, 62)];
    const { worldTeamOfYear } = computeWorldAwards(players, SEASON, ctx());
    expect(worldTeamOfYear.every((pid) => pid !== null && pid < 200)).toBe(true);
  });

  it("caps the shortlist and is stable across repeated runs", () => {
    const players = Array.from({ length: 40 }, (_, i) =>
      player({ pid: i + 1, tid: i % 2 === 0 ? 1 : 2, ovr: 60 + (i % 20), goals: i % 15 }),
    );
    const first = computeWorldAwards(players, SEASON, ctx());
    const second = computeWorldAwards(players, SEASON, ctx());
    expect(first.ballonDOr).toHaveLength(BALLON_DOR_SHORTLIST);
    expect(first).toEqual(second);
  });

  it("returns empty honors when nobody played that season", () => {
    const { ballonDOr, worldTeamOfYear } = computeWorldAwards([], SEASON, ctx());
    expect(ballonDOr).toEqual([]);
    expect(worldTeamOfYear).toHaveLength(11);
    expect(worldTeamOfYear.every((p) => p === null)).toBe(true);
  });

  it("skips players whose club has no competition recorded for that season", () => {
    const players = [player({ pid: 1, tid: 99, ovr: 90, goals: 40 }), ...squad(100, 1, 70)];
    const { ballonDOr } = computeWorldAwards(players, SEASON, ctx());
    expect(ballonDOr.some((e) => e.pid === 1)).toBe(false);
  });
});
