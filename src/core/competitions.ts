/**
 * A competition is one league a set of clubs plays in — one entry per
 * division per country. Teams point at a competition via StoredTeam.compId.
 * England-only today; a follow-up PR adds Spain and Italy as more rows.
 * Ids are stable forever within a save: an old save's legacy division values
 * (0 = English D1, 1 = English D2) are already valid compIds by construction.
 */
export interface Competition {
  id: number;
  country: string;
  tier: 1 | 2;
  name: string;
}

export function englandCompetitions(): Competition[] {
  return [
    { id: 0, country: "England", tier: 1, name: "English Division 1" },
    { id: 1, country: "England", tier: 2, name: "English Division 2" },
  ];
}

export function worldCompetitions(): Competition[] {
  return [
    ...englandCompetitions(),
    { id: 2, country: "Spain", tier: 1, name: "Spanish Division 1" },
    { id: 3, country: "Spain", tier: 2, name: "Spanish Division 2" },
    { id: 4, country: "Italy", tier: 1, name: "Italian Division 1" },
    { id: 5, country: "Italy", tier: 2, name: "Italian Division 2" },
  ];
}

export function competitionOf(competitions: Competition[], compId: number): Competition {
  const comp = competitions.find((c) => c.id === compId);
  if (!comp) throw new Error(`Unknown compId ${compId}`);
  return comp;
}

export function tierOf(competitions: Competition[], compId: number): 1 | 2 {
  return competitionOf(competitions, compId).tier;
}

/** The other tier's competition in the same country (D1<->D2 partner). */
export function partnerOf(competitions: Competition[], compId: number): Competition {
  const comp = competitionOf(competitions, compId);
  const partner = competitions.find((c) => c.country === comp.country && c.id !== comp.id);
  if (!partner) throw new Error(`No partner competition for compId ${compId}`);
  return partner;
}

/** Unique country names, in table order. */
export function countriesOf(competitions: Competition[]): string[] {
  return [...new Set(competitions.map((c) => c.country))];
}

/** One D1/D2 pair per country, in the table's tier-1 order. */
export interface Tier1Pair {
  d1: Competition;
  d2: Competition;
}

/**
 * Every country's tier-1/tier-2 pair, derived from the table rather than
 * assumed from array position — shared by every caller that needs to walk
 * "each country's two divisions" (promotion/relegation, world generation)
 * so the pairing rule only has one implementation to keep correct.
 */
export function tier1Pairs(competitions: Competition[]): Tier1Pair[] {
  return competitions
    .filter((c) => c.tier === 1)
    .map((d1) => ({ d1, d2: partnerOf(competitions, d1.id) }));
}

export interface CountryClubRange {
  country: string;
  /** Inclusive start tid (== CLUBS index) for this country's block. */
  start: number;
  /** Exclusive end tid (== CLUBS index) for this country's block. */
  end: number;
}

/**
 * The tid/CLUBS-index range each country occupies, derived the same way
 * generateWorld() assigns tids (tier1Pairs() order, tier-1 block then
 * tier-2 block per country) rather than a hardcoded "40 per country"
 * literal — so a future country added to worldCompetitions() is picked up
 * automatically. teamsPerTier1/teamsPerTier2 are passed in (NUM_TEAMS/
 * NUM_TEAMS_D2 from constants.ts) rather than imported here to keep this
 * file free of a dependency on team-count constants it otherwise has no
 * reason to know about.
 */
export function countryClubRanges(
  competitions: Competition[],
  teamsPerTier1: number,
  teamsPerTier2: number,
): CountryClubRange[] {
  const ranges: CountryClubRange[] = [];
  let cursor = 0;
  for (const { d1 } of tier1Pairs(competitions)) {
    const count = teamsPerTier1 + teamsPerTier2;
    ranges.push({ country: d1.country, start: cursor, end: cursor + count });
    cursor += count;
  }
  return ranges;
}
