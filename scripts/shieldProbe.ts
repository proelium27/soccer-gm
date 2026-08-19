/**
 * End-to-end check that the Continental Shield runs alongside the Continental
 * Cup on a real simmed world.
 *
 * Both competitions are seeded at the same offseason, play on the same
 * matchdays and are archived together, so the things worth verifying are the
 * ones that only show up once they run side by side:
 *   - the two fields never share a club (that is what makes sharing the
 *     calendar safe — see CUP_FORMATS)
 *   - each qualifies from its own slice of the league tables
 *   - both complete, with different champions and their own prize scales
 *   - the Shield's results are its own, not a replay of the Cup's streams
 *
 * Run: npx tsx scripts/shieldProbe.ts [seed] [seasons]
 */
import { createLeagueState } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { simOffseason } from "../src/core/offseason.js";
import { mulberry32 } from "../src/engine/rng.js";
import type { CupState } from "../src/core/cup/types.js";
import type { LeagueStore } from "../src/core/leagueState.js";

const seed = Number(process.argv[2] ?? 7);
const seasons = Number(process.argv[3] ?? 3);

const rng = mulberry32(seed);
let league = createLeagueState(0, rng);

const nameOf = (l: LeagueStore, tid: number): string =>
  l.teams.find((t) => t.tid === tid)?.name ?? `Team ${tid}`;
const compNameOf = (l: LeagueStore, tid: number): string => {
  const team = l.teams.find((t) => t.tid === tid);
  const comp = l.competitions.find((c) => c.id === team?.compId);
  return comp ? `${comp.country} T${comp.tier}` : "?";
};

/** Every club that took part, whatever stage it reached. */
const fieldOf = (cup: CupState): number[] =>
  cup.leaguePhase ? cup.leaguePhase.teams : cup.teams.filter((t) => t >= 0);

for (let s = 1; s <= seasons; s++) {
  // Where each club finished, captured before the offseason wipes the season.
  const beforeSim = league;
  league = simThrough(league, "season", rng);

  const cup = league.cup;
  const shield = league.shield;
  console.log(`\n=== season ${beforeSim.season} ===`);

  if (!cup && !shield) {
    console.log("  no continental competitions this season (season 1 has no prior tables)");
  } else {
    const cupField = cup ? fieldOf(cup) : [];
    const shieldField = shield ? fieldOf(shield) : [];
    const overlap = shieldField.filter((t) => cupField.includes(t));
    console.log(`  Cup field ${cupField.length}, Shield field ${shieldField.length}, shared clubs ${overlap.length}`);
    if (overlap.length > 0) {
      console.log(`  !! OVERLAP: ${overlap.map((t) => nameOf(league, t)).join(", ")}`);
      process.exitCode = 1;
    }

    // Which finishing places each competition actually drew from, per league.
    // Both were seeded from the *previous* season's final tables, which the
    // offseason snapshotted onto seasonHistory (one combined table, labelled by
    // that season's compsByTid).
    const prevTables = new Map<number, number[]>();
    const prev = beforeSim.seasonHistory.find((h) => h.season === beforeSim.season - 1);
    if (prev) {
      for (const row of prev.table) {
        const compId = prev.compsByTid[row.tid];
        if (compId === undefined) continue;
        const order = prevTables.get(compId) ?? [];
        order.push(row.tid);
        prevTables.set(compId, order);
      }
    }
    const placesOf = (field: number[]): string => {
      const places: number[] = [];
      for (const tid of field) {
        for (const order of prevTables.values()) {
          const i = order.indexOf(tid);
          if (i >= 0) places.push(i + 1);
        }
      }
      return [...new Set(places)].sort((a, b) => a - b).join(",");
    };
    if (cup) console.log(`  Cup qualified from places:    ${placesOf(cupField)}`);
    if (shield) console.log(`  Shield qualified from places: ${placesOf(shieldField)}`);

    for (const [label, c] of [["Cup", cup], ["Shield", shield]] as const) {
      if (!c) continue;
      const champ = c.championTid;
      console.log(
        `  ${label}: ${c.ties.length} knockout ties, champion ` +
        (champ === null ? "(unfinished)" : `${nameOf(league, champ)} (${compNameOf(league, champ)})`),
      );
    }
    if (cup?.championTid != null && shield?.championTid != null) {
      console.log(`  distinct champions: ${cup.championTid !== shield.championTid}`);
    }
    // Same-season, same-matchday competitions on shared rng streams would
    // produce suspiciously matched scorelines; these should not line up.
    if (cup && shield) {
      const line = (c: CupState) =>
        c.ties.map((t) => `${t.homeGoals}-${t.awayGoals}`).join(" ");
      console.log(`  Cup KO scorelines:    ${line(cup)}`);
      console.log(`  Shield KO scorelines: ${line(shield)}`);
      if (line(cup) === line(shield) && cup.ties.length > 0) {
        console.log("  !! identical scoreline sequence — the two are sharing an rng stream");
        process.exitCode = 1;
      }
    }
  }

  league = simOffseason(league, rng);
}

console.log(
  `\narchived: ${league.cupHistory.length} cups, ${league.shieldHistory.length} shields`,
);
for (const c of league.shieldHistory) {
  console.log(
    `  shield ${c.season}: champion ${nameOf(league, c.championTid ?? -1)}, ` +
    `${c.statLines?.length ?? 0} stat lines, box scores dropped: ` +
    `${c.ties.every((t) => t.boxScore === null)}`,
  );
}
