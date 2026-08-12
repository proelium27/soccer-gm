/**
 * Club abbreviations and colors for imported clubs.
 *
 * The player datasets carry club *names* and nothing else — no crest, no kit
 * colors — but the roster file format requires an abbrev and a two-color pair
 * per club. Both are therefore synthesized deterministically from the name, so
 * re-running the converter on the same CSV always produces the same file, and
 * both are overridable via --identities for anyone who wants real kit colors on
 * the clubs they care about.
 */

/** FNV-1a over the club name — stable across runs and machines. */
function hashName(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Club-type tokens that carry no identity ("FC Barcelona" and "Barcelona" are
 * the same club, and "FCB" is a worse abbrev than "BAR"). Dropped when
 * something identifying survives.
 */
const NOISE_TOKENS = new Set([
  "fc", "cf", "afc", "sc", "ac", "as", "ss", "ssc", "us", "usc", "rc", "rcd", "cd", "ud", "ca",
  "sd", "bsc", "vfb", "vfl", "tsg", "tsv", "sv", "fsv", "sg", "spvgg", "borussia", "club",
  "de", "do", "da", "of", "the", "real", "athletic", "atletico", "sporting", "sport", "clube",
  "calcio", "futebol", "football", "deportivo", "united", "city", "town", "county", "rovers",
  "wanderers", "albion", "hotspur", "1", "04", "05", "07", "09", "96", "98",
]);

const WORD_RE = /[a-z0-9À-ɏ]+/gi;

/** Strip diacritics so "Köln" abbreviates to KOL, not K?L. */
function deaccent(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * A 3-letter abbreviation derived from the club name: initials when several
 * identifying words survive, otherwise the first three letters of the leading
 * one. Falls back to the raw name's letters when every token is noise (e.g. a
 * club literally named "Real Sporting").
 */
export function deriveAbbrev(name: string): string {
  const words = (deaccent(name).match(WORD_RE) ?? []).map((w) => w.toLowerCase());
  if (words.length === 0) return "CLB";
  const meaty = words.filter((w) => !NOISE_TOKENS.has(w));
  const use = meaty.length > 0 ? meaty : words;

  const letters =
    use.length >= 3
      ? use.slice(0, 3).map((w) => w[0]).join("")
      : use.length === 2
        ? use[0].slice(0, 2) + use[1][0]
        : use[0].slice(0, 3);

  return letters.toUpperCase().padEnd(3, "X").slice(0, 3);
}

const SUFFIX_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/**
 * Make every abbrev in a competition unique, preserving the first claim on a
 * name and resolving later collisions. The roster file does not require
 * uniqueness, but duplicate three-letter codes in one table are unreadable
 * in-game — and collisions are common, since a whole league of "<Town> United"
 * abbreviates identically once the noise words are dropped.
 *
 * Resolution order: the club's own later letters first (so the code still
 * looks like the name), then an exhaustive two-character sweep keyed off the
 * leading letter. The sweep is bounded and exhaustive — 36x36 candidates
 * against at most a few dozen clubs — so this always terminates.
 */
export function uniquifyAbbrevs(names: string[]): string[] {
  const taken = new Set<string>();
  const out: string[] = [];

  for (const name of names) {
    const abbrev = uniqueAbbrev(name, deriveAbbrev(name), taken);
    taken.add(abbrev);
    out.push(abbrev);
  }
  return out;
}

/**
 * Return `preferred` if it is free, otherwise a substitute that isn't in
 * `taken`. Does not mutate `taken` — the caller claims the result.
 *
 * Split out of uniquifyAbbrevs so the merge step can reuse the same resolution
 * on abbrevs it did not derive: a filled slot takes its code verbatim from a
 * hand-written names file, which has no uniqueness pass of its own, and that is
 * how "UD Leiria" and "Leixões SC" both ended up as LEI in one table.
 */
export function uniqueAbbrev(name: string, preferred: string, taken: ReadonlySet<string>): string {
  if (!taken.has(preferred)) return preferred;

  // Prefer a code still drawn from the club's own letters.
  let abbrev = preferred;
  const letters = (deaccent(name).match(WORD_RE) ?? []).join("").toUpperCase();
  for (let i = 2; i < letters.length && taken.has(abbrev); i++) {
    abbrev = (preferred.slice(0, 2) + letters[i]).slice(0, 3);
  }
  if (!taken.has(abbrev)) return abbrev;

  // Otherwise sweep a bounded space. Keying off preferred[0] keeps the first
  // letter recognisable; the sweep covers 1296 codes, far more than the
  // 20 clubs a competition holds, so it cannot run out or spin.
  const head = preferred[0] ?? "C";
  for (const c1 of SUFFIX_ALPHABET) {
    for (const c2 of SUFFIX_ALPHABET) {
      const cand = head + c1 + c2;
      if (!taken.has(cand)) return cand;
    }
  }
  return abbrev;
}

/**
 * Kit-ish color pairs (primary, secondary). Deliberately high-contrast and
 * drawn in the same register as the game's own fictional clubs so imported
 * tables do not look out of place beside un-imported ones.
 */
const PALETTE: [string, string][] = [
  ["#c0392b", "#ffffff"], ["#1b4f72", "#f4d03f"], ["#0b5394", "#ffffff"],
  ["#e74c3c", "#1a1a1a"], ["#27ae60", "#ffffff"], ["#8e44ad", "#f1c40f"],
  ["#2c3e50", "#e67e22"], ["#f39c12", "#2c3e50"], ["#16a085", "#ffffff"],
  ["#7f1d1d", "#fcd34d"], ["#1a1a1a", "#ffffff"], ["#2980b9", "#ffffff"],
  ["#a93226", "#2874a6"], ["#117864", "#f7dc6f"], ["#5b2c6f", "#ffffff"],
  ["#b7950b", "#1a1a1a"], ["#1f618d", "#e74c3c"], ["#943126", "#ffffff"],
  ["#0e6251", "#ffffff"], ["#4a235a", "#f4d03f"], ["#6e2c00", "#f8c471"],
  ["#154360", "#aed6f1"], ["#7d6608", "#ffffff"], ["#641e16", "#d5d8dc"],
];

/** Deterministic color pair for a club name. */
export function deriveColors(name: string): [string, string] {
  return PALETTE[hashName(name) % PALETTE.length];
}

export interface IdentityOverride {
  abbrev?: string;
  colors?: [string, string];
  /** Rename the club outright (e.g. to sidestep a dataset's odd spelling). */
  name?: string;
}

/** club name (as it appears in the CSV) -> override. */
export type IdentityOverrides = Record<string, IdentityOverride>;
