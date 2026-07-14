import type { Player, Position } from "./players/types.js";
import { POSITIONS } from "./players/types.js";
import type { StoredTeam } from "./teams/clubs.js";
import {
  ROSTER_COMPOSITION, ROSTER_CAP, CONTRACT_LENGTH_MIN, CONTRACT_LENGTH_MAX,
  ACADEMY_ROSTER_CAP, ROSTER_SAFETY_FLOOR,
} from "./constants.js";
import {
  contractTerms, extendContract, seasonSalaryForOvr, extendAcademyContract,
} from "./contracts.js";

/** Pids not currently on any team's roster or academy pool. */
export function freeAgentPids(teams: StoredTeam[], players: Player[]): Set<number> {
  const rostered = new Set(teams.flatMap((t) => [...t.roster, ...t.academyRoster]));
  return new Set(
    players.map((p) => p.pid).filter((pid) => !rostered.has(pid)),
  );
}

/**
 * Remove players whose contract expired at or before `season` from every
 * team's roster and academy pool. The players remain in the league's player
 * pool as free agents; only roster/academy membership changes.
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
    academyRoster: t.academyRoster.filter((pid) => !expired.has(pid)),
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
          salary: seasonSalaryForOvr(signing.ovr, signing.pid, season),
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

/**
 * Depth floor shared by the transfer market (isForSale) and manual releases:
 * losing `pid` must leave the club with at least half its target complement
 * (ROSTER_COMPOSITION, rounded up) at that position. Without this floor a
 * user could release their way down to an unfieldable squad — an empty side
 * crashes the match engine and the state persists, bricking the save.
 */
export function keepsDepthFloor(
  team: StoredTeam,
  players: Map<number, Player>,
  pid: number,
): boolean {
  const p = players.get(pid);
  if (!p || !team.roster.includes(pid)) return false;
  const depthAfter =
    team.roster.filter((q) => players.get(q)?.pos === p.pos).length - 1;
  return depthAfter >= Math.ceil(ROSTER_COMPOSITION[p.pos] / 2);
}

/**
 * Release a player from a team's roster back to the free agent pool. No-op
 * if the release would take the squad below the positional depth floor.
 */
export function releasePlayer(
  teams: StoredTeam[],
  players: Player[],
  tid: number,
  pid: number,
): StoredTeam[] {
  const team = teams.find((t) => t.tid === tid);
  if (!team) return teams;
  const playerMap = new Map(players.map((p) => [p.pid, p]));
  if (!keepsDepthFloor(team, playerMap, pid)) return teams;
  return teams.map((t) =>
    t.tid === tid ? { ...t, roster: t.roster.filter((p) => p !== pid) } : t,
  );
}

/**
 * Sign a specific free agent to a specific team (used by the user-facing free
 * agency page). No-op if the pid isn't actually a free agent or the team is
 * already at ROSTER_CAP. Terms are the deterministic one-button contract
 * (age-based length, ovr-based salary) so the sign button can display them
 * up front. Wages are paid up front at each season's start, so a signing
 * during the regular phase charges the new contract's full season salary at
 * signing (no-op if the team can't afford it); offseason signings cost
 * nothing here — the upcoming season-start charge covers them.
 */
export function signFreeAgent(
  teams: StoredTeam[],
  players: Player[],
  tid: number,
  pid: number,
  season: number,
  phase: "regular" | "offseason",
): { teams: StoredTeam[]; players: Player[] } {
  if (!freeAgentPids(teams, players).has(pid)) {
    return { teams, players };
  }
  const team = teams.find((t) => t.tid === tid);
  if (!team || team.roster.length >= ROSTER_CAP) {
    return { teams, players };
  }
  const player = players.find((p) => p.pid === pid);
  if (!player) return { teams, players };
  const wageCharge = phase === "regular" ? contractTerms(player, season).salary : 0;
  if (wageCharge > team.budget) return { teams, players };

  return {
    teams: teams.map((t) =>
      t.tid === tid
        ? { ...t, roster: [...t.roster, pid], budget: t.budget - wageCharge }
        : t,
    ),
    players: extendContract(players, pid, season),
  };
}

/**
 * Sign a free agent into a team's academy pool (used by Incoming Talent for
 * young prospects). No-op if the pid isn't a free agent or the academy is
 * already at ACADEMY_ROSTER_CAP. Academy contracts are a flat stipend
 * (academyContractTerms), not the normal ovr-cubic wage — cheap enough that
 * it's charged immediately regardless of phase, unlike the season-salary
 * charge signFreeAgent applies mid-season.
 */
