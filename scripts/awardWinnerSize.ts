/**
 * What the per-season award-winner snapshot costs a save.
 *
 * `SeasonHistoryEntry.awardWinners` is the fix for award winners going
 * unresolvable on long saves (see core/awardWinners.ts). It is a copy, so the
 * only question worth asking of it is its weight — run this after any change to
 * the field's shape or to how many competitions the world has.
 */
import { mulberry32 } from "../src/engine/rng.js";
import { createLeagueState } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { simOffseason } from "../src/core/offseason.js";

const rng = mulberry32(7);
const league = simOffseason(simThrough(createLeagueState(0, rng), "season", rng), rng);
const entry = league.seasonHistory.at(-1)!;
const bytes = (v: unknown): number => JSON.stringify(v).length;

const winners = entry.awardWinners ?? [];
const entryBytes = bytes(entry);
const winnerBytes = bytes(winners);
console.log(`competitions      ${league.competitions.length}`);
console.log(`winners named     ${winners.length}`);
console.log(`awardWinners      ${(winnerBytes / 1024).toFixed(1)} KB/season`);
console.log(`season entry      ${(entryBytes / 1024).toFixed(1)} KB (winners are ${(100 * winnerBytes / entryBytes).toFixed(1)}%)`);
console.log(`whole save        ${(bytes(league) / 1024 / 1024).toFixed(1)} MB at 1 season`);
console.log(`100 seasons       ~${(winnerBytes * 100 / 1024 / 1024).toFixed(1)} MB of winners`);
