/**
 * How many job offers a manager actually sees, by how big their club is and how
 * decorated they are — and the same for national teams.
 *
 * Written for the bug it caught: the offer pool is the intersection of an
 * *absolute* prestige band (centred on reputation) and a *relative* step-up
 * filter (against your current job), and those two stop overlapping entirely
 * once you manage something bigger than your reputation. The symptom is a
 * decorated manager at a top club being offered nothing, season after season,
 * which reads as a dead feature rather than a bug.
 *
 * Two grids per side, and BOTH are needed. Count alone saturates near the cap
 * once the pool is comfortably large, which reads as "reputation does nothing" —
 * it does, it steers *which* clubs call rather than how many. The second grid is
 * the mean prestige of the clubs offered, and that is where reputation shows up.
 * Any 0.00 in the count grid's right-hand columns is the failure the probe was
 * written for: the better you do, the fewer offers.
 *
 *   npx tsx scripts/managerOfferProbe.ts
 *   SEED=3 npx tsx scripts/managerOfferProbe.ts
 *
 * Pure and rng-free with respect to the sim: offers draw on their own seeded
 * streams (970 / 971), so nothing here can move a match result.
 */
import { mulberry32 } from "../src/engine/rng.js";
import { createLeagueState } from "../src/core/leagueState.js";
import { deriveExpectations } from "../src/core/manager/expectation.js";
import { generateJobOffers, NO_MOVES } from "../src/core/manager/jobOffers.js";
import { nationExpectations } from "../src/core/nationalManager/expectation.js";
import { generateNationOffers } from "../src/core/nationalManager/offers.js";
import type { IntlPowerSnapshot } from "../src/core/international/types.js";

const SEED = Number(process.env.SEED ?? 1);
/** Seasons averaged per cell. Offers are seeded off the season, so this is the sample. */
const SEASONS = 12;
const REPS = [30, 45, 60, 75, 90, 100];

const pad = (s: string | number, n: number): string => String(s).padStart(n);

function clubGrid(): void {
  const league = createLeagueState(0, mulberry32(SEED), SEED);
  const exp = deriveExpectations(
    league.teams, league.players, league.competitions, league.seasonHistory,
  );
  const all = [...exp.values()].sort((a, b) => b.prestige - a.prestige);

  console.log(`\nCLUB OFFERS — ${all.length} clubs, seed ${SEED}`);
  console.log(`mean offers per season over ${SEASONS} seasons; rows = your club's world rank by prestige`);
  console.log(`rank  prestige |${REPS.map((r) => pad(r, 6)).join("")}   <- reputation`);

  const measure = (tid: number, reputation: number): { count: number; prestige: string } => {
    let offers = 0;
    let prestigeSum = 0;
    for (let season = 1; season <= SEASONS; season++) {
      const list = generateJobOffers({
        lid: 0, season, currentTid: tid, expectations: exp,
        sacked: false, reputation, lastOverperformance: 0, moves: NO_MOVES,
      });
      offers += list.length;
      for (const o of list) prestigeSum += o.prestige;
    }
    return {
      count: offers / SEASONS,
      prestige: offers === 0 ? "--" : (prestigeSum / offers).toFixed(3),
    };
  };

  const counts: string[] = [];
  const quality: string[] = [];
  for (const rank of [1, 3, 10, 25, 60, 120, 250, 450, all.length]) {
    const me = all[rank - 1];
    counts.push(`${pad(rank, 4)}  ${me.prestige.toFixed(3)}    |`
      + REPS.map((r) => pad(measure(me.tid, r).count.toFixed(2), 6)).join(""));
    quality.push(`${pad(rank, 4)}  ${me.prestige.toFixed(3)}    |`
      + REPS.map((r) => pad(measure(me.tid, r).prestige, 6)).join(""));
  }
  console.log(counts.join("\n"));
  console.log(`\nmean prestige of the clubs offered ("--" = none offered)`);
  console.log(`rank  prestige |${REPS.map((r) => pad(r, 6)).join("")}   <- reputation`);
  console.log(quality.join("\n"));
}

/**
 * A synthetic 44-nation field — the count a fresh shipped world produces. Built
 * here rather than simmed because the probe is about the offer arithmetic, and
 * reaching a real `IntlPowerSnapshot` costs a full offseason of international
 * football for a ranking this reproduces exactly.
 */
function nationSnapshot(n = 44): IntlPowerSnapshot {
  return {
    season: 1,
    ranks: Array.from({ length: n }, (_, i) => ({ nation: `Nation ${i + 1}`, rating: 80 - i })),
  } as IntlPowerSnapshot;
}

function nationGrid(): void {
  const exp = nationExpectations(nationSnapshot());
  const all = [...exp.values()].sort((a, b) => a.rank - b.rank);
  const run = (currentNation: string | null, reputation: number): number => {
    let total = 0;
    for (let season = 1; season <= SEASONS; season++) {
      total += generateNationOffers({
        lid: 0, season, currentNation, expectations: exp,
        sacked: false, reputation, lastOverperformance: 0,
      }).length;
    }
    return total / SEASONS;
  };

  console.log(`\nNATIONAL OFFERS — ${all.length} nations`);
  console.log(`rank  prestige |${REPS.map((r) => pad(r, 6)).join("")}   <- reputation`);
  for (const rank of [1, 3, 8, 15, 22, 33, all.length]) {
    const me = all[rank - 1];
    const cells = REPS.map((rep) => pad(run(me.nation, rep).toFixed(2), 6));
    console.log(`${pad(rank, 4)}  ${me.prestige.toFixed(3)}    |${cells.join("")}`);
  }
  console.log(`  --  no job    |${REPS.map((rep) => pad(run(null, rep).toFixed(2), 6)).join("")}`);
}

clubGrid();
nationGrid();
