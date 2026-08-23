/**
 * How large a World Cup field the world can actually fill.
 *
 * `INTL_FIELD_SIZE` is not a free knob: it is bounded by how many nationalities
 * have a deep enough player pool to field a squad (`isEligibleNation`), and
 * more importantly by how far down that list the nations stay worth watching.
 * This prints both, plus what a given field size does to qualifying — a
 * confederation with no more nations than places plays no qualifying matches at
 * all (see `initQualifying`), so a bigger field silently converts whole
 * confederations into automatic entry.
 *
 * Run it before moving `INTL_FIELD_SIZE` or `INTL_MIN_POOL`, and re-run it after
 * adding a league country (that is the lever that actually deepens the tail).
 *
 *   npx tsx scripts/intlFieldProbe.ts
 */
import { mulberry32 } from "../src/engine/rng.js";
import { createLeagueState } from "../src/core/leagueState.js";
import { buildSquads, nationPools, isEligibleNation } from "../src/core/international/squads.js";
import {
  groupByConfederation, allocateSlots, confederationOf,
} from "../src/core/international/confederations.js";
import { INTL_FIELD_SIZE, INTL_MIN_POOL } from "../src/core/constants.js";

/** Field sizes to report qualifying pressure for; the shipped one is always included. */
const FIELDS = [...new Set([16, INTL_FIELD_SIZE, 40])].sort((a, b) => a - b);
const SEEDS = [1, 2, 3];

for (const seed of SEEDS) {
  const league = createLeagueState(0, mulberry32(seed));
  const pools = nationPools(league.players);
  const squads = buildSquads(league.players);
  const ratings = squads.map((s) => s.rating);
  const at = (rank: number) => (ratings[rank - 1] !== undefined ? ratings[rank - 1].toFixed(1) : "—");

  console.log(`\n=== seed ${seed}: ${league.players.length} players, ${pools.size} nationalities present`);
  console.log(`eligible (pool >= ${INTL_MIN_POOL} + a GK + a confederation): ${squads.length}`);
  console.log(
    `squad rating by rank: #1 ${at(1)}  #16 ${at(16)}  #32 ${at(32)}  #40 ${at(40)}  #${squads.length} ${at(squads.length)}`,
  );

  // The nations just under the bar, to show what lowering INTL_MIN_POOL would buy.
  const nearMisses = [...pools.entries()]
    .filter(([nation, pool]) => confederationOf(nation) !== null && !isEligibleNation(nation, pool))
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 6)
    .map(([nation, pool]) => `${nation} ${pool.length}`);
  console.log(`nearest ineligible: ${nearMisses.join(", ")}`);

  // What each field size does to qualifying. A confederation allocated as many
  // places as it has nations sends them all and plays nothing.
  const byConfederation = groupByConfederation(squads.map((s) => s.nation));
  for (const field of FIELDS) {
    if (field > squads.length) {
      console.log(`  field ${field}: cannot be filled (only ${squads.length} eligible)`);
      continue;
    }
    const contenders = new Set(squads.slice(0, field).map((s) => s.nation));
    const slots = allocateSlots(byConfederation, field, contenders);
    let contested = 0;
    const parts: string[] = [];
    for (const [confederation, places] of slots) {
      const members = byConfederation.get(confederation)?.length ?? 0;
      const auto = places >= members;
      if (!auto) contested += members - places;
      parts.push(`${confederation} ${places}/${members}${auto ? " (auto)" : ""}`);
    }
    console.log(`  field ${field}: ${contested} of ${squads.length} nations can miss out — ${parts.join(", ")}`);
  }
}
