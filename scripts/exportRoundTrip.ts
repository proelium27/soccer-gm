/**
 * End-to-end check of the export file format on a *simmed* save: encode it the
 * way the Export Save button does, read it back the way Import does, and prove
 * nothing was lost — plus print what the file actually weighs.
 *
 * The unit tests cover the format on a fresh league; this covers the shape a
 * save has after seasons of history, which is where the size problem lives.
 *
 * Usage: npx tsx scripts/exportRoundTrip.ts [seasons]
 */
import "fake-indexeddb/auto";
import { createLeagueState } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { simOffseason } from "../src/core/offseason.js";
import { mulberry32 } from "../src/engine/rng.js";
import {
  encodeLeagueFile,
  importLeagueJSON,
  readLeagueFileText,
} from "../src/db/exportImport.js";

const SEASONS = Number(process.argv[2] ?? 3);
const MB = (n: number) => (n / 1024 / 1024).toFixed(2);

const rng = mulberry32(7);
let league = createLeagueState(0, rng);
for (let s = 1; s <= SEASONS; s++) {
  league = simThrough(league, "season", rng);
  league = simOffseason(league, rng);
  console.log(`simmed season ${s}`);
}

const before = JSON.stringify(league);
const pretty = JSON.stringify(league, null, 2).length;
const bytes = await encodeLeagueFile(league);

console.log(`\nseasons                 ${SEASONS}`);
console.log(`old format (pretty)     ${MB(pretty)} MB`);
console.log(`new format (gzip)       ${MB(bytes.length)} MB`);
console.log(`shrink                  ${(pretty / bytes.length).toFixed(1)}x`);

// Read it back exactly as the Import button would.
const file = new File([bytes], `soccer-gm-league-${league.lid}.json.gz`);

// The format itself must be lossless: what comes out of the file is byte-for-byte
// what went in. Compared before migrateLeague, which legitimately backfills
// fields and so would muddy the question this is asking.
const decoded = await readLeagueFileText(file);
console.log(`\nbytes identical         ${decoded === before ? "YES" : "NO"}`);
if (decoded !== before) {
  console.error("export/import is LOSSY — the decoded text differs");
  process.exit(1);
}

const { league: reloaded } = await importLeagueJSON(file);
console.log(`players                 ${reloaded.players.length}`);
console.log(`transfers               ${reloaded.transfers.length}`);
console.log(`seasonHistory           ${reloaded.seasonHistory.length}`);

// And an old plain-JSON export must still import (back-compat).
const { league: fromLegacy } = await importLeagueJSON(new File([before], "old-save.json"));
console.log(
  `legacy .json import     ${fromLegacy.players.length === reloaded.players.length ? "YES" : "NO"}`,
);
