/**
 * What the domestic cups pay, and what ALL prize money adds up to, on a real
 * simmed world.
 *
 * Reports the combined continental + domestic total rather than the domestic
 * half alone, deliberately: money entering the world from outside the leagues is
 * what the weak-league solvency audit ultimately reacts to, and two probes each
 * reporting half of it cannot answer that question. `continentalPrizeProbe.ts`
 * breaks the European side down by stage; this one is the world view.
 *
 * The three things to read:
 *
 *   - **a winner's run, against `PRIZE_TOP_10`.** A real domestic cup is small
 *     money (the FA Cup's whole fund is ~£16M and winning it pays ~£3.9M against
 *     a league title's ~£60M merit payment). If a cup win ever approaches a
 *     league placing here, the competition has stopped being a cup.
 *   - **tier 1 vs tier 2 earnings per club.** Measured £0.53-0.58M against
 *     £0.18-0.26M, and **that ~3x gap is NOT the tier scaling** — the payment
 *     rate is flat across divisions by design (see `domesticCupScaleFor`) and
 *     `domesticCupIntegration.test.ts` pins the two scales equal. The gap is
 *     performance: a second-division club enters at the preliminary round, where
 *     the cheques are smallest, and goes out earlier. Don't read this line as
 *     evidence the flatness was lost; read the test for that.
 *   - **the world total as a share of base income**, per country. Measured 4-9%,
 *     and the residual rise toward the poor end (England 6%, Greece 8-9%) is the
 *     *continental* half, which pays flat on purpose — the domestic half is
 *     country-scaled and contributes a level ~1% everywhere.
 *
 * Note this divides by every club that EARNED something, where
 * `continentalPrizeProbe.ts` divides by the ~6 qualifiers a country sends. The
 * two "% of a season" figures are therefore not comparable — this one is
 * diluted by the ~20 clubs a domestic cup pays, and is the smaller number.
 *
 * Run: npx tsx scripts/domesticCupPrizeProbe.ts [seed] [seasons]
 */
import { createLeagueState } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { simOffseason } from "../src/core/offseason.js";
import { mulberry32 } from "../src/engine/rng.js";
import { cupFormat } from "../src/core/cup/cup.js";
import { domesticPrizeForRound, roundsFromFinal } from "../src/core/domesticCup/cup.js";
import { domesticCupScaleFor } from "../src/core/finance/budget.js";
import {
  BASE_SEASON_BUDGET, PRIZE_TOP_10, DOMESTIC_CUP_PRIZE_RUNNER_UP,
  DOMESTIC_CUP_GLAMOUR_TIE_BONUS,
} from "../src/core/constants.js";
import { competitionBudgetScale } from "../src/core/competitions.js";
import { financeScale } from "../src/core/finance/budget.js";
import type { CupState } from "../src/core/cup/types.js";
import type { DomesticCupState } from "../src/core/domesticCup/types.js";
import type { LeagueStore } from "../src/core/leagueState.js";

const seed = Number(process.argv[2] ?? 7);
const seasons = Number(process.argv[3] ?? 3);

const M = (n: number): string => `${(n / 1_000_000).toFixed(2)}M`;

/**
 * What one domestic cup paid, per club. Mirrors `playDomesticRound` exactly:
 * each tie's winner takes the round's prize, and the final's loser alone takes
 * the runner-up cheque, both multiplied by the club's own scale.
 */
function domesticPot(
  cup: DomesticCupState,
  scaleOf: (tid: number) => number,
  tierOf: (tid: number) => number,
): Map<number, number> {
  const byTid = new Map<number, number>();
  const add = (tid: number, amount: number): void => {
    if (amount <= 0) return;
    byTid.set(tid, (byTid.get(tid) ?? 0) + amount * scaleOf(tid));
  };
  cup.rounds.forEach((round, r) => {
    const win = domesticPrizeForRound(cup, r);
    for (const tie of round.ties ?? []) {
      if (tie.winner < 0) continue;
      add(tie.winner, win);
      if (roundsFromFinal(cup, r) === 0) {
        add(tie.winner === tie.home ? tie.away : tie.home, DOMESTIC_CUP_PRIZE_RUNNER_UP);
      }
      // Glamour-tie gate receipts to the smaller club, win or lose.
      const ht = tierOf(tie.home);
      const at = tierOf(tie.away);
      if (ht !== at) add(ht > at ? tie.home : tie.away, DOMESTIC_CUP_GLAMOUR_TIE_BONUS);
    }
  });
  return byTid;
}

