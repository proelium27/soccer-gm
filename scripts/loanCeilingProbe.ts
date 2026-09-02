/**
 * Can the loan market plant an illegal Division-2 resident?
 *
 * CLAUDE.md states the prevention guards as: "a tier-2 club never buys/bids-on/
 * **is-loaned** an over-threshold player". The buy paths do carry that guard
 * (transferMarket.ts, inboundOffers.ts). `loans.ts` does not — it never imports
 * DIVISION_2_REFUSAL_OVR_THRESHOLD at all.
 *
 * That would matter more than a normal leak, because `enforceDivisionCeilings`
 * cannot clean it up: the sweep deliberately skips loaned pids (moving one would
 * leave processLoanReturns handing a copy back to the parent, i.e. the same pid
 * on two rosters), so a loaned-in 70+ player sits in Division 2 untouchable for
 * the whole 1-3 season loan. CLAUDE.md separately records the ceiling leaking
 * ~23 over-threshold tier-2 players per season without attributing it.
 *
 * This counts, per season: active loans placing an at-or-over-threshold player
 * at a tier-2 club, and how much of the total over-threshold tier-2 population
 * they are. userTid is excluded throughout — a relegated user squad keeps its
 * 70+ players by design and would otherwise read as a breach every season.
 *
 *   npx tsx scripts/loanCeilingProbe.ts [seasons] [seed]
 */
import { createLeagueState } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { simOffseason } from "../src/core/offseason.js";
import { mulberry32 } from "../src/engine/rng.js";
import { tierOf } from "../src/core/competitions.js";
import { DIVISION_2_REFUSAL_OVR_THRESHOLD } from "../src/core/constants.js";

const SEASONS = Number(process.argv[2] ?? 12);
const SEED = Number(process.argv[3] ?? 1);

const rng = mulberry32(SEED);
let league = createLeagueState(0, rng);

console.log(`seed ${SEED}, threshold ovr ${DIVISION_2_REFUSAL_OVR_THRESHOLD}\n`);
console.log("season  loans  onLoanInD2>=thr   allD2>=thr   share   meanOvr  ovr65+");

let worstLoanBreach = 0;
const seasonMeanOvr: number[] = [];
const seasonUseful: number[] = [];
let totalLoanBreaches = 0;

for (let s = 1; s <= SEASONS; s++) {
  league = simThrough(league, "season", rng);
  league = simOffseason(league, rng);

  const byPid = new Map(league.players.map((p) => [p.pid, p]));
  const teamById = new Map(league.teams.map((t) => [t.tid, t]));
  const tierByTid = new Map(
    league.teams.map((t) => [t.tid, tierOf(league.competitions, t.compId)]),
  );

  // Over-threshold players sitting in tier 2 *because of a loan*.
  let loanBreaches = 0;
  for (const loan of league.activeLoans) {
    const p = byPid.get(loan.pid);
    if (!p || p.ovr < DIVISION_2_REFUSAL_OVR_THRESHOLD) continue;
    // Where is he actually playing? The loanee holds him on its roster.
    const host = [...league.teams].find((t) => t.roster.includes(loan.pid));
    if (!host || host.tid === league.meta.userTid) continue;
    if (tierByTid.get(host.tid) === 2) loanBreaches++;
  }

  // The whole over-threshold tier-2 population, for context.
  let allBreaches = 0;
  for (const team of league.teams) {
    if (team.tid === league.meta.userTid) continue;
    if (tierByTid.get(team.tid) !== 2) continue;
    for (const pid of team.roster) {
      const p = byPid.get(pid);
      if (p && p.ovr >= DIVISION_2_REFUSAL_OVR_THRESHOLD) allBreaches++;
    }
  }
  void teamById;

  // Loan volume is cap-bound (AI_LOAN_MAX_MOVES), not screen-bound, so removing
  // a candidate filter barely moves the count — it changes WHICH players move.
  // Quality is therefore the metric that shows whether a filter change did
  // anything useful, not the count.
  const loanOvrs = league.activeLoans
    .map((l) => byPid.get(l.pid)?.ovr)
    .filter((o): o is number => o !== undefined);
  const meanOvr = loanOvrs.length
    ? loanOvrs.reduce((a, b) => a + b, 0) / loanOvrs.length
    : 0;
  const useful = loanOvrs.filter((o) => o >= 65).length;
  seasonMeanOvr.push(meanOvr);
  seasonUseful.push(useful);

  worstLoanBreach = Math.max(worstLoanBreach, loanBreaches);
  totalLoanBreaches += loanBreaches;
  const share = allBreaches > 0 ? `${((loanBreaches / allBreaches) * 100).toFixed(0)}%` : "—";
  console.log(
    `${String(league.season).padStart(6)}  ${String(league.activeLoans.length).padStart(5)}` +
    `  ${String(loanBreaches).padStart(15)}  ${String(allBreaches).padStart(11)}  ${share.padStart(6)}` +
    `  ${meanOvr.toFixed(1).padStart(7)}  ${String(useful).padStart(6)}`,
  );
}

const avg = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
console.log(
  `\nloan-planted D2 breaches: worst season ${worstLoanBreach}, ${totalLoanBreaches} total over ${SEASONS} seasons.`,
);
console.log(
  `loaned-player quality across the run: mean ovr ${avg(seasonMeanOvr).toFixed(2)}, ` +
  `mean ovr-65+ loans per season ${avg(seasonUseful).toFixed(1)}`,
);
console.log(
  worstLoanBreach === 0
    ? "→ Zero. Expected WITH the tier-2 guard in runAILoanMarket's buyer loop; if you have\n" +
      "  removed that guard and still see zero, the path has become unreachable some other way."
    : "→ Reachable. The sweep cannot clean these up (it skips loaned pids), so each sits for\n" +
      "  the loan's full 1-3 seasons. Measured at 16 over 12 seasons before the guard existed,\n" +
      "  and they were 100% of all over-threshold tier-2 residents.",
);
