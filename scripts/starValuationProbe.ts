/**
 * Probe: for the best players in a generated world, who values them most?
 * Prints the owning club's valuation vs the top outside bidders, so we can see
 * whether the evaluation core prefers big clubs or small ones for a superstar.
 */
import { mulberry32 } from "../src/engine/rng.js";
import { createLeagueState } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { simOffseason } from "../src/core/offseason.js";
import { simThroughInternational, isIntlStagePending } from "../src/core/international/staging.js";
import { deriveLeagueContexts } from "../src/core/ai/clubContext.js";
import { evaluatePlayerForClub } from "../src/core/ai/evaluate.js";
import { trueTransferValue } from "../src/core/finance/valuation.js";

const rng = mulberry32(1);
let league = createLeagueState(0, rng);
for (let s = 1; s <= 3; s++) {
  league = simThrough(league, "season", rng);
  if (isIntlStagePending(league.international)) {
    const r = simThroughInternational(league.international, league.players, league.lid, league.season);
    league = { ...league, international: r.international, players: r.players };
  }
  league = simOffseason(league, rng);
}

const contexts = deriveLeagueContexts({
  teams: league.teams,
  players: league.players,
  season: league.season,
  played: league.played,
  competitions: league.competitions,
});
const byPid = new Map(league.players.map((p) => [p.pid, p]));
const tidOf = new Map<number, number>();
for (const t of league.teams) for (const pid of t.roster) tidOf.set(pid, t.tid);
const nameOf = (tid: number) => league.teams.find((t) => t.tid === tid)?.name ?? `#${tid}`;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const strengthOf = (tid: number) => {
  const t = league.teams.find((x) => x.tid === tid)!;
  return avg(t.roster.map((p) => byPid.get(p)?.ovr ?? 0).sort((a, b) => b - a).slice(0, 16));
};
const fmt = (x: number) => `$${(x / 1e6).toFixed(0)}M`;

const stars = league.players
  .filter((p) => tidOf.has(p.pid))
  .sort((a, b) => b.ovr - a.ovr)
  .slice(0, 3);

for (const star of stars) {
  const ownTid = tidOf.get(star.pid)!;
  const own = evaluatePlayerForClub(star, contexts.get(ownTid)!);
  console.log(
    `\n${star.name} (${star.pos}, ovr ${star.ovr}) — owned by ${nameOf(ownTid)} [squad ${strengthOf(ownTid).toFixed(1)}]`,
  );
  console.log(`  true market value: ${fmt(trueTransferValue(star, league.season))}`);
  console.log(
    `  his OWN club values him at ${fmt(own.value)}  (need x${own.needMult.toFixed(2)}, timeline x${own.timelineMult.toFixed(2)}, afford x${own.affordabilityMult.toFixed(2)})`,
  );

  const others = league.teams
    .filter((t) => t.tid !== ownTid)
    .map((t) => ({ tid: t.tid, ev: evaluatePlayerForClub(star, contexts.get(t.tid)!) }))
    .sort((a, b) => b.ev.value - a.ev.value)
    .slice(0, 5);
  console.log("  highest outside bidders:");
  for (const o of others) {
    console.log(
      `    ${fmt(o.ev.value).padStart(7)}  ${nameOf(o.tid).padEnd(22)} squad ${strengthOf(o.tid).toFixed(1).padStart(5)}  need x${o.ev.needMult.toFixed(2)}`,
    );
  }
}
