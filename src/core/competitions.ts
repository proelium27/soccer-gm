/**
 * A competition is one league a set of clubs plays in — one entry per
 * division per country. Teams point at a competition via StoredTeam.compId.
 * New saves span eight countries (England, Spain, Italy, Germany, France,
 * Portugal, Belgium, Turkey), each a two-division pyramid; England-only saves
 * predating the world expansion keep just competitions 0/1. France, Portugal,
 * Belgium and Turkey are deliberately weaker leagues — see
 * COUNTRY_STRENGTH_OFFSET in constants.ts. Ids are stable forever within a
 * save: an old save's legacy division values (0 = English D1, 1 = English D2)
 * are already valid compIds by construction.
 */
import {
  COUNTRY_STRENGTH_OFFSET, COUNTRY_BUDGET_SCALE, LEAGUE_BASE, DIVISION_2_OFFSET,
  CUP_STRONG_LEAGUE_SLOTS, CUP_WEAK_LEAGUE_SLOTS, CUP_LP_DIRECT_QF, CUP_LP_PLAYOFF_TEAMS,
} from "./constants.js";

export interface Competition {
  id: number;
  country: string;
  tier: 1 | 2;
  name: string;
  /* ── Per-league tuning ─────────────────────────────────────────────────────
   * Every knob below is OPTIONAL and falls back to the per-country tables in
   * constants.ts when absent. That fallback is the whole point: every shipped
   * competition leaves them unset, so the default world and every existing save
   * behave exactly as before and need no migration. They exist so a league the
   * player adds — which has no entry in those country tables — can carry its
   * own settings, and so the new-league screen can override a shipped league's.
   *
   * Resolve them through the accessors below (competitionStrengthOffset etc.)
   * rather than reading the fields directly, or a custom league silently gets
   * the shipped default. */
  /**
   * OVR handicap applied to every player generated into this league, in the
   * same units as COUNTRY_STRENGTH_OFFSET (roughly 0.94 OVR per point). Higher
   * = weaker. Absent → the country's shipped offset, or 0 for a country with
   * no entry.
   */
  strengthOffset?: number;
  /**
   * The league's youth-intake anchor, as an offset in the same units. Separate
   * from strengthOffset because the two answer different questions — how good
   * this league is *now* versus what it keeps regenerating toward — so a league
   * can be set up to decline (strong squads, weak academies) or to rise. Absent
   * → strengthOffset, which is the shipped behaviour: one number doing both.
   */
  academyOffset?: number;
  /**
   * Money multiplier for every club in this league, on top of the tier scale.
   * Absent → the country's COUNTRY_BUDGET_SCALE entry, or 1.
   *
   * Keep this monotonic with strengthOffset: a weaker-but-richer league climbs
   * the ladder over a dynasty and overtakes a stronger-but-poorer one, which is
   * measured (see the constant's own comment) and is the single easiest way to
   * break a world.
   */
  budgetScale?: number;
  /**
   * How many clubs this league sends to each continental competition, keyed by
   * CupCompetitionId ("continental" | "shield"). Absent (or an absent entry) →
   * the competition format's strong/weak default for this league.
   *
   * Only the slot COUNTS live here. Where each competition starts in the table
   * is always derived from the counts above it (see cupOffsetForCompetition),
   * so the fields cannot overlap or leave a gap whatever these are set to.
   */
  continentalSlots?: Partial<Record<string, number>>;
}

/* ── Per-league tuning accessors ─────────────────────────────────────────────
 * One place each knob is resolved: the competition's own value if it carries
 * one, else the shipped per-country table. Every reader in the codebase goes
 * through these, so adding a league is a matter of setting fields rather than
 * hunting down each lookup. */

/** This league's OVR handicap — higher is weaker. See Competition.strengthOffset. */
export function competitionStrengthOffset(comp: Competition): number {
  return comp.strengthOffset ?? COUNTRY_STRENGTH_OFFSET[comp.country] ?? 0;
}

/**
 * This league's youth-intake anchor offset. Falls back to its *strength* offset
 * rather than to the country table directly, so a league that customises only
 * its current strength keeps academies in step with it — which is the shipped
 * behaviour, where one number does both jobs.
 */
export function competitionAcademyOffset(comp: Competition): number {
  return comp.academyOffset ?? competitionStrengthOffset(comp);
}

