import type { LeagueStore } from "./leagueState.js";
import type { Player } from "./players/types.js";
import type { StoredTeam } from "./teams/clubs.js";
import { progressPlayer, rollRetirement } from "./players/progression.js";
import { generateYouthIntake } from "./players/youth.js";
import { releaseExpiredContracts, runAIFreeAgency, trimRosterSurplus } from "./freeAgency.js";
import { runAITransferMarket } from "./ai/transferMarket.js";
import { runAIContractRenewals } from "./ai/renewals.js";
import { computeStandings, computeTeamSeasonStats } from "./standings.js";
import { generateSchedule } from "./schedule.js";
import { updateHype } from "./finance/hype.js";
import { settleSeasonEnd, chargeSeasonStart, wageBill } from "./finance/budget.js";
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

  // 0. Proactive AI contract renewals: any AI player entering his final
  //    contract season is renewed now if his club still values him above
  //    the new wage (by AI_RENEWAL_MARGIN) — before step 1 below would
  //    otherwise walk him to free agency next offseason with zero priority
  //    for his own club to keep him. Uses this season's now-final standings/
  //    league.played for form, same as the transfer-market steps do later.
  //    Seeded independently of `rng` (same convention as the transfer-market
  //    steps below) so the phase-5 scouting-noise jitter can't perturb the
  //    progression/retirement stream the validation gates are tuned against.
  const renewals = runAIContractRenewals(
    league.teams, league.players, nextSeason, league.meta.userTid, league.played,
    hashInts(league.lid, nextSeason, 9),
  );

  // 1. Release expired contracts to the free agent pool.
  let teams: StoredTeam[] = releaseExpiredContracts(renewals.teams, renewals.players, endingSeason);

  // 2. Progress every remaining player's ratings. The months-long break also
  //    heals any injury still mid-recovery when the season ended (max recovery
  //    is INJURY_GAMES_MAX matchdays, far shorter than an offseason).
  let players: Player[] = renewals.players.map((p) => {
    const progressed = progressPlayer(rng, p, endingSeason);
    return progressed.injury ? { ...progressed, injury: null } : progressed;
  });

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

  // 3.5. Settle season-end finances: success payout by final rank plus hype
  //      revenue in, scouting spend out, then move hype toward this season's
  //      performance. Wages are NOT charged here — they're paid up front at
  //      the new season's start (step 6.5) on the finalized roster. Standings
  //      are computed here (before AI free agency changes rosters) so rank
  //      reflects the season that actually just played out.
  const standings = computeStandings(teams.map((t) => t.tid), league.played);
  const teamStats = computeTeamSeasonStats(teams.map((t) => t.tid), league.played);
  const rankByTid = new Map(standings.map((row, i) => [row.tid, i + 1]));
  const rowByTid = new Map(standings.map((row) => [row.tid, row]));
  teams = teams.map((t) => {
    const rank = rankByTid.get(t.tid) ?? NUM_TEAMS;
    const row = rowByTid.get(t.tid);
    const budget = settleSeasonEnd(t.budget, rank, t.hype, t.scoutingSpend);
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

  // 6.4. AI↔AI transfer market (summer window): now that squads are settled,
  //      clubs trade with each other to improve, money conserved, user
  //      excluded. Valued for the season they're about to play (nextSeason),
  //      with form from the season that just finished (league.played, not yet
  //      cleared). Seeded independently of `rng` so it can't perturb the
  //      progression/retirement stream the validation gates are tuned against.
  //      Runs before season-start wages so any fee is reflected in the cash a
  //      club has when its squad is paid.
  const marketSeed = hashInts(league.lid, nextSeason, 7);
  const summerMarket = runAITransferMarket(
    teams, players, league.transfers, nextSeason, league.played,
    "summer", "offseason", league.meta.userTid, marketSeed,
  );
  teams = summerMarket.teams;

  // 6.5. Season-start finances on the finalized new-season rosters: the base
  //      allocation arrives and each squad's wages for the season are paid
  //      out of it immediately (mirrors league creation in assignIdentities).
  const salaryMap = new Map(players.map((p) => [p.pid, p.contract.salary]));
  teams = teams.map((t) => ({
    ...t,
    budget: chargeSeasonStart(t.budget, wageBill(t.roster, salaryMap)),
  }));

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
    transfers: summerMarket.transfers,
    // The winter market hasn't run for the new season yet.
    winterMarketRunSeason: null,
    seasonHistory: [
      ...league.seasonHistory,
      { season: endingSeason, table: standings, championTid: standings[0].tid, teamStats },
    ],
  };
}
