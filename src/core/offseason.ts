import type { LeagueStore } from "./leagueState.js";
import type { Player } from "./players/types.js";
import type { StoredTeam } from "./teams/clubs.js";
import type { Competition } from "./competitions.js";
import { progressPlayer, rollRetirement } from "./players/progression.js";
import { generateYouthIntake } from "./players/youth.js";
import {
  releaseExpiredContracts, runAIFreeAgency, trimRosterSurplus, ensureUserRosterSafety,
} from "./freeAgency.js";
import { runAITransferMarket } from "./ai/transferMarket.js";
import { runAIContractRenewals } from "./ai/renewals.js";
import { enforceDivision2Ceiling } from "./ai/divisionCeiling.js";
import { reconcileScoutingObserved } from "./scouting/potentialFog.js";
import { processLoanReturns, runAILoanMarket } from "./loans.js";
import { computeStandings, computeTeamSeasonStats, type StandingsRow } from "./standings.js";
import { computeSeasonAwards, type SeasonAwards } from "./awards.js";
import { buildCupState } from "./cup/cup.js";
import { computeCountrySwaps, applyCompetitionSwaps, stepAcademyBaseConvergence } from "./promotion.js";
import { generateSchedule } from "./schedule.js";
import { updateHype } from "./finance/hype.js";
import { settleSeasonEnd, chargeSeasonStart, wageBill } from "./finance/budget.js";
import { academyContractTerms } from "./contracts.js";
import { SCOUTING_SPEND_DEFAULT } from "./constants.js";
import { clampScoutingSpend } from "./finance/scouting.js";
import { tierOf, competitionOf } from "./competitions.js";
import { hashInts } from "../engine/rng.js";

