import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { simSeason } from "../../src/core/season.js";
import { attributeTouchStats, emptyLine, type TouchSide, type PlayerMatchLine } from "../../src/engine/attribution.js";

/**
 * Passes/crosses/fouls are decorative attribution layered on the composite sim.
 * These tests lock in two things: (1) they never change the scoreline, and
 * (2) their per-team volumes read like real top-flight football.
 */

// A full deterministic season through the real pipeline; reused across cases.
const SEASON = simSeason(mulberry32(12345));

/**
 * Baseline scoreline hash. Still guards that touch attribution (passes/crosses)
 * never perturbs the scoreline — it runs on a separate rng stream. The fixed
 * value has been rebased for deliberate shot-outcome changes: first when the
 * individual-finisher effect (SHOOTER_FINISH_WEIGHT) was added to resolveShot;
 * again when rollupComposites gained position-weighting + star concentration
 * (COMPOSITE_STAR_CONCENTRATION), which changed the attack/defense/control
 * composites (and thus match results) without touching the rng stream; again
 * when the substitution logic gained a bench-quality gate (SUB_FATIGUE_RELIEF et
 * al.), which now holds back roughly one sub in ten, changing who's on the pitch
 * late; once more when that gate became form-aware (SUB_GATE_RATING_INFLUENCE),
 * shifting which held-back subs fire; and again when SUB_QUALITY_MARGIN was
 * retuned 1→2.5 so the gate holds back its intended ~1 sub in ten rather than
 * ~1 in five — each a personnel/composite change, not an rng-stream shift.
 */
const BASELINE_SCORELINE_HASH = 3023701295;

function scorelineHash(matches: typeof SEASON.matches): number {
  const s = matches.map((m) => `${m.home}:${m.homeGoals}-${m.awayGoals}:${m.away}`).join("|");
  let h = 0;
  for (const c of s) h = (Math.imul(h, 31) + c.charCodeAt(0)) | 0;
  return h >>> 0;
}

describe("touch attribution — scoreline invariance", () => {
  it("does not perturb the main match RNG stream (scorelines bit-identical to pre-attribution baseline)", () => {
    expect(scorelineHash(SEASON.matches)).toBe(BASELINE_SCORELINE_HASH);
  });

  it("is deterministic: same lines + same seed produce identical passes/crosses", () => {
    const side = (): TouchSide => ({
      players: [
        { pid: 1, pos: "CM", minutes: 90 },
        { pid: 2, pos: "W", minutes: 90 },
        { pid: 3, pos: "GK", minutes: 90 },
      ],
      ticks: 470,
      control: 0.55,
    });
    const run = () => {
      const lines = new Map<number, PlayerMatchLine>([1, 2, 3].map((p) => [p, emptyLine(p)]));
      attributeTouchStats(lines, side(), side(), 999);
      return [1, 2, 3].map((p) => {
        const l = lines.get(p)!;
        return [l.passes, l.passesCompleted, l.crosses];
      });
    };
    expect(run()).toEqual(run());
  });
});

describe("touch attribution — realism", () => {
  // Aggregate every team-match's box score across the full season.
  const perTeam: { passes: number; completed: number; crosses: number; fouls: number }[] = [];
  const byPos: Record<string, { passes: number; crosses: number; fouls: number; n: number }> = {};
  const posOf = new Map(SEASON.league.players.map((p) => [p.pid, p.pos]));

  for (const m of SEASON.matches) {
    for (const side of [m.boxScore.home, m.boxScore.away]) {
      let passes = 0, completed = 0, crosses = 0, fouls = 0;
      for (const l of side) {
        passes += l.passes;
        completed += l.passesCompleted;
        crosses += l.crosses;
        fouls += l.foulsCommitted;
        const pos = posOf.get(l.pid)!;
        const b = (byPos[pos] ??= { passes: 0, crosses: 0, fouls: 0, n: 0 });
        b.passes += l.passes;
        b.crosses += l.crosses;
        b.fouls += l.foulsCommitted;
        b.n++;
      }
      perTeam.push({ passes, completed, crosses, fouls });
    }
  }

  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const passMean = mean(perTeam.map((t) => t.passes));
  const totalPasses = perTeam.reduce((a, t) => a + t.passes, 0);
  const totalCompleted = perTeam.reduce((a, t) => a + t.completed, 0);
  const completionPct = (100 * totalCompleted) / totalPasses;
  const crossMean = mean(perTeam.map((t) => t.crosses));
  const foulMean = mean(perTeam.map((t) => t.fouls));

  it("passes per team land in a realistic top-flight range (~450-500)", () => {
    expect(passMean).toBeGreaterThan(420);
    expect(passMean).toBeLessThan(560);
  });

  it("pass completion sits in the realistic 78-86% band", () => {
    expect(completionPct).toBeGreaterThan(78);
    expect(completionPct).toBeLessThan(86);
  });

  it("completed never exceeds attempted on any team-match", () => {
    expect(perTeam.every((t) => t.completed <= t.passes)).toBe(true);
  });

  it("crosses per team land in a realistic range (~12-22)", () => {
    expect(crossMean).toBeGreaterThan(11);
    expect(crossMean).toBeLessThan(23);
  });

  it("fouls per team match the engine's actual foul events (~5-9)", () => {
    // Tied to real FOUL_BASE foul events (not synthesized), so consistent with cards.
    expect(foulMean).toBeGreaterThan(4);
    expect(foulMean).toBeLessThan(10);
  });

  it("distributes touches sensibly by position", () => {
    // Central/deep positions circulate the ball more than a lone striker.
    expect(byPos.CM.passes / byPos.CM.n).toBeGreaterThan(byPos.ST.passes / byPos.ST.n);
    expect(byPos.CB.passes / byPos.CB.n).toBeGreaterThan(byPos.ST.passes / byPos.ST.n);
    // Wide players dominate crosses; keepers and centre-backs barely cross.
    expect(byPos.W.crosses / byPos.W.n).toBeGreaterThan(byPos.CM.crosses / byPos.CM.n);
    expect(byPos.FB.crosses / byPos.FB.n).toBeGreaterThan(byPos.CB.crosses / byPos.CB.n);
    expect(byPos.GK.crosses).toBe(0);
  });
});
