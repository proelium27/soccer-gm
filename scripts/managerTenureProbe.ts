/**
 * How long does a manager actually last?
 *
 * Runs seasons on a real world and applies the board's verdict to **every AI
 * club as if it were the user's**, then reports how often a manager would be
 * sacked and how long a typical tenure runs, per difficulty.
 *
 * Judging the AI clubs rather than the user's own is deliberate and it is the
 * only way to get a meaningful number here. The user's club is unmanaged in a
 * headless run (no free agency, no renewals, no buys), so it rots and produces
 * every extreme in the distribution — measuring tenure on it would say the board
 * fires everyone, and it would say that about any tuning at all. AI clubs are
 * managed normally, so their finish-versus-expectation spread is the one a real
 * manager plays against.
 *
 *   npx tsx scripts/managerTenureProbe.ts [seasons] [seed]
 */
import { mulberry32 } from "../src/engine/rng.js";
import { createLeagueState } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { simOffseason } from "../src/core/offseason.js";
import { deriveExpectations, actualFinish } from "../src/core/manager/expectation.js";
import { tablesByCompetition } from "../src/core/manager/index.js";
import { judgeSeason } from "../src/core/manager/confidence.js";
import { computeCountrySwaps } from "../src/core/promotion.js";
import {
  DIFFICULTIES, DIFFICULTY_ORDER, MANAGER_START_CONFIDENCE, MANAGER_GRACE_SEASONS,
  type Difficulty,
} from "../src/core/constants.js";

const SEASONS = Number(process.argv[2] ?? 12);
const SEED = Number(process.argv[3] ?? 1);
const USER_TID = 0;

interface Chair {
  confidence: number;
  seasonsInPost: number;
  tenures: number[];
  sackings: number;
}

function main(): void {
  let league = createLeagueState(USER_TID, mulberry32(SEED), SEED);

  // One independent "manager" per club per difficulty, all watching the same
  // world, so the difficulties are compared on identical results.
  const chairs = new Map<Difficulty, Map<number, Chair>>();
  for (const d of DIFFICULTY_ORDER) {
    chairs.set(d, new Map(league.teams.map((t) => [t.tid, {
      confidence: MANAGER_START_CONFIDENCE,
      seasonsInPost: 0,
      tenures: [],
      sackings: 0,
    }])));
  }

  const overs: number[] = [];

  for (let s = 0; s < SEASONS; s++) {
    league = simThrough(league, "season", mulberry32(league.lid * 1000 + league.played.length));

    // History through last season only — the bar the club carried into this one.
    const expectations = deriveExpectations(
      league.teams, league.players, league.competitions, league.seasonHistory,
    );
    const tables = tablesByCompetition(league.teams, league.competitions, league.played);
    const swaps = computeCountrySwaps(league.competitions, tables);
    const promoted = new Set(swaps.flatMap((x) => x.promoted));
    const relegated = new Set(swaps.flatMap((x) => x.relegated));

    for (const team of league.teams) {
      // The unmanaged user club is exactly the artifact this probe exists to
      // avoid, so it is excluded rather than reported separately.
      if (team.tid === USER_TID) continue;
      const e = expectations.get(team.tid);
      const table = e ? tables.get(e.compId) : undefined;
      const finish = e && table ? actualFinish(table, team.tid) : null;
      if (!e || finish === null) continue;

      overs.push((e.expectedRank - finish) / Math.max(1, e.clubs - 1));

      for (const d of DIFFICULTY_ORDER) {
        const chair = chairs.get(d)!.get(team.tid)!;
        const verdict = judgeSeason(
          {
            finish,
            expectedRank: e.expectedRank,
            clubs: e.clubs,
            demand: e.demand,
            titles: finish === 1 ? 1 : 0,
            trophies: 0,
            promoted: promoted.has(team.tid),
            relegated: relegated.has(team.tid),
          },
          chair.confidence,
          chair.seasonsInPost,
          true,
          DIFFICULTIES[d].boardPatience,
        );
        chair.seasonsInPost++;
        if (verdict.sacked) {
          chair.sackings++;
          chair.tenures.push(chair.seasonsInPost);
          chair.confidence = MANAGER_START_CONFIDENCE;
          chair.seasonsInPost = 0;
        } else {
          chair.confidence = verdict.confidence;
        }
      }
    }

    league = simOffseason(league, mulberry32(league.lid * 1000 + league.season));
  }

  overs.sort((a, b) => a - b);
  const pct = (p: number): number => overs[Math.floor(overs.length * p)] ?? 0;
  console.log(`\nWorld: ${league.teams.length} clubs, ${SEASONS} seasons, seed ${SEED}`);
  console.log(`Finish vs expectation (fraction of a division), across ${overs.length} club-seasons:`);
  console.log(
    `  p10 ${pct(0.1).toFixed(3)}  p25 ${pct(0.25).toFixed(3)}  median ${pct(0.5).toFixed(3)}`
    + `  p75 ${pct(0.75).toFixed(3)}  p90 ${pct(0.9).toFixed(3)}`,
  );
  console.log(`  (grace period ${MANAGER_GRACE_SEASONS} season(s); sacking possible from season ${MANAGER_GRACE_SEASONS + 1})`);

  console.log("\ndifficulty  patience  sackings  per-100-club-seasons  median tenure  survived all");
  for (const d of DIFFICULTY_ORDER) {
    const all = [...chairs.get(d)!.values()];
    const sackings = all.reduce((n, c) => n + c.sackings, 0);
    const clubSeasons = all.reduce((n, c) => n + c.seasonsInPost + c.tenures.reduce((a, b) => a + b, 0), 0);
    const tenures = all.flatMap((c) => c.tenures).sort((a, b) => a - b);
    const median = tenures.length ? tenures[Math.floor(tenures.length / 2)] : NaN;
    const survivedAll = all.filter((c) => c.sackings === 0).length;
    console.log(
      `${d.padEnd(11)} ${String(DIFFICULTIES[d].boardPatience).padEnd(9)} ${String(sackings).padEnd(9)}`
      + ` ${((sackings / Math.max(1, clubSeasons)) * 100).toFixed(1).padEnd(21)}`
      + ` ${(Number.isNaN(median) ? "-" : `${median}`).padEnd(14)} ${survivedAll}/${all.length}`,
    );
  }
  console.log();
}

main();
