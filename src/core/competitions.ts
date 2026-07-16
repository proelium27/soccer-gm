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
