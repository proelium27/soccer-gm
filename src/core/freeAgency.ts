import type { Player, Position } from "./players/types.js";
import { POSITIONS } from "./players/types.js";
import type { StoredTeam } from "./teams/clubs.js";
import type { ActiveLoan } from "./loans.js";
import {
  ROSTER_COMPOSITION, ROSTER_CAP, CONTRACT_LENGTH_MIN, CONTRACT_LENGTH_MAX,
  ACADEMY_ROSTER_CAP, ROSTER_SAFETY_FLOOR, PROSPECT_AGE_MAX,
  AI_PROSPECT_SLOTS, AI_PROSPECT_MAX_AGE, AI_PROSPECT_MIN_POT,
} from "./constants.js";
import {
  contractTerms, extendContract, seasonSalaryForOvr, extendAcademyContract, academyContractTerms,
} from "./contracts.js";
import { mulberry32, hashInts } from "../engine/rng.js";

/**
 * True while a player the user signed from free agency is inside his
 * one-season transfer hold (see Player.faSignedSeason). The user can't sell him
 * — via inbound offers or otherwise — until the season after the signing takes
 * effect, so free agents can't be flipped for a fee the same window. Only ever
 * meaningful for the user's own roster (AI signings don't set faSignedSeason).
 */
export function faTransferLocked(player: Player, season: number): boolean {
  return player.faSignedSeason != null && season <= player.faSignedSeason;
}

/**
 * Pids not currently on any team's roster or academy pool — the signable free
 * agents. A player out on loan is *never* a free agent: he's owned by his
 * parent club and physically on the loanee's roster, so passing `activeLoans`
 * keeps him out of the pool even in the pathological case where some path has
 * dropped him off the loanee roster while the loan is still live (which would
 * otherwise let a club re-sign him, then processLoanReturns hand a second copy
 * back to his parent — the same pid on two rosters). Ownership is tracked by
 * the loan, not by roster membership.
 */
export function freeAgentPids(
  teams: StoredTeam[],
  players: Player[],
  activeLoans: ActiveLoan[] = [],
): Set<number> {
  const rostered = new Set(teams.flatMap((t) => [...t.roster, ...t.academyRoster]));
  const onLoan = new Set(activeLoans.map((l) => l.pid));
  return new Set(
    players.map((p) => p.pid).filter((pid) => !rostered.has(pid) && !onLoan.has(pid)),
  );
}

/**
 * Remove players whose contract expired at or before `season` from every
 * team's roster and academy pool. The players remain in the league's player
 * pool as free agents; only roster/academy membership changes.
 *
 * `onLoanPids` must be every pid still out on loan, and skipping them is a
 * correctness requirement rather than a nicety: a loaned player sits on the
 * *loanee's* roster, so releasing him there strands him on no roster at all
 * while `freeAgentPids` still counts him as rostered (he is on loan), leaving
 * him unsignable, unplayable and invisible until the loan ends. The loan is a
 * fixed-duration commitment; his contract travels home with him and is settled
 * there, which is why the offseason returns loans *before* calling this.
 */
