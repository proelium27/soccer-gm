/**
 * Which confederation each nation qualifies through.
 *
 * Covers every nation that has a name pool (NATIONALITIES + OTHER_NATIONS +
 * UNLISTED_NATIONALITIES in players/nationalities.ts) — i.e. every nationality
 * a generated player can actually hold. A nation missing from this table would
 * silently drop out of qualifying, so `nationsWithoutConfederation` in the test
 * suite asserts the two lists stay in step when a nation is added.
 */

export const CONFEDERATIONS = [
  "Europe",
  "South America",
  "Africa",
  "Asia",
  "North America",
  "Oceania",
] as const;

export type Confederation = (typeof CONFEDERATIONS)[number];

export const CONFEDERATION_OF: Record<string, Confederation> = {
  // Europe
  Albania: "Europe",
  Austria: "Europe",
  Belarus: "Europe",
  Belgium: "Europe",
  "Bosnia-Herzegovina": "Europe",
  Bulgaria: "Europe",
  Croatia: "Europe",
  "Czech Republic": "Europe",
  Denmark: "Europe",
  England: "Europe",
  Finland: "Europe",
  France: "Europe",
  Georgia: "Europe",
  Germany: "Europe",
  Greece: "Europe",
  Hungary: "Europe",
  Iceland: "Europe",
  Israel: "Europe", // plays in UEFA competition, as in real football
  Italy: "Europe",
  Kosovo: "Europe",
  Montenegro: "Europe",
  Netherlands: "Europe",
  "North Macedonia": "Europe",
  "Northern Ireland": "Europe",
  Norway: "Europe",
  Poland: "Europe",
  Portugal: "Europe",
  "Republic of Ireland": "Europe",
  Romania: "Europe",
  Russia: "Europe",
  Scotland: "Europe",
  Serbia: "Europe",
  Slovakia: "Europe",
  Slovenia: "Europe",
  Spain: "Europe",
  Sweden: "Europe",
  Switzerland: "Europe",
  Turkey: "Europe",
  Ukraine: "Europe",
  Wales: "Europe",

  // South America
  Argentina: "South America",
  Bolivia: "South America",
  Brazil: "South America",
  Chile: "South America",
  Colombia: "South America",
  Ecuador: "South America",
  Paraguay: "South America",
  Peru: "South America",
  Uruguay: "South America",
  Venezuela: "South America",

  // Africa
  Algeria: "Africa",
  Angola: "Africa",
  Benin: "Africa",
  "Burkina Faso": "Africa",
  Cameroon: "Africa",
  "Cape Verde": "Africa",
  Gambia: "Africa",
  "DR Congo": "Africa",
  Egypt: "Africa",
  Ethiopia: "Africa",
  Gabon: "Africa",
  Ghana: "Africa",
  Guinea: "Africa",
  "Guinea-Bissau": "Africa",
  "Ivory Coast": "Africa",
  Kenya: "Africa",
  Libya: "Africa",
  Mali: "Africa",
  Morocco: "Africa",
  Nigeria: "Africa",
  Senegal: "Africa",
  "South Africa": "Africa",
  Sudan: "Africa",
  Tanzania: "Africa",
  Togo: "Africa",
  Uganda: "Africa",
  Tunisia: "Africa",
  Zimbabwe: "Africa",
  Zambia: "Africa",

  // Asia (Australia plays in the Asian confederation, as in real football)
  Australia: "Asia",
  China: "Asia",
  India: "Asia",
  Indonesia: "Asia",
  Iran: "Asia",
  Iraq: "Asia",
  Japan: "Asia",
  Jordan: "Asia",
  Malaysia: "Asia",
  Qatar: "Asia",
  "Saudi Arabia": "Asia",
  "South Korea": "Asia",

  Thailand: "Asia",
  "United Arab Emirates": "Asia",
  Uzbekistan: "Asia",
  Vietnam: "Asia",
  // North America
  Canada: "North America",
  "Costa Rica": "North America",
  "El Salvador": "North America",
  Guatemala: "North America",
  Honduras: "North America",
  Jamaica: "North America",
  Mexico: "North America",
  Panama: "North America",
  "Trinidad and Tobago": "North America",
  "United States": "North America",

  // Oceania
  Fiji: "Oceania",
  "New Zealand": "Oceania",
  "Papua New Guinea": "Oceania",
};

/** The confederation a nation qualifies through, or null if it has none on file. */
export function confederationOf(nation: string): Confederation | null {
  return CONFEDERATION_OF[nation] ?? null;
}

/**
 * Split `nations` by confederation, preserving the input order within each and
 * dropping any nation with no confederation on file. Confederations with no
 * eligible nation are omitted entirely.
 */
export function groupByConfederation(nations: string[]): Map<Confederation, string[]> {
  const out = new Map<Confederation, string[]>();
  for (const nation of nations) {
    const conf = confederationOf(nation);
    if (!conf) continue;
    const list = out.get(conf);
    if (list) list.push(nation);
    else out.set(conf, [nation]);
  }
  return out;
}