/** This league's money multiplier, before the tier scale. See Competition.budgetScale. */
export function competitionBudgetScale(comp: Competition): number {
  return comp.budgetScale ?? COUNTRY_BUDGET_SCALE[comp.country] ?? 1;
}

/**
 * Whether this league gets the "weak league" share of continental places, and
 * whatever else keys off league strength. Derived from the resolved offset, so
 * a custom league is classified by what it actually is rather than by whether
 * its country happens to appear in a table.
 */
export function isWeakLeague(comp: Competition): boolean {
  return competitionStrengthOffset(comp) > 0;
}

/**
 * Center strength a club's academyBase converges toward after a promotion/
 * relegation swap — its new tier's band within its own league, so a promoted
 * French club rises toward French D1's (handicapped) level, not England's.
 */
export function academyBaseCenterOf(comp: Competition): number {
  return LEAGUE_BASE - competitionAcademyOffset(comp) - (comp.tier === 2 ? DIVISION_2_OFFSET : 0);
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
    { id: 6, country: "Germany", tier: 1, name: "German Division 1" },
    { id: 7, country: "Germany", tier: 2, name: "German Division 2" },
    { id: 8, country: "France", tier: 1, name: "French Division 1" },
    { id: 9, country: "France", tier: 2, name: "French Division 2" },
    { id: 10, country: "Portugal", tier: 1, name: "Portuguese Division 1" },
    { id: 11, country: "Portugal", tier: 2, name: "Portuguese Division 2" },
    { id: 12, country: "Belgium", tier: 1, name: "Belgian Division 1" },
    { id: 13, country: "Belgium", tier: 2, name: "Belgian Division 2" },
    { id: 14, country: "Turkey", tier: 1, name: "Turkish Division 1" },
    { id: 15, country: "Turkey", tier: 2, name: "Turkish Division 2" },
  ];
}

/* ── Building a world's table ────────────────────────────────────────────────
 * A save's competitions table is fixed at creation and never regenerated, so
 * this is the only place a world's shape is decided. The new-league screen
 * assembles a list of these and hands the result to createLeagueState. */

/**
 * One country in a world: its two divisions and the knobs they carry. A country
 * is always a two-division pyramid — promotion/relegation pairs a tier-1
 * competition with exactly one tier-2 partner (see partnerOf), and a one-tier
 * country would have nothing to be relegated into.
 *
 * Every knob is optional, and leaving one out is meaningfully different from
 * setting it: absent means "fall back to the shipped country table", which is
 * what keeps a world built from the shipped countries identical to
 * worldCompetitions().
 */
export interface LeagueSpec {
  country: string;
  /** Defaults to "<country> Division 1" / "... 2". */
  d1Name?: string;
  d2Name?: string;
  strengthOffset?: number;
  academyOffset?: number;
  budgetScale?: number;
  /** Places sent to the Continental Cup / Shield. Absent → the format default. */
  cupSlots?: number;
  shieldSlots?: number;
}

/** Drop keys whose value is undefined, so an untouched knob stays *absent*. */
function withDefined<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

/**
 * Build a competitions table from a list of countries, in the order given. Ids
 * are handed out sequentially in table order, which is also the order
 * generateWorld walks countries in, so a country's position here decides its
 * clubs' tids.
 */
export function buildCompetitions(specs: LeagueSpec[]): Competition[] {
  const out: Competition[] = [];
  for (const spec of specs) {
    const slots = withDefined({ continental: spec.cupSlots, shield: spec.shieldSlots });
    const shared = withDefined({
      strengthOffset: spec.strengthOffset,
      academyOffset: spec.academyOffset,
      budgetScale: spec.budgetScale,
      continentalSlots: Object.keys(slots).length > 0 ? slots : undefined,
    });
    out.push({
      id: out.length,
      country: spec.country,
      tier: 1,
      name: spec.d1Name ?? `${spec.country} Division 1`,
      ...shared,
    });
    out.push({
      id: out.length,
      country: spec.country,
      tier: 2,
      name: spec.d2Name ?? `${spec.country} Division 2`,
      ...shared,
    });
  }
  return out;
}

/**
 * The money scale that keeps a league of this strength in step with the shipped
 * ladder. Fitted to the shipped pairs (offset 0 → 1.0, 10 → 0.5, 12 → 0.4), and
 * used as the default when a player adds a league so the common case lands on a
 * world that behaves.
 */
export function suggestedBudgetScale(strengthOffset: number): number {
  const scale = 1 - 0.05 * strengthOffset;
  return Math.round(Math.min(1, Math.max(0.25, scale)) * 100) / 100;
}

