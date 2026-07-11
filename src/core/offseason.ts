import type { LeagueStore } from "./leagueState.js";
import type { Player } from "./players/types.js";
import type { StoredTeam } from "./teams/clubs.js";
import { progressPlayer, rollRetirement } from "./players/progression.js";
import { generateYouthIntake } from "./players/youth.js";
import { releaseExpiredContracts, runAIFreeAgency, trimRosterSurplus } from "./freeAgency.js";
import { computeStandings } from "./standings.js";
import { generateSchedule } from "./schedule.js";
import { updateHype } from "./finance/hype.js";
import { settleSeasonBudget, wageBill } from "./finance/budget.js";
import { NUM_TEAMS, SCOUTING_SPEND_MIN } from "./constants.js";
import { hashInts } from "../engine/rng.js";

/**
 * Run one full offseason: contract expiry, progression, retirement, AI free
 * agency, youth intake, then a fresh schedule for the new season. Only
 * callable when the league is in the "offseason" phase (all 38 matchdays
 * played). The user's team is left untouched by free agency/youth so the UI
 * can offer those as manual actions later; youth intake still applies to
 * every club per spec (no draft mechanic).
 */
export function simOffseason(league: LeagueStore, rng: () => number): LeagueStore {
  if (league.phase !== "offseason") {
    return league;
  }

  const endingSeason = league.season;
  const nextSeason = endingSeason + 1;

  // 1. Release expired contracts to the free agent pool.
  let teams: StoredTeam[] = releaseExpiredContracts(league.teams, league.players, endingSeason);

  // 2. Progress every remaining player's ratings.
  let players: Player[] = league.players.map((p) => progressPlayer(rng, p, endingSeason));

  // 3. Roll retirement; drop retirees from rosters and the player pool.
  const retiredPids = new Set(
    players
      .filter((p) => rollRetirement(rng, p, endingSeason))
      .map((p) => p.pid),
  );
  players = players.filter((p) => !retiredPids.has(p.pid));
  teams = teams.map((t) => ({
    ...t,
    roster: t.roster.filter((pid) => !retiredPids.has(pid)),
  }));

  // 3.5. Settle season finances: revenue (equal base + success payout by
  //      final rank + damped hype revenue) minus wages paid and scouting
  //      spend, then move hype toward this season's performance. Standings
  //      are computed here (before AI free agency changes rosters) so rank
  //      reflects the season that actually just played out.
  const standings = computeStandings(teams.map((t) => t.tid), league.played);
  const rankByTid = new Map(standings.map((row, i) => [row.tid, i + 1]));
  const rowByTid = new Map(standings.map((row) => [row.tid, row]));
  const salaryMap = new Map(players.map((p) => [p.pid, p.contract.salary]));
  teams = teams.map((t) => {
    const rank = rankByTid.get(t.tid) ?? NUM_TEAMS;
    const row = rowByTid.get(t.tid);
    const wages = wageBill(t.roster, salaryMap);
    const budget = settleSeasonBudget(t.budget, rank, t.hype, wages, t.scoutingSpend);
    const hype = row ? updateHype(t.hype, row, rank) : t.hype;
    return { ...t, budget, hype, scoutingSpend: SCOUTING_SPEND_MIN };
  });

  // 4. AI free agency fills roster holes (worst team picks first), skipping
  //    the user's club so they can sign manually.
  const signingOrder = [...standings].sort((a, b) => a.points - b.points).map((s) => s.tid);
  ({ teams, players } = runAIFreeAgency(
    teams,
    players,
    nextSeason,
    rng,
    league.meta.userTid,
    signingOrder,
  ));

  // 5. Youth intake for every club, anchored to each club's fixed
  //    generation-time strength (never the current roster average — see
  //    LeagueTeam.academyBase for why that ratchets OVR upward without bound).
  let nextPid = Math.max(0, ...players.map((p) => p.pid)) + 1;
  teams = teams.map((t) => {
    // Caller-supplied seed (not drawn from `rng`) so youth nationality/name
    // generation varies across leagues/seasons/teams without perturbing the
    // ratings/potential stream consumed per player.
    const genSeed = hashInts(league.lid, nextSeason, t.tid, 2);
    const { players: youth, nextPid: updatedNextPid } = generateYouthIntake(
      rng,
      t.academyBase,
      nextSeason,
      nextPid,
      genSeed,
    );
    nextPid = updatedNextPid;
    players.push(...youth);
    return { ...t, roster: [...t.roster, ...youth.map((p) => p.pid)] };
  });

  // 6. Trim AI squads back down to target composition so youth intake
  //    doesn't accumulate indefinitely across seasons.
  teams = trimRosterSurplus(teams, players, league.meta.userTid);

  // 7. New schedule, new season, back to regular play.
  const schedule = generateSchedule(teams.map((t) => t.tid));

  return {
    ...league,
    teams,
    players,
    season: nextSeason,
    phase: "regular",
    schedule,
    played: [],
  };
}