export function releaseExpiredContracts(
  teams: StoredTeam[],
  players: Player[],
  season: number,
  onLoanPids: ReadonlySet<number> = new Set(),
): StoredTeam[] {
  const expired = new Set(
    players
      .filter((p) => p.contract.expiresSeason <= season && !onLoanPids.has(p.pid))
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
 * The order clubs shop the free-agent pool in: worst first, over the WHOLE
 * world as one queue, so the weakest club anywhere gets first pick.
 *
 * Ranked by points per game, not raw points, and the distinction is
 * load-bearing once divisions differ in size (2026-08-29). A 12-club league
 * plays 22 games and a 20-club one 38, so at equal quality the small league's
 * clubs carry ~58% of the points — and raw points put every one of them at the
 * front of the queue whatever they are worth. The pool drains by quality, so
 * picking first is the entire prize: measured on `scripts/divisionSizeProbe.ts`
 * (six countries identical in strength, money and promotion, differing only in
 * club count), a 12-club league's free-agent arrivals averaged **39 OVR**
 * against a 20-club league's **26**, at the same count per club, and that gap
 * alone was ~7 OVR of whole-roster drift over 15 seasons — big leagues signing
 * junk into their holes while small ones signed players. It is what put
 * Scotland, generated second-weakest in the world, top of the world's tier-1
 * mean OVR by season 20.
 *
 * Within one division every club has played the same number of games, so ppg
 * order IS raw-points order and a uniform-size world is byte-identical.
 * Ties keep their input order, as before.
 */
export function freeAgencySigningOrder(
  standings: readonly { tid: number; played: number; points: number }[],
): number[] {
  const ppg = (r: { played: number; points: number }) => (r.played > 0 ? r.points / r.played : 0);
  return [...standings].sort((a, b) => ppg(a) - ppg(b)).map((s) => s.tid);
}

/**
 * AI free-agent signing: each team in `signingOrderTids` (skips `userTid`)
 * fills positional shortfalls against ROSTER_COMPOSITION by greedily signing
 * the best available free agent at that position. Contract terms are a
 * placeholder (ovr-based salary, 1-3 season length) pending real finances.
 * Mutates neither input; returns updated teams and players.
 *
 * Has no Division 2 concept of its own — Division 2's strength ceiling is
 * enforced separately and deterministically by enforceDivision2Ceiling
 * (offseason.ts), so a strong player who lands as a free agent from a
 * Division 2 club can be signed by anyone here without undoing that.
 */
export function runAIFreeAgency(
  teams: StoredTeam[],
  players: Player[],
  season: number,
  rng: () => number,
  userTid: number,
  signingOrderTids: number[],
  activeLoans: ActiveLoan[] = [],
): { teams: StoredTeam[]; players: Player[]; signings: { pid: number; toTid: number }[] } {
  const playerMap = new Map(players.map((p) => [p.pid, { ...p }]));
  const teamMap = new Map(teams.map((t) => [t.tid, { ...t, roster: [...t.roster] }]));

  let pool = [...freeAgentPids(teams, players, activeLoans)];
  // Each free-agent arrival is logged by the caller as a fee-0 transfer (see
  // offseason.ts) so the player's club-by-season history registers the move.
  const signings: { pid: number; toTid: number }[] = [];

  const sign = (team: StoredTeam & { roster: number[] }, signing: Player): void => {
    const length = CONTRACT_LENGTH_MIN
      + Math.floor(rng() * (CONTRACT_LENGTH_MAX - CONTRACT_LENGTH_MIN + 1));
    signing.contract = {
      salary: seasonSalaryForOvr(signing.ovr, signing.pid, season),
      expiresSeason: season + length,
    };
    team.roster.push(signing.pid);
    signings.push({ pid: signing.pid, toTid: team.tid });
    pool = pool.filter((pid) => pid !== signing.pid);
  };

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
        sign(team, signing);
        shortfall--;
      }
    }
  }

  // Second pass: AI clubs poach the best remaining quality free agents to
  // upgrade a position they're already stocked at (same worst-first order, so
  // weaker clubs improve most). Each club adds at most one player per position
  // — a genuine upgrade over its current weakest there — taking that position
  // to ROSTER_COMPOSITION + 1. trimRosterSurplus (run later in the offseason)
  // then keeps the best complement and releases the now-weakest, so the net
  // effect is that the strongest free agents get pulled out of the pool and a
  // weaker player is returned in their place. That drains quality from the
  // market the user shops in — most good free agents are gone before the user
  // gets to them — without ballooning AI squad sizes or their wage bills (trim
  // caps size; wages are charged on the post-trim roster at season start).
  //
  // Contract length is drawn from a per-signing seeded stream, NOT the shared
  // rng, so this pass consumes no shared draws and youth generation downstream
  // stays bit-identical (the RNG-stream-order invariant).
  const poachSign = (team: StoredTeam & { roster: number[] }, signing: Player): void => {
    const lenRng = mulberry32(hashInts(season, team.tid, signing.pid, 5));
    const length = CONTRACT_LENGTH_MIN
      + Math.floor(lenRng() * (CONTRACT_LENGTH_MAX - CONTRACT_LENGTH_MIN + 1));
    signing.contract = {
      salary: seasonSalaryForOvr(signing.ovr, signing.pid, season),
      expiresSeason: season + length,
    };
    team.roster.push(signing.pid);
    signings.push({ pid: signing.pid, toTid: team.tid });
    pool = pool.filter((pid) => pid !== signing.pid);
  };

  for (const tid of signingOrderTids) {
    if (tid === userTid) continue;
    const team = teamMap.get(tid);
    if (!team) continue;

    for (const pos of POSITIONS as readonly Position[]) {
      if (team.roster.length >= ROSTER_CAP) break;
      const atPos = team.roster
        .map((pid) => playerMap.get(pid)!)
        .filter((p) => p.pos === pos);
      // Only positions already at target depth are eligible for a depth
      // upgrade; genuine shortfalls were filled in the first pass above.
      if (atPos.length < ROSTER_COMPOSITION[pos]) continue;
      const weakest = Math.min(...atPos.map((p) => p.ovr));
      const best = pool
        .map((pid) => playerMap.get(pid)!)
        .filter((p) => p.pos === pos)
        .sort((a, b) => b.ovr - a.ovr)[0];
      if (best && best.ovr > weakest) poachSign(team, best);
    }
  }

  // Third pass: prospects. The two passes above rank purely on current ovr, so
  // no AI club had any reason to sign a 16-year-old — measured, that left the
  // unsigned under-22 pool growing without bound (1,485 in season 2 to 3,072 by
  // season 7 on a fresh world) with the user the only actor in the world that
  // valued potential. Each club fills its AI_PROSPECT_SLOTS from the pool,
  // worst-first like the passes above so weak clubs get first pick at the next
  // generation, which is also the upward-mobility direction the country ladder
  // depends on.
  //
  // These sign ON TOP of the depth chart and trimRosterSurplus protects exactly
  // the same count on exactly the same rule, so a club signs a prospect and
  // keeps him rather than churning him straight back out next offseason.
  //
  // Ordering note: free agency is offseason step 4 and youth intake is step 5,
  // so a club fills its slots here without knowing what its own academy is
  // about to produce, and step 6's trim then keeps the best AI_PROSPECT_SLOTS
  // across both. A signing can therefore be released in the same offseason it
  // was made — harmless (he returns to the pool, and the club keeps the better
  // player either way), and rare in practice because supply is the binding
  // constraint: ~275 POT>=70 players are generated a year against 320 clubs'
  // worth of slots, so clubs sit well short of full. Measured, rosters settle
  // ~1 player above the depth chart, not five.
  //
  // Contract length comes from a per-signing seeded stream (tag 6, distinct
  // from the poach pass's 5), NOT the shared rng — so this pass consumes no
  // shared draws and youth generation downstream stays bit-identical, the same
  // RNG-stream-order invariant the poach pass above preserves.
  const prospectSign = (team: StoredTeam & { roster: number[] }, signing: Player): void => {
    const lenRng = mulberry32(hashInts(season, team.tid, signing.pid, 6));
    const length = CONTRACT_LENGTH_MIN
      + Math.floor(lenRng() * (CONTRACT_LENGTH_MAX - CONTRACT_LENGTH_MIN + 1));
    signing.contract = {
      salary: seasonSalaryForOvr(signing.ovr, signing.pid, season),
      expiresSeason: season + length,
    };
    team.roster.push(signing.pid);
    signings.push({ pid: signing.pid, toTid: team.tid });
    pool = pool.filter((pid) => pid !== signing.pid);
  };

  for (const tid of signingOrderTids) {
    if (tid === userTid) continue;
    const team = teamMap.get(tid);
    if (!team) continue;

    // How many prospect slots this club has spare. Counted against the same
    // bar trimRosterSurplus retains on, so the two agree on who is a prospect;
    // a club that already developed five wonderkids signs none.
    const held = team.roster
      .map((pid) => playerMap.get(pid)!)
      .filter(
        (p) => p && season - p.born <= AI_PROSPECT_MAX_AGE && p.potential >= AI_PROSPECT_MIN_POT,
      ).length;

    for (let slot = held; slot < AI_PROSPECT_SLOTS; slot++) {
      if (team.roster.length >= ROSTER_CAP) break;
      const best = pool
        .map((pid) => playerMap.get(pid)!)
        .filter(
          (p) => p && season - p.born <= AI_PROSPECT_MAX_AGE && p.potential >= AI_PROSPECT_MIN_POT,
        )
        .sort((a, b) => b.potential - a.potential || b.ovr - a.ovr || a.pid - b.pid)[0];
      if (!best) break;
      prospectSign(team, best);
    }
  }

  return {
    teams: [...teams.map((t) => teamMap.get(t.tid)!)],
    players: [...players.map((p) => playerMap.get(p.pid)!)],
    signings,
  };
}

