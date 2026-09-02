import type { Player } from "../players/types.js";
import type { StoredTeam } from "../teams/clubs.js";
import type { PlayedMatch } from "../standings.js";
import type { Competition } from "../competitions.js";
import type { ActiveLoan } from "../loans.js";
import { deriveLeagueContexts } from "./clubContext.js";
import { perceivedValueToClub } from "./evaluate.js";
import { canExtend, contractTerms, extendContract } from "../contracts.js";
import { AI_RENEWAL_MARGIN } from "../constants.js";
import { mulberry32, hashInts } from "../../engine/rng.js";

/**
 * Proactive AI contract renewals: the season before a rostered player's
 * contract would expire, his own club decides whether to extend him now
 * based on its (scouting-noised) perceivedValueToClub vs. the wage he'd
 * command — reusing the same evaluation core phases 1-3 build on, so a club
 * keeps players it still rates and lets the rest walk (or get sold earlier
 * via the existing AI↔AI transfer market) without any scripted "he's aging,
 * replace him" rule. A club's own scouting noise (phase 5) means a
 * poorly-scouted club can misjudge its own player, same as it can misjudge
 * one it's buying. The user's club is untouched; their renewals stay a
 * manual UI action. Seeded independently per player so it can't perturb any
 * other stream.
 *
 * A club decides about the players it *owns*, not the ones on its roster, and
 * on a loan those differ: a loaned-in player is judged by his parent club, not
 * by the club currently borrowing him. Getting this wrong was not cosmetic —
 * it put every loaned-out player's contract in the hands of a club with no
 * stake in him, and left his actual owner (who cannot see him on any roster)
 * no way to renew at all, so he quietly ran his deal down while away and left
 * on a free the moment he got home.
 *
 * No Division 2 refusal check needed here: enforceDivisionCeilings
 * (offseason.ts) moves any Division 2 player above the OVR line to
 * Division 1 regardless of contract length, so an AI club renewing him
 * first doesn't block that move — it just means he changes clubs with a
 * contract already in place, same as any other transfer.
 */
export function runAIContractRenewals(
  teams: StoredTeam[],
  players: Player[],
  nextSeason: number,
  userTid: number,
  playedThisSeason: PlayedMatch[],
  seed: number,
  competitions: Competition[],
  activeLoans: ActiveLoan[] = [],
): { teams: StoredTeam[]; players: Player[] } {
  const contexts = deriveLeagueContexts({
    teams, players, season: nextSeason, played: playedThisSeason, competitions,
  });

  let updatedPlayers = players;
  const playerByPid = new Map(players.map((p) => [p.pid, p]));

  // Ownership, not roster membership: drop the players a club is only
  // borrowing, add back the ones it has sent out (see the note above).
  const loanedIn = new Set(activeLoans.map((l) => l.pid));
  const loanedOut = new Map<number, number[]>();
  for (const l of activeLoans) {
    loanedOut.set(l.parentTid, [...(loanedOut.get(l.parentTid) ?? []), l.pid]);
  }

  for (const team of teams) {
    if (team.tid === userTid) continue;
    const ctx = contexts.get(team.tid);
    if (!ctx) continue;

    const owned = [
      ...team.roster.filter((pid) => !loanedIn.has(pid)),
      ...(loanedOut.get(team.tid) ?? []),
    ];
    for (const pid of owned) {
      const player = playerByPid.get(pid);
      if (!player || !canExtend(player, nextSeason)) continue;

      const terms = contractTerms(player, nextSeason);
      const jitter = mulberry32(hashInts(seed, pid));
      // Deliberately the buy-side valuation, not the keep-side one, even though
      // this is a club judging a player it already has. AI_RENEWAL_MARGIN is
      // calibrated against these numbers, and keep-side values are much higher
      // (see ValuationSide) — feeding them in here re-signs essentially every
      // player in the world, so nobody's contract ever runs down and free
      // agency dries up completely. Measured: the AI free-agent pool collapsed
      // and offseason.ts step 4 signed nobody at all. Renewal realism is worth
      // revisiting on its own terms, with AI_RENEWAL_MARGIN retuned to match.
      const value = perceivedValueToClub(player, ctx, jitter);
      if (value >= terms.salary * AI_RENEWAL_MARGIN) {
        updatedPlayers = extendContract(updatedPlayers, pid, nextSeason);
      }
    }
  }

  return { teams, players: updatedPlayers };
}
