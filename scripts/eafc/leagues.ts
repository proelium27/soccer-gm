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
 * league is not one this converter covers (the datasets carry 30+ leagues;
 * everything else is simply skipped).
 *
 * **Coverage is twelve competitions across six countries, while the game now
 * models sixteen across eight.** Belgium and Turkey have no rules here, so their
 * clubs are skipped and those four divisions keep their generated identities
 * after an import — the same behaviour as any club a roster file does not cover,
 * not a failure. Adding them means adding a rule below *and* a verified id in
 * LEAGUE_IDS; the ids must be confirmed against a real dataset with
 * scripts/eafc/inspectLeagues.ts, since names alone collide across federations.
 *
 * Name matching alone is NOT sufficient on real data — see resolveByRow below.
 */
export function mapLeague(raw: string | undefined): string | null {
  if (!raw) return null;
  const n = normalizeLeague(raw);
  for (const rule of LEAGUE_RULES) {
    if (rule.patterns.some((p) => n.includes(p))) return rule.competition;
  }
  return null;
}

/**
 * Numeric league ids, which are unambiguous where names are not.
 *
 * League *names* collide across federations, and the exports strip the country
 * prefix that would separate them: in the FC26 dataset "Bundesliga" is both
 * Germany's (id 19) and Austria's (id 80), "Premier League" is both England's
 * (13) and Ukraine's (332), and "Serie A" is both Italy's (31) and Ecuador's
 * (2018). Matching on name alone pulled 12 Austrian clubs into the German top
 * flight and let Shakhtar compete for a Premier League slot.
 *
 * Every id below was verified against that dataset by inspecting the clubs it
 * contains (see scripts/eafc/inspectLeagues.ts), not taken from memory.
 * Portugal's second tier is absent from that dataset, so no id is listed for
 * it — it resolves by name instead, via the unambiguous-name rule.
 */
export const LEAGUE_IDS: Record<string, string> = {
  "13": "English Division 1",   // Premier League
  "14": "English Division 2",   // Championship
  "53": "Spanish Division 1",   // La Liga
  "54": "Spanish Division 2",   // La Liga 2
  "31": "Italian Division 1",   // Serie A
  "32": "Italian Division 2",   // Serie B
  "19": "German Division 1",    // Bundesliga
  "20": "German Division 2",    // 2. Bundesliga
  "16": "French Division 1",    // Ligue 1
  "17": "French Division 2",    // Ligue 2
  "308": "Portuguese Division 1", // Primeira Liga
};

export interface LeagueResolver {
  /** Resolve one row's league, given its raw league name and id. */
  resolve(name: string | undefined, id: string | undefined): string | null;
  /** League names that were skipped because they span several ids. */
  ambiguous: { name: string; ids: string[] }[];
}

/**
 * Build a resolver that prefers league ids and only falls back to the name
 * when that name is unambiguous *within this file*.
 *
 * The fallback rule is what keeps this working on datasets whose ids we don't
 * recognise: a name that maps to exactly one id in the file cannot be hiding a
 * second country's league, so trusting it is safe. A name spanning several ids
 * (Germany's and Austria's "Bundesliga") is only honoured for the ids we
 * actually know, and the rest are dropped rather than guessed at.
 *
 * Datasets with no id column at all fall back to pure name matching, which is
 * the best available and was the previous behaviour.
 */
export function buildLeagueResolver(
  rows: { name: string | undefined; id: string | undefined }[],
): LeagueResolver {
  const idsByName = new Map<string, Set<string>>();
  let sawAnyId = false;
  for (const { name, id } of rows) {
    if (!name) continue;
    if (id) sawAnyId = true;
    if (!idsByName.has(name)) idsByName.set(name, new Set());
    if (id) idsByName.get(name)!.add(id);
  }

  const ambiguous: { name: string; ids: string[] }[] = [];
  for (const [name, ids] of idsByName) {
    if (ids.size > 1 && mapLeague(name) !== null) {
      ambiguous.push({ name, ids: [...ids] });
    }
  }

  return {
    ambiguous,
    resolve(name, id) {
      if (id && LEAGUE_IDS[id]) return LEAGUE_IDS[id];
      if (!name) return null;
      const byName = mapLeague(name);
      if (byName === null) return null;
      // With ids present, only trust the name when it identifies one league.
      if (sawAnyId) {
        const ids = idsByName.get(name);
        if (ids && ids.size > 1) return null;
      }
      return byName;
    },
  };
}
