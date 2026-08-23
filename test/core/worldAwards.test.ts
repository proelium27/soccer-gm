import { describe, it, expect } from "vitest";
import { computeWorldAwards, type WorldAwardContext } from "../../src/core/worldAwards.js";
import { emptySeasonStats, type Player, type Position } from "../../src/core/players/types.js";
import type { CupState, CupTie } from "../../src/core/cup/types.js";
import { archiveCup } from "../../src/core/cup/archive.js";
import type { BoxScore, PlayerMatchLine } from "../../src/engine/attribution.js";
import { TOTS_SLOTS } from "../../src/core/awards.js";
import {
  BALLON_DOR_SHORTLIST, AWARD_MIN_APPEARANCES,
  WORLD_AWARD_DOMESTIC_CUP_BONUS, WORLD_AWARD_DOMESTIC_CUP_FULL_INVOLVEMENT,
} from "../../src/core/constants.js";
import type { DomesticCupState } from "../../src/core/domesticCup/types.js";

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
  return TOTS_SLOTS.map((pos, i) =>
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
    competition: "continental",
    season: SEASON,
    name: "Continental Cup",
    teams: [winnerTid, loserTid],
    seeds: {},
    statLines: null,
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

  it("lets a clearly better player beat a bigger statline in the same league", () => {
    // WORLD_AWARD_OVR_WEIGHT exists so the world award leans harder on raw
    // quality than the per-league POTY does. Same league, same supporting cast:
    // the 86-ovr player scored 8 fewer goals and still wins, which under the
    // per-league formula alone (AWARD_OVR_WEIGHT 0.06) he would not.
    const players = [
      player({ pid: 1, tid: 1, ovr: 72, goals: 28, avgRating: 7.1 }),
      player({ pid: 2, tid: 2, ovr: 86, goals: 20, avgRating: 7.1 }),
      ...squad(100, 1, 70),
      ...squad(200, 2, 70),
    ];
    expect(computeWorldAwards(players, SEASON, ctx()).ballonDOr[0].pid).toBe(2);
  });

  it("still lets a big enough statline beat a slightly better player", () => {
    // The counterweight must not become an ovr ranking: 3 ovr of quality does
    // not survive a 22-goal gap. If this flips, WORLD_AWARD_OVR_WEIGHT is too high.
    const players = [
      player({ pid: 1, tid: 1, ovr: 75, goals: 34, avgRating: 7.6 }),
      player({ pid: 2, tid: 2, ovr: 78, goals: 12, avgRating: 6.9 }),
      ...squad(100, 1, 70),
      ...squad(200, 2, 70),
    ];
    expect(computeWorldAwards(players, SEASON, ctx()).ballonDOr[0].pid).toBe(1);
  });
});

