import type { Player } from "../players/types.js";
import type { StoredTeam } from "../teams/clubs.js";
import type { PlayedMatch } from "../standings.js";
import { deriveLeagueContexts } from "./clubContext.js";
import { valueToClub } from "./evaluate.js";
import { canExtend, contractTerms, extendContract } from "../contracts.js";
import { AI_RENEWAL_MARGIN } from "../constants.js";

/**
 * Proactive AI contract renewals: the season before a rostered player's
 * contract would expire, his own club decides whether to extend him now
 * based on valueToClub vs. the wage he'd command — reusing the same
 * evaluation core phases 1-3 build on, so a club keeps players it still
 * rates and lets the rest walk (or get sold earlier via the existing
 * AI↔AI transfer market) without any scripted "he's aging, replace him"
 * rule. The user's club is untouched; their renewals stay a manual UI
 * action. Deterministic — no rng, so it can't perturb any other stream.
 */
export function runAIContractRenewals(
  teams: StoredTeam[],
  players: Player[],
  nextSeason: number,
  userTid: number,
  playedThisSeason: PlayedMatch[],
): { teams: StoredTeam[]; players: Player[] } {
  const contexts = deriveLeagueContexts({
    teams, players, season: nextSeason, played: playedThisSeason,
  });

  let updatedPlayers = players;
  const playerByPid = new Map(players.map((p) => [p.pid, p]));

  for (const team of teams) {
    if (team.tid === userTid) continue;
    const ctx = contexts.get(team.tid);
    if (!ctx) continue;

    for (const pid of team.roster) {
      const player = playerByPid.get(pid);
      if (!player || !canExtend(player, nextSeason)) continue;

      const terms = contractTerms(player, nextSeason);
      const value = valueToClub(player, ctx);
      if (value >= terms.salary * AI_RENEWAL_MARGIN) {
        updatedPlayers = extendContract(updatedPlayers, pid, nextSeason);
      }
    }
  }

  return { teams, players: updatedPlayers };
}
