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
  SHIELD_STRONG_LEAGUE_SLOTS, SHIELD_WEAK_LEAGUE_SLOTS, largestValidCupField,
  NUM_TEAMS, NUM_TEAMS_D2, PROMOTION_RELEGATION_COUNT,
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
  /**
   * How many clubs play in this division. Absent → the shipped default for the
   * tier (NUM_TEAMS / NUM_TEAMS_D2).
   *
   * Must be EVEN, because the fixture generator builds a double round robin by
   * the circle method and an odd field leaves a club unpaired every round. It is
   * also capped: a division of n clubs plays 2(n-1) matchdays and the season
   * calendar is a fixed grid (see MAX_DIVISION_TEAMS), so a bigger division has
   * nowhere to put its fixtures.
   */
  teamCount?: number;
  /**
   * How many clubs swap with the division below (or above) at the end of each
   * season. Absent → PROMOTION_RELEGATION_COUNT, which is what every shipped
   * country plays and what a save made before the knob existed keeps.
   *
   * Written to BOTH divisions of a country, because buildCompetitions builds
   * the pair from one spec and they cannot drift; either one answers the
   * question. Meaningless on a one-division country, which has no partner to
   * swap with — tier1Pairs drops it before this is ever read.
   *
   * Resolve through competitionPromotionSpots, never the field: it also holds
   * the number inside what the divisions can supply.
   */
  promotionSpots?: number;
  /**
   * Three-letter code for the country, used wherever a flag would go and there
   * is no flag to draw. The game ships flag art keyed by country name, so a
   * country the player invented has none and would otherwise render an empty
   * grey swatch. Absent → derived from the country name.
   */
  abbrev?: string;
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

/**
 * The country's three-letter code: its own if it set one, else the first three
 * letters of its name. Always returns something, so a caller can use it as the
 * stand-in wherever a flag is missing without checking first.
 */
export function competitionAbbrev(comp: Competition): string {
  const own = comp.abbrev?.trim();
  if (own) return own.toUpperCase().slice(0, 3);
  return comp.country.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 3);
}

/** How many clubs play in this division. See Competition.teamCount. */
export function competitionTeamCount(comp: Competition): number {
  return comp.teamCount ?? (comp.tier === 1 ? NUM_TEAMS : NUM_TEAMS_D2);
}

/**
 * How many clubs this league promotes and relegates each season, held to
 * something both divisions can supply.
 *
 * The clamp is load-bearing rather than defensive: divisions can be different
 * sizes (see teamCount), so a 6-up-6-down setting on a league whose second tier
 * holds 8 clubs would swap most of it, and asking for more clubs than a division
 * holds would trade the two divisions wholesale. Takes the partner's size
 * because the swap needs both ends of it.
 */
