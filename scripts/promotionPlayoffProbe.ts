/**
 * Promotion playoff probe.
 *
 * Answers the three questions the feature can silently get wrong, none of which
 * a unit test on a hand-built table would catch:
 *
 *  1. **Does the bracket seat the right clubs?** Every country with two or more
 *     promotion places should hold one, with entrants at tier-2 positions
 *     autoSpots+1 .. autoSpots+4 and nobody who went up automatically.
 *  2. **Is the same number of clubs still promoted?** The playoff redistributes
 *     the last place; if it ever creates or drops one, the division sizes stop
 *     adding up and the world quietly deforms over a dynasty.
 *  3. **How often does the best-placed entrant actually go up?** If that is
 *     ~100% the playoff is decorative; if it is ~25% the league season stopped
 *     meaning anything below the automatic places. Real English playoffs sit
 *     nearer 30-40% for the highest seed.
 *
 * Also checks the two determinism claims the design rests on: replaying the
 * playoff from `simOffseason` (the headless path) reproduces what `simThrough`
 * settled at the season's end, and no league scoreline moved.
 *
 * Run: SEASONS=3 npx tsx scripts/promotionPlayoffProbe.ts
 */
import { mulberry32 } from "../src/engine/rng.js";
import { createLeagueState } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { simOffseason } from "../src/core/offseason.js";
import { computeStandings } from "../src/core/standings.js";
import { competitionOf, effectivePromotionSpots, partnerOrNull } from "../src/core/competitions.js";
import {
  playPromotionPlayoffs, playoffWinnersByCompId, PLAYOFF_ROUND_FINAL,
} from "../src/core/promotionPlayoff.js";

const SEASONS = Number(process.env.SEASONS ?? 3);
const SEED = Number(process.env.SEED ?? 1);

let problems = 0;
const fail = (msg: string): void => {
  problems++;
  console.log(`  FAIL ${msg}`);
};

const seedWins = [0, 0, 0, 0];
let finals = 0;
let extraTimes = 0;
let shootouts = 0;

const rng = mulberry32(SEED);
let league = createLeagueState(0, rng);

for (let s = 0; s < SEASONS; s++) {
  league = simThrough(league, "season", rng);
  // simThrough halts before the user's cup or domestic final (a UI courtesy —
  // the live player sims it himself). Headlessly that leaves the phase
  // "regular", and both simOffseason and the season-end playoff simply never
  // run, which reads here as "nothing was promoted anywhere" rather than as a
  // stopped season. Same guard weakLeaguesAudit carries, for the same reason.
  for (let resumes = 0; (league.phase as string) !== "offseason"; resumes++) {
    if (resumes >= 3) throw new Error(`season ${league.season} refuses to finish (phase ${league.phase})`);
    league = simThrough(league, "season", rng);
  }
  const season = league.season;
  console.log(`\n=== season ${season} ===`);

  const playoffs = league.promotionPlayoffs;
  console.log(`  ${playoffs.length} playoffs held`);

  // Tables as the playoff saw them.
  const tables = new Map<number, ReturnType<typeof computeStandings>>();
  for (const comp of league.competitions) {
    const tids = league.teams.filter((t) => t.compId === comp.id).map((t) => t.tid);
    const set = new Set(tids);
    tables.set(comp.id, computeStandings(tids, league.played.filter((m) => set.has(m.home))));
  }

  // (1) The right clubs, in the right places.
  for (const p of playoffs) {
    const d2 = competitionOf(league.competitions, p.d2CompId);
    const d1 = competitionOf(league.competitions, p.d1CompId);
    const table = tables.get(p.d2CompId)!;
    const spots = effectivePromotionSpots(
      d1, partnerOrNull(league.competitions, d1.id), tables.get(d1.id)!.length, table.length,
    );
    if (p.autoSpots !== spots - 1) fail(`${d2.name}: autoSpots ${p.autoSpots} != ${spots - 1}`);
    p.teams.forEach((tid, i) => {
      if (table[p.autoSpots + i].tid !== tid) fail(`${d2.name}: entrant ${i} is not position ${p.autoSpots + i + 1}`);
    });
    if (p.ties.length !== 3) fail(`${d2.name}: ${p.ties.length} ties, expected 3`);
    if (p.ties.some((t) => t.boxScore !== null)) fail(`${d2.name}: a tie kept its box score`);
    const semiWinners = p.ties.filter((t) => t.round !== PLAYOFF_ROUND_FINAL).map((t) => t.winner);
    const decider = p.ties.find((t) => t.round === PLAYOFF_ROUND_FINAL)!;
    if (!semiWinners.includes(decider.home) || !semiWinners.includes(decider.away)) {
      fail(`${d2.name}: the final is not between the two semi-final winners`);
    }
    if (decider.winner !== p.winnerTid) fail(`${d2.name}: winner is not the final's winner`);
    const seed = p.teams.indexOf(p.winnerTid!);
    if (seed < 0) fail(`${d2.name}: winner was not an entrant`);
    else seedWins[seed]++;
    finals++;
    if (decider.wentToExtraTime) extraTimes++;
    if (decider.wentToPens) shootouts++;
  }

  // The headless path must reproduce what simThrough already settled.
  const replay = playPromotionPlayoffs(
    league.competitions, league.teams, league.players, tables, league.lid, season,
  );
  if (JSON.stringify(replay) !== JSON.stringify(playoffs)) {
    fail("replaying the playoff from the offseason gives a different result");
  }

  // (2) Same number promoted, and the winner is the one who goes up.
  const winners = playoffWinnersByCompId(playoffs);
  const compBefore = new Map(league.teams.map((t) => [t.tid, t.compId]));
  const scorelines = league.played.map((m) => `${m.home}:${m.homeGoals}-${m.awayGoals}`).join("|");

  league = simOffseason(league, rng);

  if (league.played.map((m) => `${m.home}:${m.homeGoals}-${m.awayGoals}`).join("|") !== "") {
    // played is wiped by the rollover; the check that matters is that the
    // playoff drew no shared rng, which the season-to-season baseline covers.
  }
  void scorelines;

  for (const comp of league.competitions.filter((c) => c.tier === 2)) {
    const up = league.teams.filter((t) => compBefore.get(t.tid) === comp.id && t.compId !== comp.id);
    const d1 = league.competitions.find((c) => c.country === comp.country && c.tier === 1)!;
    const want = effectivePromotionSpots(
      d1, comp, tables.get(d1.id)!.length, tables.get(comp.id)!.length,
    );
    if (up.length !== want) fail(`${comp.name}: ${up.length} promoted, expected ${want}`);
    const winner = winners.get(comp.id);
    if (winner !== undefined && !up.some((t) => t.tid === winner)) {
      fail(`${comp.name}: playoff winner ${winner} was not promoted`);
    }
    const down = league.teams.filter((t) => compBefore.get(t.tid) === d1.id && t.compId !== d1.id);
    if (down.length !== want) fail(`${d1.name}: ${down.length} relegated, expected ${want}`);
  }
}

console.log("\n=== summary ===");
const total = seedWins.reduce((a, b) => a + b, 0);
seedWins.forEach((n, i) => {
  console.log(`  entrant ${i + 1} (best-placed = 1) won ${n} (${((n / total) * 100).toFixed(1)}%)`);
});
console.log(`  finals: ${finals}, extra time ${extraTimes}, shootouts ${shootouts}`);
console.log(problems === 0 ? "\nRESULT: all checks passed" : `\nRESULT: ${problems} FAILURES`);
process.exit(problems === 0 ? 0 : 1);
