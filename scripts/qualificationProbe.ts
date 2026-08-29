/**
 * Continental qualification probe: does a real dynasty actually use the routes?
 *
 * The unit tests drive `allocateContinentalPlaces` with synthetic tables, which
 * proves the rule but not that the game ever exercises it. This sims seasons and
 * reports, per season:
 *
 *   - field sizes (must stay exactly 24 / 16 — the league-phase draw only
 *     accepts certain sizes, so a route that grew a field would throw)
 *   - overlap between the two fields (must always be 0)
 *   - how many clubs got in by each route, and how far down the table they came
 *
 * The number worth watching is how often the domestic cup route actually FIRES.
 * Most cup winners qualify through their league anyway, in which case the place
 * passes back down the table and nothing changes. A season where the route never
 * fires is normal; a dynasty where it never fires means something is wrong.
 *
 * Run: npx tsx scripts/qualificationProbe.ts   (SEASONS=6 SEED=1 to vary)
 */
import { mulberry32 } from "../src/engine/rng.js";
import { createLeagueState } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { simOffseason } from "../src/core/offseason.js";
import { competitionOf } from "../src/core/competitions.js";
import { seasonQualification } from "../src/core/cup/seasonQualification.js";
import { CUP_LEAGUE_PHASE_SIZE, SHIELD_LEAGUE_PHASE_SIZE } from "../src/core/constants.js";

const SEASONS = Number(process.env.SEASONS ?? 6);
const SEED = Number(process.env.SEED ?? 1);

const rng = mulberry32(SEED);
let league = createLeagueState(0, rng);

let routeTotals = { table: 0, "domestic-cup": 0, holder: 0 };
let problems = 0;

for (let s = 0; s < SEASONS; s++) {
  league = simThrough(league, "season", rng);

  // The projection the Standings page shades, taken at the moment the season
  // ends — i.e. exactly the allocation the offseason is about to apply.
  const projected = seasonQualification(league, "current");
  const counts = { table: 0, "domestic-cup": 0, holder: 0 };
  const oddPlaces: string[] = [];
  for (const [tid, place] of projected.byTid) {
    counts[place.route]++;
    routeTotals[place.route]++;
    if (place.route !== "table") {
      const team = league.teams.find((t) => t.tid === tid)!;
      const comp = competitionOf(league.competitions, team.compId);
      oddPlaces.push(`${team.name} (${comp.country} t${comp.tier}) → ${place.competition} as ${place.route}`);
    }
  }

  const cupWinners = (league.domesticCups ?? []).filter((c) => c.championTid !== null).length;
  league = simOffseason(league, rng);

  const cupField = league.cup?.leaguePhase?.teams ?? [];
  const shieldField = league.shield?.leaguePhase?.teams ?? [];
  const overlap = shieldField.filter((t) => cupField.includes(t)).length;
  const sizesOk = cupField.length === CUP_LEAGUE_PHASE_SIZE
    && shieldField.length === SHIELD_LEAGUE_PHASE_SIZE;
  // Season 1 has no continental competitions at all (they need a finished
  // table), so an empty field there is correct rather than a failure.
  const expectFields = s > 0;
  if (overlap > 0 || (expectFields && !sizesOk)) problems++;

  console.log(
    `season ${league.season - 1}: cup ${cupField.length} shield ${shieldField.length} `
    + `overlap ${overlap} | domestic cups decided ${cupWinners} | `
    + `routes table ${counts.table} cup ${counts["domestic-cup"]} holder ${counts.holder}`,
  );
  for (const line of oddPlaces) console.log(`    ${line}`);
}

console.log(`\ntotals over ${SEASONS} seasons (seed ${SEED}):`, routeTotals);
console.log(problems === 0
  ? "OK: every field the right size, never any overlap"
  : `FAIL: ${problems} season(s) with a bad field size or an overlap`);