/**
 * Problems with a world's tuning that the player should see before generating
 * it. Advisory, never blocking — it is their world — but these are failure modes
 * that take a dynasty to show up and read as bugs when they do, so they are
 * worth saying out loud at the one moment they can still be changed.
 *
 * The money-versus-strength check is the important one and is measured, not
 * theoretical: a weaker-but-richer league climbs the ladder over 20 seasons and
 * overtakes a stronger-but-poorer one (see COUNTRY_BUDGET_SCALE's comment for
 * the 2.23-OVR inversion this describes).
 */
export function worldTuningWarnings(specs: LeagueSpec[]): string[] {
  const out: string[] = [];
  if (specs.length === 0) return ["A world needs at least one league."];

  const named = specs.map((s) => ({
    country: s.country,
    strength: s.strengthOffset ?? COUNTRY_STRENGTH_OFFSET[s.country] ?? 0,
    money: s.budgetScale ?? COUNTRY_BUDGET_SCALE[s.country] ?? 1,
  }));
  for (const a of named) {
    for (const b of named) {
      // a is the weaker league (higher offset) but has the bigger budget.
      if (a.strength > b.strength && a.money > b.money) {
        out.push(
          `${a.country} is weaker than ${b.country} but richer. Over a long save the`
          + ` richer league climbs, so ${a.country} will likely end up above`
          + ` ${b.country} rather than below it.`,
        );
      }
    }
  }

  const duplicates = specs
    .map((s) => s.country.trim().toLowerCase())
    .filter((c, i, all) => all.indexOf(c) !== i);
  for (const dupe of new Set(duplicates)) {
    out.push(`Two leagues are both called "${dupe}". Give them different countries.`);
  }

  // The Continental Cup needs a field big enough to seed its whole structure
  // (four direct quarter-finalists plus an eight-team playoff). Short of that it
  // simply doesn't run — a legitimate world, but a surprising thing to discover
  // a season in. Counted the same way cupPlan counts it, defaults included,
  // rather than guessed from the number of countries.
  const cupField = named.reduce((total, league, i) => {
    const spec = specs[i];
    const fallback = league.strength > 0 ? CUP_WEAK_LEAGUE_SLOTS : CUP_STRONG_LEAGUE_SLOTS;
    return total + (spec.cupSlots ?? fallback);
  }, 0);
  if (cupField < CUP_LP_DIRECT_QF + CUP_LP_PLAYOFF_TEAMS) {
    out.push(
      `Only ${cupField} clubs would qualify for the Continental Cup, and it needs`
      + ` ${CUP_LP_DIRECT_QF + CUP_LP_PLAYOFF_TEAMS}. Add more leagues or more places`
      + ` per league, or it won't run.`,
    );
  }
  return [...new Set(out)];
}

/**
 * The shipped world expressed as specs, so the new-league screen can start from
 * it and let the player toggle countries off, retune one, or append their own.
 * Every knob is left absent, so building these back returns exactly
 * worldCompetitions() — pinned by a test.
 */
export function worldLeagueSpecs(): LeagueSpec[] {
  return tier1Pairs(worldCompetitions()).map(({ d1, d2 }) => ({
    country: d1.country,
    d1Name: d1.name,
    d2Name: d2.name,
  }));
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

/** One club slot in a freshly generated world: which competition a tid lands in. */
export interface TeamSlot {
  tid: number;
  compId: number;
}

/**
 * Every club slot a fresh world will have, tid -> competition, laid out exactly
 * the way generateWorld() assigns tids (tier1Pairs() order, a country's tier-1
 * block then its tier-2 block). Lets a caller reason about the slot structure
 * of a save that doesn't exist yet — the new-league roster-file preview needs
 * to know which competition each tid belongs to before paying the cost of
 * generating 6000 players.
 */
export function worldTeamSlots(
  competitions: Competition[],
  teamsPerTier1: number,
  teamsPerTier2: number,
): TeamSlot[] {
  const slots: TeamSlot[] = [];
  let tid = 0;
  for (const { d1, d2 } of tier1Pairs(competitions)) {
    for (let i = 0; i < teamsPerTier1; i++) slots.push({ tid: tid++, compId: d1.id });
    for (let i = 0; i < teamsPerTier2; i++) slots.push({ tid: tid++, compId: d2.id });
  }
  return slots;
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