/**
 * Release each team's lowest-ovr surplus players (beyond ROSTER_COMPOSITION
 * per position) back to the free agent pool. Without this, youth intake
 * accumulates every season with nothing offsetting it except the occasional
 * retirement/contract expiry, and rosters balloon indefinitely. Skips
 * `userTid` so the user manages their own squad size manually.
 *
 * A loaned-in player (physically on the loanee's roster but owned by his
 * parent) is never trimmed: he leaves only via processLoanReturns at loan
 * end. Pruning him here would orphan the still-live ActiveLoan — he'd become
 * a "free agent" a club could re-sign while the loan later hands a copy back
 * to his parent, duplicating the pid across two rosters. He's also excluded
 * from the position's kept-count so he can't displace a genuine squad member.
 *
 * **Each club also retains up to AI_PROSPECT_SLOTS young high-potential players
 * beyond the depth chart.** Without that the depth chart alone — which ranks on
 * *current* ovr, where a 16-year-old is always last — released 84-86% of every
 * club's youth intake into free agency in the offseason it arrived, wonderkids
 * included, and nothing in AI free agency valued potential enough to pick them
 * back up. See AI_PROSPECT_SLOTS for the measurements and for why retention is
 * additive rather than folded into the ranking: keeping a prospect *instead of*
 * a squad player would change who is selected, and the point is that it doesn't.
 */
