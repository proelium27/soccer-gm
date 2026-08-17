/**
 * Calibration probe for the difficulty levels (see the DIFFICULTIES block in
 * core/constants.ts). Run it after touching ANY difficulty value.
 *
 *   npx tsx scripts/difficultyProbe.ts [seasons] [seed...]
 *
 * Two halves, and the split matters:
 *
 * 1. MARKET, measured on ONE shared world. Difficulty changes what the user can
 *    afford, which changes the rng stream, so two levels simmed separately are
 *    different worlds and their player counts are not comparable. Everything
 *    that compares levels against each other is therefore measured by applying
 *    each level's bar to a single simmed world. This half also checks the
 *    feature's central invariant: the AI market's own protected set must be
 *    identical whatever the save's difficulty is, or a lever has leaked out of
 *    the user's club and into the world economy.
 *
 * 2. FINANCE, simmed per level. Note the headless user club is unmanaged (see
 *    CLAUDE.md), so its roster rots to academy stipends and its *simmed* balance
 *    says nothing useful about a played save. The number to read is the
 *    structural one printed first: season-1 income against season-1 wages, which
 *    is the squeeze a real user actually faces.
 */
import { mulberry32 } from "../src/engine/rng.js";
import { createLeagueState } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { simOffseason } from "../src/core/offseason.js";
import { wageBill, financeScaleFor, seasonRevenue } from "../src/core/finance/budget.js";
import {
  protectedStarPids, lastCompletedSeason, userProtectedStarBar,
} from "../src/core/transfers/protectedStars.js";
import { reservationPrice } from "../src/core/transfers/negotiation.js";
import {
  DIFFICULTIES, DIFFICULTY_ORDER, PRIZE_TOP_10_CUTOFF,
} from "../src/core/constants.js";
import type { LeagueStore } from "../src/core/leagueState.js";

const SEASONS = Number(process.argv[2] ?? 5);
const SEEDS = (process.argv.slice(3).length > 0 ? process.argv.slice(3) : ["1"]).map(Number);
/** A mid-table English top-flight club (tids ascend from the strongest). */
const USER_TID = 9;

const m = (n: number) => `£${(n / 1e6).toFixed(1)}M`;

function userTeam(league: LeagueStore) {
  return league.teams.find((t) => t.tid === league.meta.userTid)!;
}

function wagesOf(league: LeagueStore): number {
  const t = userTeam(league);
  const salaries = new Map(league.players.map((p) => [p.pid, p.contract.salary]));
  return wageBill([...t.roster, ...t.academyRoster], salaries);
}

/** Season income at this level, assuming a mid-table finish (no prize money). */
function incomeOf(league: LeagueStore): number {
  const t = userTeam(league);
  return seasonRevenue(
    PRIZE_TOP_10_CUTOFF + 1,
    t.hype,
    financeScaleFor(league.competitions, t.compId, t.tid, league.meta.userTid, league.difficulty),
  ).total;
}

for (const seed of SEEDS) {
  console.log(`\n########## seed ${seed} ##########`);

  // ---- 1. Structural finance, read off the generated squad (real wages). ----
  console.log(`\n-- opening finances (user tid ${USER_TID}, real generated squad) --`);
  for (const level of DIFFICULTY_ORDER) {
    const league = createLeagueState(USER_TID, mulberry32(seed), seed, level);
    const wages = wagesOf(league);
    const income = incomeOf(league);
    const gap = income - wages;
    console.log(
      `${DIFFICULTIES[level].label.padEnd(7)}` +
      ` opening ${m(userTeam(league).budget).padStart(8)}` +
      ` | mid-table income ${m(income).padStart(8)}` +
      ` − wages ${m(wages).padStart(8)}` +
      ` = ${(gap >= 0 ? "+" : "") + m(gap)} per season`,
    );
  }

  // ---- 2. Market, all levels applied to ONE world. ----
  let league = createLeagueState(USER_TID, mulberry32(seed), seed, "normal");
  for (let s = 0; s < SEASONS; s++) {
    league = simThrough(league, "season", mulberry32(seed * 1000 + s));
    // simThrough halts before the user's cup final; finish the season off.
    while (league.phase === "regular" && league.schedule.length > 0) {
      league = simThrough(league, "season", mulberry32(seed * 1000 + s));
    }
    league = simOffseason(league, mulberry32(seed * 2000 + s));
  }

  const last = lastCompletedSeason(league);
  const rosteredAI = league.teams
    .filter((t) => t.tid !== league.meta.userTid)
    .reduce((n, t) => n + t.roster.length, 0);

  console.log(`\n-- market after ${SEASONS} seasons (one world, ${rosteredAI} AI players) --`);

  // The invariant, stated the way it's actually enforced: the AI callers pass
  // no bar at all, so what they get is the shipped default — which must be the
  // same set the *normal* profile produces. If those two ever diverge, a
  // difficulty value has been edited into the world's own gate.
  // (`difficulty.test.ts` pins the stronger form: varying league.difficulty
  // cannot move the default-bar set.)
  const aiDefault = protectedStarPids(
    last, league.teams, league.players, league.competitions, league.meta.userTid,
  );
  const normalBar = protectedStarPids(
    last, league.teams, league.players, league.competitions, league.meta.userTid,
    userProtectedStarBar("normal"),
  );
  const stable = aiDefault.size === normalBar.size
    && [...aiDefault].every((pid) => normalBar.has(pid));
  console.log(
    `AI market protects ${aiDefault.size} players (the shipped bar): ` +
    `${stable ? "OK, matches normal" : `LEAK — normal gives ${normalBar.size}`}`,
  );

  const ranked = league.players
    .filter((p) => league.teams.some((t) => t.tid !== league.meta.userTid && t.roster.includes(p.pid)))
    .sort((a, b) => b.ovr - a.ovr || a.pid - b.pid);

  for (const level of DIFFICULTY_ORDER) {
    const profile = DIFFICULTIES[level];
    const hidden = protectedStarPids(
      last, league.teams, league.players, league.competitions, league.meta.userTid,
      userProtectedStarBar(level),
    );
    const scale = profile.buyPriceScale;
    const ask = (i: number) => {
      const p = ranked[i];
      if (!p) return "n/a";
      const price = m(reservationPrice(league.lid, league.season, "summer", p, scale));
      return `${hidden.has(p.pid) ? "(off market)" : price}`;
    };
    console.log(
      `${profile.label.padEnd(7)} hides ${String(hidden.size).padStart(4)}` +
      ` (${((hidden.size / rosteredAI) * 100).toFixed(1)}% of the world)` +
      ` | best ${ask(0)} · #200 ${ask(200)} · #1000 ${ask(1000)}`,
    );
  }
  console.log(
    `        (#200 is ovr ${ranked[200]?.ovr}, #1000 is ovr ${ranked[1000]?.ovr}` +
    ` — same three players on every row)`,
  );
}