export function signToAcademy(
  teams: StoredTeam[],
  players: Player[],
  tid: number,
  pid: number,
  season: number,
): { teams: StoredTeam[]; players: Player[] } {
  if (!freeAgentPids(teams, players).has(pid)) {
    return { teams, players };
  }
  const team = teams.find((t) => t.tid === tid);
  if (!team || team.academyRoster.length >= ACADEMY_ROSTER_CAP) {
    return { teams, players };
  }
  return {
    teams: teams.map((t) =>
      t.tid === tid ? { ...t, academyRoster: [...t.academyRoster, pid] } : t,
    ),
    players: extendAcademyContract(players, pid, season),
  };
}

/**
 * Promote an academy player onto the senior roster: moves the pid from
 * academyRoster to roster and re-contracts him at the normal ovr-cubic wage
 * (contractTerms) instead of the academy stipend — he's now competing for a
 * real squad slot. No-op if he isn't in the team's academy or the roster is
 * already at ROSTER_CAP. Mirrors signFreeAgent's wage-timing: a mid-season
 * promotion charges the new contract's full season salary immediately
 * (no-op if unaffordable); an offseason promotion is covered by the next
 * season-start charge.
 */
export function promoteFromAcademy(
  teams: StoredTeam[],
  players: Player[],
  tid: number,
  pid: number,
  season: number,
  phase: "regular" | "offseason",
): { teams: StoredTeam[]; players: Player[] } {
  const team = teams.find((t) => t.tid === tid);
  if (!team || !team.academyRoster.includes(pid) || team.roster.length >= ROSTER_CAP) {
    return { teams, players };
  }
  const player = players.find((p) => p.pid === pid);
  if (!player) return { teams, players };
  const wageCharge = phase === "regular" ? contractTerms(player, season).salary : 0;
  if (wageCharge > team.budget) return { teams, players };

  return {
    teams: teams.map((t) =>
      t.tid === tid
        ? {
            ...t,
            academyRoster: t.academyRoster.filter((p) => p !== pid),
            roster: [...t.roster, pid],
            budget: t.budget - wageCharge,
          }
        : t,
    ),
    players: extendContract(players, pid, season),
  };
}

/**
 * Release an academy player back to the free agent pool (the "choose not to
 * re-sign" path, or a manual cut) — no depth floor, unlike releasePlayer, since
 * the academy has no fixed composition target to protect.
 */
export function releaseAcademyPlayer(
  teams: StoredTeam[],
  tid: number,
  pid: number,
): StoredTeam[] {
  const team = teams.find((t) => t.tid === tid);
  if (!team || !team.academyRoster.includes(pid)) return teams;
  return teams.map((t) =>
    t.tid === tid ? { ...t, academyRoster: t.academyRoster.filter((p) => p !== pid) } : t,
  );
}

/**
 * Emergency call-up: auto-promotes from the user's own academy if their
 * senior roster has fallen dangerously thin (see ROSTER_SAFETY_FLOOR for
 * why this exists). GK first if the roster has none at all (fielding
 * requires exactly one), then by ovr until the floor is reached or the
 * academy runs out. A no-op for every other team, and for a healthily
 * managed user roster. Called once per offseason from simOffseason.
 */
export function ensureUserRosterSafety(
  teams: StoredTeam[],
  players: Player[],
  userTid: number,
  season: number,
): { teams: StoredTeam[]; players: Player[] } {
  const team = teams.find((t) => t.tid === userTid);
  if (!team) return { teams, players };

  const playerMap = new Map(players.map((p) => [p.pid, p]));
  const roster = [...team.roster];
  let academy = [...team.academyRoster];
  const promoted = new Map<number, Player>();

  function promote(pid: number): void {
    const p = playerMap.get(pid)!;
    const terms = contractTerms(p, season);
    promoted.set(pid, { ...p, contract: { salary: terms.salary, expiresSeason: terms.expiresSeason } });
    roster.push(pid);
    academy = academy.filter((q) => q !== pid);
  }

  if (!roster.some((pid) => playerMap.get(pid)?.pos === "GK")) {
    const bestGk = academy
      .map((pid) => playerMap.get(pid)!)
      .filter((p) => p.pos === "GK")
      .sort((a, b) => b.ovr - a.ovr)[0];
    if (bestGk) promote(bestGk.pid);
  }

  while (roster.length < ROSTER_SAFETY_FLOOR && academy.length > 0) {
    const best = academy
      .map((pid) => playerMap.get(pid)!)
      .sort((a, b) => b.ovr - a.ovr)[0];
    promote(best.pid);
  }

  if (promoted.size === 0) return { teams, players };

  return {
    teams: teams.map((t) => (t.tid === userTid ? { ...t, roster, academyRoster: academy } : t)),
    players: players.map((p) => promoted.get(p.pid) ?? p),
  };
}
