/** Minimum club budget at generation, and the season-start charge margin. */
import { mulberry32 } from "../src/engine/rng.js";
import { createLeagueState } from "../src/core/leagueState.js";
import { competitionOf } from "../src/core/competitions.js";
import { financeScale, wageBill, chargeSeasonStart } from "../src/core/finance/budget.js";

for (const seed of [1, 2]) {
  const league = createLeagueState(0, mulberry32(seed));
  const salaryMap = new Map(league.players.map((p) => [p.pid, p.contract.salary]));
  let minBudget = { v: Infinity, label: "" };
  let minMargin = { v: Infinity, label: "" };
  for (const t of league.teams) {
    const comp = competitionOf(league.competitions, t.compId);
    const label = `${comp.country} T${comp.tier} tid${t.tid}`;
    if (t.budget < minBudget.v) minBudget = { v: t.budget, label };
    const scale = financeScale(league.competitions, t.compId);
    const wages = wageBill([...t.roster, ...t.academyRoster], salaryMap);
    const margin = chargeSeasonStart(t.budget, wages, scale, t.hype);
    if (margin < minMargin.v) minMargin = { v: margin, label };
  }
  console.log(`seed ${seed}: min opening budget £${(minBudget.v / 1e6).toFixed(2)}M (${minBudget.label})`);
  console.log(`         min next-charge margin £${(minMargin.v / 1e6).toFixed(2)}M (${minMargin.label})`);
}
