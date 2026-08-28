/**
 * Dynasty audit for country coefficients: do the Continental Cup's places move
 * on merit, and do they move *sanely*?
 *
 * `weakLeaguesAudit.ts` is the formal gate for the strength ladder and for AI
 * solvency, and it should be run alongside this. What it cannot show is the
 * dynamic this feature introduces, which is a feedback loop: places won →
 * more continental prize money → stronger clubs → more places. The failure to
 * look for is therefore not "the numbers moved" but a RATCHET — one country
 * accumulating places it can no longer lose, or a country falling to the floor
 * and never recovering.
 *
 * So this prints, per season, every country's coefficient and Cup places, and
 * summarises:
 *   - places held at the end vs at generation (who gained, who lost)
 *   - how many times places changed hands at all (a ladder that never moves is
 *     as much a failure as one that thrashes — the feature would be inert)
 *   - the number of countries stuck at the floor
 *   - each country's D1 mean OVR and poorest AI club budget, so a place loss
 *     can be read against what it did to that league
 *
 * The total is asserted every season: the reallocation is zero-sum, so a world
 * that starts sending 24 clubs must send 24 forever. A drift there is a bug,
 * and a bug that would otherwise surface much later inside the league-phase
 * draw.
 *
 * The user's club (tid 0) is excluded from budget minima — an unmanaged club
 * rots in a headless sim and sets every worst case (see CLAUDE.md).
 *
 * Run: npx tsx scripts/coefficientAudit.ts
 *      SEASONS=20 SEEDS=1,2 npx tsx scripts/coefficientAudit.ts
 */
import { mulberry32 } from "../src/engine/rng.js";
import { createLeagueState, type LeagueStore } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { simOffseason } from "../src/core/offseason.js";
import { competitionOf } from "../src/core/competitions.js";
import { countryCoefficients, reallocateCupSlots } from "../src/core/cup/coefficients.js";
import { cupSlotsForCompetition } from "../src/core/cup/qualification.js";
import {
  CONTINENTAL_CUP_FORMAT, COEFFICIENT_MIN_CUP_SLOTS, CUP_LEAGUE_PHASE_SIZE,
} from "../src/core/constants.js";

const SEASONS = Number(process.env.SEASONS ?? 20);
const SEEDS = (process.env.SEEDS ?? "1,2").split(",").map(Number).filter(Number.isFinite);

interface SeedResult {
  seed: number;
  changes: number;
  atFloor: string[];
  gained: string[];
  lost: string[];
  problems: string[];
}

function slotsNow(league: LeagueStore, season: number): Map<string, number> {
  const live = [league.cup, league.shield].filter(
    (c): c is NonNullable<typeof c> => !!c && c.championTid !== null,
  );
  const coeffs = countryCoefficients(
    league.competitions, league.teams,
    [league.cupHistory ?? [], league.shieldHistory ?? [], live], season,
  );
  const byComp = reallocateCupSlots(league.competitions, coeffs);
  const out = new Map<string, number>();
  for (const comp of league.competitions.filter((c) => c.tier === 1)) {
    out.set(
      comp.country,
      byComp?.get(comp.id) ?? cupSlotsForCompetition(comp, CONTINENTAL_CUP_FORMAT),
    );
  }
  return out;
}

/** D1 mean OVR per country, excluding the user's club. */
function ladder(league: LeagueStore): Map<string, number> {
  const sums = new Map<string, { n: number; total: number }>();
  for (const team of league.teams) {
    if (team.tid === league.meta.userTid) continue;
    const comp = competitionOf(league.competitions, team.compId);
    if (comp.tier !== 1) continue;
    const roster = league.players.filter((p) => team.roster.includes(p.pid));
    if (roster.length === 0) continue;
    const mean = roster.reduce((a, p) => a + p.ovr, 0) / roster.length;
    const cur = sums.get(comp.country) ?? { n: 0, total: 0 };
    sums.set(comp.country, { n: cur.n + 1, total: cur.total + mean });
  }
  return new Map([...sums].map(([k, v]) => [k, v.total / v.n]));
}

