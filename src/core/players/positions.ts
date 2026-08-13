import type { Player, Position } from "./types.js";
import { POSITIONS } from "./types.js";
import { computeOvr } from "./ovr.js";
import { COVERABLE } from "../../engine/positionFit.js";
import { MAX_SECONDARY_POSITIONS, SECONDARY_POSITION_CUTOFF } from "../constants.js";

/** What a player would be rated at one position, on the usual OVR scale. */
export interface PositionRating {
  pos: Position;
  ovr: number;
  /** His listed position — the one his OVR and every stat weighting keys off. */
  primary: boolean;
  /** He knows this job too: no familiarity penalty for playing it. */
  secondary: boolean;
}

/**
 * A player's OVR at his own position and at every slot he could plausibly
 * cover, best first (his own position wins ties, so the strip leads with what
 * he actually is).
 *
 * OVR is position-relative by construction — `computeOvr` weights the same 14
 * skills differently per position — so "what would he be as a full-back" is a
 * question the rating model can already answer exactly. Nothing new is stored
 * or rolled: this is a re-read of attributes the player already has.
 *
 * Deliberately NOT all eight positions. A keeper's striker rating, or a
 * striker's centre-back rating, is a number the model will happily produce and
 * that means nothing — seven lines of noise around the one that matters. The
 * coverable set is the same one versatility is drawn from, so the strip shows
 * exactly the positions where the answer is meaningful.
 */
function rate(p: Player): PositionRating[] {
  const secondary = new Set(deriveSecondaries(p));
  const shown: Position[] = [p.pos, ...COVERABLE[p.pos]];
  return shown
    .map((pos) => ({
      pos,
      ovr: pos === p.pos ? p.ovr : computeOvr(pos, p.ratings, p.heightCm),
      primary: pos === p.pos,
      secondary: secondary.has(pos),
    }))
    .sort((a, b) => b.ovr - a.ovr || (a.primary ? -1 : b.primary ? 1 : 0));
}

/**
 * The positions a player can fill without a familiarity penalty, beyond his own.
 *
 * Two gates, and both are load-bearing:
 *
 *  - **Adjacency.** Only a slot he could plausibly cover is eligible, via
 *    COVERABLE — the REVERSE of the adjacency table, since we are asking where
 *    else he can play rather than who can replace him, and the table is not
 *    symmetric. This bounds the sim change: a secondary can only ever waive the
 *    *adjacent* penalty, never the foreign one, so no derivation quirk can hand
 *    a centre-back a free run at striker. Keepers cover nothing and nothing
 *    covers them, so they are always specialists.
 *
 *  - **Rating, against a PER-PAIR bar.** His OVR at that slot must beat his own
 *    by at least `SECONDARY_POSITION_CUTOFF[pos][slot]`, a measured figure that
 *    admits a fixed share of players at his position. One shared threshold
 *    cannot work at any value: how close a player rates one position along is
 *    set by how much the two positions' OVR weights overlap, which is a
 *    property of the pair, not of him. CM/DM/AM share most of their weighting,
 *    a striker's overlaps almost nothing — so a flat gap makes every midfielder
 *    a three-position player before any striker is a two-position one
 *    (measured; see scripts/secondaryPositionProbe.ts). Calibrating per pair
 *    removes that bias and makes a badge mean "better here than the typical
 *    player of his position" rather than "plays a position whose weights happen
 *    to overlap".
 *
 * Versatility is therefore a property of his attributes, which is what keeps
 * the badge and the per-position strip from ever contradicting each other, and
 * lets it update itself over a career — no stored field to migrate, and no rng
 * draw, so the seeded stream is untouched.
 *
 * Best first, capped at `MAX_SECONDARY_POSITIONS`.
 */
export function deriveSecondaries(
  p: Player,
  cutoff: Partial<Record<Position, number>> = SECONDARY_POSITION_CUTOFF[p.pos],
  max: number = MAX_SECONDARY_POSITIONS,
): Position[] {
  const out: { pos: Position; ovr: number }[] = [];
  for (const pos of COVERABLE[p.pos]) {
    const bar = cutoff[pos];
    if (bar === undefined) continue;
    const ovr = computeOvr(pos, p.ratings, p.heightCm);
    if (ovr - p.ovr >= bar) out.push({ pos, ovr });
  }
  // Ovr desc, then position order, so the list is stable for a given player.
  out.sort((a, b) => b.ovr - a.ovr || POSITIONS.indexOf(a.pos) - POSITIONS.indexOf(b.pos));
  return out.slice(0, max).map((r) => r.pos);
}

/**
 * Per-player memo. Keyed on the player OBJECT, which is exactly right here: the
 * core is purely functional and hands unchanged players through by reference,
 * so a player whose ratings moved is a *new* object and misses the cache
 * automatically. A pid key would go stale the season he progresses.
 */
const secondaryCache = new WeakMap<Player, Position[]>();
const ratingCache = new WeakMap<Player, PositionRating[]>();

/** Cached `deriveSecondaries` at the shipped constants — the normal entry point. */
export function secondaryPositions(p: Player): Position[] {
  let hit = secondaryCache.get(p);
  if (!hit) {
    hit = deriveSecondaries(p);
    secondaryCache.set(p, hit);
  }
  return hit;
}

/** Cached full per-position strip, best first. */
export function positionRatings(p: Player): PositionRating[] {
  let hit = ratingCache.get(p);
  if (!hit) {
    hit = rate(p);
    ratingCache.set(p, hit);
  }
  return hit;
}

/**
 * What he'd be rated playing THIS slot, rather than his own position.
 *
 * The number to rank candidates by whenever a slot is being filled. Ranking by
 * `p.ovr` instead compares a winger's *winger* rating against a striker's
 * *striker* rating and then plays the winner up front — which measurably cost
 * team finishing, because a versatile winger would take the striker slot on a
 * rating he doesn't carry into it (see scripts/midVsMidProbe.ts). Making him
 * beat the striker at being a striker is both the correct comparison and what
 * keeps the goals/game benchmark where it was.
 */
export function ovrAtSlot(p: Player, slot: Position): number {
  if (slot === p.pos) return p.ovr;
  const known = positionRatings(p).find((r) => r.pos === slot);
  return known ? known.ovr : computeOvr(slot, p.ratings, p.heightCm);
}

/** "ST" or "ST / W" — his position as the UI should name it. */
export function positionLabel(p: Player): string {
  const sec = secondaryPositions(p);
  return sec.length === 0 ? p.pos : `${p.pos} / ${sec.join(" / ")}`;
}
