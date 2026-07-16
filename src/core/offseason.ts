import type { LeagueStore } from "./leagueState.js";
import type { Player } from "./players/types.js";
import type { StoredTeam } from "./teams/clubs.js";
import { progressPlayer, rollRetirement } from "./players/progression.js";
import { generateYouthIntake } from "./players/youth.js";
import {
  releaseExpiredContracts, runAIFreeAgency, trimRosterSurplus, ensureUserRosterSafety,
} from "./freeAgency.js";
import { runAITransferMarket } from "./ai/transferMarket.js";
import { runAIContractRenewals } from "./ai/renewals.js";
import { enforceDivision2Ceiling } from "./ai/divisionCeiling.js";
import { computeStandings, computeTeamSeasonStats, type StandingsRow } from "./standings.js";
import { computeSeasonAwards, type SeasonAwards } from "./awards.js";
import { computeDivisionSwap, applyDivisionSwap, stepAcademyBaseConvergence } from "./promotion.js";
import { generateSchedule } from "./schedule.js";
import { updateHype } from "./finance/hype.js";
import { settleSeasonEnd, chargeSeasonStart, wageBill } from "./finance/budget.js";
import { academyContractTerms } from "./contracts.js";
import { NUM_TEAMS, NUM_TEAMS_D2, SCOUTING_SPEND_DEFAULT } from "./constants.js";
import { clampScoutingSpend } from "./finance/scouting.js";
import { hashInts } from "../engine/rng.js";

/** Awards for the season that just ended, computed separately per division from players' current club membership. */
function awardsByDivision(
  players: Player[],
  teams: StoredTeam[],
  season: number,
): [SeasonAwards, SeasonAwards] {
  const rosterOf = (division: 0 | 1) =>
    new Set(teams.filter((t) => t.division === division).flatMap((t) => t.roster));
  const d1Roster = rosterOf(0);
  const d2Roster = rosterOf(1);
  const d1Players = players.filter((p) => d1Roster.has(p.pid));
  const d2Players = players.filter((p) => d2Roster.has(p.pid));
  return [computeSeasonAwards(d1Players, season), computeSeasonAwards(d2Players, season)];
}

/**
 * Run one full offseason: contract expiry, progression, retirement, AI free
 * agency, youth intake, promotion/relegation, then a fresh schedule for the
 * new season. Only callable when the league is in the "offseason" phase
 * (all 38 matchdays played in both divisions). The user's team is left
 * untouched by free agency/youth so the UI can offer those as manual
 * actions later; youth intake still applies to every club per spec (no
 * draft mechanic).
 */
