/**
 * Does division SIZE alone move a league's strength over a dynasty?
 *
 * The 12-country world put Scotland (12 clubs, generated second-weakest) top of
 * the world's tier-1 mean OVR after 20 seasons, on both audited seeds. Division
 * size was the only thing that changed, but the shipped world confounds it with
 * strength offset, budget scale, promotion spots and nationality, so it cannot
 * say whether size is the cause.
 *
 * This is the controlled version: several countries IDENTICAL in every tunable
 * except how many clubs they field. Any spread that opens up is size, and
 * nothing else.
 *
 *   SEASONS=15 SEED=1 npx tsx scripts/divisionSizeProbe.ts
 */
import { mulberry32 } from "../src/engine/rng.js";
import { createLeagueState, type LeagueStore } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { simOffseason } from "../src/core/offseason.js";
import { buildCompetitions, competitionOf } from "../src/core/competitions.js";
import { SEASON_MATCHDAYS } from "../src/core/calendar.js";

const SEASONS = Number(process.env.SEASONS ?? 15);
const SEED = Number(process.env.SEED ?? 1);
const SIZES = (process.env.SIZES ?? "12,16,20").split(",").map(Number);

// Same strength, same money, same promotion, same nationality table. Only the
// club count differs. Country count kept even so both continental fields stay
// buildable (see competitions.ts).
const specs = SIZES.flatMap((n) => [
  { country: `Size${n}`, d1Teams: n, d2Teams: n, strengthOffset: 8, budgetScale: 0.6,
    promotionSpots: 2, abbrev: `S${n}` },
  { country: `Twin${n}`, d1Teams: n, d2Teams: n, strengthOffset: 8, budgetScale: 0.6,
    promotionSpots: 2, abbrev: `T${n}` },
]);
const competitions = buildCompetitions(specs);

interface Row { ovr: number; roster: number; budget: number; top: number; weak: number }
function ladder(league: LeagueStore): Map<string, Row> {
  const acc = new Map<string, Row & { n: number }>();
  for (const team of league.teams) {
    if (team.tid === league.meta.userTid) continue;
    const comp = competitionOf(league.competitions, team.compId);
    if (comp.tier !== 1) continue;
    const roster = league.players.filter((p) => team.roster.includes(p.pid));
    if (roster.length === 0) continue;
    const cur = acc.get(comp.country)
      ?? { n: 0, ovr: 0, roster: 0, budget: 0, top: 0, weak: 0 };
    const sorted = [...roster].sort((a, b) => b.ovr - a.ovr);
    acc.set(comp.country, {
      n: cur.n + 1,
      ovr: cur.ovr + roster.reduce((a, p) => a + p.ovr, 0) / roster.length,
      // The XI, so "are the good players good" is separable from "how much
      // filler is on the books" — a mean over the whole roster conflates them.
      top: cur.top + sorted.slice(0, 11).reduce((a, p) => a + p.ovr, 0) / 11,
      weak: cur.weak + roster.filter((p) => p.ovr < 40).length,
      roster: cur.roster + roster.length,
      budget: cur.budget + team.budget,
    });
  }
  return new Map([...acc].map(([k, v]) => [k, {
    ovr: v.ovr / v.n, roster: v.roster / v.n, budget: v.budget / v.n,
    top: v.top / v.n, weak: v.weak / v.n,
  }]));
}

const rng = mulberry32(SEED);
let league = createLeagueState(0, rng, SEED, "normal", competitions);
const gen = ladder(league);

for (let s = 0; s < SEASONS; s++) {
  league = simThrough(league, { matchday: SEASON_MATCHDAYS }, rng);
  league = simOffseason(league, rng);
}
const end = ladder(league);

console.log(`seed ${SEED}, ${SEASONS} seasons, ${competitions.length} competitions`);
console.log("\n  league     clubs  gen ovr  end ovr   drift  XI gen  XI end  XIdrift  roster  <40  budget");
for (const [country, v] of [...end].sort((a, b) => b[1].ovr - a[1].ovr)) {
  const n = competitionOf(competitions,
    competitions.find((c) => c.country === country && c.tier === 1)!.id).teamCount ?? 20;
  const g = gen.get(country)!;
  const sign = (x: number) => (x >= 0 ? "+" : "") + x.toFixed(2);
  console.log(
    `  ${country.padEnd(10)} ${String(n).padStart(3)}  ${g.ovr.toFixed(2).padStart(7)}` +
    `  ${v.ovr.toFixed(2).padStart(7)}  ${sign(v.ovr - g.ovr).padStart(6)}` +
    `  ${g.top.toFixed(2).padStart(6)}  ${v.top.toFixed(2).padStart(6)}   ${sign(v.top - g.top).padStart(6)}` +
    `  ${v.roster.toFixed(1).padStart(5)} ${v.weak.toFixed(1).padStart(4)}  £${(v.budget / 1e6).toFixed(0).padStart(4)}M`,
  );
}
