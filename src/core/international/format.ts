/**
 * Tournament shapes.
 *
 * The World Cup has a fixed 32-nation field, so its shape could be hard-coded
 * (eight groups of four, top two into a sixteen-nation bracket). A confederation
 * cup cannot: Europe fields two dozen nations and South America five,
 * and the same code has to run both. So a tournament's shape is chosen from
 * this table by how many nations actually turned up.
 *
 * Every shape ends in a power-of-two knockout, which is what lets the staged
 * offseason play several tournaments side by side and still land their finals
 * on the same click (see confederationCup.ts). The smallest shape is a single
 * round-robin whose top two contest a final — which is not a fudge for a thin
 * field but how Copa America was genuinely played until 1975.
 */

/** A tournament's shape: how the field splits into groups and how many advance. */
export interface TournamentFormat {
  fieldSize: number;
  groupCount: number;
  qualifyPerGroup: number;
}

/**
 * Supported shapes, largest field first. Each one's knockout is
 * `groupCount * qualifyPerGroup` nations, always a power of two:
 *
 *   32 -> 8 groups of 4, top 2 -> 16-nation knockout (the World Cup's shape)
 *   16 -> 4 groups of 4, top 2 -> 8
 *   12 -> 4 groups of 3, top 2 -> 8
 *    8 -> 2 groups of 4, top 2 -> 4
 *    6 -> 2 groups of 3, top 2 -> 4
 *    5 -> one round-robin,  top 2 -> a final
 *    4 -> one round-robin,  top 2 -> a final
 */
export const TOURNAMENT_FORMATS: TournamentFormat[] = [
  { fieldSize: 32, groupCount: 8, qualifyPerGroup: 2 },
  { fieldSize: 16, groupCount: 4, qualifyPerGroup: 2 },
  { fieldSize: 12, groupCount: 4, qualifyPerGroup: 2 },
  { fieldSize: 8, groupCount: 2, qualifyPerGroup: 2 },
  { fieldSize: 6, groupCount: 2, qualifyPerGroup: 2 },
  { fieldSize: 5, groupCount: 1, qualifyPerGroup: 2 },
  { fieldSize: 4, groupCount: 1, qualifyPerGroup: 2 },
];

/**
 * The biggest shape that fits: no larger than the target field the competition
 * wants, and no larger than the number of nations available to fill it. Null
 * when neither reaches the smallest supported shape, which is the signal to not
 * hold the tournament at all.
 */
export function formatFor(available: number, target: number): TournamentFormat | null {
  const cap = Math.min(available, target);
  return TOURNAMENT_FORMATS.find((f) => f.fieldSize <= cap) ?? null;
}

/** How many knockout rounds a shape plays (4 for a sixteen-nation bracket, 1 for a lone final). */
export function knockoutRounds(format: TournamentFormat): number {
  return Math.log2(format.groupCount * format.qualifyPerGroup);
}
