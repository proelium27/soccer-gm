/**
 * Stale contracts on a simmed dynasty — the headless version of the ERROR
 * `scripts/playerSaveAudit.ts` reports on a real save ("rostered player whose
 * contract already expired", docs/player-save-findings.md #2).
 *
 * Run it on this branch and on the base to see the fix land:
 *   npx tsx scripts/loanContractProbe.ts [seasons] [seed]
 *
 * Counts, at the end of each offseason:
 *   - stale:    senior-rostered players with contract.expiresSeason < season
 *   - fromLoan: how many of those returned from a loan at this rollover
 *   - limbo:    players on an active loan who are on no roster at all (the
 *               latent half of the same bug — invisible and unsignable)
 */
import { createLeagueState } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { simOffseason } from "../src/core/offseason.js";
import { mulberry32 } from "../src/engine/rng.js";

const seasons = Number(process.argv[2] ?? 12);
const seed = Number(process.argv[3] ?? 1);

const rng = mulberry32(seed);
let league = createLeagueState(0, rng);

console.log(`seasons=${seasons} seed=${seed}`);
console.log("season  stale  fromLoan  limbo  loans");

let worstStale = 0;
let worstLimbo = 0;

for (let s = 0; s < seasons; s++) {
  league = simThrough(league, "season", rng);
  league = simOffseason(league, rng);

  const onSenior = new Set(league.teams.flatMap((t) => t.roster));
  const stale = league.players.filter(
    (p) => onSenior.has(p.pid) && p.contract.expiresSeason < league.season,
  );
  const returnedNow = new Set(
    league.transfers
      .filter((t) => t.loanReturn && t.season === league.season)
      .map((t) => t.pid),
  );
  const fromLoan = stale.filter((p) => returnedNow.has(p.pid)).length;
  const limbo = league.activeLoans.filter((l) => !onSenior.has(l.pid)).length;

  worstStale = Math.max(worstStale, stale.length);
  worstLimbo = Math.max(worstLimbo, limbo);
  console.log(
    `${String(league.season).padStart(6)}  ${String(stale.length).padStart(5)}  `
    + `${String(fromLoan).padStart(8)}  ${String(limbo).padStart(5)}  `
    + `${String(league.activeLoans.length).padStart(5)}`,
  );
}

console.log(`\nworst stale=${worstStale} worst limbo=${worstLimbo}`);
process.exit(worstStale === 0 && worstLimbo === 0 ? 0 : 1);
