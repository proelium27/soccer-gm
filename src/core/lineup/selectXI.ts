import type { Player, Position } from "../players/types.js";
import { slotValue } from "../players/positions.js";

/**
 * Best candidate for a slot from an arbitrary pool (e.g. the bench), independent
 * of `selectXI`'s whole-roster assignment. Ranks on the same `slotValue` — what
 * he'd be worth playing that job — with an explicit pid tiebreak for determinism.
 */
export function bestFit(slot: Position, candidates: Player[]): Player | null {
  let best: Player | null = null;
  let bestKey: [number, number] | null = null; // [-slotValue, pid]
  for (const p of candidates) {
    const key: [number, number] = [-slotValue(p, slot), p.pid];
    const better =
      !bestKey || key[0] < bestKey[0] || (key[0] === bestKey[0] && key[1] < bestKey[1]);
    if (better) {
      best = p;
      bestKey = key;
    }
  }
  return best;
}

/**
 * Fill every slot with the eleven who are worth most playing those jobs.
 *
 * Ranks on `slotValue` — his rating at the slot, less the familiarity penalty
 * the match sim will charge him — rather than on fit tier with rating only as a
 * tiebreak. That old rule made *any* natural full-back beat *every* non-full-back
 * for a full-back slot however wide the gap, so a club short at one position
 * started a 39-rated specialist while a 67-rated midfielder who'd have been
 * worth 10 points more there sat on the bench. Measured on a season-8 world,
 * that was 16.9% of all first-division starting slots across 77% of clubs, and
 * it hit exactly the positions with the thinnest natural cover (wing 37%,
 * full-back 18%). The sim already charged the penalty in the composite rollup
 * and already picked substitutes this way (`benchValueAt`); only the XI picker
 * was optimizing a different number from the one it was scored on.
 *
 * Assignment is greedy over every (slot, player) pair, best pair first — NOT
 * slot by slot. Slot order is not a priority order, so filling in sequence lets
 * an early slot take a player a later one needed far more: with a lone good
 * striker and nothing at the back, a full-back slot listed first would claim him
 * and leave the striker slot to a reserve. Taking the strongest pairing
 * available at each step is immune to that, because a player only loses a slot
 * to someone worth more there.
 *
 * Deterministic: ties break by slot index then pid, so a formation's duplicate
 * slots (two CBs, two FBs) fill left to right and never depend on Map order.
 *
 * A roster shorter than the formation leaves the TRAILING slots empty, as
 * before — callers index the result against `slots`, so a gap in the middle
 * would silently shift every player after it into the wrong job.
 */
export function selectXI(roster: Player[], slots: Position[]): Player[] {
  const fillable = Math.min(slots.length, roster.length);
  const value = (p: Player, slot: number) => slotValue(p, slots[slot]);

  const pairs: { slot: number; player: Player; value: number }[] = [];
  for (let i = 0; i < fillable; i++) {
    for (const player of roster) pairs.push({ slot: i, player, value: value(player, i) });
  }
  pairs.sort((a, b) => b.value - a.value || a.slot - b.slot || a.player.pid - b.player.pid);

  const xi: (Player | null)[] = new Array(fillable).fill(null);
  const taken = new Set<number>();
  let filled = 0;
  for (const pair of pairs) {
    if (filled === fillable) break;
    if (xi[pair.slot] !== null || taken.has(pair.player.pid)) continue;
    xi[pair.slot] = pair.player;
    taken.add(pair.player.pid);
    filled++;
  }

  const picked = xi as Player[];
  // Sorted, so the improvement pass can't depend on the roster's own order.
  const bench = roster.filter((p) => !taken.has(p.pid)).sort((a, b) => a.pid - b.pid);
  improve(picked, bench, value);
  return picked;
}

/**
 * Greedy leaves a residual, so finish by taking improving moves until none is
 * left. Two starters can each be worth more in the other's slot — greedy locks
 * in the single best pairing first, and the man who wanted that slot second
 * takes whatever is free rather than the one he suits — and once a pair
 * un-crosses, a bench player can become worth a slot he wasn't before.
 *
 * Measured on a season-8 world before this pass existed: no club had a bench
 * player worth a starting slot, but 113 pairs of starters across 47% of
 * first-division clubs were in each other's jobs, worth 705 rating points in
 * total. Small per club, and free to reclaim.
 *
 * Terminates: `slotValue` is a whole number, every accepted move raises the XI's
 * total by at least one, and the total is bounded. Deterministic: the best move
 * wins, and equal moves break by the fixed scan — lowest slot first, a swap
 * before a substitution, then by slot and by pid — never by roster order.
 *
 * **A gain must be FINITE, and that guard is what makes the proof true.** A
 * player carrying a missing or malformed rating (`heightCm` absent, say) makes
 * `computeOvr` return NaN, so his value at a slot is NaN and every comparison
 * against it is false — including `g <= gain`, which would wave the move through,
 * set `gain` to NaN, and then accept every subsequent move forever. `>` alone
 * cannot express "strictly better" over a set that might contain NaN. Selection
 * has always seen such players (the old picker read the same ratings) and simply
 * ranked them arbitrarily; a loop, unlike a sort, hangs instead. Skipping a
 * non-finite candidate leaves him wherever greedy put him, which is the same
 * treatment as before and the only safe answer when his rating is unknowable.
 */
function improve(
  xi: Player[],
  bench: Player[],
  value: (p: Player, slot: number) => number,
): void {
  for (;;) {
    let gain = 0;
    let move: { i: number; j: number; sub: Player | null } | null = null;
    const better = (g: number, m: { i: number; j: number; sub: Player | null }) => {
      if (!(g > gain) || !Number.isFinite(g)) return;
      gain = g;
      move = m;
    };

    for (let i = 0; i < xi.length; i++) {
      const here = value(xi[i], i);
      for (let j = i + 1; j < xi.length; j++) {
        const now = here + value(xi[j], j);
        const swapped = value(xi[j], i) + value(xi[i], j);
        better(swapped - now, { i, j, sub: null });
      }
      for (const p of bench) better(value(p, i) - here, { i, j: -1, sub: p });
    }

    if (!move) return;
    const { i, j, sub } = move as { i: number; j: number; sub: Player | null };
    if (sub) {
      bench[bench.indexOf(sub)] = xi[i];
      xi[i] = sub;
    } else {
      [xi[i], xi[j]] = [xi[j], xi[i]];
    }
  }
}