/** Continental side, by club — the same three sources the cup tests assert from. */
function continentalPot(cup: CupState): Map<number, number> {
  const p = cupFormat(cup).prizes;
  const byTid = new Map<number, number>();
  const add = (tid: number, amount: number): void => {
    byTid.set(tid, (byTid.get(tid) ?? 0) + amount);
  };
  for (const tid of cup.leaguePhase ? cup.leaguePhase.teams : cup.teams.filter((t) => t >= 0)) {
    add(tid, p.participation);
  }
  for (const m of cup.leaguePhase?.matches ?? []) {
    if (!m.played) continue;
    if (m.homeGoals === m.awayGoals) {
      add(m.home, p.leaguePhaseDraw);
      add(m.away, p.leaguePhaseDraw);
    } else add(m.homeGoals > m.awayGoals ? m.home : m.away, p.leaguePhaseWin);
  }
  for (const t of cup.playoff?.ties ?? []) if (t.winner >= 0) add(t.winner, p.playoffWin);
  const finalRound = p.koByRound.length - 1;
  for (const t of cup.ties) {
    add(t.winner, p.koByRound[t.round] ?? 0);
    if (t.round === finalRound) add(t.winner === t.home ? t.away : t.home, p.runnerUp);
  }
  return byTid;
}

const sum = (m: Map<number, number>): number => [...m.values()].reduce((a, b) => a + b, 0);

const rng = mulberry32(seed);
let league: LeagueStore = createLeagueState(0, rng);

// A fresh league needs two cycles before BOTH competitions are live, and
// reporting them as ordinary seasons is how this probe first read a fully
// working world as "continental 0.00M": season 1 has no continental cups at all
// (they qualify off a finished table) and the cycle that completes it is what
// builds them. Warm up rather than printing empty seasons.
for (let w = 0; w < 2; w++) {
  league = simThrough(league, "season", rng);
  league = simOffseason(league, rng);
}