/**
 * Allocate `slots` tournament places across confederations by the
 * largest-remainder method, weighted by each confederation's share of the
 * world's genuinely competitive nations rather than by how many nations it has.
 *
 * `contenders` is the set of nations strong enough to count toward a
 * confederation's weight (the caller passes the global strongest N — see
 * planQualifying). Weighting by raw nation count instead was measurably wrong:
 * Africa's eight eligible nations earned as many places as Europe's twenty-four
 * despite Europe holding every one of the eight strongest sides, and the
 * tournament filled up with nations that had no business there while Germany
 * and England watched from home.
 *
 * A confederation with at least one eligible nation but no contender still
 * takes a floor of one place, so every part of the world stays represented —
 * the same reason real qualifying reserves places for its smaller
 * confederations. A confederation is never given more places than it has
 * nations; places freed by that cap go to the largest remainders. Pure function
 * of the inputs, so it needs no rng and is stable for a given world.
 */
export function allocateSlots(
  byConfederation: Map<Confederation, string[]>,
  slots: number,
  contenders: ReadonlySet<string> = new Set(),
): Map<Confederation, number> {
  const entries = [...byConfederation.entries()].filter(([, ns]) => ns.length > 0);
  const out = new Map<Confederation, number>();
  if (entries.length === 0) return out;

  // Weight = contenders held, or 0 for a confederation that has none. When no
  // contender set is supplied at all, fall back to nation counts so the
  // function still behaves sensibly on its own.
  const weightOf = (nations: string[]): number =>
    contenders.size === 0 ? nations.length : nations.filter((n) => contenders.has(n)).length;
  const totalWeight = entries.reduce((sum, [, ns]) => sum + weightOf(ns), 0);
  const totalNations = totalWeight > 0 ? totalWeight : entries.reduce((sum, [, ns]) => sum + ns.length, 0);

  // Floor of one place each; if the confederations alone outnumber the places,
  // the largest ones take them (a world too fragmented to seat everyone).
  if (entries.length >= slots) {
    const ranked = [...entries].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
    ranked.slice(0, slots).forEach(([conf]) => out.set(conf, 1));
    return out;
  }

  // Proportional share of the places left after every confederation's floor.
  const spare = slots - entries.length;
  const exact = entries.map(([conf, ns]) => ({
    conf,
    cap: ns.length,
    quota: ((totalWeight > 0 ? weightOf(ns) : ns.length) / totalNations) * spare,
  }));
  for (const e of exact) out.set(e.conf, 1 + Math.floor(e.quota));

  // Hand out the rounding remainder, largest first, respecting each cap.
  let remaining = slots - [...out.values()].reduce((a, b) => a + b, 0);
  const byRemainder = [...exact].sort(
    (a, b) => (b.quota - Math.floor(b.quota)) - (a.quota - Math.floor(a.quota)) || a.conf.localeCompare(b.conf),
  );
  while (remaining > 0) {
    const before = remaining;
    for (const e of byRemainder) {
      if (remaining === 0) break;
      const current = out.get(e.conf)!;
      if (current >= e.cap) continue;
      out.set(e.conf, current + 1);
      remaining--;
    }
    if (remaining === before) break; // every confederation is at its cap
  }

  return out;
}

/**
 * Each confederation's cup: what it's called and how big a field it
 * would like. The actual field is the smaller of this target and how many
 * eligible nations the confederation has (see formatFor), so a target is a
 * ceiling rather than a promise.
 *
 * Every confederation has one, but a default world only plays three of them —
 * see CONFEDERATION_CUP_MIN_NATIONS for why, and why the other three are defined
 * anyway rather than left out.
 */
export interface ConfederationCupSpec {
  confederation: Confederation;
  name: string;
  /** Largest field this cup will take, if the nations are there. */
  targetField: number;
}

export const CONFEDERATION_CUPS: ConfederationCupSpec[] = [
  { confederation: "Europe", name: "European Championship", targetField: 16 },
  { confederation: "South America", name: "Copa América", targetField: 10 },
  { confederation: "Africa", name: "Africa Cup of Nations", targetField: 16 },
  { confederation: "Asia", name: "Asian Cup", targetField: 16 },
  { confederation: "North America", name: "Gold Cup", targetField: 12 },
  { confederation: "Oceania", name: "OFC Nations Cup", targetField: 8 },
];

/** The cup spec for a confederation, or null if it somehow has none. */
export function confederationCupSpec(confederation: string): ConfederationCupSpec | null {
  return CONFEDERATION_CUPS.find((t) => t.confederation === confederation) ?? null;
}

/**
 * A confederation's index in CONFEDERATIONS. Used to give each cup its
 * own rng stream — several are played in the same offseason, so sharing one
 * stream would make each tournament's results depend on the order the others
 * were played in.
 */
export function confederationIndex(confederation: string): number {
  return CONFEDERATIONS.indexOf(confederation as Confederation);
}
