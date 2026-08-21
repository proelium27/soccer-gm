import type { ClubIdentity } from "./clubs.js";
import { mulberry32, hashInts } from "../../engine/rng.js";

/**
 * Club identities for a league the player added, which by definition has no
 * entry in the hand-written CLUBS table (that table is indexed by tid and stops
 * at the shipped world's last club).
 *
 * Everything here is invented — the same rule the shipped table follows, for the
 * same reason: the game ships no real club names or crests. The stems below are
 * deliberately plausible-but-fictional place names rather than real towns, since
 * an added league can be given any country name at all and a real-place pool
 * would only ever be right for the one country it was written for.
 *
 * **Deterministic from (country, count) alone**, on its own seeded stream, never
 * the shared rng. Two consequences, both load-bearing:
 *   - The new-league screen can preview an added league's clubs before any world
 *     exists, and the save it then generates carries exactly those names. No
 *     plumbing between the two, because both call this with the same arguments.
 *   - Generating identities cannot perturb player generation. RNG stream order is
 *     load-bearing across this codebase (see CLAUDE.md), and identity assignment
 *     runs after generation, so it must not touch that stream.
 */

/** Invented place-name stems. Drawn without replacement, so no league repeats one. */
const STEMS = [
  "Alderworth", "Amberfell", "Ashcombe", "Bellhaven", "Bracken Hollow",
  "Briarholt", "Calderwick", "Carrowmore", "Cindermoor", "Darnley",
  "Duskmere", "Eastmarch", "Elmsworth", "Fallowfield", "Fenwick",
  "Foxglove", "Garrowby", "Glennock", "Graystone", "Harrowgate",
  "Hollowbrook", "Ironvale", "Kestrelby", "Kirkmoor", "Lansmere",
  "Larchfield", "Lindenrow", "Marchwood", "Millbank", "Norwood Cross",
  "Oakenshaw", "Orrinvale", "Pelham Green", "Quarrydown", "Ravensmoor",
  "Redwater", "Rushmere", "Saltmarsh", "Silverbeck", "Stonebridge",
  "Thornbury", "Tillingham", "Uplandhurst", "Vellacourt", "Wardenfell",
  "Westerly", "Whitmoor", "Willowbank", "Wrenfield", "Yarrowdale",
  "Beckhurst", "Cravenmoor", "Dunmarch", "Ellersby", "Farrowgate",
  "Highmarsh", "Kelbridge", "Lowenford", "Merrowdean", "Netherby",
] as const;

/** Varied club suffixes. An empty entry leaves the town name standing alone. */
const SUFFIXES = [
  "United", "Town", "Rovers", "Athletic", "Wanderers", "City", "Albion",
  "Sentinels", "Harriers", "Foresters", "Mariners", "Colliers", "Falcons",
  "Stags", "Ironsides", "Drovers", "", "", "",
] as const;

/** Two-tone kits, from the shipped table's palette family. */
const PALETTE: [string, string][] = [
  ["#c0392b", "#ffffff"], ["#1b4f72", "#f4d03f"], ["#145a32", "#ecf0f1"],
  ["#8e44ad", "#f1c40f"], ["#2980b9", "#ffffff"], ["#e67e22", "#2c3e50"],
  ["#16a085", "#ecf0f1"], ["#7f8c8d", "#e67e22"], ["#d35400", "#1a1a1a"],
  ["#2c3e50", "#f39c12"], ["#27ae60", "#ffffff"], ["#922b21", "#f7dc6f"],
];

/** Stable 32-bit hash of a string, so a country name can seed a stream. */
function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Fisher-Yates over a copy, on the caller's stream. */
function shuffled<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * A three-letter abbreviation for a club name, unique within `taken`. Letters
 * only (a name can carry a space), upper-cased, walked forward through the
 * name's own letters on collision so the result still reads as coming from the
 * club rather than from a counter.
 */
export function abbrevFor(name: string, taken: Set<string>): string {
  const letters = name.toUpperCase().replace(/[^A-Z]/g, "");
  for (let start = 0; start + 3 <= letters.length; start++) {
    const candidate = letters.slice(start, start + 3);
    if (!taken.has(candidate)) return candidate;
  }
  const stem = letters.slice(0, 2).padEnd(2, "X");
  for (let n = 0; n < 10; n++) {
    const candidate = stem + String(n);
    if (!taken.has(candidate)) return candidate;
  }
  return stem.padEnd(3, "X");
}

/**
 * `count` club identities for an added league, stable for a given country name.
 * The stem pool is sized well above a two-division country's needs; past it the
 * draw wraps, and the suffix keeps the repeated stem from producing a duplicate
 * name outright.
 */
export function generateClubIdentities(country: string, count: number): ClubIdentity[] {
  const rng = mulberry32(hashInts(hashString(country), 0x0c1b, count));
  const stems = shuffled(STEMS, rng);
  const taken = new Set<string>();
  const out: ClubIdentity[] = [];
  for (let i = 0; i < count; i++) {
    const stem = stems[i % stems.length];
    const suffix = SUFFIXES[Math.floor(rng() * SUFFIXES.length)];
    const name = [stem, suffix].filter(Boolean).join(" ");
    const abbrev = abbrevFor(name, taken);
    taken.add(abbrev);
    out.push({ name, abbrev, colors: PALETTE[Math.floor(rng() * PALETTE.length)] });
  }
  return out;
}
