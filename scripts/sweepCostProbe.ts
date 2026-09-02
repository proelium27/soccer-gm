/**
 * Does the ceiling sweep ratchet wages onto the top flights of poor countries?
 *
 * `enforceDivisionCeilings` is a FORCED buy: it moves any player above his
 * tier's ceiling up a division whether the receiving club wants him or not. The
 * FEE is capped at what the buyer can pay ("never pushes the buyer's budget
 * negative"), but the arriving player's WAGES are not capped by anything. A
 * three-tier pyramid runs two sweep passes instead of one, and the top pass
 * draws on a second division that is itself replenished from below — so the
 * hypothesis is that weak-country tier-1 clubs absorb more forced wage
 * liability than they used to and eventually cannot carry it.
 *
 * Measures, per season, for the poorest countries' TOP FLIGHTS:
 *   - total wage bill against total income (financeScale x BASE_SEASON_BUDGET),
 *     which is the ratio that would climb if wages are ratcheting;
 *   - arrivals from a LOWER division of the same country, which is what the
 *     sweep does and almost nothing else does.
 *
 * Run the same command on both worlds and compare. One seed is enough to kill
 * or support the hypothesis — a ratchet is a trend, not a tail.
 *
 *   SEASONS=15 SEEDS=1 npx tsx scripts/sweepCostProbe.ts
 */
import { mulberry32 } from "../src/engine/rng.js";
import { createLeagueState, type LeagueStore } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { simOffseason } from "../src/core/offseason.js";
import { competitionOf, divisionsOf } from "../src/core/competitions.js";
import { financeScale } from "../src/core/finance/budget.js";
import { BASE_SEASON_BUDGET } from "../src/core/constants.js";

const SEASONS = Number(process.env.SEASONS ?? 15);
const SEEDS = (process.env.SEEDS ?? "1").split(",").map(Number);
const POOR = (process.env.POOR ?? "Scotland,Serbia,Greece").split(",");
const USER_TID = 0;

function playSeason(league: LeagueStore, rng: () => number): LeagueStore {
  let out = simThrough(league, "season", rng);
  for (let i = 0; (out.phase as string) !== "offseason"; i++) {
    if (i >= 3) throw new Error("season refuses to finish");
    out = simThrough(out, "season", rng);
  }
  return out;
}

for (const seed of SEEDS) {
  const rng = mulberry32(seed);
  let league = createLeagueState(USER_TID, rng);
  const worldClubs = league.teams.length;
  console.log(`\n=== seed ${seed} — ${worldClubs} clubs, top flights of ${POOR.join("/")} ===`);
  console.log("season  wageBill  income  ratio   upFromBelow  cumUp");

  let seenTransfers = 0;
  let cumUp = 0;

  for (let s = 1; s <= SEASONS; s++) {
    const before = league.transfers.length;
    league = playSeason(league, rng);
    league = simOffseason(league, rng);

    const tierOf = new Map(league.teams.map((t) => [t.tid, competitionOf(league.competitions, t.compId).tier]));
    const countryOf = new Map(league.teams.map((t) => [t.tid, competitionOf(league.competitions, t.compId).country]));

    // Arrivals at a poor country's top flight from a LOWER division of the same
    // country. The ceiling sweep is essentially the only thing that does this.
    let up = 0;
    for (const tr of league.transfers.slice(before)) {
      const toTier = tierOf.get(tr.toTid);
      const fromTier = tierOf.get(tr.fromTid);
      if (toTier !== 1 || fromTier === undefined || fromTier <= 1) continue;
      if (countryOf.get(tr.toTid) !== countryOf.get(tr.fromTid)) continue;
      if (!POOR.includes(countryOf.get(tr.toTid)!)) continue;
      up++;
    }
    cumUp += up;
    seenTransfers = league.transfers.length;

    const salary = new Map(league.players.map((p) => [p.pid, p.contract.salary]));
    let wage = 0;
    let income = 0;
    for (const t of league.teams) {
      if (t.tid === USER_TID) continue;
      const comp = competitionOf(league.competitions, t.compId);
      if (comp.tier !== 1 || !POOR.includes(comp.country)) continue;
      wage += t.roster.reduce((sum, pid) => sum + (salary.get(pid) ?? 0), 0);
      income += BASE_SEASON_BUDGET * financeScale(league.competitions, t.compId);
    }
    console.log(
      `  ${String(s).padStart(4)}  ${(wage / 1e6).toFixed(1).padStart(7)}M ` +
      `${(income / 1e6).toFixed(1).padStart(7)}M  ${(wage / income).toFixed(3)}  ` +
      `${String(up).padStart(10)}  ${String(cumUp).padStart(5)}`,
    );
  }
  void seenTransfers;
  const chains = divisionsOf(league.competitions, POOR[0]).length;
  console.log(`  (${POOR[0]} runs ${chains} divisions)`);
}