export function trimRosterSurplus(
  teams: StoredTeam[],
  players: Player[],
  userTid: number,
  season: number,
  activeLoans: ActiveLoan[] = [],
): StoredTeam[] {
  const playerMap = new Map(players.map((p) => [p.pid, p]));
  const onLoan = new Set(activeLoans.map((l) => l.pid));

  return teams.map((t) => {
    if (t.tid === userTid) return t;

    const byPos = new Map<Position, Player[]>();
    for (const pid of t.roster) {
      if (onLoan.has(pid)) continue;
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

    // Prospect slots, on top of the depth chart above. Ranked by potential
    // (then ovr, then pid — a total order, so the choice can't depend on
    // roster array order) among the young players the chart didn't already
    // keep. Rng-free, like the rest of this function.
    const prospects = [...byPos.values()]
      .flat()
      .filter(
        (p) =>
          !kept.has(p.pid)
          && season - p.born <= AI_PROSPECT_MAX_AGE
          && p.potential >= AI_PROSPECT_MIN_POT,
      )
      .sort((a, b) => b.potential - a.potential || b.ovr - a.ovr || a.pid - b.pid);
    for (const p of prospects.slice(0, AI_PROSPECT_SLOTS)) kept.add(p.pid);

    return { ...t, roster: t.roster.filter((pid) => kept.has(pid) || onLoan.has(pid)) };
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
  activeLoans: ActiveLoan[] = [],
): { teams: StoredTeam[]; players: Player[] } {
  if (!freeAgentPids(teams, players, activeLoans).has(pid)) {
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

  // The one-season transfer hold is keyed to the season the player actually
  // joins the XI: a mid-season signing plays this season; an offseason signing
  // plays next season (the rollover bumps league.season to season + 1).
  const effectiveSeason = phase === "offseason" ? season + 1 : season;
  const contracted = extendContract(players, pid, season);

  return {
    teams: teams.map((t) =>
      t.tid === tid
        ? { ...t, roster: [...t.roster, pid], budget: t.budget - wageCharge }
        : t,
    ),
    players: contracted.map((p) =>
      p.pid === pid ? { ...p, faSignedSeason: effectiveSeason } : p,
    ),
  };
}

/**
 * Sign a free agent into a team's academy pool (used by Incoming Talent for
 * young prospects). No-op if the pid isn't a free agent, isn't age-eligible
 * (PROSPECT_AGE_MAX — enforced here too, not just by Incoming Talent's UI
 * filter, so the action itself can't park an expensive older free agent at
 * the academy's near-zero stipend), the academy is already at
 * ACADEMY_ROSTER_CAP, or (mid-season) the club can't afford it. Academy
 * contracts are a flat stipend (academyContractTerms), not the normal
 * ovr-cubic wage, but the same wage-timing convention as
 * signFreeAgent/promoteFromAcademy still applies: a mid-season signing
 * charges the season's stipend immediately, an offseason one is covered by
 * the next season-start charge (wageBill folds academyRoster in alongside
 * roster — see its call sites).
 */
export function signToAcademy(
  teams: StoredTeam[],
  players: Player[],
  tid: number,
  pid: number,
  season: number,
  phase: "regular" | "offseason",
  activeLoans: ActiveLoan[] = [],
): { teams: StoredTeam[]; players: Player[] } {
  if (!freeAgentPids(teams, players, activeLoans).has(pid)) {
    return { teams, players };
  }
  const player = players.find((p) => p.pid === pid);
  if (!player || season - player.born > PROSPECT_AGE_MAX) {
    return { teams, players };
  }
  const team = teams.find((t) => t.tid === tid);
  if (!team || team.academyRoster.length >= ACADEMY_ROSTER_CAP) {
    return { teams, players };
  }
  const wageCharge = phase === "regular" ? academyContractTerms(season).salary : 0;
  if (wageCharge > team.budget) return { teams, players };

  return {
    teams: teams.map((t) =>
      t.tid === tid
        ? { ...t, academyRoster: [...t.academyRoster, pid], budget: t.budget - wageCharge }
        : t,
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
 * requires exactly one) — falling back to the open free-agent pool if the
 * academy itself has no GK, since generateYouthIntake's uniform position
 * draw means the academy can easily lack one and the whole point of this
 * function is to guarantee a fieldable team, not just a headcount — then by
 * ovr from the academy until the floor is reached or it runs out. A no-op
 * for every other team, and for a healthily managed user roster. Called once
 * per offseason from simOffseason.
 */
export function ensureUserRosterSafety(
  teams: StoredTeam[],
  players: Player[],
  userTid: number,
  season: number,
  activeLoans: ActiveLoan[] = [],
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
    const academyGk = academy
      .map((pid) => playerMap.get(pid)!)
      .filter((p) => p.pos === "GK")
      .sort((a, b) => b.ovr - a.ovr)[0];
    if (academyGk) {
      promote(academyGk.pid);
    } else {
      // The academy has no GK either — last resort, sign the best available
      // free-agent GK so the team can't end up call-up-"safe" but GK-less.
      const faGk = [...freeAgentPids(teams, players, activeLoans)]
        .map((fpid) => playerMap.get(fpid))
        .filter((p): p is Player => p != null && p.pos === "GK")
        .sort((a, b) => b.ovr - a.ovr)[0];
      if (faGk) promote(faGk.pid);
    }
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