describe("computeWorldAwards — cross-league competitions", () => {
  it("still credits the cup after the cup has been archived", () => {
    // archiveCup folds box scores into statLines and deletes them (save size).
    // computeWorldAwards must read the stored lines, or every past season's cup
    // silently scores zero — which is exactly what migrate.ts's backfill hits.
    const base = [
      player({ pid: 1, tid: 1, ovr: 80, goals: 20, avgRating: 7.4 }),
      player({ pid: 2, tid: 2, ovr: 80, goals: 20, avgRating: 7.4 }),
      ...squad(100, 1, 74),
      ...squad(200, 2, 74),
    ];
    const live = cup(2, 1, [{ tid: 2, pid: 2, goals: 4, rating: 8 }]);
    const archived = archiveCup(live);
    // Precondition: archiving really did drop the box scores it aggregated.
    expect(archived.statLines).not.toBeNull();
    expect(archived.ties.every((t) => t.boxScore === null)).toBe(true);

    const fromLive = computeWorldAwards(base, SEASON, ctx({ cup: live }));
    const fromArchive = computeWorldAwards(base, SEASON, ctx({ cup: archived }));
    const cupOf = (r: typeof fromLive, pid: number) => r.ballonDOr.find((e) => e.pid === pid)!.cup;
    expect(cupOf(fromArchive, 2)).toBeGreaterThan(0);
    expect(cupOf(fromArchive, 2)).toBeCloseTo(cupOf(fromLive, 2), 10);
    expect(fromArchive.ballonDOr[0].pid).toBe(fromLive.ballonDOr[0].pid);
  });

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

  it("weights a confederation cup between qualifying and a World Cup", () => {
    const stats = { caps: 6, goals: 4, assists: 1 };
    const career = (kind: "tournament" | "confederation" | "qualifying") =>
      ({ caps: 6, goals: 4, assists: 1, tournaments: 0, titles: 0, seasons: [{ season: SEASON, kind, ...stats }] });
    const players = [
      player({ pid: 1, tid: 1, ovr: 80, goals: 20, intl: career("tournament") }),
      player({ pid: 2, tid: 2, ovr: 80, goals: 20, intl: career("confederation") }),
      player({ pid: 3, tid: 2, ovr: 80, goals: 20, intl: career("qualifying") }),
      ...squad(100, 1, 74),
    ];
    const { ballonDOr } = computeWorldAwards(players, SEASON, ctx());
    const intlOf = (pid: number) => ballonDOr.find((e) => e.pid === pid)!.intl;
    expect(intlOf(1)).toBeGreaterThan(intlOf(2));
    expect(intlOf(2)).toBeGreaterThan(intlOf(3));
  });

  it("pays a confederation cup winner's medal, and only to a nation that won one", () => {
    const line = { season: SEASON, kind: "confederation" as const, caps: 5, goals: 3, assists: 1 };
    const career = { caps: 5, goals: 3, assists: 1, tournaments: 0, titles: 0, seasons: [line] };
    const players = [
      player({ pid: 1, tid: 1, ovr: 80, goals: 20, nationality: "Italy", intl: career }),
      player({ pid: 2, tid: 2, ovr: 80, goals: 20, nationality: "Wales", intl: career }),
      ...squad(100, 1, 74),
    ];
    const { ballonDOr } = computeWorldAwards(
      players, SEASON, ctx({ confederationCupChampions: new Set(["Italy"]) }),
    );
    expect(ballonDOr.find((e) => e.pid === 1)!.intl)
      .toBeGreaterThan(ballonDOr.find((e) => e.pid === 2)!.intl);
    expect(ballonDOr.find((e) => e.pid === 2)!.intl).toBeGreaterThan(0);
  });

  it("sums every campaign a player played that offseason, not just the first", () => {
    // The offseason that stages the confederation cups also plays a
    // World Cup qualifying leg, so a player holds two lines for one season.
    // Reading only the first would silently drop one of them.
    const both = {
      caps: 11, goals: 7, assists: 3, tournaments: 0, titles: 0,
      seasons: [
        { season: SEASON, kind: "qualifying" as const, caps: 6, goals: 4, assists: 2 },
        { season: SEASON, kind: "confederation" as const, caps: 5, goals: 3, assists: 1 },
      ],
    };
    const qualifyingOnly = {
      caps: 6, goals: 4, assists: 2, tournaments: 0, titles: 0,
      seasons: [{ season: SEASON, kind: "qualifying" as const, caps: 6, goals: 4, assists: 2 }],
    };
    const players = [
      player({ pid: 1, tid: 1, ovr: 80, goals: 20, intl: both }),
      player({ pid: 2, tid: 2, ovr: 80, goals: 20, intl: qualifyingOnly }),
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
      expect(byPid.get(pid!)!.pos).toBe(TOTS_SLOTS[i]);
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

/**
 * A domestic cup won by club `tid`, with `lines` giving each player's
 * appearances in it. Archived shape (statLines set, no box scores), which is
 * what a season being judged actually holds by the time awards run.
 */
function domesticCup(tid: number, lines: Record<number, number>): DomesticCupState {
  return {
    season: SEASON,
    country: "England",
    name: "English Cup",
    teams: [tid],
    rounds: [],
    totalRounds: 6,
    championTid: tid,
    statLines: Object.entries(lines).map(([pid, appearances]) => ({
      pid: Number(pid),
      season: SEASON,
      appearances,
      goals: 0, assists: 0, shots: 0, shotsOnTarget: 0, saves: 0, goalsAgainst: 0,
      tackles: 0, interceptions: 0, minutesPlayed: appearances * 90,
      ratingSum: appearances * 8, ratedAppearances: appearances,
    })),
  };
}

describe("computeWorldAwards — domestic cup", () => {
  it("credits a winner's squad, pro-rated by ties played", () => {
    const players = [
      player({ pid: 1, tid: 1, ovr: 80, goals: 20 }),
      player({ pid: 2, tid: 2, ovr: 80, goals: 20 }),
      ...squad(100, 1, 60),
      ...squad(200, 2, 60),
    ];
    const full = domesticCup(1, { 1: WORLD_AWARD_DOMESTIC_CUP_FULL_INVOLVEMENT });
    const withCup = computeWorldAwards(players, SEASON, ctx({ domesticCups: [full] }));
    const without = computeWorldAwards(players, SEASON, ctx());

    const cupWinner = withCup.ballonDOr.find((e) => e.pid === 1)!;
    const baseline = without.ballonDOr.find((e) => e.pid === 1)!;
    expect(cupWinner.domesticCup).toBeCloseTo(WORLD_AWARD_DOMESTIC_CUP_BONUS, 6);
    expect(cupWinner.score - baseline.score).toBeCloseTo(WORLD_AWARD_DOMESTIC_CUP_BONUS, 6);

    // A team-mate who played one tie gets a fraction, not the lot.
    const oneTie = computeWorldAwards(players, SEASON, ctx({ domesticCups: [domesticCup(1, { 1: 1 })] }));
    expect(oneTie.ballonDOr.find((e) => e.pid === 1)!.domesticCup)
      .toBeCloseTo(WORLD_AWARD_DOMESTIC_CUP_BONUS / WORLD_AWARD_DOMESTIC_CUP_FULL_INVOLVEMENT, 6);
  });

  it("pays nothing to a player at a club that didn't win it, or who never played a tie", () => {
    const players = [
      player({ pid: 1, tid: 1, ovr: 80, goals: 20 }),
      player({ pid: 2, tid: 2, ovr: 80, goals: 20 }),
      ...squad(100, 1, 60),
    ];
    // Club 1 won, but pid 1 never featured; pid 2 is at a club that didn't win.
    const cup = domesticCup(1, { 999: 6 });
    const { ballonDOr } = computeWorldAwards(players, SEASON, ctx({ domesticCups: [cup] }));
    expect(ballonDOr.find((e) => e.pid === 1)!.domesticCup).toBe(0);
    expect(ballonDOr.find((e) => e.pid === 2)!.domesticCup).toBe(0);
  });

  it("is a team bonus only: cup goals never enter the award", () => {
    const players = [player({ pid: 1, tid: 1, ovr: 80, goals: 10 }), ...squad(100, 1, 60)];
    const quiet = domesticCup(1, { 1: 6 });
    const prolific: DomesticCupState = {
      ...quiet,
      statLines: quiet.statLines!.map((l) => ({ ...l, goals: 25, assists: 15 })),
    };
    const a = computeWorldAwards(players, SEASON, ctx({ domesticCups: [quiet] }));
    const b = computeWorldAwards(players, SEASON, ctx({ domesticCups: [prolific] }));
    expect(b.ballonDOr.find((e) => e.pid === 1)!.score)
      .toBeCloseTo(a.ballonDOr.find((e) => e.pid === 1)!.score, 6);
  });

  it("scores a season with no domestic cups exactly as before the competition existed", () => {
    const players = [player({ pid: 1, tid: 1, ovr: 80, goals: 20 }), ...squad(100, 1, 60)];
    expect(computeWorldAwards(players, SEASON, ctx({ domesticCups: [] })))
      .toEqual(computeWorldAwards(players, SEASON, ctx()));
  });
});
