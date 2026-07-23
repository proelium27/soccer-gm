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
 * Run a whole qualifying campaign in one pass: every eligible nation names a
 * squad, confederations are allocated the INTL_FIELD_SIZE places between them,
 * and each plays its groups out. Returns the campaign plus the international
 * appearances it generated.
 *
 * Returns null when the world simply cannot fill the field — an England-only
 * legacy save, say, whose player pool spans too few nations. The caller treats
 * that exactly like a world with no Continental Cup: the feature stays dark.
 */
export function runQualifying(
  players: Player[],
  season: number,
  lid: number,
): { campaign: IntlQualifyingCampaign; delta: CareerDelta } | null {
  const squads: NationSquad[] = buildSquads(players);
  if (squads.length < INTL_FIELD_SIZE) return null;

  // nid = index into `nations`, assigned strongest first (buildSquads sorts).
  const nations = squads.map((s) => s.nation);
  const nidOf = new Map(nations.map((n, i) => [n, i]));

  const byConfederation = groupByConfederation(nations);
  // A confederation's pull comes from how many genuinely competitive nations it
  // holds, not how many nations it has — the contender set is the strongest
  // INTL_FIELD_SIZE in the world (nations are already sorted strongest first).
  const contenders = new Set(nations.slice(0, INTL_FIELD_SIZE));
  const slotsByConfederation = allocateSlots(byConfederation, INTL_FIELD_SIZE, contenders);

  const groups: IntlGroup[] = [];
  // Which of `groups` belong to each confederation, so places can be filled
  // per confederation once every group has been played.
  const groupsOfConfederation = new Map<string, number[]>();
  const directQualifiers: number[] = [];

  for (const [confederation, slots] of slotsByConfederation) {
    const members = (byConfederation.get(confederation) ?? []).map((n) => nidOf.get(n)!);
    // A confederation with no more nations than places sends them all — there
    // is nothing to qualify for, so it plays no matches.
    if (members.length <= slots) {
      directQualifiers.push(...members);
      continue;
    }
    const indices: number[] = [];
    for (const nids of serpentineGroups(members, groupCountFor(members.length, slots))) {
      indices.push(groups.length);
      groups.push(buildGroup(groups.length, nids, confederation, INTL_QUAL_LEGS));
    }
    groupsOfConfederation.set(confederation, indices);
  }

  const delta = emptyCareerDelta();
  const matchData = nationMatchData(squads, players);
  const played = playGroups(groups, matchData, lid, season, QUALIFYING_GROUP_STREAM, false, delta);

  const qualifiedNids = [...directQualifiers];
  for (const [confederation, slots] of slotsByConfederation) {
    const indices = groupsOfConfederation.get(confederation);
    if (!indices) continue; // direct qualifiers, handled above
    qualifiedNids.push(...fillPlaces(indices.map((i) => played[i]), slots));
  }

  // Strongest first, so the tournament draw's pots are seeded correctly.
  const qualified = [...new Set(qualifiedNids)]
    .sort((a, b) => a - b)
    .slice(0, INTL_FIELD_SIZE)
    .map((nid) => nations[nid]);

  if (qualified.length < INTL_FIELD_SIZE) return null;

  return {
    campaign: { season, nations, squads, groups: played, qualified },
    delta,
  };
}
