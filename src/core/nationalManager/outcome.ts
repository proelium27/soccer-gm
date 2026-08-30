/**
 * What happened to a nation in a campaign, expressed as a placement in the
 * field so it can be compared against where the nation was expected to finish.
 *
 * Pure, rng-free and read-only: everything here is derived from the campaign
 * objects the international sim already wrote.
 */
import type {
  InternationalState, IntlTournament, IntlQualifyingCampaign,
} from "../international/types.js";
import { INTL_QUAL_LEGS, INTL_TOURNAMENT_NAME } from "../constants.js";
import type { CampaignKind } from "./confidence.js";

/**
 * Where a nation finished a tournament, as a place in the field.
 *
 * Everyone knocked out in the same round shares a band of places — the four
 * beaten quarter-finalists really are 5th to 8th and nothing distinguishes them
 * — so a band's midpoint is the only honest single number. Bands are derived
 * from the bracket's own depth rather than named, because bracket depth varies:
 * four rounds for the World Cup's 32-nation field, three for a 16-nation
 * confederation cup, one for a cup that is only a final.
 *
 * Returns null for a nation that wasn't in the field.
 */
export function tournamentPlacement(t: IntlTournament, nation: string): number | null {
  const nid = t.nations.indexOf(nation);
  if (nid < 0) return null;

  const fieldSize = t.nations.length;
  if (t.championNid === nid) return 1;

  const koSize = t.bracket.length;
  const totalRounds = koSize > 1 ? Math.round(Math.log2(koSize)) : 0;

  const lost = t.ties.find((tie) => (tie.home === nid || tie.away === nid) && tie.winner !== nid);
  if (lost) {
    // Rounds still to come after the one they lost: 0 for the final, 1 for a
    // semi, and so on. The losers of that round fill the places just below the
    // survivors, so the band runs 2^k + 1 .. 2^(k+1).
    const roundsFromFinal = totalRounds - 1 - lost.round;
    const k = Math.max(0, roundsFromFinal);
    const bandStart = Math.pow(2, k) + 1;
    const bandEnd = Math.pow(2, k + 1);
    return (bandStart + bandEnd) / 2;
  }

  // Reached the knockout but has no losing tie and isn't champion: the bracket
  // is still being played. Nothing to judge yet.
  if (t.bracket.includes(nid)) return null;

  // Out at the group stage — the band below every nation that made the bracket.
  if (fieldSize <= koSize) return fieldSize;
  return (koSize + 1 + fieldSize) / 2;
}

/**
 * Where a nation "finished" a qualifying campaign.
 *
 * Qualifying has no granularity — you are in the finals or you are not — so a
 * raw midpoint would read a favourite's routine qualification as a collapse
 * (expected 3rd, "finished" 16th). The placement is therefore **clamped toward
 * expectation**: qualifying can only help you if you weren't expected to, and
 * missing out can only hurt you if you were. That makes the four cases come out
 * with exactly the signs a manager would expect, and it is the reason this is
 * not just `tournamentPlacement` with a different field.
 */
export function qualifyingPlacement(
  campaign: IntlQualifyingCampaign,
  nation: string,
  expectedRank: number,
): number | null {
  if (!campaign.nations.includes(nation)) return null;
  const entered = campaign.nations.length;
  const places = campaign.qualified.length;
  if (places === 0 || entered <= 1) return null;

  if (campaign.qualified.includes(nation)) {
    // Somewhere in the qualifying band; no better than you were expected to be.
    return Math.min(expectedRank, (1 + places) / 2);
  }
  // Somewhere in the band that missed out; no worse than you were expected to be.
  return Math.max(expectedRank, (places + 1 + entered) / 2);
}

/** One campaign that concluded this offseason and which the given nation was in. */
export interface ConcludedCampaign {
  kind: CampaignKind;
  competition: string;
  /** Every nation that took part, so expectation is ranked within this field. */
  field: string[];
  /** The finished tournament, for a tournament or confederation cup. */
  tournament: IntlTournament | null;
  /** The finished qualifying campaign, for a qualifying campaign. */
  qualifying: IntlQualifyingCampaign | null;
  /** Won the World Cup. */
  title: boolean;
  /** Won a confederation championship. */
  continentalTitle: boolean;
  /** Reached the World Cup finals — only meaningful for a qualifying campaign. */
  qualified: boolean | null;
}

/**
 * Which campaigns involving `nation` finished in this offseason.
 *
 * Determined from the campaign objects rather than from `season % INTL_CYCLE_YEARS`,
 * so a save that joined the cycle late, a world too small to run a confederation
 * cup, or any future change to the cadence can't leave a campaign silently
 * unjudged. In the shipped cadence at most one ever concludes in a given
 * offseason — qualifying at the cycle's third season, the cups at its second,
 * the World Cup at its fourth — but the list is returned in full and folded in
 * order rather than assuming that.
 */
export function concludedCampaigns(
  intl: InternationalState,
  nation: string,
  season: number,
): ConcludedCampaign[] {
  const out: ConcludedCampaign[] = [];

  // Qualifying spans INTL_QUAL_LEGS offseasons from the cycle's first season, so
  // it concludes in the offseason of that season plus the legs after it.
  const q = intl.qualifying;
  if (
    q
    && q.qualified.length > 0
    && season === q.season + INTL_QUAL_LEGS - 1
    && q.nations.includes(nation)
  ) {
    out.push({
      kind: "qualifying",
      competition: `${INTL_TOURNAMENT_NAME} qualifying`,
      field: q.nations,
      tournament: null,
      qualifying: q,
      title: false,
      continentalTitle: false,
      qualified: q.qualified.includes(nation),
    });
  }

  for (const cup of intl.confederationCups) {
    if (cup.season !== season || cup.championNid === null) continue;
    if (!cup.nations.includes(nation)) continue;
    out.push({
      kind: "confederation",
      competition: cup.name,
      field: cup.nations,
      tournament: cup,
      qualifying: null,
      title: false,
      continentalTitle: cup.nations[cup.championNid] === nation,
      qualified: null,
    });
  }

  const t = intl.tournament;
  if (t && t.season === season && t.championNid !== null && t.nations.includes(nation)) {
    out.push({
      kind: "tournament",
      competition: t.name,
      field: t.nations,
      tournament: t,
      qualifying: null,
      title: t.nations[t.championNid] === nation,
      continentalTitle: false,
      qualified: null,
    });
  }

  return out;
}
