import type { Player, SuspensionReason } from "./players/types.js";
import type { PlayedMatch } from "./standings.js";
import {
  SUSPENSION_YELLOW_THRESHOLD,
  SUSPENSION_YELLOW_MATCHES,
  SUSPENSION_SECOND_YELLOW_MATCHES,
  SUSPENSION_RED_MATCHES,
} from "./constants.js";

/** Is this player banned from league matches right now? */
export function isSuspended(p: Player): boolean {
  return (p.suspension?.matchesRemaining ?? 0) > 0;
}

/** "2 matches" / "1 match" — shared by every surface that shows a ban. */
export function matchesLabel(n: number): string {
  return `${n} ${n === 1 ? "match" : "matches"}`;
}

/**
 * What a single match's card haul does to one player's discipline record.
 *
 * Reads the box-score *line* rather than the event list, because the line
 * already encodes the distinction we need: matchSim issues a second yellow as
 * `yellowCards: 2` plus a red, while a straight red leaves the yellow count
 * below two. A player booked once and then sent off outright reads as a
 * straight red, which is right.
 *
 * Pure, and drawing no rng at all — see the module note in applySuspensions.
 */
function banFor(
  yellowCards: number,
  redCards: number,
  yellowCountBefore: number,
): { yellowCount: number; matches: number; reason: SuspensionReason } {
  let yellowCount = yellowCountBefore + yellowCards;
  let matches = 0;
  let reason: SuspensionReason = "yellow cards";

  if (yellowCount >= SUSPENSION_YELLOW_THRESHOLD) {
    // Subtract the threshold rather than zeroing: a sixth booking in the same
    // match as the fifth should carry over toward the next ban, not evaporate.
    yellowCount -= SUSPENSION_YELLOW_THRESHOLD;
    matches = SUSPENSION_YELLOW_MATCHES;
  }

  if (redCards > 0) {
    const sentOff =
      yellowCards >= 2 ? SUSPENSION_SECOND_YELLOW_MATCHES : SUSPENSION_RED_MATCHES;
    // Longer of the two, never the sum — see the constants block for why.
    if (sentOff >= matches) {
      matches = sentOff;
      reason = yellowCards >= 2 ? "second yellow" : "red card";
    }
  }

  return { yellowCount, matches, reason };
}

/**
 * Turn a matchday's league bookings into bans, and tick every existing ban down
 * by one — the disciplinary twin of `applyInjuries`, called once per matchday
 * from `simThrough` right after that matchday's league games are simmed.
 *
 * Two things make the tick exact rather than approximate. Every competition in
 * the world is a 20-club round robin, so *every* club plays on *every* matchday
 * — a global decrement really is "one match served each". And a player banned
 * by this very matchday's cards is skipped, so his ban starts with the next
 * matchday rather than being partly served by the game he was sent off in
 * (same shape as applyInjuries' fresh-injury branch).
 *
 * Deliberately rng-free. Cards are already rolled inside the match on the
 * shared stream; this only reads what came out, so it consumes no draws and
 * cannot shift RNG stream order. It does change *who is available* next
 * matchday, which changes composites and therefore results — exactly as
 * injuries do, and the reason the touchStats scoreline baseline was rebased
 * when this shipped.
 */
export function applySuspensions(players: Player[], matches: PlayedMatch[]): Player[] {
  const cardedThisMatchday = new Map<number, { yellowCards: number; redCards: number }>();
  for (const m of matches) {
    for (const line of [...m.boxScore.home, ...m.boxScore.away]) {
      if (line.yellowCards === 0 && line.redCards === 0) continue;
      const prior = cardedThisMatchday.get(line.pid);
      cardedThisMatchday.set(line.pid, {
        yellowCards: (prior?.yellowCards ?? 0) + line.yellowCards,
        redCards: (prior?.redCards ?? 0) + line.redCards,
      });
    }
  }

  return players.map((p) => {
    const cards = cardedThisMatchday.get(p.pid);
    if (cards) {
      const { yellowCount, matches: banned, reason } = banFor(
        cards.yellowCards,
        cards.redCards,
        p.yellowCount ?? 0,
      );
      // A ban earned today is served from the next matchday, so it is stamped
      // at full length and skips this matchday's decrement.
      const suspension = banned > 0 ? { matchesRemaining: banned, reason } : p.suspension ?? null;
      return { ...p, yellowCount, suspension };
    }
    if (isSuspended(p)) {
      const matchesRemaining = p.suspension!.matchesRemaining - 1;
      return {
        ...p,
        suspension: matchesRemaining > 0 ? { ...p.suspension!, matchesRemaining } : null,
      };
    }
    return p;
  });
}

/**
 * Wipe the slate at the offseason: bans don't carry into a new season and the
 * yellow tally restarts, mirroring how progression heals every lingering
 * injury. Real leagues do carry some reds over; clearing is the simpler promise
 * to a manager, and it keeps every "am I available" question inside one season.
 */
export function clearSuspension(p: Player): Player {
  if (!p.suspension && !p.yellowCount) return p;
  return { ...p, suspension: null, yellowCount: 0 };
}
