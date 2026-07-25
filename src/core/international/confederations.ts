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
  Austria: "Europe",
  Belgium: "Europe",
  Croatia: "Europe",
  "Czech Republic": "Europe",
  Denmark: "Europe",
  England: "Europe",
  Finland: "Europe",
  France: "Europe",
  Germany: "Europe",
  Greece: "Europe",
  Iceland: "Europe",
  Israel: "Europe", // plays in UEFA competition, as in real football
  Italy: "Europe",
  Kosovo: "Europe",
  Netherlands: "Europe",
  Norway: "Europe",
  Poland: "Europe",
  Portugal: "Europe",
  "Republic of Ireland": "Europe",
  Romania: "Europe",
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
  "Burkina Faso": "Africa",
  Cameroon: "Africa",
  "Cape Verde": "Africa",
  "DR Congo": "Africa",
  Egypt: "Africa",
  Gabon: "Africa",
  Ghana: "Africa",
  Guinea: "Africa",
  "Guinea-Bissau": "Africa",
  "Ivory Coast": "Africa",
  Kenya: "Africa",
  Mali: "Africa",
  Morocco: "Africa",
  Nigeria: "Africa",
  Senegal: "Africa",
  "South Africa": "Africa",
  Tanzania: "Africa",
  Tunisia: "Africa",
  Zambia: "Africa",

  // Asia (Australia plays in the Asian confederation, as in real football)
  Australia: "Asia",
  China: "Asia",
  India: "Asia",
  Iran: "Asia",
  Japan: "Asia",
  "South Korea": "Asia",

  // North America
  Canada: "North America",
  "Costa Rica": "North America",
  Honduras: "North America",
  Jamaica: "North America",
  Mexico: "North America",
  Panama: "North America",
  "United States": "North America",

  // Oceania
  "New Zealand": "Oceania",
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
