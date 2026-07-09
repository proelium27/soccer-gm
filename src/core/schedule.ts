/** Flat fixture kept for backward compatibility with existing tests and season.ts. */
export interface Fixture {
  home: number; // tid
  away: number; // tid
}

/** Matchday-aware fixture produced by the new scheduler. */
export interface ScheduleGame {
  matchday: number; // 1–38
  home: number; // tid
  away: number; // tid
}

/**
 * Double round-robin: every distinct ordered pair of team ids plays once, so
 * each pair meets twice (home and away). Order within the list is deterministic.
 *
 * @deprecated Use {@link generateSchedule} for matchday-grouped fixtures.
 */
export function doubleRoundRobin(teamIds: number[]): Fixture[] {
  const fixtures: Fixture[] = [];
  for (const home of teamIds)
    for (const away of teamIds)
      if (home !== away) fixtures.push({ home, away });
  return fixtures;
}

/**
 * Generate a full double round-robin schedule with matchday grouping using the
 * circle method (polygon scheduling algorithm).
 *
 * For n teams (must be even):
 *   - Fix team 0 in position 0; rotate the rest through positions 1..(n-1).
 *   - Each round: pair pos 0 vs pos n-1, pos 1 vs pos n-2, etc.
 *   - Alternate home/away per round so no team always hosts or always visits.
 *   - Second half mirrors the first half with home/away reversed.
 *
 * Result: n-1 rounds per half * 2 halves = 2*(n-1) matchdays, n/2 games each.
 * For 20 teams: 38 matchdays, 10 games per matchday, 380 games total.
 */
export function generateSchedule(teamIds: number[]): ScheduleGame[] {
  const n = teamIds.length;
  if (n < 2 || n % 2 !== 0) {
    throw new Error(
      `generateSchedule requires an even number of teams >= 2, got ${n}`,
    );
  }

  const roundsPerHalf = n - 1;
  const gamesPerRound = n / 2;

  // Build the rotating array: fix teamIds[0] at position 0, rotate the rest.
  const fixed = teamIds[0];
  const rotating = teamIds.slice(1); // length = n - 1

  const schedule: ScheduleGame[] = [];

  for (let half = 0; half < 2; half++) {
    // Take a fresh copy of the rotating array for each half so the second
    // half mirrors the first.
    const rot = [...rotating];

    for (let round = 0; round < roundsPerHalf; round++) {
      const matchday = half * roundsPerHalf + round + 1; // 1-indexed

      // Build the current round's positions: [fixed, rot[0], rot[1], ..., rot[n-2]]
      const positions = [fixed, ...rot];

      for (let i = 0; i < gamesPerRound; i++) {
        const teamA = positions[i];
        const teamB = positions[n - 1 - i];

        let home: number;
        let away: number;

        if (half === 0) {
          // First half: alternate home/away by round parity so no team is
          // always home or always away when seated in position 0.
          if (round % 2 === 0) {
            home = teamA;
            away = teamB;
          } else {
            home = teamB;
            away = teamA;
          }
        } else {
          // Second half: reverse home/away relative to the corresponding
          // first-half round.
          if (round % 2 === 0) {
            home = teamB;
            away = teamA;
          } else {
            home = teamA;
            away = teamB;
          }
        }

        schedule.push({ matchday, home, away });
      }

      // Rotate: move last element to front of the rotating array.
      rot.unshift(rot.pop()!);
    }
  }

  return schedule;
}
