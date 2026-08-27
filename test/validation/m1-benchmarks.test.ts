import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { runScenario } from "../../src/engine/montecarlo.js";
import { generateLeague } from "../../src/core/league/generate.js";
import { leagueComposites } from "../../src/core/league/composites.js";

const N = 20_000;

interface AveragedMetrics {
  goalsPerGame: number;
  shotsPerGame: number;
  sotPerGame: number;
  drawPct: number;
  nilNilPct: number;
  homeWinPct: number;
}

// Averaged over several independently-generated leagues (not just one fixed
// seed's "mid" team) so this gate isn't fragile to incidental shifts in how
// many random draws upstream generation code consumes per player — e.g. a
// change to potential estimation or name generation can nudge exactly which
// ratings a fixed seed's median team gets, without the game actually being
// any less balanced. See m1-table-spread.test.ts for the same pattern.
//
// Every team in each league plays itself, and ALL of them are averaged. This
// used to sample one club per seed — `seedComps[len / 2]`, the middle ARRAY
// index — which is not the average team at all: strength targets are shuffled
// across tids at generation (the strong/weak pair above already sorts by
// `avgOvr` "rather than array position" for exactly that reason), so it was an
// arbitrary club whose standing moves whenever team selection changes.
//
// That made the gate report the sampled club rather than the league, and it sat
// on its floor: measured on the commit this was written against, the old
// estimator gave goals/game 2.6019 against a 2.6 floor. A change that provably
// did NOT move scoring (2.8566 -> 2.8560 across all 100 teams, a difference of
// 0.0006) failed it, purely because a different club landed at that index.
//
// Averaging every team fixes the estimator without touching a single band: all
// six metrics land inside their existing ranges, on both that commit and the
// change that exposed this. Deliberately NOT a widened band — the bands are the
// realism targets from the spec and none of them moved. `scripts/midVsMidProbe.ts`
// prints both estimators side by side.
const LEAGUE_SEEDS = [1, 11, 21, 31, 41];
/** Per-team match count. Lower than N because every club is simulated, not one. */
const SELF_MATCH_N = 2_000;
function averageMidVsMid(): AveragedMetrics {
  const sums: AveragedMetrics = {
    goalsPerGame: 0, shotsPerGame: 0, sotPerGame: 0,
    drawPct: 0, nilNilPct: 0, homeWinPct: 0,
  };
  let teams = 0;
  for (const seed of LEAGUE_SEEDS) {
    for (const comp of leagueComposites(generateLeague(mulberry32(seed)))) {
      const r = runScenario(comp, comp, SELF_MATCH_N, 12345);
      for (const key of Object.keys(sums) as (keyof AveragedMetrics)[]) {
        sums[key] += r[key];
      }
      teams++;
    }
  }
  for (const key of Object.keys(sums) as (keyof AveragedMetrics)[]) {
    sums[key] /= teams;
  }
  return sums;
}

describe("M1 §8 gates — generated average teams", () => {
  const r = averageMidVsMid();
  it("goals/game in 2.6-2.9", () => {
    expect(r.goalsPerGame).toBeGreaterThanOrEqual(2.6);
    expect(r.goalsPerGame).toBeLessThanOrEqual(2.9);
  });
  it("shots/game in 23-27", () => {
    expect(r.shotsPerGame).toBeGreaterThanOrEqual(23);
    expect(r.shotsPerGame).toBeLessThanOrEqual(27);
  });
  it("shots on target in 8-9.5", () => {
    expect(r.sotPerGame).toBeGreaterThanOrEqual(8);
    expect(r.sotPerGame).toBeLessThanOrEqual(9.5);
  });
  it("draw rate in 23-28%", () => {
    expect(r.drawPct).toBeGreaterThanOrEqual(23);
    expect(r.drawPct).toBeLessThanOrEqual(28);
  });
  it("0-0 rate in 5-9%", () => {
    expect(r.nilNilPct).toBeGreaterThanOrEqual(5);
    expect(r.nilNilPct).toBeLessThanOrEqual(9);
  });
  it("home win rate in 38-46%", () => {
    expect(r.homeWinPct).toBeGreaterThanOrEqual(38);
    expect(r.homeWinPct).toBeLessThanOrEqual(46);
  });
});

/**
 * The mismatch pair, averaged over the same seeds, for the same reason the
 * mid-vs-mid gate above stopped sampling one club.
 *
 * A single league's strongest and weakest clubs are not a fixed matchup: how far
 * apart they land is itself a draw. Across these seeds the OVR gap runs 16.9 to
 * 18.8, and the strong side's home win rate with it — measured on the commit
 * this was written against, `73.60 / 74.42 / 76.07 / 78.65 / 78.75 / 79.88 /
 * 76.89 / 83.90`, mean 77.77, sd 3.30. So one seed's reading carries ±3.3pp of
 * spread against a 10pp-wide band, and seed 71 sat OUTSIDE it on a completely
 * unmodified tree. The gate read seed 1, which happened to land 0.12pp under the
 * ceiling; a change worth +0.23pp on the mean (selectXI choosing on slotValue,
 * which lets a club field its actual best eleven) tipped it to 80.07 and failed
 * a realism gate that had not detected a realism problem.
 *
 * Averaging is the same correction, with the same justification: the band is the
 * spec's realism target and is untouched, and the estimator now measures "a
 * strong side beats a weak one" rather than "this arbitrary pair did". Mean lands
 * at 78.0, inside 70-80, on both that commit and the change that exposed this.
 */
function averageMismatch(): { strongHomeWinPct: number; weakAvoidsDefeatPct: number } {
  let strongHomeWin = 0;
  let weakAvoidsDefeat = 0;
  for (const seed of LEAGUE_SEEDS) {
    const league = generateLeague(mulberry32(seed));
    const seedComps = leagueComposites(league);
    const ranked = league.teams
      .map((t, i) => ({ avgOvr: t.avgOvr, comp: seedComps[i] }))
      .sort((a, b) => b.avgOvr - a.avgOvr);
    const s = ranked[0].comp;
    const w = ranked[ranked.length - 1].comp;
    strongHomeWin += runScenario(s, w, N, 6789).homeWinPct;
    const rev = runScenario(w, s, N, 4242);
    weakAvoidsDefeat += rev.homeWinPct + rev.drawPct;
  }
  return {
    strongHomeWinPct: strongHomeWin / LEAGUE_SEEDS.length,
    weakAvoidsDefeatPct: weakAvoidsDefeat / LEAGUE_SEEDS.length,
  };
}

describe("M1 §8 gates — generated mismatch", () => {
  const r = averageMismatch();
  it("strong home beats weak 70-80% of the time", () => {
    expect(r.strongHomeWinPct).toBeGreaterThanOrEqual(70);
    expect(r.strongHomeWinPct).toBeLessThanOrEqual(80);
  });
  it("weak home avoids defeat vs strong at least 20% of the time", () => {
    expect(r.weakAvoidsDefeatPct).toBeGreaterThanOrEqual(20);
  });
});
