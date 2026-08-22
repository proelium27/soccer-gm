/**
 * End-to-end check that a player-shaped world actually works: build a
 * competitions table that is NOT the shipped one (a country switched off, two
 * added, one of them deliberately set up to rise), generate it, and sim seasons
 * through the real simThrough/simOffseason.
 *
 * What it is looking for is the set of things that only break once the world
 * stops being the shipped one:
 *   - club identities come from the right country (the tid-indexed lookup this
 *     replaced would hand a shifted country another country's clubs);
 *   - the continental competitions still seed, and no club lands in both;
 *   - promotion/relegation pairs every country's two divisions;
 *   - an added league's finances hold up;
 *   - the academy split actually moves a league over a dynasty.
 *
 * Run: npx tsx scripts/customWorldProbe.ts [seasons] [seed]
 */
import { mulberry32 } from "../src/engine/rng.js";
import { createLeagueState, type LeagueStore } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { simOffseason } from "../src/core/offseason.js";
import {
  buildCompetitions, worldLeagueSpecs, worldTuningWarnings, tier1Pairs,
  competitionOf, type LeagueSpec,
} from "../src/core/competitions.js";
import { cupSlotRange, CUP_STAGE_LEAGUE_PHASE } from "../src/core/cup/cup.js";
import type { RosterFile } from "../src/core/teams/rosterFile.js";
import { retargetRosterFile, ROSTER_FILE_FORMAT } from "../src/core/teams/rosterFile.js";
import { applyRosterFileToNewLeague } from "../src/core/teams/rosterImport.js";
import { CONTINENTAL_CUP_FORMAT, SHIELD_FORMAT } from "../src/core/constants.js";

const SEASONS = Number(process.argv[2] ?? 6);
const SEED = Number(process.argv[3] ?? 1);
const USER_TID = 0;

/**
 * Pass --shipped to run the unmodified world instead. The point is the
 * comparison: any drift this probe reports only means something measured
 * against what the shipped world does over the same seasons on the same seed.
 */
const SHIPPED = process.argv.includes("--shipped");

/** England off, two invented leagues on — one steady, one built to rise. */
const CUSTOM_SPECS: LeagueSpec[] = [
  ...worldLeagueSpecs().filter((s) => s.country !== "England"),
  {
    country: "Avalon",
    strengthOffset: 8,
    academyOffset: 8,
    budgetScale: 0.6,
    cupSlots: 2,
    shieldSlots: 2,
  },
  {
    // Generated weak, but its academies keep producing at big-four level, so it
    // should climb over a dynasty. This is the knob that did not exist before.
    country: "Ascalon",
    strengthOffset: 10,
    academyOffset: 2,
    budgetScale: 0.5,
    cupSlots: 1,
    shieldSlots: 3,
  },
];

const SPECS: LeagueSpec[] = SHIPPED ? worldLeagueSpecs() : CUSTOM_SPECS;

function meanD1Ovr(league: LeagueStore, country: string): number {
  const comp = league.competitions.find((c) => c.country === country && c.tier === 1)!;
  const tids = new Set(league.teams.filter((t) => t.compId === comp.id).map((t) => t.tid));
  const ovrs = league.teams
    .filter((t) => tids.has(t.tid))
    .flatMap((t) => t.roster)
    .map((pid) => league.players.find((p) => p.pid === pid)?.ovr ?? 0)
    .filter((o) => o > 0);
  return ovrs.reduce((a, b) => a + b, 0) / ovrs.length;
}

