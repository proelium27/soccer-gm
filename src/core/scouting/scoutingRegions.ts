import type { NationalityWeights } from "../players/nationalities.js";
import { namePoolFor } from "../players/nationalities.js";
import { SCOUTING_REGION_MAX, SCOUTING_REGION_SHARE } from "../constants.js";

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
