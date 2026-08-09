/**
 * EA FC league names -> soccer-gm competition names.
 *
 * The datasets disagree on naming across editions ("Spain Primera Division",
 * "LaLiga", "LaLiga EA Sports" and "Spanish La Liga" all appear for the same
 * competition, and sponsor names churn yearly), so each competition matches a
 * list of distinctive substrings against the normalized league cell rather than
 * relying on an exact name.
 *
 * Order matters: second-tier patterns are tested before first-tier ones,
 * because "2. Bundesliga" contains "bundesliga" and "Liga Portugal 2" contains
 * "liga portugal". Every rule is checked most-specific-first for that reason.
 */

export interface LeagueRule {
  /** The soccer-gm competition name this maps onto. */
  competition: string;
  /** Normalized substrings that identify the league. */
  patterns: string[];
}

/** Normalize a league cell the same way headers are normalized. */
export function normalizeLeague(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

/**
 * Second tiers first — see the ordering note above. Within a country the tier-2
 * rule must be unambiguous against the tier-1 name.
 */
export const LEAGUE_RULES: LeagueRule[] = [
  // --- Second tiers ---
  { competition: "English Division 2", patterns: ["championship", "efl_championship", "english_league_championship"] },
  { competition: "Spanish Division 2", patterns: ["segunda_division", "laliga_2", "la_liga_2", "laliga_hypermotion", "spain_segunda"] },
  { competition: "Italian Division 2", patterns: ["serie_b"] },
  { competition: "German Division 2", patterns: ["2_bundesliga", "german_2", "bundesliga_2"] },
  { competition: "French Division 2", patterns: ["ligue_2", "french_ligue_2", "domino_s_ligue_2"] },
  { competition: "Portuguese Division 2", patterns: ["liga_portugal_2", "segunda_liga", "liga_2", "portuguese_segunda"] },

  // --- First tiers ---
  { competition: "English Division 1", patterns: ["premier_league", "english_premier"] },
  { competition: "Spanish Division 1", patterns: ["primera_division", "laliga", "la_liga", "spain_primera"] },
  { competition: "Italian Division 1", patterns: ["serie_a"] },
  { competition: "German Division 1", patterns: ["bundesliga"] },
  { competition: "French Division 1", patterns: ["ligue_1"] },
  { competition: "Portuguese Division 1", patterns: ["liga_portugal", "primeira_liga", "liga_nos", "liga_zon", "portuguese_liga"] },
];

/**
 * Resolve an EA league cell to a soccer-gm competition name, or null when the
 * league is not one of the twelve the game models (the datasets carry 30+
 * leagues; everything outside our six countries' two tiers is simply skipped).
 */
export function mapLeague(raw: string | undefined): string | null {
  if (!raw) return null;
  const n = normalizeLeague(raw);
  for (const rule of LEAGUE_RULES) {
    if (rule.patterns.some((p) => n.includes(p))) return rule.competition;
  }
  return null;
}
