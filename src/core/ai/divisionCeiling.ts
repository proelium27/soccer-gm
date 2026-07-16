import type { Player, Position } from "../players/types.js";
import type { StoredTeam } from "../teams/clubs.js";
import type { CompletedTransfer } from "../transfers/negotiation.js";
import { DIVISION_2_REFUSAL_OVR_THRESHOLD, ROSTER_CAP } from "../constants.js";

/**
 * Guaranteed, deterministic ceiling on how good an AI-controlled Division 2
 * player is allowed to stay: any rostered player at or above
 * DIVISION_2_REFUSAL_OVR_THRESHOLD is moved to a Division 1 club every
 * offseason, no market/affordability chance involved. Skips the user's club
 * on both sides — as seller (their roster is never auto-modified) and as
 * buyer (never force-added to without consent) — matching every other
 * AI-automation convention in this codebase.
 *
 * This replaces earlier probabilistic nudges (a per-club valueToClub match,
 * then a flat OVR-based "refuses to re-sign" preference feeding free agency
 * and the AI market) as the primary drift-fighting mechanism: a 30-season
 * dynasty audit found Division 2's strength ceiling kept climbing toward
 * Division 1's even with the AI transfer market disabled entirely — the
 * dominant driver is simply that a relegated club keeps its full-strength
 * existing roster (only future youth intake is anchored weaker), and three
 * clubs relegate every single season. No amount of nudging a *chance* that
 * a buyer shows up can close a gap driven by players who were never put up
 * for sale in the first place. A hard, unconditional move is the only thing
 * that reliably empties Division 2 of anyone above the line every season,
 * regardless of contract status, club wealth, or whether any specific AI
 * buyer happened to want him that window.
 *
 * The receiving Division 1 club is picked deterministically — whichever
 * (non-user) Division 1 club currently has the lowest average OVR at his
 * position — recomputed after each move so multiple qualifying players in
 * the same offseason spread across different needy clubs rather than
 * piling onto a single one. If the receiving club is already at ROSTER_CAP,
 * its own weakest player (any position) is released to the free agent pool
 * to make room, so the move always succeeds. No fee changes hands — this
 * is a structural correction, not a negotiated transfer — but it's still
 * logged as a zero-fee CompletedTransfer for News Feed/Finance visibility.
 */
export function enforceDivision2Ceiling(
  teams: StoredTeam[],
  players: Player[],
  transfers: CompletedTransfer[],
  season: number,
  userTid: number,
): { teams: StoredTeam[]; players: Player[]; transfers: CompletedTransfer[] } {
  const playerByPid = new Map(players.map((p) => [p.pid, p]));
  const rosterByTid = new Map(teams.map((t) => [t.tid, [...t.roster]]));
  const divisionByTid = new Map(teams.map((t) => [t.tid, t.division]));
  const executed: CompletedTransfer[] = [];

  const avgOvrAtPos = (tid: number, pos: Position): number => {
    const atPos = rosterByTid.get(tid)!
      .map((pid) => playerByPid.get(pid)!)
      .filter((p) => p.pos === pos);
    if (atPos.length === 0) return -Infinity; // an empty position is the neediest possible fit
    return atPos.reduce((s, p) => s + p.ovr, 0) / atPos.length;
  };

  // Highest OVR first: the biggest stars get first pick of the neediest
  // Division 1 club, since avgOvrAtPos is recomputed (and shifts) after
  // each move.
  const qualifying = [...rosterByTid.entries()]
    .filter(([tid]) => divisionByTid.get(tid) === 1 && tid !== userTid)
    .flatMap(([, roster]) => roster)
    .map((pid) => playerByPid.get(pid)!)
    .filter((p) => p.ovr >= DIVISION_2_REFUSAL_OVR_THRESHOLD)
    .sort((a, b) => b.ovr - a.ovr || a.pid - b.pid);

  for (const player of qualifying) {
    const sellerTid = [...rosterByTid.entries()].find(([, r]) => r.includes(player.pid))?.[0];
    if (sellerTid === undefined) continue; // already moved earlier this pass

    const d1Candidates = [...divisionByTid.entries()].filter(
      ([tid, div]) => div === 0 && tid !== userTid,
    );
    if (d1Candidates.length === 0) continue;

    let buyerTid = d1Candidates[0][0];
    let bestNeed = avgOvrAtPos(buyerTid, player.pos);
    for (const [tid] of d1Candidates.slice(1)) {
      const need = avgOvrAtPos(tid, player.pos);
      if (need < bestNeed) {
        bestNeed = need;
        buyerTid = tid;
      }
    }

    let buyerRoster = rosterByTid.get(buyerTid)!;
    if (buyerRoster.length >= ROSTER_CAP) {
      let weakestPid = buyerRoster[0];
      let weakestOvr = playerByPid.get(weakestPid)!.ovr;
      for (const pid of buyerRoster.slice(1)) {
        const ovr = playerByPid.get(pid)!.ovr;
        if (ovr < weakestOvr) {
          weakestOvr = ovr;
          weakestPid = pid;
        }
      }
      buyerRoster = buyerRoster.filter((pid) => pid !== weakestPid);
    }

    rosterByTid.set(sellerTid, rosterByTid.get(sellerTid)!.filter((pid) => pid !== player.pid));
    rosterByTid.set(buyerTid, [...buyerRoster, player.pid]);
    executed.push({ pid: player.pid, fromTid: sellerTid, toTid: buyerTid, fee: 0, season, window: "summer" });
  }

  return {
    teams: teams.map((t) => ({ ...t, roster: rosterByTid.get(t.tid) ?? t.roster })),
    players,
    transfers: [...transfers, ...executed],
  };
}
