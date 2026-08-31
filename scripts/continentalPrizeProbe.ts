/**
 * What the continental competitions actually pay, on a real simmed world.
 *
 * The prize constants are easy to reason about wrongly, because the league
 * phase is where the volume is: 32 clubs collect a participation fee once, but
 * they play 96 matches between them, so a per-result fee that looks small next
 * to the trophy is a bigger line in the pot than the trophy is. This prints the
 * pot broken down by stage so a retune is sized against measurement rather than
 * arithmetic done in a comment.
 *
 * The three numbers to read, and what they're for:
 *
 *   - **the pot**, per competition per season. This is money entering the world
 *     from outside every league, so it is what the weak-league solvency and
 *     strength-ladder audit is ultimately reacting to. Price any change here in
 *     "£ per season across the world" before running the 40-minute audit.
 *   - **what a league-phase exit earns**, against PRIZE_TOP_5 (£20M). This is
 *     the ratio the 2026-08-31 reshape exists to fix: qualifying for Europe and
 *     going out in the group has to be worth a season's work, and at £2M it was
 *     a rounding error next to finishing 5th at home.
 *   - **earnings by country**, which is where the risk lives. Payments are flat
 *     (UEFA pays a Belgian club what it pays an English one), so European money
 *     is worth proportionally far more to a weak league — the documented
 *     weaker-but-richer tripwire. Read this next to COUNTRY_BUDGET_SCALE.
 *
 * Derived from the finished CupState rather than by instrumenting simThrough's
 * creditPrizes, so it stays a read-only probe: the same three sources the tests
 * assert the pot from (participation × field, each league-phase result, each
 * tie), which means probe and test cannot disagree about what a stage pays.
 *
 * Run: npx tsx scripts/continentalPrizeProbe.ts [seed] [seasons]
 */
import { createLeagueState } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { simOffseason } from "../src/core/offseason.js";
import { mulberry32 } from "../src/engine/rng.js";
import { cupFormat } from "../src/core/cup/cup.js";
import { BASE_SEASON_BUDGET, PRIZE_TOP_5 } from "../src/core/constants.js";
import { competitionBudgetScale } from "../src/core/competitions.js";
import type { CupState } from "../src/core/cup/types.js";

const seed = Number(process.argv[2] ?? 7);
const seasons = Number(process.argv[3] ?? 3);

const M = (n: number): string => `${(n / 1_000_000).toFixed(1)}M`;

interface Pot {
  participation: number;
  leaguePhase: number;
  playoff: number;
  knockout: number;
  /** tid → total earned, so per-club and per-country readings share one source. */
  byTid: Map<number, number>;
}

/**
 * Every prize a finished cup paid, by stage. Mirrors what simThrough credits:
 * participation to the whole field, a fee per league-phase result, a playoff
 * win, then a per-round knockout win plus the runner-up's consolation.
 */
function potOf(cup: CupState): Pot {
  const p = cupFormat(cup).prizes;
  const byTid = new Map<number, number>();
  const add = (tid: number, amount: number): void => {
    byTid.set(tid, (byTid.get(tid) ?? 0) + amount);
  };

  const field = cup.leaguePhase ? cup.leaguePhase.teams : cup.teams.filter((t) => t >= 0);
  for (const tid of field) add(tid, p.participation);
  const participation = field.length * p.participation;

  let leaguePhase = 0;
  for (const m of cup.leaguePhase?.matches ?? []) {
    if (!m.played) continue;
    if (m.homeGoals === m.awayGoals) {
      add(m.home, p.leaguePhaseDraw);
      add(m.away, p.leaguePhaseDraw);
      leaguePhase += 2 * p.leaguePhaseDraw;
    } else {
      add(m.homeGoals > m.awayGoals ? m.home : m.away, p.leaguePhaseWin);
      leaguePhase += p.leaguePhaseWin;
    }
  }

  let playoff = 0;
  for (const t of cup.playoff?.ties ?? []) {
    if (t.winner < 0) continue;
    add(t.winner, p.playoffWin);
    playoff += p.playoffWin;
  }

  let knockout = 0;
  const finalRound = p.koByRound.length - 1;
  for (const t of cup.ties) {
    const win = p.koByRound[t.round] ?? 0;
    add(t.winner, win);
    knockout += win;
    if (t.round === finalRound) {
      const runnerUp = t.winner === t.home ? t.away : t.home;
      add(runnerUp, p.runnerUp);
      knockout += p.runnerUp;
    }
  }

  return { participation, leaguePhase, playoff, knockout, byTid };
}

const total = (p: Pot): number => p.participation + p.leaguePhase + p.playoff + p.knockout;

const rng = mulberry32(seed);
let league = createLeagueState(0, rng);

for (let s = 1; s <= seasons; s++) {
  const season = league.season;
  league = simThrough(league, "season", rng);

  const cups: [string, CupState | null][] = [
    ["Continental Cup", league.cup],
    ["Continental Shield", league.shield],
  ];

  console.log(`\n=== season ${season} ===`);
  let worldPot = 0;
  const worldByTid = new Map<number, number>();

  for (const [label, cup] of cups) {
    if (!cup || !cup.championTid) {
      console.log(`  ${label}: not played`);
      continue;
    }
    const pot = potOf(cup);
    worldPot += total(pot);
    for (const [tid, v] of pot.byTid) worldByTid.set(tid, (worldByTid.get(tid) ?? 0) + v);

    const earned = [...pot.byTid.values()].sort((a, b) => a - b);
    const field = pot.byTid.size;
    console.log(
      `  ${label}: pot ${M(total(pot))} over ${field} clubs` +
        `  [qualify ${M(pot.participation)}` +
        `  league phase ${M(pot.leaguePhase)}` +
        `  playoff ${M(pot.playoff)}` +
        `  knockout ${M(pot.knockout)}]`,
    );
    console.log(
      `    per club: min ${M(earned[0])}  median ${M(earned[Math.floor(field / 2)])}` +
        `  champion ${M(pot.byTid.get(cup.championTid) ?? 0)}` +
        `   (finishing top-quarter at home pays ${M(PRIZE_TOP_5)})`,
    );
  }

  // Flat payments land hardest on the poorest leagues, which is the real-life
  // effect and also the ladder risk. Measure it as a share of base income.
  const byCountry = new Map<string, { total: number; clubs: number; scale: number }>();
  for (const [tid, v] of worldByTid) {
    const team = league.teams.find((t) => t.tid === tid);
    const comp = league.competitions.find((c) => c.id === team?.compId);
    if (!comp) continue;
    const row = byCountry.get(comp.country) ?? {
      total: 0,
      clubs: 0,
      scale: competitionBudgetScale(comp),
    };
    row.total += v;
    row.clubs += 1;
    byCountry.set(comp.country, row);
  }
  console.log(`  world pot ${M(worldPot)}; per qualifier, against that country's base income:`);
  for (const [country, row] of [...byCountry].sort((a, b) => b[1].scale - a[1].scale)) {
    const per = row.total / row.clubs;
    const income = BASE_SEASON_BUDGET * row.scale;
    console.log(
      `    ${country.padEnd(12)} ${row.clubs} qualifiers  ${M(per)} each` +
        `  = ${((per / income) * 100).toFixed(0)}% of a ${M(income)} season`,
    );
  }

  league = simOffseason(league, rng);
}
