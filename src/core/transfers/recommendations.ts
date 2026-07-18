import type { Player } from "../players/types.js";
import type { LeagueStore } from "../leagueState.js";
import { transferWindowState } from "./window.js";
import { departsAtRollover, isForSale, scoutedValue, windowSeed } from "./negotiation.js";
import { scoutingNoiseSd } from "../finance/scouting.js";
import { resolveXI } from "../lineup/resolveXI.js";
import { FORMATIONS } from "../lineup/formations.js";
import { mulberry32, gaussian } from "../../engine/rng.js";
import { wouldRefuseExtension } from "../ai/breakoutRefusal.js";
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
 * User-supplied scouting criteria. These are *hard* constraints applied to
 * the candidate pool before ranking — they change which players the search
 * considers, not just which of a fixed list are shown. A null/undefined/""
 * field is "no constraint". A pinned `position` also lifts the usual
 * per-position variety cap, so asking for "FB" returns a full list of FBs
 * rather than the two that would fit in the mixed-position list.
 */
export interface RecommendationFilters {
  position?: string;
  minOvr?: number | null;
  minPot?: number | null;
  maxAge?: number | null;
  maxValue?: number | null;
}

/**
 * The Recommended Transfers list: 5-10 for-sale players of similar overall
 * level to the user's team (an ovr band around the starting-XI average,
 * skewed upward) whose scouted valuation fits the budget. Ranked by how much
 * they'd improve the squad (ovr above team level plus potential headroom),
 * with window-seeded noise scaled by scouting quality — poor scouts shuffle
 * the ranking, good scouts surface the genuinely best targets. Deterministic
 * within a window (and stable across renders) for a given `refreshNonce`;
 * empty when no window is open. The UI's Refresh button bumps the nonce to
 * re-roll the noise and surface a different set of targets on demand.
 *
 * `filters` narrows the candidate pool (see RecommendationFilters) so the
 * search actually re-runs against the constraint — e.g. picking a position
 * surfaces fresh targets at that position rather than filtering the mixed
 * list down to whatever happened to rank in the global top few.
 */
export function recommendedTransfers(
  league: LeagueStore,
  refreshNonce = 0,
  filters: RecommendationFilters = {},
): TransferTarget[] {
  const ws = transferWindowState(league);
  if (!ws.open) return [];

  const user = league.teams.find((t) => t.tid === league.meta.userTid);
  if (!user) return [];

  const posFilter = filters.position || null;
  const minOvr = filters.minOvr ?? null;
  const minPot = filters.minPot ?? null;
  const maxAge = filters.maxAge ?? null;
  const maxValue = filters.maxValue ?? null;

  const playerMap = new Map(league.players.map((p) => [p.pid, p]));
  const rosterPlayers = user.roster
    .map((pid) => playerMap.get(pid))
    .filter((p): p is Player => p !== undefined);
  const xi = resolveXI(rosterPlayers, FORMATIONS["4-3-3"], user.starters);
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
      if (!isForSale(team, playerMap, pid) && !wouldRefuseExtension(player, team, league.competitions)) continue;
      if (departsAtRollover(league, player)) continue;
      // Hard user constraints — these narrow *which* players the search
      // considers, so changing a filter surfaces a genuinely new list.
      if (posFilter && player.pos !== posFilter) continue;
      if (minOvr !== null && player.ovr < minOvr) continue;
      if (minPot !== null && player.potential < minPot) continue;
      if (maxAge !== null && ws.season - player.born > maxAge) continue;
      const value = scoutedValue(league.lid, ws.season, ws.window, player, user.scoutingSpend);
      if (value > user.budget) continue;
      if (maxValue !== null && value > maxValue) continue;
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
    const rng = mulberry32(
      windowSeed(league.lid, ws.season, ws.window, c.player.pid, 3 + refreshNonce * 1000),
    );
    return (
      c.player.ovr - teamAvg
      + RECOMMENDED_UPSIDE_WEIGHT * (c.player.potential - c.player.ovr)
      + gaussian(rng) * noiseSd * RECOMMENDED_NOISE_OVR_SCALE
    );
  };

  const ranked = pool
    .map((c) => ({ target: c, score: score(c) }))
    .sort((a, b) => b.score - a.score || a.target.player.pid - b.target.player.pid);

  // Keep the mixed list varied: never more than a couple of targets per
  // position. When the user has pinned a single position, that variety cap
  // makes no sense — they asked for that position, so show a full list of it.
  const maxPerPosition = posFilter ? RECOMMENDED_TRANSFERS_MAX : RECOMMENDED_MAX_PER_POSITION;
  const picked: TransferTarget[] = [];
  const perPosition = new Map<string, number>();
  for (const { target } of ranked) {
    if (picked.length >= RECOMMENDED_TRANSFERS_MAX) break;
    const pos = target.player.pos;
    const count = perPosition.get(pos) ?? 0;
    if (count >= maxPerPosition) continue;
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