export function simOffseason(league: LeagueStore, rng: () => number): LeagueStore {
  if (league.phase !== "offseason") {
    return league;
  }

  const endingSeason = league.season;
  const nextSeason = endingSeason + 1;

  // Snapshotted before any roster/division change below, from league.players
  // (not the `players` variable mutated further down) so a player who
  // retires this offseason still gets credit for the season he just
  // finished, and division membership reflects who actually played where.
  const divisionsByTid: Record<number, 0 | 1> = {};
  for (const t of league.teams) divisionsByTid[t.tid] = t.division;
  const awards = awardsByDivision(league.players, league.teams, endingSeason);

  // 0. Proactive AI contract renewals (cross-division: a club's own player,
  //    regardless of which division that club plays in).
  const renewals = runAIContractRenewals(
    league.teams, league.players, nextSeason, league.meta.userTid, league.played,
    hashInts(league.lid, nextSeason, 9),
  );

  // 1. Release expired contracts to the free agent pool.
  let teams: StoredTeam[] = releaseExpiredContracts(renewals.teams, renewals.players, endingSeason);

  // 2. Progress every remaining player's ratings; heal any lingering injury.
  let players: Player[] = renewals.players.map((p) => {
    const progressed = progressPlayer(rng, p, endingSeason);
    return progressed.injury ? { ...progressed, injury: null } : progressed;
  });

  // 3. Roll retirement; drop retirees from rosters and the player pool.
  const retiredPids = new Set(
    players.filter((p) => rollRetirement(rng, p, endingSeason)).map((p) => p.pid),
  );
  players = players.filter((p) => !retiredPids.has(p.pid));
  teams = teams.map((t) => ({
    ...t,
    roster: t.roster.filter((pid) => !retiredPids.has(pid)),
  }));

  // 3.5. Per-division standings, rank-based settlement, and hype update.
  //      Each division's 20-team table is computed independently — pooling
  //      both divisions into one 40-team table would misapply prize-tier
  //      rank cutoffs (PRIZE_TOP_5_CUTOFF etc. assume a 20-team table) and
  //      the hype curve (NUM_TEAMS-normalized) to a league neither was
  //      tuned for.
  const d1TeamIds = teams.filter((t) => t.division === 0).map((t) => t.tid);
  const d2TeamIds = teams.filter((t) => t.division === 1).map((t) => t.tid);
  const d1TeamIdSet = new Set(d1TeamIds);
  const d2TeamIdSet = new Set(d2TeamIds);
  const d1Standings = computeStandings(d1TeamIds, league.played.filter((m) => d1TeamIdSet.has(m.home)));
  const d2Standings = computeStandings(d2TeamIds, league.played.filter((m) => d2TeamIdSet.has(m.home)));
  const standings = [...d1Standings, ...d2Standings];
  const teamStats = computeTeamSeasonStats(teams.map((t) => t.tid), league.played);

  const settle = (rows: StandingsRow[], division: 0 | 1): void => {
    const rankByTid = new Map(rows.map((row, i) => [row.tid, i + 1]));
    const rowByTid = new Map(rows.map((row) => [row.tid, row]));
    teams = teams.map((t) => {
      if (t.division !== division) return t;
      const defaultRank = division === 0 ? NUM_TEAMS : NUM_TEAMS_D2;
      const rank = rankByTid.get(t.tid) ?? defaultRank;
      const row = rowByTid.get(t.tid);
      const budget = settleSeasonEnd(t.budget, rank, t.hype, t.scoutingSpend, division === 0 ? 1 : 2);
      const hype = row ? updateHype(t.hype, row, rank) : t.hype;
      return { ...t, budget, hype, scoutingSpend: clampScoutingSpend(SCOUTING_SPEND_DEFAULT, budget) };
    });
  };
  settle(d1Standings, 0);
  settle(d2Standings, 1);

  // 3.6. Promotion/relegation: bottom PROMOTION_RELEGATION_COUNT of D1 swap
  //      with top PROMOTION_RELEGATION_COUNT of D2, using the tables just
  //      computed above (the season that actually just played out). Then
  //      every mid-convergence team's academyBase moves one step closer to
  //      its current division's strength band.
  const swap = computeDivisionSwap(d1Standings, d2Standings);
  teams = applyDivisionSwap(teams, swap);
  teams = stepAcademyBaseConvergence(teams);

  // 3.7. Guaranteed ceiling on Division 2 quality, first pass: any
  //      AI-controlled player at or above DIVISION_2_REFUSAL_OVR_THRESHOLD
  //      (most commonly a just-relegated club's existing squad) is moved to
  //      whichever (non-user) Division 1 club needs him most, no
  //      market/affordability chance involved — see enforceDivision2Ceiling
  //      for why a soft nudge isn't enough. Run here, before free agency, so
  //      a club that loses a player this way still gets a chance to backfill
  //      the hole below; run again after the summer market (step 6.45) to
  //      also catch a player sold *into* Division 2 as ordinary market
  //      surplus this same offseason (idempotent — a no-op if nothing
  //      qualifies either time).
  let ceilingTransfers = league.transfers;
  ({ teams, transfers: ceilingTransfers } = enforceDivision2Ceiling(
    teams, players, ceilingTransfers, nextSeason, league.meta.userTid,
  ));

  // 4. AI free agency fills roster holes (worst team picks first, within
  //    its own division's finishing order — cross-division buying happens
  //    later, in the transfer market step), skipping the user's club.
  const signingOrder = [...standings].sort((a, b) => a.points - b.points).map((s) => s.tid);
  ({ teams, players } = runAIFreeAgency(
    teams, players, nextSeason, rng, league.meta.userTid, signingOrder,
  ));

  // 5. Youth intake for every club, anchored to each club's fixed
  //    generation-time strength (academyBase — see promotion.ts for how it
  //    moves after a division swap).
  let nextPid = Math.max(0, ...players.map((p) => p.pid)) + 1;
  teams = teams.map((t) => {
    const genSeed = hashInts(league.lid, nextSeason, t.tid, 2);
    const { players: youth, nextPid: updatedNextPid } = generateYouthIntake(
      rng, t.academyBase, nextSeason, nextPid, genSeed,
    );
    nextPid = updatedNextPid;
    if (t.tid === league.meta.userTid) {
      const academyTerms = academyContractTerms(nextSeason);
      for (const p of youth) {
        p.contract = { salary: academyTerms.salary, expiresSeason: academyTerms.expiresSeason };
      }
      players.push(...youth);
      return { ...t, academyRoster: [...t.academyRoster, ...youth.map((p) => p.pid)] };
    }
    players.push(...youth);
    return { ...t, roster: [...t.roster, ...youth.map((p) => p.pid)] };
  });

  // 5.5. Emergency call-up for the user's own roster.
  ({ teams, players } = ensureUserRosterSafety(teams, players, league.meta.userTid, nextSeason));

  // 6. Trim AI squads back down to target composition.
  teams = trimRosterSurplus(teams, players, league.meta.userTid);

  // 6.4. AI<->AI transfer market (summer window, cross-division by design —
  //      no division filtering here, see design doc).
  const marketSeed = hashInts(league.lid, nextSeason, 7);
  const summerMarket = runAITransferMarket(
    teams, players, ceilingTransfers, nextSeason, league.played,
    "summer", "offseason", league.meta.userTid, marketSeed,
  );
  teams = summerMarket.teams;

  // 6.45. Guaranteed ceiling on Division 2 quality, run *after* the market
  //      above (not before) — a Division 1 club can still sell a genuinely
  //      elite player down to Division 2 as ordinary surplus, and this must
  //      catch that in the same offseason it happens, not wait a full cycle.
  //      Any AI-controlled player at or above DIVISION_2_REFUSAL_OVR_THRESHOLD
  //      is moved to whichever (non-user) Division 1 club needs him most, no
  //      market/affordability chance involved (see enforceDivision2Ceiling
  //      for why a soft nudge isn't enough — the dominant drift driver is
  //      relegated clubs simply keeping their existing strong rosters, not
  //      anything a market mechanic alone can fix).
  const { teams: ceilingTeams, transfers: finalTransfers } = enforceDivision2Ceiling(
    teams, players, summerMarket.transfers, nextSeason, league.meta.userTid,
  );
  teams = ceilingTeams;

  // 6.5. Season-start finances on the finalized new-season rosters, scaled
  //      by each club's (possibly just-changed) division.
  const salaryMap = new Map(players.map((p) => [p.pid, p.contract.salary]));
  teams = teams.map((t) => ({
    ...t,
    budget: chargeSeasonStart(t.budget, wageBill([...t.roster, ...t.academyRoster], salaryMap), t.division === 0 ? 1 : 2),
  }));

  // 7. New per-division schedules, new season, back to regular play.
  const newD1Ids = teams.filter((t) => t.division === 0).map((t) => t.tid);
  const newD2Ids = teams.filter((t) => t.division === 1).map((t) => t.tid);
  const schedule = [...generateSchedule(newD1Ids), ...generateSchedule(newD2Ids)];

  return {
    ...league,
    teams,
    players,
    season: nextSeason,
    phase: "regular",
    schedule,
    played: [],
    transfers: finalTransfers,
    winterMarketRunSeason: null,
    seasonHistory: [
      ...league.seasonHistory,
      {
        season: endingSeason,
        table: standings,
        championTid: d1Standings[0].tid,
        teamStats,
        awards,
        divisionsByTid,
      },
    ],
  };
}