for (let s = 0; s < seasons; s++) {
  league = simThrough(league, "season", rng);
  // Labelled from a cup's own season rather than league.season, which is a
  // moving target across the offseason boundary.
  const season = league.domesticCups[0]?.season ?? league.season;

  const compOf = new Map(league.teams.map((t) => [t.tid, t.compId]));
  const byId = new Map(league.competitions.map((c) => [c.id, c]));
  const tierOf = (tid: number): number => byId.get(compOf.get(tid) ?? 0)?.tier ?? 1;
  const scaleOf = (tid: number): number =>
    domesticCupScaleFor(
      league.competitions, compOf.get(tid) ?? 0, tid, league.meta.userTid, league.difficulty,
    );

  console.log(`\n=== season ${season} ===`);

  // Domestic: one cup per country.
  let domTotal = 0;
  const domByTid = new Map<number, number>();
  const runs: number[] = [];
  for (const cup of league.domesticCups) {
    const pot = domesticPot(cup, scaleOf, tierOf);
    domTotal += sum(pot);
    for (const [tid, v] of pot) domByTid.set(tid, (domByTid.get(tid) ?? 0) + v);
    if (cup.championTid !== null) runs.push(pot.get(cup.championTid) ?? 0);
  }
  runs.sort((a, b) => a - b);
  console.log(
    `  domestic cups: ${M(domTotal)} over ${league.domesticCups.length} countries` +
      `  | winner's run min ${M(runs[0] ?? 0)} median ${M(runs[runs.length >> 1] ?? 0)}` +
      ` max ${M(runs[runs.length - 1] ?? 0)}   (a top-half league finish pays ${M(PRIZE_TOP_10)})`,
  );

  // Per division, over however many the world has -- it grew a third on
  // 2026-09-01 and a hardcoded [1, 2] would have quietly stopped reporting the
  // clubs this feature exists for.
  const tiers = [...new Set(league.competitions.map((c) => c.tier))].sort((a, b) => a - b);
  const perTier = tiers.map((tier) => {
    const vals = [...domByTid].filter(([tid]) => byId.get(compOf.get(tid) ?? 0)?.tier === tier);
    const total = vals.reduce((a, [, v]) => a + v, 0);
    return { tier, clubs: vals.length, mean: vals.length ? total / vals.length : 0 };
  });
  console.log(
    `    per club that won anything: ` +
      perTier.map((r) => `tier ${r.tier} ${M(r.mean)} (${r.clubs} clubs)`).join("   "),
  );

  // Continental side + the combined world view.
  let contTotal = 0;
  const allByTid = new Map(domByTid);
  for (const cup of [league.cup, league.shield]) {
    if (!cup || !cup.championTid) continue;
    const pot = continentalPot(cup);
    contTotal += sum(pot);
    for (const [tid, v] of pot) allByTid.set(tid, (allByTid.get(tid) ?? 0) + v);
  }
  console.log(
    `  continental ${M(contTotal)}  +  domestic ${M(domTotal)}` +
      `  =  ${M(contTotal + domTotal)} entering the world` +
      `  (domestic is ${((domTotal / (contTotal + domTotal)) * 100).toFixed(0)}% of it)`,
  );

  // THE question this feature exists to answer: does a second-division club
  // actually make money out of the cup? Counts every source, because the cup's
  // biggest payment to a tier-2 club is not its prize table at all -- winning it
  // takes a Continental Shield place (allocateContinentalPlaces), and Shield
  // money is FLAT, so it is worth proportionally most to exactly these clubs.
  const tier2 = [...allByTid]
    .filter(([tid]) => (byId.get(compOf.get(tid) ?? 0)?.tier ?? 1) >= 2)
    .map(([tid, total]) => {
      const comp = byId.get(compOf.get(tid) ?? 0)!;
      const income = BASE_SEASON_BUDGET * financeScale(league.competitions, comp.id);
      return { tid, country: comp.country, tier: comp.tier, total, income, pct: (total / income) * 100 };
    })
    .sort((a, b) => b.pct - a.pct);
  const domWinnersT2 = league.domesticCups
    .filter((c) => c.championTid !== null && (byId.get(compOf.get(c.championTid!) ?? 0)?.tier ?? 1) >= 2)
    .map((c) => `${c.country} (tier ${byId.get(compOf.get(c.championTid!) ?? 0)?.tier})`);
  const medT2 = tier2.length ? tier2[tier2.length >> 1] : null;
  console.log(
    `  LOWER-DIVISION clubs earning anything: ${tier2.length}` +
      `  | median ${medT2 ? `${M(medT2.total)} (${medT2.pct.toFixed(1)}% of its season)` : "-"}` +
      `  | best ${tier2[0] ? `${M(tier2[0].total)} = ${tier2[0].pct.toFixed(1)}% (${tier2[0].country})` : "-"}`,
  );
  console.log(
    `    tier-2 clubs that WON their domestic cup: ` +
      (domWinnersT2.length ? domWinnersT2.join(", ") : "none") +
      `   (a cup win takes a Continental Shield place)`,
  );
  for (const r of tier2.slice(0, 3)) {
    console.log(
      `      ${r.country.padEnd(12)} tier ${r.tier}  ${M(r.total)} of a ${M(r.income)} season = ${r.pct.toFixed(1)}%`,
    );
  }

  // Is a country's domestic cup money proportional to its SIZE? The knockout
  // bracket is capped at 32 clubs whatever the field, so every country's
  // R32-onward prizes are the same cash -- a smaller country splits an identical
  // pot among fewer clubs. That is invisible to domesticCupScaleFor, which
  // scales by country wealth and not by country size, and it is the suspected
  // cause of the 2026-09-02 Turkey->Greece ladder inversion.
  const domByCountry = new Map<string, { total: number; clubs: number; scale: number }>();
  for (const [tid, v] of domByTid) {
    const comp = byId.get(compOf.get(tid) ?? 0);
    if (!comp) continue;
    const row = domByCountry.get(comp.country) ?? {
      total: 0, clubs: 0, scale: competitionBudgetScale(comp),
    };
    row.total += v;
    domByCountry.set(comp.country, row);
  }
  for (const comp of league.competitions) {
    const row = domByCountry.get(comp.country);
    if (row) row.clubs += league.teams.filter((t) => t.compId === comp.id).length;
  }
  // The ladder gate measures TIER-1 mean OVR, so the number that can move it is
  // money per top-flight club, not money per club. The late rounds pay a fixed
  // count of ties (1 final, 2 semis, 4 quarters) whatever the field size, and
  // they are mostly won by top-flight clubs -- so a country with a SMALLER top
  // flight concentrates the same late money on fewer of the clubs the gate reads.
  const t1ByCountry = new Map<string, { total: number; clubs: number; scale: number }>();
  for (const [tid, v] of domByTid) {
    const comp = byId.get(compOf.get(tid) ?? 0);
    if (!comp || comp.tier !== 1) continue;
    const row = t1ByCountry.get(comp.country) ?? {
      total: 0, clubs: 0, scale: competitionBudgetScale(comp),
    };
    row.total += v;
    t1ByCountry.set(comp.country, row);
  }
  for (const comp of league.competitions.filter((c) => c.tier === 1)) {
    const row = t1ByCountry.get(comp.country);
    if (row) row.clubs += league.teams.filter((t) => t.compId === comp.id).length;
  }
  console.log("  DOMESTIC money per TOP-FLIGHT club, scale-adjusted (what the ladder gate reads):");
  for (const [country, row] of [...t1ByCountry].sort(
    (a, b) => b[1].total / b[1].clubs / b[1].scale - a[1].total / a[1].clubs / a[1].scale,
  )) {
    const per = row.total / row.clubs / row.scale;
    console.log(
      `    ${country.padEnd(12)} ${String(row.clubs).padStart(2)} top-flight clubs  ${M(per)}/club before country scale`,
    );
  }

  console.log("  DOMESTIC cup money per club in the country, scale-adjusted (flat = size-neutral):");
  for (const [country, row] of [...domByCountry].sort(
    (a, b) => b[1].total / b[1].clubs / b[1].scale - a[1].total / a[1].clubs / a[1].scale,
  )) {
    const perClub = row.total / row.clubs;
    console.log(
      `    ${country.padEnd(12)} ${String(row.clubs).padStart(3)} clubs  ${M(perClub)}/club` +
        `  = ${M(perClub / row.scale)} before country scale`,
    );
  }

  const byCountry = new Map<string, { total: number; clubs: number; scale: number }>();
  for (const [tid, v] of allByTid) {
    const comp = byId.get(compOf.get(tid) ?? 0);
    if (!comp) continue;
    const row = byCountry.get(comp.country) ?? {
      total: 0, clubs: 0, scale: competitionBudgetScale(comp),
    };
    row.total += v;
    row.clubs += 1;
    byCountry.set(comp.country, row);
  }
  console.log("  all prize money per earning club, against that country's base income:");
  for (const [country, row] of [...byCountry].sort((a, b) => b[1].scale - a[1].scale)) {
    const per = row.total / row.clubs;
    const income = BASE_SEASON_BUDGET * row.scale;
    console.log(
      `    ${country.padEnd(12)} ${String(row.clubs).padStart(3)} clubs  ${M(per)} each` +
        `  = ${((per / income) * 100).toFixed(0)}% of a ${M(income)} season`,
    );
  }

  league = simOffseason(league, rng);
}
