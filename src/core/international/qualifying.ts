import type { Player } from "../players/types.js";
import type { IntlGroup, IntlQualifyingCampaign, NationSquad } from "./types.js";
import type { CareerDelta } from "./simIntl.js";
import { buildSquads, nationMatchData } from "./squads.js";
import { groupByConfederation, allocateSlots } from "./confederations.js";
import { buildGroup, serpentineGroups, groupTable, rankAcrossGroups, type GroupRow } from "./groups.js";
import { playGroups, emptyCareerDelta, mergeCareerDelta, QUALIFYING_GROUP_STREAM } from "./simIntl.js";
import { hashInts } from "../../engine/rng.js";
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
 * the last leg is played, one leg per offseason via playQualifyingRound). No rng
 * draw is taken from the shared stream and no player is touched, so this is safe
 * to run the instant the offseason begins.
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
 * The 16 qualifiers, computed once the whole campaign is played: each
 * confederation's places filled by finishing position across its groups, plus
 * the direct qualifiers whose confederation had no more nations than places.
 * Strongest first (by nid) so the tournament draw's pots seed correctly. The
 * allocation is recomputed from the campaign's own nations, so no extra state is
 * stored on the campaign.
 */
export function computeQualified(played: IntlGroup[], nations: string[]): string[] {
  const { nidOf, byConfederation, slotsByConfederation } = planQualifying(nations);

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

  return [...new Set(qualifiedNids)]
    .sort((a, b) => a - b)
    .slice(0, INTL_FIELD_SIZE)
    .map((nid) => nations[nid]);
}

/**
 * Play the next unplayed leg of a qualifying campaign — one leg per offseason
 * across the four-year cycle. Each leg is seeded independently (off the
 * campaign's start season and the leg index), so its results are the same
 * whether the campaign is clicked through a leg at a time or run in one pass.
 * Squad pids are filtered to players still in the world, because a three-season
 * campaign outlives some of the players named at its start (retirement runs
 * between offseasons). Once the final leg completes, the 16 qualifiers are
 * locked in.
 */
export function playQualifyingRound(
  campaign: IntlQualifyingCampaign,
  players: Player[],
  lid: number,
): { campaign: IntlQualifyingCampaign; delta: CareerDelta; injured: number[] } {
  const delta = emptyCareerDelta();
  const injured = new Set<number>();

  // The next leg to play is the lowest leg with any fixture still unplayed.
  const pendingLegs = campaign.groups.flatMap((g) =>
    g.matches.filter((m) => m.homeGoals < 0).map((m) => m.leg ?? 0),
  );
  if (pendingLegs.length === 0) {
    // Nothing left to play (or a world where every confederation qualified
    // directly): make sure the qualifiers are computed.
    const qualified = campaign.qualified.length > 0
      ? campaign.qualified
      : computeQualified(campaign.groups, campaign.nations);
    return { campaign: { ...campaign, qualified }, delta, injured: [] };
  }
  const leg = Math.min(...pendingLegs);

  // Drop squad members who have since retired out of the world so match data
  // never dereferences a missing pid.
  const alive = new Set(players.map((p) => p.pid));
  const liveSquads = campaign.squads.map((s) => ({ ...s, pids: s.pids.filter((pid) => alive.has(pid)) }));
  const matchData = nationMatchData(liveSquads, players);

  const seed = hashInts(lid, campaign.season, QUALIFYING_GROUP_STREAM, leg);
  const played = playGroups(campaign.groups, matchData, seed, false, delta, injured, leg);

  const complete = played.every((g) => g.matches.every((m) => m.homeGoals >= 0));
  const qualified = complete ? computeQualified(played, campaign.nations) : campaign.qualified;
  return { campaign: { ...campaign, groups: played, qualified }, delta, injured: [...injured] };
}

/**
 * Draw and play a whole qualifying campaign (every leg) in one pass — the bulk
 * path and the equivalence baseline for the staged, one-leg-per-offseason play.
 * Null when the world cannot fill the field (see initQualifying).
 */
export function runQualifying(
  players: Player[],
  season: number,
  lid: number,
): { campaign: IntlQualifyingCampaign; delta: CareerDelta; injured: number[] } | null {
  const drawn = initQualifying(players, season);
  if (!drawn) return null;

  const delta = emptyCareerDelta();
  const injured = new Set<number>();
  let campaign = drawn;
  for (let guard = 0; campaign.qualified.length === 0 && guard <= INTL_QUAL_LEGS; guard++) {
    const r = playQualifyingRound(campaign, players, lid);
    mergeCareerDelta(delta, r.delta);
    for (const pid of r.injured) injured.add(pid);
    campaign = r.campaign;
  }

  if (campaign.qualified.length < INTL_FIELD_SIZE) return null;
  return { campaign, delta, injured: [...injured] };
}
