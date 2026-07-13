import type { Player } from "../players/types.js";
import type { StoredTeam } from "../teams/clubs.js";
import type { PlayedMatch } from "../standings.js";
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
 */
export function runAIContractRenewals(
  teams: StoredTeam[],
  players: Player[],
  nextSeason: number,
  userTid: number,
  playedThisSeason: PlayedMatch[],
  seed: number,
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
      const jitter = mulberry32(hashInts(seed, pid));
      const value = perceivedValueToClub(player, ctx, jitter);
      if (value >= terms.salary * AI_RENEWAL_MARGIN) {
        updatedPlayers = extendContract(updatedPlayers, pid, nextSeason);
      }
    }
  }

  return { teams, players: updatedPlayers };
}
