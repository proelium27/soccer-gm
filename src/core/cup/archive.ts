import type { CupState } from "./types.js";
import { aggregateCupStats } from "./cupStats.js";

/**
 * Collapse a finished cup for storage: fold every stage's box scores into one
 * stat line per player, then drop the box scores.
 *
 * Why: an aged save held 18 MB of cup box scores, and **save size is what
 * freezes the game** — every mutation rewrites the whole league to IndexedDB and
 * every sim structuredClones it to the worker, both on the main thread (see
 * CLAUDE.md's save-size section). The aggregate is ~8x smaller than even the
 * knockout box scores alone (431 KB vs 3.6 MB across 13 cups).
 *
 * Nothing displayed is lost. Scorelines, aggregates, legs, winners, the
 * league-phase table and the bracket are all stored separately; the box scores'
 * only reader was `cupStatsForPlayer`, which now prefers the stored lines.
 *
 * Aggregating across all three stages also **fixes** a long-standing under-count:
 * the old code summed only the top-level `ties`, so a club that played six group
 * games and went out in the playoff showed 0 cup appearances for every player
 * (1857 appearances played vs 199 counted, in one measured season).
 *
 * Idempotent, and safe on a cup whose box scores are already partly gone — it
 * aggregates whatever remains and leaves existing `statLines` alone.
 */
export function archiveCup(cup: CupState): CupState {
  const statLines = cup.statLines ?? aggregateCupStats(cup);

  const leaguePhase = !cup.leaguePhase
    ? null
    : {
        ...cup.leaguePhase,
        matches: (cup.leaguePhase.matches ?? []).map((m) =>
          m.boxScore === null ? m : { ...m, boxScore: null },
        ),
      };
  const dropTie = <T extends { boxScore: unknown }>(t: T): T =>
    (t.boxScore === null ? t : { ...t, boxScore: null });

  return {
    ...cup,
    statLines,
    leaguePhase,
    playoff: !cup.playoff
      ? null
      : { ...cup.playoff, ties: (cup.playoff.ties ?? []).map(dropTie) },
    playIn: !cup.playIn
      ? null
      : { ...cup.playIn, ties: (cup.playIn.ties ?? []).map(dropTie) },
    ties: (cup.ties ?? []).map(dropTie),
    // First legs are transient (held only between a round's two matchdays), so a
    // finished cup should have none; clear defensively rather than keep box
    // scores alive through a field nothing reads after the tie resolves.
    koLegs: null,
  };
}
