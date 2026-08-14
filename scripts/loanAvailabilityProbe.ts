/**
 * Does LOAN_AVAILABILITY repeat the bug that AI_MARKET_AVAILABILITY caused?
 *
 * runAILoanMarket still screens on `keepValueToClub(p) > market * 0.95`, the
 * same club-relative-vs-club-blind comparison that was deleted from the
 * permanent market on 2026-08-11 for shutting off the upward talent drain and
 * inverting the league strength ladder (docs/transfer-mobility.md).
 *
 * The reason it may be harmless HERE is population, not principle: the loan
 * market already restricts itself to players **outside their club's starting
 * XI** and **aged <= LOAN_AI_MAX_AGE**, so a club's best player — the group the
 * screen silently removed from the transfer market — is excluded before the
 * screen ever runs. This measures whether that holds, by reporting the
 * reservation/market distribution over the *loan-eligible* population only, and
 * what share the screen actually excludes.
 *
 * Read it the way the original probe was read: if the screen excludes a large
 * share, or excludes the best eligible players specifically, it is the same bug
 * in a smaller pond and should go the same way.
 *
 *   npx tsx scripts/loanAvailabilityProbe.ts [seasons]
 */
import { createLeagueState } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { simOffseason } from "../src/core/offseason.js";
import { mulberry32 } from "../src/engine/rng.js";
import { deriveLeagueContexts } from "../src/core/ai/clubContext.js";
import { keepValueToClub } from "../src/core/ai/evaluate.js";
import { trueTransferValue } from "../src/core/finance/valuation.js";
import { resolveXI } from "../src/core/lineup/resolveXI.js";
import { teamSlots } from "../src/core/lineup/formations.js";
import { LOAN_AI_MAX_AGE } from "../src/core/constants.js";

/**
 * The screen this probe was written to measure. LOAN_AVAILABILITY was deleted
 * from constants.ts on 2026-08-13 *because of* the numbers below, so the value
 * is pinned here to keep the measurement reproducible — the same way
 * cupUndercountDemo.ts keeps a removed behaviour runnable. Re-running this
 * should still report ~28.9% of clubs' best loan-eligible players passing.
 */
const LOAN_AVAILABILITY = 0.95;

const SEASONS = Number(process.argv[2] ?? 6);

const rng = mulberry32(1);
let league = createLeagueState(0, rng);
for (let s = 1; s < SEASONS; s++) {
  league = simThrough(league, "season", rng);
  league = simOffseason(league, rng);
}

const byPid = new Map(league.players.map((p) => [p.pid, p]));
const contexts = deriveLeagueContexts(league);
const onLoan = new Set(league.activeLoans.map((l) => l.pid));

/** reservation/market for every loan-eligible player. */
const eligible: { ratio: number; ovr: number }[] = [];
/** Same, for the best loan-eligible player at each club — the group the market bug hit. */
const bestEligible: number[] = [];

for (const team of league.teams) {
  if (team.tid === league.meta.userTid) continue;
  const ctx = contexts.get(team.tid);
  if (!ctx) continue;

  // Same XI derivation runAILoanMarket uses, so the eligible pool matches it.
  const teamPlayers = team.roster
    .map((pid) => byPid.get(pid))
    .filter((p): p is NonNullable<typeof p> => !!p);
  const xi = new Set(resolveXI(teamPlayers, teamSlots(team), team.starters).map((p) => p.pid));
  const pool = team.roster
    .map((pid) => byPid.get(pid))
    .filter((p): p is NonNullable<typeof p> => !!p)
    .filter((p) => !xi.has(p.pid) && !onLoan.has(p.pid) && league.season - p.born <= LOAN_AI_MAX_AGE);
  if (!pool.length) continue;

  let best: { ratio: number; ovr: number } | null = null;
  for (const player of pool) {
    const market = trueTransferValue(player, league.season);
    if (market <= 0) continue;
    const ratio = keepValueToClub(player, ctx) / market;
    eligible.push({ ratio, ovr: player.ovr });
    if (!best || player.ovr > best.ovr) best = { ratio, ovr: player.ovr };
  }
  if (best) bestEligible.push(best.ratio);
}

const pct = (xs: number[], p: number): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};
const share = (xs: number[], t: number): string =>
  `${((xs.filter((r) => r <= t).length / xs.length) * 100).toFixed(1)}%`;

const ratios = eligible.map((e) => e.ratio);
console.log(`season ${league.season}, LOAN_AVAILABILITY = ${LOAN_AVAILABILITY}\n`);
console.log(`loan-eligible players (outside XI, age <= ${LOAN_AI_MAX_AGE})  n=${ratios.length}`);
console.log(`  reservation/market   p10 ${pct(ratios, 10).toFixed(2)}  median ${pct(ratios, 50).toFixed(2)}  p90 ${pct(ratios, 90).toFixed(2)}`);
console.log(`  PASSES the screen (loanable): ${share(ratios, LOAN_AVAILABILITY)}`);
console.log(`\nbest loan-eligible player at each club  n=${bestEligible.length}`);
console.log(`  reservation/market   p10 ${pct(bestEligible, 10).toFixed(2)}  median ${pct(bestEligible, 50).toFixed(2)}  p90 ${pct(bestEligible, 90).toFixed(2)}`);
console.log(`  PASSES the screen (loanable): ${share(bestEligible, LOAN_AVAILABILITY)}`);
console.log(
  `\nCompare the transfer-market bug: there, 0.0% of clubs' best players could ever be offered.\n` +
  `A high pass rate here means the screen is inert on this population and the bug does not reproduce.`,
);