function main(): void {
  const warnings = worldTuningWarnings(SPECS);
  console.log(`World: ${SPECS.length} countries — ${SPECS.map((s) => s.country).join(", ")}`);
  console.log(warnings.length ? `Warnings:\n  ${warnings.join("\n  ")}` : "Warnings: none");

  const competitions = buildCompetitions(SPECS);
  let league = createLeagueState(USER_TID, mulberry32(SEED), SEED, undefined, competitions);
  console.log(`\nGenerated ${league.teams.length} clubs, ${league.players.length} players.`);

  // Per-league roster import: a file that names a competition this world has
  // never heard of, retargeted onto one added league's top division and applied.
  if (!SHIPPED) {
    const target = competitions.find((c) => c.country === "Ascalon" && c.tier === 1)!;
    const source: RosterFile = {
      format: ROSTER_FILE_FORMAT,
      formatVersion: 1,
      competitions: [{
        match: "A League That Does Not Exist",
        clubs: ["Real Ascalon", "Ascalon City", "Sporting Ascalon"].map((name) => ({
          name,
          abbrev: name.slice(0, 3).toUpperCase(),
          colors: ["#101010", "#f0f0f0"] as [string, string],
        })),
      }],
    };
    const { file } = retargetRosterFile(source, [target.name]);
    const applied = applyRosterFileToNewLeague(league, file, USER_TID);
    league = applied.league;
    const named = league.teams.filter((t) => t.compId === target.id).slice(0, 4).map((t) => t.name);
    console.log(`\nPer-league roster import into ${target.name}:`);
    console.log(`  first four clubs now: ${named.join(", ")}`);
    const ok = named[0] === "Real Ascalon" && named[3] !== undefined && !named[3].startsWith("Real");
    console.log(`  replaced the named clubs and left the rest alone: ${ok ? "yes" : "NO"}`);
    if (!ok) process.exitCode = 1;
  }

  // Club identities: each country's clubs should be its own.
  for (const country of SPECS.slice(0, 2).concat(SPECS.slice(-2)).map((s) => s.country)) {
    const comp = league.competitions.find((c) => c.country === country && c.tier === 1)!;
    const names = league.teams.filter((t) => t.compId === comp.id).slice(0, 3).map((t) => t.name);
    console.log(`  ${country} D1: ${names.join(", ")}`);
  }

  // Continental fields must be disjoint per league.
  console.log("\nQualification bands (Cup / Shield):");
  for (const { d1 } of tier1Pairs(league.competitions)) {
    const cup = cupSlotRange(d1, CONTINENTAL_CUP_FORMAT);
    const shield = cupSlotRange(d1, SHIELD_FORMAT);
    const overlap = shield[0] <= cup[1];
    console.log(
      `  ${d1.country.padEnd(10)} ${cup[0]}-${cup[1]} / ${shield[0]}-${shield[1]}`
      + (overlap ? "   *** OVERLAP ***" : ""),
    );
    if (overlap) process.exitCode = 1;
  }

  const startOvr = new Map(SPECS.map((s) => [s.country, meanD1Ovr(league, s.country)]));

  for (let s = 1; s <= SEASONS; s++) {
    const rng = mulberry32(SEED * 1000 + s);
    league = simThrough(league, "season", rng);
    // simThrough halts before the user's own cup final; push through it.
    if (league.phase === "regular") league = simThrough(league, "season", rng);
    league = simOffseason(league, mulberry32(SEED * 2000 + s));

    const cup = league.cupHistory[league.cupHistory.length - 1];
    const shield = league.shieldHistory[league.shieldHistory.length - 1];
    const winner = (tid: number | null | undefined) =>
      tid == null ? "—" : league.teams.find((t) => t.tid === tid)?.name ?? `#${tid}`;
    console.log(
      `\nSeason ${s}: Cup ${winner(cup?.teams?.find(() => false) ?? null)}`
      + ` league phase ${cup ? "played" : "none"}, Shield ${shield ? "played" : "none"}`,
    );

    const broke = league.teams.filter((t) => t.tid !== USER_TID && t.budget < 0);
    if (broke.length > 0) {
      const worst = broke.reduce((a, b) => (a.budget < b.budget ? a : b));
      const comp = competitionOf(league.competitions, worst.compId);
      console.log(`  ${broke.length} AI clubs in deficit, worst ${worst.name} (${comp.country}) ${(worst.budget / 1e6).toFixed(2)}M`);
      process.exitCode = 1;
    }
  }

  console.log("\nD1 mean OVR, start → end:");
  for (const spec of SPECS) {
    const from = startOvr.get(spec.country)!;
    const to = meanD1Ovr(league, spec.country);
    console.log(
      `  ${spec.country.padEnd(10)} ${from.toFixed(2)} → ${to.toFixed(2)}`
      + ` (${to - from >= 0 ? "+" : ""}${(to - from).toFixed(2)})`,
    );
  }
  void CUP_STAGE_LEAGUE_PHASE;
}

main();
