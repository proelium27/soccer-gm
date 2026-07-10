import type { Player } from "../players/types.js";
import type { LeagueStore } from "../leagueState.js";
import { transferWindowState } from "./window.js";
import { departsAtRollover, isForSale, scoutedValue, windowSeed } from "./negotiation.js";
import { scoutingNoiseSd } from "../finance/scouting.js";
import { selectXI } from "../lineup/selectXI.js";
import { FORMATIONS } from "../lineup/formations.js";
import { mulberry32, gaussian } from "../../engine/rng.js";
import {
  RECOMMENDED_TRANSFERS_MIN, RECOMMENDED_TRANSFERS_MAX,
  RECOMMENDED_OVR_BELOW, RECOMMENDED_OVR_ABOVE, RECOMMENDED_BAND_WIDEN,
  RECOMMENDED_UPSIDE_WEIGHT, RECOMMENDED_NOISE_OVR_SCALE,
  RECOMMENDED_MAX_PER_POSITION,
} from "../constants.js";

export interface TransferTarget {
  player: Player;
  sellerTid: number;
  /** The scouting department's (noisy) valuation — the baseline for offers. */
  scoutedValue: number;
}

/**
 * The Recommended Transfers list: 5-10 for-sale players of similar overall
 * level to the user's team (an ovr band around the starting-XI average,
 * skewed upward) whose scouted valuation fits the budget. Ranked by how much
 * they'd improve the squad (ovr above team level plus potential headroom),
 * with window-seeded noise scaled by scouting quality — poor scouts shuffle
 * the ranking, good scouts surface the genuinely best targets. Deterministic
 * within a window; empty when no window is open.
 */
export function recommendedTransfers(league: LeagueStore): TransferTarget[] {
  const ws = transferWindowState(league);
  if (!ws.open) return [];

  const user = league.teams.find((t) => t.tid === league.meta.userTid);
  if (!user) return [];

  const playerMap = new Map(league.players.map((p) => [p.pid, p]));
  const rosterPlayers = user.roster
    .map((pid) => playerMap.get(pid))
    .filter((p): p is Player => p !== undefined);
  const xi = selectXI(rosterPlayers, FORMATIONS["4-3-3"]);
  const reference = xi.length === 11 ? xi : rosterPlayers;
  const teamAvg =
    reference.length > 0
      ? reference.reduce((s, p) => s + p.ovr, 0) / reference.length
      : 50;

  const candidates: TransferTarget[] = [];
  for (const team of league.teams) {
    if (team.tid === user.tid) continue;
    for (const pid of team.roster) {
      const player = playerMap.get(pid);
      if (!player) continue;
      if (!isForSale(team, playerMap, pid)) continue;
      if (departsAtRollover(league, player)) continue;
      const value = scoutedValue(league.lid, ws.season, ws.window, player, user.scoutingSpend);
      if (value > user.budget) continue;
      candidates.push({ player, sellerTid: team.tid, scoutedValue: value });
    }
  }

  const band = (below: number, above: number) =>
    candidates.filter(
      (c) => c.player.ovr >= teamAvg - below && c.player.ovr <= teamAvg + above,
    );
  let pool = band(RECOMMENDED_OVR_BELOW, RECOMMENDED_OVR_ABOVE);
  if (pool.length < RECOMMENDED_TRANSFERS_MIN) {
    pool = band(
      RECOMMENDED_OVR_BELOW + RECOMMENDED_BAND_WIDEN,
      RECOMMENDED_OVR_ABOVE + RECOMMENDED_BAND_WIDEN,
    );
  }
  if (pool.length < RECOMMENDED_TRANSFERS_MIN) pool = candidates;

  const noiseSd = scoutingNoiseSd(user.scoutingSpend);
  const score = (c: TransferTarget): number => {
    const rng = mulberry32(windowSeed(league.lid, ws.season, ws.window, c.player.pid, 3));
    return (
      c.player.ovr - teamAvg
      + RECOMMENDED_UPSIDE_WEIGHT * (c.player.potential - c.player.ovr)
      + gaussian(rng) * noiseSd * RECOMMENDED_NOISE_OVR_SCALE
    );
  };

  const ranked = pool
    .map((c) => ({ target: c, score: score(c) }))
    .sort((a, b) => b.score - a.score || a.target.player.pid - b.target.player.pid);

  // Keep the list varied: never more than a couple of targets per position.
  const picked: TransferTarget[] = [];
  const perPosition = new Map<string, number>();
  for (const { target } of ranked) {
    if (picked.length >= RECOMMENDED_TRANSFERS_MAX) break;
    const pos = target.player.pos;
    const count = perPosition.get(pos) ?? 0;
    if (count >= RECOMMENDED_MAX_PER_POSITION) continue;
    perPosition.set(pos, count + 1);
    picked.push(target);
  }

  // Variety is a preference, the 5-target minimum is the contract: if the
  // pool was so position-concentrated that the cap cut below it, backfill
  // with the best remaining candidates regardless of position.
  if (picked.length < RECOMMENDED_TRANSFERS_MIN) {
    const pickedPids = new Set(picked.map((t) => t.player.pid));
    for (const { target } of ranked) {
      if (picked.length >= RECOMMENDED_TRANSFERS_MIN) break;
      if (!pickedPids.has(target.player.pid)) picked.push(target);
    }
  }
  return picked;
}
