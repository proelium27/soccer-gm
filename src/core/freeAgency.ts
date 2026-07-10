import type { Player, Position } from "./players/types.js";
import { POSITIONS } from "./players/types.js";
import type { StoredTeam } from "./teams/clubs.js";
import {
  ROSTER_COMPOSITION, SALARY_PER_OVR, CONTRACT_LENGTH_MIN, CONTRACT_LENGTH_MAX,
} from "./constants.js";
import { contractTerms } from "./contracts.js";

/** Pids not currently on any team's roster. */
export function freeAgentPids(teams: StoredTeam[], players: Player[]): Set<number> {
  const rostered = new Set(teams.flatMap((t) => t.roster));
  return new Set(
    players.map((p) => p.pid).filter((pid) => !rostered.has(pid)),
  );
}

/**
 * Remove players whose contract expired at or before `season` from every
 * team's roster. The players remain in the league's player pool as free
 * agents; only roster membership changes.
 */
export function releaseExpiredContracts(
  teams: StoredTeam[],
  players: Player[],
  season: number,
): StoredTeam[] {
  const expired = new Set(
    players
      .filter((p) => p.contract.expiresSeason <= season)
      .map((p) => p.pid),
  );
  return teams.map((t) => ({
    ...t,
    roster: t.roster.filter((pid) => !expired.has(pid)),
  }));
}

function positionCounts(roster: number[], players: Map<number, Player>): Record<Position, number> {
  const counts = Object.fromEntries(POSITIONS.map((p) => [p, 0])) as Record<Position, number>;
  for (const pid of roster) {
    const p = players.get(pid);
    if (p) counts[p.pos]++;
  }
  return counts;
}

/**
 * AI free-agent signing: each team in `signingOrderTids` (skips `userTid`)
 * fills positional shortfalls against ROSTER_COMPOSITION by greedily signing
 * the best available free agent at that position. Contract terms are a
 * placeholder (ovr-based salary, 1-3 season length) pending real finances.
 * Mutates neither input; returns updated teams and players.
 */
export function runAIFreeAgency(
  teams: StoredTeam[],
  players: Player[],
  season: number,
  rng: () => number,
  userTid: number,
  signingOrderTids: number[],
): { teams: StoredTeam[]; players: Player[] } {
  const playerMap = new Map(players.map((p) => [p.pid, { ...p }]));
  const teamMap = new Map(teams.map((t) => [t.tid, { ...t, roster: [...t.roster] }]));

  let pool = [...freeAgentPids(teams, players)];

  for (const tid of signingOrderTids) {
    if (tid === userTid) continue;
    const team = teamMap.get(tid);
    if (!team) continue;

    const counts = positionCounts(team.roster, playerMap);
    for (const pos of POSITIONS as readonly Position[]) {
      let shortfall = ROSTER_COMPOSITION[pos] - counts[pos];
      while (shortfall > 0) {
        const candidates = pool
          .map((pid) => playerMap.get(pid)!)
          .filter((p) => p.pos === pos)
          .sort((a, b) => b.ovr - a.ovr);
        const signing = candidates[0];
        if (!signing) break;

        const length = CONTRACT_LENGTH_MIN
          + Math.floor(rng() * (CONTRACT_LENGTH_MAX - CONTRACT_LENGTH_MIN + 1));
        signing.contract = {
          salary: SALARY_PER_OVR * signing.ovr,
          expiresSeason: season + length,
        };
        team.roster.push(signing.pid);
        pool = pool.filter((pid) => pid !== signing.pid);
        shortfall--;
      }
    }
  }

  return {
    teams: [...teams.map((t) => teamMap.get(t.tid)!)],
    players: [...players.map((p) => playerMap.get(p.pid)!)],
  };
}

/**
 * Release each team's lowest-ovr surplus players (beyond ROSTER_COMPOSITION
 * per position) back to the free agent pool. Without this, youth intake
 * accumulates every season with nothing offsetting it except the occasional
 * retirement/contract expiry, and rosters balloon indefinitely. Skips
 * `userTid` so the user manages their own squad size manually.
 */
export function trimRosterSurplus(
  teams: StoredTeam[],
  players: Player[],
  userTid: number,
): StoredTeam[] {
  const playerMap = new Map(players.map((p) => [p.pid, p]));

  return teams.map((t) => {
    if (t.tid === userTid) return t;

    const byPos = new Map<Position, Player[]>();
    for (const pid of t.roster) {
      const p = playerMap.get(pid);
      if (!p) continue;
      const list = byPos.get(p.pos) ?? [];
      list.push(p);
      byPos.set(p.pos, list);
    }

    const kept = new Set<number>();
    for (const pos of POSITIONS as readonly Position[]) {
      const squad = (byPos.get(pos) ?? []).sort((a, b) => b.ovr - a.ovr);
      for (const p of squad.slice(0, ROSTER_COMPOSITION[pos])) kept.add(p.pid);
    }

    return { ...t, roster: t.roster.filter((pid) => kept.has(pid)) };
  });
}

/** Release a player from a team's roster back to the free agent pool. */
export function releasePlayer(
  teams: StoredTeam[],
  tid: number,
  pid: number,
): StoredTeam[] {
  return teams.map((t) =>
    t.tid === tid ? { ...t, roster: t.roster.filter((p) => p !== pid) } : t,
  );
}

/**
 * Sign a specific free agent to a specific team (used by the user-facing free
 * agency page). No-op if the pid isn't actually a free agent. Terms are the
 * deterministic one-button contract (age-based length, ovr-based salary) so
 * the sign button can display them up front.
 */
export function signFreeAgent(
  teams: StoredTeam[],
  players: Player[],
  tid: number,
  pid: number,
  season: number,
): { teams: StoredTeam[]; players: Player[] } {
  if (!freeAgentPids(teams, players).has(pid)) {
    return { teams, players };
  }

  return {
    teams: teams.map((t) =>
      t.tid === tid ? { ...t, roster: [...t.roster, pid] } : t,
    ),
    players: players.map((p) => {
      if (p.pid !== pid) return p;
      const terms = contractTerms(p, season);
      return { ...p, contract: { salary: terms.salary, expiresSeason: terms.expiresSeason } };
    }),
  };
}
