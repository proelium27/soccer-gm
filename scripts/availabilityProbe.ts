/**
 * The probe that found the 2026-08-11 ladder inversion. **The screen it measures
 * is gone** — runAITransferMarket no longer filters on availability at all — so
 * this does not describe live behaviour. It is kept because the distribution it
 * prints is the evidence for that deletion, and because any *replacement* prune
 * has to be judged against these same numbers.
 *
 * The market used to shop a player only when
 *     keepValueToClub(player, sellerCtx) <= trueTransferValue(player) * 0.95
 * skipping him entirely otherwise, before any buyer was consulted. Keep-side
 * valuation exists to price a club's own best player properly ("how far would we
 * fall without him"), so for a club's best player that ratio is high by
 * construction and the screen excluded him permanently. This prints the
 * reservation/market distribution, separating each club's best player from the
 * rest — they were the population being silently removed.
 *
 * See docs/transfer-mobility.md.
 *
 *   npx tsx scripts/availabilityProbe.ts [seasons]
 */
import { createLeagueState } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { simOffseason } from "../src/core/offseason.js";
import { mulberry32 } from "../src/engine/rng.js";
import { deriveLeagueContexts } from "../src/core/ai/clubContext.js";
import { keepValueToClub } from "../src/core/ai/evaluate.js";
import { trueTransferValue } from "../src/core/finance/valuation.js";
import { settledMultiplier, joinedSeasons } from "../src/core/transfers/playerWill.js";

const SEASONS = Number(process.argv[2] ?? 6);

const rng = mulberry32(1);
let league = createLeagueState(0, rng);
for (let s = 1; s < SEASONS; s++) {
  league = simThrough(league, "season", rng);
  league = simOffseason(league, rng);
}

const byPid = new Map(league.players.map((p) => [p.pid, p]));
const contexts = deriveLeagueContexts(league);
const joined = joinedSeasons(league.transfers);

/** ratio of what the club demands to what the player is worth on the open market */
const all: number[] = [];
const bestOfClub: number[] = [];

for (const team of league.teams) {
  if (team.tid === league.meta.userTid) continue;
  const ctx = contexts.get(team.tid);
  if (!ctx) continue;

  const roster = team.roster.map((pid) => byPid.get(pid)).filter((p): p is NonNullable<typeof p> => !!p);
  if (!roster.length) continue;
  const best = roster.reduce((a, b) => (b.ovr > a.ovr ? b : a));

  for (const player of roster) {
    const market = trueTransferValue(player, league.season);
    if (market <= 0) continue;
    const reservation =
      keepValueToClub(player, ctx) * settledMultiplier(joined.get(player.pid), league.season);
    const ratio = reservation / market;
    all.push(ratio);
    if (player.pid === best.pid) bestOfClub.push(ratio);
  }
}

function pct(xs: number[], p: number): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}
function shareShoppable(xs: number[], threshold: number): string {
  return `${((xs.filter((r) => r <= threshold).length / xs.length) * 100).toFixed(1)}%`;
}

console.log(`season ${league.season}\n`);
for (const [label, xs] of [["all rostered", all], ["each club's BEST player", bestOfClub]] as const) {
  console.log(`${label}  (n=${xs.length})`);
  console.log(`  reservation/market   p10 ${pct(xs, 10).toFixed(2)}  median ${pct(xs, 50).toFixed(2)}  p90 ${pct(xs, 90).toFixed(2)}`);
  console.log(`  shoppable at 0.95 (today): ${shareShoppable(xs, 0.95)}`);
  for (const t of [1.0, 1.25, 1.5, 2.0, 3.0]) {
    console.log(`  shoppable at ${t.toFixed(2)}:          ${shareShoppable(xs, t)}`);
  }
  console.log("");
}