/** Poorest non-user AI club budget per country. */
function poorest(league: LeagueStore): Map<string, number> {
  const out = new Map<string, number>();
  for (const team of league.teams) {
    if (team.tid === league.meta.userTid) continue;
    const comp = competitionOf(league.competitions, team.compId);
    const cur = out.get(comp.country);
    if (cur === undefined || team.budget < cur) out.set(comp.country, team.budget);
  }
  return out;
}

const results: SeedResult[] = [];

for (const seed of SEEDS) {
  console.log(`\n=== seed ${seed} ===`);
  const rng = mulberry32(seed);
  let league = createLeagueState(0, rng);
  const countries = [...new Set(league.competitions.filter((c) => c.tier === 1).map((c) => c.country))];
  const initial = slotsNow(league, league.season);
  let previous = initial;
  let changes = 0;
  const problems: string[] = [];

  for (let s = 0; s < SEASONS; s++) {
    league = simThrough(league, "season", rng);
    league = simOffseason(league, rng);

    const slots = slotsNow(league, league.season);
    const total = [...slots.values()].reduce((a, b) => a + b, 0);
    if (total !== CUP_LEAGUE_PHASE_SIZE) {
      problems.push(`season ${league.season}: slots total ${total}, expected ${CUP_LEAGUE_PHASE_SIZE}`);
    }
    for (const c of countries) if (slots.get(c) !== previous.get(c)) { changes++; break; }

    const coeffs = countryCoefficients(
      league.competitions, league.teams,
      [league.cupHistory ?? [], league.shieldHistory ?? [], []], league.season,
    );
    const line = coeffs
      .map((c) => `${c.country.slice(0, 3)} ${c.coefficient.toFixed(2)}/${slots.get(c.country)}`)
      .join("  ");
    console.log(`s${String(league.season).padStart(3)} total ${total}  ${line}`);
    previous = slots;
  }

  const finalLadder = ladder(league);
  const finalPoorest = poorest(league);
  console.log("\n  country      places  (was)   D1 ovr   poorest AI club");
  for (const c of countries) {
    const now = previous.get(c) ?? 0;
    const was = initial.get(c) ?? 0;
    console.log(
      `  ${c.padEnd(12)} ${String(now).padStart(2)}     (${was})    `
      + `${(finalLadder.get(c) ?? 0).toFixed(1)}     £${((finalPoorest.get(c) ?? 0) / 1e6).toFixed(1)}M`,
    );
    if ((finalPoorest.get(c) ?? 0) < 0) problems.push(`${c}: an AI club is in deficit`);
  }

  results.push({
    seed,
    changes,
    atFloor: countries.filter((c) => (previous.get(c) ?? 0) <= COEFFICIENT_MIN_CUP_SLOTS),
    gained: countries.filter((c) => (previous.get(c) ?? 0) > (initial.get(c) ?? 0)),
    lost: countries.filter((c) => (previous.get(c) ?? 0) < (initial.get(c) ?? 0)),
    problems,
  });
}

console.log("\n=== summary ===");
for (const r of results) {
  console.log(
    `seed ${r.seed}: seasons where places moved ${r.changes}/${SEASONS} | `
    + `gained [${r.gained.join(", ")}] | lost [${r.lost.join(", ")}] | at floor [${r.atFloor.join(", ")}]`,
  );
  for (const p of r.problems) console.log(`  PROBLEM ${p}`);
}

const anyProblem = results.some((r) => r.problems.length > 0);
const everMoved = results.some((r) => r.changes > 0);
if (!everMoved) console.log("\nWARNING: places never moved on any seed — the coefficient is inert.");
console.log(anyProblem ? "\nFAIL" : "\nOK");
process.exit(anyProblem ? 1 : 0);
