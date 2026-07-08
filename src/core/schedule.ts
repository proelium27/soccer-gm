export interface Fixture {
  home: number; // tid
  away: number; // tid
}

/**
 * Double round-robin: every distinct ordered pair of team ids plays once, so
 * each pair meets twice (home and away). Order within the list is deterministic.
 * The final table is order-independent, so no matchday interleaving is needed for M1.
 */
export function doubleRoundRobin(teamIds: number[]): Fixture[] {
  const fixtures: Fixture[] = [];
  for (const home of teamIds)
    for (const away of teamIds)
      if (home !== away) fixtures.push({ home, away });
  return fixtures;
}
