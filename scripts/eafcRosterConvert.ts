/**
 * Convert an EA FC player CSV into a soccer-gm roster file.
 *
 *   npx tsx scripts/eafcRosterConvert.ts --in players_25.csv --out eafc-roster.json
 *
 * Then load the result in-game via Leagues -> Import roster file. Nothing here
 * runs in the shipped build, and the generated file is gitignored: the game
 * continues to ship its own fictional clubs, and real names/ratings stay a
 * local overlay you bring yourself.
 *
 * See scripts/eafc/ for the pieces (column detection, position/league/nation
 * maps, attribute mapping, and the rank-matching rescale) and
 * docs/eafc-import.md for the workflow.
 */
import { parseArgs } from "node:util";
import { readFileSync, writeFileSync } from "node:fs";
import { convert, DEFAULT_OPTIONS, type ConvertOptions } from "./eafc/convert.js";
import type { IdentityOverrides } from "./eafc/identity.js";

const HELP = `
Convert an EA FC player CSV into a soccer-gm roster file.

Usage:
  npx tsx scripts/eafcRosterConvert.ts --in <players.csv> [options]

Options:
  --in <path>          Source CSV (required).
  --out <path>         Output roster file. Default: eafc-roster.json
  --squad-size <n>     Players kept per club. Default: ${DEFAULT_OPTIONS.squadSize}
                       (the game tops any short position up with weak filler).
  --spread <x>         Scales how far each player's skills sit from his own mean.
                       1 keeps EA's spikiness; below 1 makes imports blend in
                       with generated players. Default: ${DEFAULT_OPTIONS.spread}
  --scale <mode>       How EA overalls are mapped onto soccer-gm's band:
                         competition  each league is rank-matched onto its own
                                      soccer-gm counterpart. Preserves the game's
                                      designed country-strength gaps (France and
                                      Portugal are deliberately weaker) and keeps
                                      second-tier stars under the division-2
                                      ceiling. Default.
                         global       all twelve leagues are pooled and matched
                                      together, so real cross-league gaps carry
                                      over instead. More faithful, but strong
                                      second-tier players may then exceed the
                                      division-2 ceiling and get swept up to a
                                      top flight in the first offseason.
  --seed <n>           Seed for the reference world whose OVR distribution is
                       matched onto. Default: ${DEFAULT_OPTIONS.referenceSeed}
  --clubs <n>          Clubs per competition. Default: ${DEFAULT_OPTIONS.clubsPerCompetition}
  --identities <path>  JSON of per-club overrides, keyed by the club name as it
                       appears in the CSV:
                         { "Manchester City": { "abbrev": "MCI",
                                                "colors": ["#6CABDD", "#ffffff"] } }
                       Also accepts "name" to rename a club outright.
  --quiet              Only print the output path.
  --help               Show this.
`.trimStart();

function main(argv: string[]): void {
  const { values } = parseArgs({
    args: argv,
    options: {
      in: { type: "string" },
      out: { type: "string", default: "eafc-roster.json" },
      "squad-size": { type: "string" },
      spread: { type: "string" },
      scale: { type: "string" },
      seed: { type: "string" },
      clubs: { type: "string" },
      identities: { type: "string" },
      quiet: { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
  });

  if (values.help || !values.in) {
    console.log(HELP);
    if (!values.help) process.exitCode = 1;
    return;
  }

  const numOpt = (raw: string | undefined, name: string): number | undefined => {
    if (raw === undefined) return undefined;
    const v = Number(raw);
    if (!Number.isFinite(v)) throw new Error(`--${name} must be a number (got "${raw}")`);
    return v;
  };

  const scale = values.scale;
  if (scale !== undefined && scale !== "competition" && scale !== "global") {
    throw new Error(`--scale must be "competition" or "global" (got "${scale}")`);
  }

  let identityOverrides: IdentityOverrides = {};
  if (values.identities) {
    identityOverrides = JSON.parse(readFileSync(values.identities, "utf8")) as IdentityOverrides;
  }

  const opts: Partial<ConvertOptions> = {
    squadSize: numOpt(values["squad-size"], "squad-size"),
    spread: numOpt(values.spread, "spread"),
    scaleMode: scale,
    referenceSeed: numOpt(values.seed, "seed"),
    clubsPerCompetition: numOpt(values.clubs, "clubs"),
    identityOverrides,
  };
  // Drop undefineds so DEFAULT_OPTIONS wins for anything unset.
  for (const k of Object.keys(opts) as (keyof ConvertOptions)[]) {
    if (opts[k] === undefined) delete opts[k];
  }

  const csv = readFileSync(values.in, "utf8");
  const { file, report } = convert(csv, opts);
  writeFileSync(values.out!, JSON.stringify(file, null, 2) + "\n", "utf8");

  if (values.quiet) {
    console.log(values.out);
    return;
  }

  const { skipped } = report;
  console.log(`Read ${report.rowsRead} rows from ${values.in}`);
  console.log(
    `Skipped: ${skipped.unmappedLeague} outside the game's leagues, ` +
      `${skipped.unmappedPosition} unrecognised position, ` +
      `${skipped.missingOverall} no overall, ${skipped.missingName} no name, ` +
      `${skipped.missingClub} no club, ${skipped.unparseableAge} no age`,
  );

  if (report.missingColumns.length > 0) {
    console.log(
      `\nColumns not found (fell back to face stats or defaults): ${report.missingColumns.join(", ")}`,
    );
  }

  console.log("\ncompetition                clubs  players   EA->GM overall");
  for (const c of report.competitions) {
    const samples = c.scaleSamples.map((s) => `${s.ea}->${s.gm}`).join("  ");
    console.log(
      `${c.name.padEnd(24)} ${String(c.clubsUsed).padStart(5)} ${String(c.playersEmitted).padStart(8)}   ${samples}`,
    );
  }
  console.log(`\nWrote ${report.rowsKept} players to ${values.out}`);

  if (report.warnings.length > 0) {
    console.log("\nWarnings:");
    for (const w of report.warnings) console.log(`  - ${w}`);
  }
  if (report.unmappedLeagues.length > 0) {
    const top = report.unmappedLeagues.slice(0, 8);
    console.log(
      `\nLeagues in the CSV that map to nothing (expected — the datasets carry 30+):\n` +
        top.map((u) => `  ${u.league} (${u.rows} rows)`).join("\n"),
    );
  }
  console.log(`\nNext: in-game, Leagues -> Import roster file -> ${values.out}`);
}

try {
  main(process.argv.slice(2));
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
}