/** Awards for the season that just ended, computed separately per competition from players' current club membership. */
function awardsByCompetition(
  players: Player[],
  teams: StoredTeam[],
  competitions: Competition[],
  season: number,
): Record<number, SeasonAwards> {
  const result: Record<number, SeasonAwards> = {};
  for (const comp of competitions) {
    const roster = new Set(teams.filter((t) => t.compId === comp.id).flatMap((t) => t.roster));
    result[comp.id] = computeSeasonAwards(players.filter((p) => roster.has(p.pid)), season);
  }
  return result;
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

  // Snapshotted before any roster/competition change below, from
  // league.players (not the `players` variable mutated further down) so a
  // player who retires this offseason still gets credit for the season he
  // just finished, and competition membership reflects who actually played
  // where.
  const compsByTid: Record<number, number> = {};
  for (const t of league.teams) compsByTid[t.tid] = t.compId;
  const awards = awardsByCompetition(league.players, league.teams, league.competitions, endingSeason);

  // 0. Proactive AI contract renewals (cross-division: a club's own player,
  //    regardless of which division that club plays in).
  const renewals = runAIContractRenewals(
    league.teams, league.players, nextSeason, league.meta.userTid, league.played,
    hashInts(league.lid, nextSeason, 9), league.competitions,
  );

  // 1. Release expired contracts to the free agent pool.
  let teams: StoredTeam[] = releaseExpiredContracts(renewals.teams, renewals.players, endingSeason);

  // 1.5. Loan returns due this rollover: any player whose loan ends before
  //      nextSeason begins goes back to his parent club now — early enough
  //      that free agency below can still fill any hole this creates, and
  //      before season-start wages are charged so they land on the right club.
  const loanReturns = processLoanReturns(teams, league.activeLoans, league.transfers, nextSeason);
  teams = loanReturns.teams;
  let activeLoans = loanReturns.activeLoans;

  // 2. Progress every remaining player's ratings; heal any lingering injury.
  //    Academy players have no senior appearances to read minutes from (they
  //    don't play senior matches), so they're assumed to play a full season
  //    rather than being penalized with the worst-case minutesFactor.
  const academyPids = new Set(teams.flatMap((t) => t.academyRoster));
  let players: Player[] = renewals.players.map((p) => {
    const progressed = progressPlayer(rng, p, endingSeason, academyPids.has(p.pid));
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

  // 3.5. Per-competition standings, rank-based settlement, and hype update.
  //      Each competition's own table is computed independently — pooling
  //      multiple competitions into one table would misapply prize-tier rank
  //      cutoffs (PRIZE_TOP_5_CUTOFF etc. assume a single competition's table
  //      size) and the hype curve to a league neither was tuned for.
  const tablesByCompId = new Map<number, StandingsRow[]>();
  for (const comp of league.competitions) {
    const compTids = teams.filter((t) => t.compId === comp.id).map((t) => t.tid);
    const compTidSet = new Set(compTids);
    tablesByCompId.set(
      comp.id,
      computeStandings(compTids, league.played.filter((m) => compTidSet.has(m.home))),
    );
  }
  const standings = league.competitions.flatMap((comp) => tablesByCompId.get(comp.id)!);
  const teamStats = computeTeamSeasonStats(teams.map((t) => t.tid), league.played);

  const settle = (rows: StandingsRow[], compId: number): void => {
    const tier = tierOf(league.competitions, compId);
    const defaultRank = rows.length;
    const rankByTid = new Map(rows.map((row, i) => [row.tid, i + 1]));
    const rowByTid = new Map(rows.map((row) => [row.tid, row]));
    teams = teams.map((t) => {
      if (t.compId !== compId) return t;
      const rank = rankByTid.get(t.tid) ?? defaultRank;
      const row = rowByTid.get(t.tid);
      const budget = settleSeasonEnd(t.budget, rank, t.hype, t.scoutingSpend, tier);
      const hype = row ? updateHype(t.hype, row, rank) : t.hype;
      return { ...t, budget, hype, scoutingSpend: clampScoutingSpend(SCOUTING_SPEND_DEFAULT, budget) };
    });
  };
  for (const comp of league.competitions) settle(tablesByCompId.get(comp.id)!, comp.id);

  // 3.6. Promotion/relegation: per country, bottom PROMOTION_RELEGATION_COUNT
  //      of its tier-1 table swap with top PROMOTION_RELEGATION_COUNT of its
  //      tier-2 table, using the tables just computed above (the season that
  //      actually just played out). Then every mid-convergence team's
  //      academyBase moves one step closer to its current competition's
  //      strength band.
  const swaps = computeCountrySwaps(league.competitions, tablesByCompId);
  teams = applyCompetitionSwaps(teams, swaps);
  teams = stepAcademyBaseConvergence(teams, league.competitions);

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
  let ceilingTransfers = loanReturns.transfers;
  ({ teams, transfers: ceilingTransfers } = enforceDivision2Ceiling(
    teams, players, ceilingTransfers, nextSeason, league.meta.userTid, league.competitions,
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
    const homeCountry = competitionOf(league.competitions, t.compId).country;
    const { players: youth, nextPid: updatedNextPid } = generateYouthIntake(
      rng, t.academyBase, nextSeason, nextPid, genSeed, homeCountry,
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
    "summer", "offseason", league.meta.userTid, marketSeed, league.competitions,
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
  const { teams: ceilingTeams, transfers: postCeilingTransfers } = enforceDivision2Ceiling(
    teams, players, summerMarket.transfers, nextSeason, league.meta.userTid, league.competitions,
  );
  teams = ceilingTeams;

  // 6.46. AI<->AI loan market (summer window): young, buried AI players loan
  //       out to needier AI clubs — see loans.ts's runAILoanMarket. The
  //       user's club never participates here; loaning the user's own
  //       players in/out is a manual action via the Loans page.
  const loanMarketSeed = hashInts(league.lid, nextSeason, 11);
  const loanMarket = runAILoanMarket(
    teams, players, activeLoans, postCeilingTransfers, nextSeason, league.played,
    "summer", league.meta.userTid, loanMarketSeed, league.competitions,
  );
  teams = loanMarket.teams;
  activeLoans = loanMarket.activeLoans;
  const finalTransfers = loanMarket.transfers;

  // 6.5. Season-start finances on the finalized new-season rosters, scaled
  //      by each club's (possibly just-changed) competition tier.
  const salaryMap = new Map(players.map((p) => [p.pid, p.contract.salary]));
  teams = teams.map((t) => ({
    ...t,
    budget: chargeSeasonStart(
      t.budget, wageBill([...t.roster, ...t.academyRoster], salaryMap), tierOf(league.competitions, t.compId),
    ),
  }));

  // 7. New per-competition schedules, new season, back to regular play.
  const schedule = league.competitions.flatMap((comp) =>
    generateSchedule(teams.filter((t) => t.compId === comp.id).map((t) => t.tid)),
  );

  // Drop any listing for a player no longer on the user's senior roster
  // (sold, released, retired, or just loaned out this offseason) — a stale
  // listing is otherwise inert (loanOfferCandidates already requires roster
  // membership) but there's no reason to let it accumulate.
  const userRosterAfter = new Set(teams.find((t) => t.tid === league.meta.userTid)?.roster ?? []);
  const loanListings = league.loanListings.filter((l) => userRosterAfter.has(l.pid));

  // Fog-of-war: record any player newly on the user's senior roster as
  // first-observed this new season, and drop those who left, so potential
  // estimates sharpen with tenure (see src/core/scouting/potentialFog.ts).
  teams = teams.map((t) =>
    t.tid === league.meta.userTid
      ? { ...t, scoutingObserved: reconcileScoutingObserved(t.scoutingObserved, t.roster, nextSeason) }
      : t,
  );

  return {
    ...league,
    teams,
    players,
    season: nextSeason,
    phase: "regular",
    schedule,
    played: [],
    transfers: finalTransfers,
    activeLoans,
    loanListings,
    winterMarketRunSeason: null,
    // Archive the season's completed Continental Cup and seed the next one
    // from the tier-1 tables just decided above (top CUP_TEAMS_PER_LEAGUE of
    // each). buildCupState returns null if a full bracket can't be fielded.
    cup: buildCupState(league.competitions, tablesByCompId, nextSeason),
    cupHistory: league.cup ? [...league.cupHistory, league.cup] : league.cupHistory,
    seasonHistory: [
      ...league.seasonHistory,
      {
        season: endingSeason,
        table: standings,
        teamStats,
        awards,
        compsByTid,
        championTidByCompId: Object.fromEntries(
          league.competitions
            .filter((c) => c.tier === 1)
            .map((c) => [c.id, tablesByCompId.get(c.id)![0].tid]),
        ),
      },
    ],
  };
}
