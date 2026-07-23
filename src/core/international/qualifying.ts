import type { Player } from "../players/types.js";
import type { IntlGroup, IntlQualifyingCampaign, NationSquad } from "./types.js";
import type { CareerDelta } from "./simIntl.js";
import { buildSquads, nationMatchData } from "./squads.js";
import { groupByConfederation, allocateSlots } from "./confederations.js";
import { buildGroup, serpentineGroups, groupTable, rankAcrossGroups, type GroupRow } from "./groups.js";
import { playGroups, emptyCareerDelta, QUALIFYING_GROUP_STREAM } from "./simIntl.js";
import { INTL_FIELD_SIZE, INTL_QUAL_GROUP_TARGET, INTL_QUAL_LEGS } from "../constants.js";

/**
 * How many groups a confederation's qualifying splits into: about
 * INTL_QUAL_GROUP_TARGET nations per group, but never more groups than it has
 * places (every group winner must be able to qualify) and never so many that a
 * group would hold fewer than two nations.
 */
function groupCountFor(nations: number, slots: number): number {
  return Math.max(1, Math.min(slots, Math.round(nations / INTL_QUAL_GROUP_TARGET), Math.floor(nations / 2)));
}

/**
 * Fill a confederation's places from its completed groups: every group winner
 * first, then the best runners-up, then the best third-placed nations, and so
 * on until the places are gone.
 *
 * Working down by finishing position (rather than one flat merged table) is
 * both how real qualifying behaves and what makes the allocation total: however
 * lopsided the group sizes are, there is always another position to draw from,
 * so a confederation can never come up short of the places it was given.
 * Nations from different groups are compared on per-game rates — see
 * rankAcrossGroups.
 */
function fillPlaces(groups: IntlGroup[], slots: number): number[] {
  const tables = groups.map((g) => groupTable(g));
  const qualified: number[] = [];
  const maxPositions = Math.max(0, ...tables.map((t) => t.length));

  for (let position = 0; position < maxPositions && qualified.length < slots; position++) {
    const atPosition: GroupRow[] = tables
      .map((table) => table[position])
      .filter((row): row is GroupRow => row !== undefined);
    for (const row of rankAcrossGroups(atPosition)) {
      if (qualified.length >= slots) break;
      qualified.push(row.nid);
    }
  }
  return qualified;
}

/**
 * The confederation allocation for a set of nations, recomputed identically at
 * draw time and at play time so no allocation state has to be persisted. Nations
 * arrive strongest first (buildSquads sorts them), so nids and the contender set
 * are stable.
 */
function planQualifying(nations: string[]): {
  nidOf: Map<string, number>;
  byConfederation: ReturnType<typeof groupByConfederation>;
  slotsByConfederation: ReturnType<typeof allocateSlots>;
} {
  const nidOf = new Map(nations.map((n, i) => [n, i]));
  const byConfederation = groupByConfederation(nations);
  // A confederation's pull comes from how many genuinely competitive nations it
  // holds, not how many nations it has — the contender set is the strongest
  // INTL_FIELD_SIZE in the world.
  const contenders = new Set(nations.slice(0, INTL_FIELD_SIZE));
  const slotsByConfederation = allocateSlots(byConfederation, INTL_FIELD_SIZE, contenders);
  return { nidOf, byConfederation, slotsByConfederation };
}

/**
 * Draw a qualifying campaign without playing a match: every eligible nation
 * names a squad, confederations are allocated the INTL_FIELD_SIZE places between
 * them, and each confederation that has more nations than places is drawn into
 * serpentine groups whose fixtures start unplayed (`qualified` stays empty until
 * playQualifying runs). No rng draw is taken from the shared stream and no
 * player is touched, so this is safe to run the instant the offseason begins.
 *
 * Returns null when the world simply cannot fill the field — an England-only
 * legacy save, say, whose player pool spans too few nations. The caller treats
 * that exactly like a world with no Continental Cup: the feature stays dark.
 */
export function initQualifying(players: Player[], season: number): IntlQualifyingCampaign | null {
  const squads: NationSquad[] = buildSquads(players);
  if (squads.length < INTL_FIELD_SIZE) return null;

  const nations = squads.map((s) => s.nation);
  const { nidOf, byConfederation, slotsByConfederation } = planQualifying(nations);

  const groups: IntlGroup[] = [];
  for (const [confederation, slots] of slotsByConfederation) {
    const members = (byConfederation.get(confederation) ?? []).map((n) => nidOf.get(n)!);
    // A confederation with no more nations than places sends them all — there
    // is nothing to qualify for, so it plays no matches.
    if (members.length <= slots) continue;
    for (const nids of serpentineGroups(members, groupCountFor(members.length, slots))) {
      groups.push(buildGroup(groups.length, nids, confederation, INTL_QUAL_LEGS));
    }
  }

  return { season, nations, squads, groups, qualified: [] };
}

/**
 * Play a drawn qualifying campaign's groups and fill each confederation's
 * places, returning the completed campaign (its `qualified` now the next
 * tournament's field) plus the appearances the matches generated. The
 * allocation is recomputed from the campaign's own nations, so this needs no
 * extra state beyond the drawn campaign itself.
 */
export function playQualifying(
  campaign: IntlQualifyingCampaign,
  players: Player[],
  lid: number,
): { campaign: IntlQualifyingCampaign; delta: CareerDelta } {
  const { season, nations, squads } = campaign;
  const { nidOf, byConfederation, slotsByConfederation } = planQualifying(nations);

  const delta = emptyCareerDelta();
  const matchData = nationMatchData(squads, players);
  const played = playGroups(campaign.groups, matchData, lid, season, QUALIFYING_GROUP_STREAM, false, delta);

  // Which of the played groups belong to each confederation, keyed off the
  // confederation stamped on the fixture at draw time.
  const groupsOfConfederation = new Map<string, number[]>();
  played.forEach((g, i) => {
    if (g.confederation == null) return;
    const arr = groupsOfConfederation.get(g.confederation) ?? [];
    arr.push(i);
    groupsOfConfederation.set(g.confederation, arr);
  });

  const qualifiedNids: number[] = [];
  for (const [confederation, slots] of slotsByConfederation) {
    const members = (byConfederation.get(confederation) ?? []).map((n) => nidOf.get(n)!);
    if (members.length <= slots) {
      qualifiedNids.push(...members); // direct qualifiers, played no matches
      continue;
    }
    const indices = groupsOfConfederation.get(confederation) ?? [];
    qualifiedNids.push(...fillPlaces(indices.map((i) => played[i]), slots));
  }

  // Strongest first (by nid), so the tournament draw's pots are seeded correctly.
  const qualified = [...new Set(qualifiedNids)]
    .sort((a, b) => a - b)
    .slice(0, INTL_FIELD_SIZE)
    .map((nid) => nations[nid]);

  return { campaign: { ...campaign, groups: played, qualified }, delta };
}

/**
 * Draw and play a whole qualifying campaign in one pass — the bulk path behind
 * "Sim through qualifying" and the equivalence baseline for the staged path.
 * Null when the world cannot fill the field (see initQualifying).
 */
export function runQualifying(
  players: Player[],
  season: number,
  lid: number,
): { campaign: IntlQualifyingCampaign; delta: CareerDelta } | null {
  const drawn = initQualifying(players, season);
  if (!drawn) return null;
  const result = playQualifying(drawn, players, lid);
  if (result.campaign.qualified.length < INTL_FIELD_SIZE) return null;
  return result;
}
