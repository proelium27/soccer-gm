import type { NationalityWeights } from "../players/nationalities.js";
import { namePoolFor } from "../players/nationalities.js";
import type { Position } from "../players/types.js";
import { POSITIONS } from "../players/types.js";
import {
  SCOUTING_REGION_MAX, SCOUTING_REGION_SHARE, SCOUT_POSITION_MAX,
} from "../constants.js";

/**
 * Everything the user has told his youth scouts, as one value.
 *
 * Grouped rather than passed around as two fields because they are set on one
 * panel, saved by one action and read at one point in the offseason — and
 * because the two genuinely differ in reach, which is easier to state once than
 * to rediscover at each call site. WHERE they look (`regions`) is a post-hoc
 * relabel of the whole trial group, since nationality is rating-neutral and
 * costs no draw. WHICH POSITIONS they look for can only shape the players the
 * scouts themselves turn up, because a position decides how a player is
 * generated and the rest of the group is generated on the shared rng, where a
 * different draw re-rolls every club after it.
 */
export interface ScoutDirections {
  regions: string[];
  positions: Position[];
}

/**
 * Where the user has sent his scouts, cleaned up: known nations only, no
 * duplicates, capped at SCOUTING_REGION_MAX.
 *
 * A nation with no name pool is dropped rather than trusted, for the same
 * reason `sanitizeNationalityWeights` drops one: `generateName` falls back to
 * synthesized nonsense words for an unknown nationality, so an unrecognised
 * entry would produce players with made-up names and a blank flag. The picker
 * only offers real nations, so this only bites on a hand-edited save.
 */
export function sanitizeScoutingRegions(regions: readonly string[] | undefined): string[] {
  if (!regions) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of regions) {
    if (seen.has(r) || !namePoolFor(r)) continue;
    seen.add(r);
    out.push(r);
    if (out.length >= SCOUTING_REGION_MAX) break;
  }
  return out;
}

/**
 * The nationality table the user's youth trial group is drawn from once he has
 * sent his scouts somewhere: his targets take SCOUTING_REGION_SHARE of the
 * draw between them, and his league's own mix supplies the rest.
 *
 * **A blend, not an override.** Sending scouts to Brazil should read as "my
 * scouts are in Brazil", not as an academy that has stopped producing local
 * players entirely — so the home mix keeps a real share and the group still
 * looks like it belongs to the club. It also means the setting can't be used to
 * manufacture a single-nationality squad, which reads as a bug rather than a
 * tactic.
 *
 * **Rating-neutral, so this is flavour with a hook rather than a balance
 * lever.** Nationality feeds `generateName` and international eligibility and
 * nothing else — ratings are drawn independently of it, which CLAUDE.md
 * verifies by regenerating a world after changing the tables and finding every
 * country's starter mean OVR identical to the decimal. The hook is that a
 * player's nationality decides which nation can cap him, so scouting a country
 * deepens that nation's pool, which matters once you manage one.
 *
 * The targets' share is split evenly rather than weighted: the player picked
 * them, and inventing a ranking between them would be a number he cannot see.
 * Weights here are relative, since `drawFrom` normalizes by the table's own
 * total, so `home` may be any scale.
 */
export function scoutedNationalityWeights(
  home: NationalityWeights,
  regions: readonly string[],
): NationalityWeights {
  const targets = sanitizeScoutingRegions(regions);
  if (targets.length === 0) return home;

  const homeTotal = Object.values(home).reduce((a, w) => a + (w > 0 ? w : 0), 0);
  // A home table that sums to nothing (hand-edited, or every row zeroed) would
  // make the blend meaningless; the targets are then the only thing to draw on.
  if (homeTotal <= 0) {
    return Object.fromEntries(targets.map((c) => [c, 1]));
  }

  // Scale so the targets end up holding SCOUTING_REGION_SHARE of the total.
  const targetTotal = (homeTotal * SCOUTING_REGION_SHARE) / (1 - SCOUTING_REGION_SHARE);
  const perTarget = targetTotal / targets.length;

  const out: NationalityWeights = { ...home };
  for (const c of targets) out[c] = (out[c] ?? 0) + perTarget;
  return out;
}

/**
 * The positions the user has told his scouts to look for: known positions only,
 * no duplicates, capped at SCOUT_POSITION_MAX.
 *
 * Same shape as `sanitizeScoutingRegions` and for the same reason — this is
 * persisted state a save can carry from an older build or a hand edit, and an
 * unrecognised entry would silently take a share of the draw that then went
 * nowhere, quietly weakening every real target beside it.
 */
export function sanitizeScoutPositions(
  positions: readonly string[] | undefined,
): Position[] {
  if (!positions) return [];
  const known = new Set<string>(POSITIONS);
  const seen = new Set<string>();
  const out: Position[] = [];
  for (const pos of positions) {
    if (seen.has(pos) || !known.has(pos)) continue;
    seen.add(pos);
    out.push(pos as Position);
    if (out.length >= SCOUT_POSITION_MAX) break;
  }
  return out;
}

/** Everything a club's stored scout directions amount to, cleaned up. */
export function scoutDirectionsOf(team: {
  scoutingRegions?: string[];
  scoutingPositions?: string[];
} | undefined): ScoutDirections {
  return {
    regions: sanitizeScoutingRegions(team?.scoutingRegions),
    positions: sanitizeScoutPositions(team?.scoutingPositions),
  };
}