export function competitionPromotionSpots(comp: Competition, partner: Competition | null): number {
  if (!partner) return 0;
  const want = comp.promotionSpots ?? partner.promotionSpots ?? PROMOTION_RELEGATION_COUNT;
  // A non-finite value would survive the clamp as NaN, which `slice(-NaN)` then
  // reads as slicing the whole table. Treat it as no swap rather than every swap.
  if (!Number.isFinite(want)) return 0;
  return Math.max(0, Math.min(
    Math.floor(want), competitionTeamCount(comp), competitionTeamCount(partner),
  ));
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
  /**
   * One or two divisions. Two is the default and the shape everything else
   * assumes; one is a country with a single professional league and therefore no
   * promotion or relegation of its own. Deliberately not three — a third tier
   * would need its own promotion chain, ceiling sweep and finance band.
   */
  divisions?: 1 | 2;
  /** Three-letter country code, used where a flag would go. See Competition.abbrev. */
  abbrev?: string;
  /** Clubs per division. Even, and at most MAX_DIVISION_TEAMS. */
  d1Teams?: number;
  d2Teams?: number;
  /** Defaults to "<country> Division 1" / "... 2". */
  d1Name?: string;
  d2Name?: string;
  strengthOffset?: number;
  academyOffset?: number;
  budgetScale?: number;
  /** Places sent to the Continental Cup / Shield. Absent → the format default. */
  cupSlots?: number;
  shieldSlots?: number;
  /**
   * Clubs promoted and relegated between the two divisions each season. Absent
   * → PROMOTION_RELEGATION_COUNT, which is what the shipped countries play.
   * Ignored by a one-division league, which has nothing to swap with.
   */
  promotionSpots?: number;
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
      abbrev: spec.abbrev,
      strengthOffset: spec.strengthOffset,
      academyOffset: spec.academyOffset,
      budgetScale: spec.budgetScale,
      promotionSpots: spec.promotionSpots,
      continentalSlots: Object.keys(slots).length > 0 ? slots : undefined,
    });
    out.push({
      id: out.length,
      country: spec.country,
      tier: 1,
      name: spec.d1Name ?? `${spec.country} Division 1`,
      ...shared,
      ...withDefined({ teamCount: spec.d1Teams }),
    });
    // A one-division country simply has no tier-2 competition. Everything that
    // walks "each country's divisions" goes through tier1Pairs, which returns a
    // null partner rather than throwing.
    if ((spec.divisions ?? 2) === 2) {
      out.push({
        id: out.length,
        country: spec.country,
        tier: 2,
        name: spec.d2Name ?? `${spec.country} Division 2`,
        ...shared,
        ...withDefined({ teamCount: spec.d2Teams }),
      });
    }
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

  // Each continental competition needs a field it can actually build (see
  // isValidCupFieldSize): big enough to seed the whole structure, and a size the
  // league-phase draw can pair. Counted the same way cupPlan counts it, defaults
  // included, rather than guessed from the number of countries.
  //
  // Both failures are worth saying out loud, and the second is the one players
  // won't see coming: places are NOT redistributed, so adding a league grows the
  // field — but only up to the next size the draw can build. Land on an awkward
  // total and the lowest-placed qualifiers in the WORLD are cut, which quietly
  // costs a different league a place it thought it had.
  const fields: [string, number][] = [
    ["Continental Cup", specs.reduce((total, spec, i) => total + (
      spec.cupSlots ?? (named[i].strength > 0 ? CUP_WEAK_LEAGUE_SLOTS : CUP_STRONG_LEAGUE_SLOTS)
    ), 0)],
    ["Continental Shield", specs.reduce((total, spec, i) => total + (
      spec.shieldSlots ?? (named[i].strength > 0 ? SHIELD_WEAK_LEAGUE_SLOTS : SHIELD_STRONG_LEAGUE_SLOTS)
    ), 0)],
  ];

  for (const [name, asked] of fields) {
    const played = largestValidCupField(asked);
    if (played === 0) {
      out.push(
        `Only ${asked} clubs would qualify for the ${name}, and it needs`
        + ` ${CUP_LP_DIRECT_QF + CUP_LP_PLAYOFF_TEAMS}. Add more leagues or more places`
        + ` per league, or it won't run.`,
      );
    } else if (played < asked) {
      out.push(
        `${asked} clubs would qualify for the ${name} but it can only field ${played},`
        + ` so the ${asked - played} lowest-placed of them would miss out every season —`
        + ` taking the place off whichever league finished worst, not off the one that`
        + ` added them. Field sizes go up in fours.`,
      );
    }
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
    ...(d2 ? { d2Name: d2.name } : { divisions: 1 as const }),
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

/**
 * The other tier's competition in the same country, or null when the country has
 * only one division. Nullable rather than throwing because a one-division
 * country is now a legitimate shape: it has nothing to be promoted to or
 * relegated into, and callers have to answer that question rather than crash.
 */
export function partnerOrNull(
  competitions: Competition[],
  compId: number,
): Competition | null {
  const comp = competitionOf(competitions, compId);
  return competitions.find((c) => c.country === comp.country && c.id !== comp.id) ?? null;
}

/** The D1<->D2 partner, for callers that already know the country has both. */
export function partnerOf(competitions: Competition[], compId: number): Competition {
  const partner = partnerOrNull(competitions, compId);
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
  /** Null for a one-division country. */
  d2: Competition | null;
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
    .map((d1) => ({ d1, d2: partnerOrNull(competitions, d1.id) }));
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
export function worldTeamSlots(competitions: Competition[]): TeamSlot[] {
  const slots: TeamSlot[] = [];
  let tid = 0;
  for (const { d1, d2 } of tier1Pairs(competitions)) {
    for (const comp of d2 ? [d1, d2] : [d1]) {
      for (let i = 0; i < competitionTeamCount(comp); i++) {
        slots.push({ tid: tid++, compId: comp.id });
      }
    }
  }
  return slots;
}

/**
 * The tid/CLUBS-index range each country occupies, derived the same way
 * generateWorld() assigns tids (tier1Pairs() order, tier-1 block then tier-2
 * block per country) rather than a hardcoded "40 per country" literal — so a
 * country added to the table, one with a single division, or one with a
 * different number of clubs is all picked up automatically.
 */
export function countryClubRanges(competitions: Competition[]): CountryClubRange[] {
  const ranges: CountryClubRange[] = [];
  let cursor = 0;
  for (const { d1, d2 } of tier1Pairs(competitions)) {
    const count = competitionTeamCount(d1) + (d2 ? competitionTeamCount(d2) : 0);
    ranges.push({ country: d1.country, start: cursor, end: cursor + count });
    cursor += count;
  }
  return ranges;
}

