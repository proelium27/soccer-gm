/**
 * What does each point on the Strength slider actually produce?
 *
 * Builds ONE world whose countries are the same league repeated at every offset
 * from 0 to 20, so every rung is generated from the same rng pass and is
 * directly comparable, then reports what a player would actually see: the
 * division's mean OVR, its best and worst club, and its best player.
 *
 * Exists so the setting can be documented with measured reference points
 * ("strength 9 lands between France and Portugal, champion around X") instead of
 * extrapolating from the 0.94-OVR-per-point figure.
 *
 * Run: npx tsx scripts/strengthAnchorProbe.ts
 */
import { mulberry32 } from "../src/engine/rng.js";
import { generateWorld } from "../src/core/league/generate.js";
import { buildCompetitions, type LeagueSpec } from "../src/core/competitions.js";
import { computeTeamRating } from "../src/core/teams/teamRating.js";
import { NUM_TEAMS } from "../src/core/constants.js";

const OFFSETS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 18, 20];
const SEED = 7;

/** Which shipped league sits at this offset, if any. */
const SHIPPED: Record<number, string> = {
  0: "England / Spain / Italy / Germany",
  5: "France",
  10: "Portugal",
  11: "Belgium",
  12: "Turkey",
};

function main(): void {
  const specs: LeagueSpec[] = OFFSETS.map((offset) => ({
    country: `Rung${String(offset).padStart(2, "0")}`,
    strengthOffset: offset,
    academyOffset: offset,
  }));
  const competitions = buildCompetitions(specs);
  const world = generateWorld(mulberry32(SEED), SEED, competitions);
  const byPid = new Map(world.players.map((p) => [p.pid, p]));

  console.log(
    "off  meanOVR  bestClub  worstClub  bestPlayer  shipped",
  );
  for (const offset of OFFSETS) {
    const comp = competitions.find(
      (c) => c.country === `Rung${String(offset).padStart(2, "0")}` && c.tier === 1,
    )!;
    const teams = world.teams.filter((t) => t.compId === comp.id);
    if (teams.length !== NUM_TEAMS) throw new Error(`expected ${NUM_TEAMS} clubs`);

    const ratings = teams
      .map((t) => computeTeamRating(t.roster.map((pid) => byPid.get(pid)!), null).ovr)
      .sort((a, b) => b - a);
    const ovrs = teams.flatMap((t) => t.roster.map((pid) => byPid.get(pid)!.ovr));
    const mean = ovrs.reduce((a, b) => a + b, 0) / ovrs.length;

    console.log(
      String(offset).padStart(3)
      + mean.toFixed(1).padStart(9)
      + ratings[0].toFixed(1).padStart(10)
      + ratings[ratings.length - 1].toFixed(1).padStart(11)
      + Math.max(...ovrs).toFixed(0).padStart(12)
      + "  " + (SHIPPED[offset] ?? ""),
    );
  }
}

main();
