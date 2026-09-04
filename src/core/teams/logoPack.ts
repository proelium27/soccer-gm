/**
 * A logo pack: club crest art someone brings to their own save.
 *
 * The game ships 80 hand-drawn crests covering England's and Spain's top two
 * divisions and nothing else, so most of a 626-club world wears the two-colour
 * swatch — and a roster import makes that worse rather than better, because
 * `ClubCrest` keys its built-in art by *slot*, so a slot holding a real club is
 * deliberately drawn with no badge at all (the art belongs to the fictional club
 * it displaced). This is how the badges get filled in.
 *
 * Shaped as a sibling of the roster file (src/core/teams/rosterFile.ts) and
 * loaded beside it, but the two match on **different things, deliberately**:
 *
 *  - a roster file maps clubs POSITIONALLY onto a competition's slots, because
 *    the clubs it carries have no identity in the save yet — they *are* the
 *    identity being installed.
 *  - a logo pack matches by club NAME, because by the time it is applied the
 *    names exist (the roster file just wrote them) and a name is the only thing
 *    the person assembling a folder of PNGs actually knows. Matching a logo
 *    positionally would mean silently mis-badging every club the moment a roster
 *    file listed its clubs in a different order.
 *
 * That is also why a pack is applied AFTER the roster file rather than folded
 * into it: `liverpool.png` finds Liverpool only once something has called a club
 * Liverpool.
 *
 * Nothing here touches the sim, or `LeagueStore`, or an rng stream. Crest art is
 * stored in its own IndexedDB store keyed `[lid, tid]` (see src/db/crestDb.ts)
 * for the reason `players`/`careers`/`retirees` are: the league record is
 * rewritten in full on every mutation and cloned to the worker on every sim, and
 * a few megabytes of images riding along on both would undo the storage work
 * this repo has done three times over.
 */

/** What newly written logo packs declare. */
export const LOGO_PACK_FORMAT = "world-soccer-sim-logos";

export const LOGO_PACK_VERSION = 1;

/**
 * The largest data URL a single entry may carry, in characters.
 *
 * A pack written by this game holds `CREST_IMAGE_SIZE`-square WebP, which comes
 * out around 5 KB — but a hand-assembled pack can carry anything, and a folder
 * of 626 full-resolution PNGs at ~110 KB each (the size of the shipped crest
 * art) is 69 MB of images that would be read into memory and written to disk in
 * one go. The importer downscales everything it decodes itself, so this bound
 * only ever catches a pack someone hand-wrote around that step.
 */
export const MAX_LOGO_DATA_URL = 512 * 1024;

/** Entries beyond this are refused rather than read. A world is 626 clubs. */
export const MAX_LOGO_ENTRIES = 4000;

export interface LogoPackEntry {
  /**
   * The club this badge belongs to, by name — matched case-, accent- and
   * punctuation-insensitively, and against the club's abbreviation as a
   * fallback. Every club the world calls this gets the badge, so a name shared
   * by two divisions badges both rather than picking one arbitrarily.
   */
  match: string;
  /** The badge itself, as a `data:image/...` URL. */
  image: string;
}

export interface LogoPack {
  format: typeof LOGO_PACK_FORMAT;
  formatVersion: typeof LOGO_PACK_VERSION;
  logos: LogoPackEntry[];
}

/** Is this a logo pack's format string? Shared by the parser and the file sniffers. */
export function isLogoPackFormat(value: unknown): value is typeof LOGO_PACK_FORMAT {
  return value === LOGO_PACK_FORMAT;
}

/**
 * Fold a club name down to what two spellings of it have in common.
 *
 * Accents ARE folded here, which is the opposite of the call `normalizeLeague`
 * makes in the EA FC converter — and the two are not in tension, because they
 * are guarding against different things. There, folding let "Série A" match
 * Italy's Serie A and quietly imported 14 Brazilian clubs into it: the strings
 * belong to *different* competitions and the accent is the only thing keeping
 * them apart. Here both strings are attempts at the *same* club, and someone
 * naming a file `bayern-munchen.png` for a club the save calls "Bayern München"
 * is the ordinary case rather than a collision.
 */
export function normalizeClubName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** A club as the matcher sees it: enough to name it, nothing more. */
export interface LogoTargetClub {
  tid: number;
  name: string;
  abbrev: string;
}

export interface LogoResolution {
  /** tid -> data URL, for every club a pack entry named. */
  byTid: Map<number, string>;
  /** Entries that matched no club, by their `match` string. */
  unmatched: string[];
}

/**
 * Resolve a pack's entries onto the clubs of a world.
 *
 * Name first, abbreviation second, and the two passes are separate rather than
 * one lookup over a merged table: an abbreviation is three letters and collides
 * far more readily than a name does ("BAR" is plausibly several clubs), so a
 * name match must never lose a tid to one. A tid already claimed by a name is
 * therefore left alone when the abbreviation pass runs.
 *
 * Later entries win a tid over earlier ones, matching `combineRosterFiles`'
 * rule for two files claiming one competition: the most recent pick is the one
 * the user is most likely to have meant.
 */
export function resolveLogoPack(
  clubs: readonly LogoTargetClub[],
  pack: LogoPack,
): LogoResolution {
  const byName = new Map<string, number[]>();
  const byAbbrev = new Map<string, number[]>();
  for (const club of clubs) {
    const name = normalizeClubName(club.name);
    if (name) {
      const list = byName.get(name);
      if (list) list.push(club.tid);
      else byName.set(name, [club.tid]);
    }
    const abbrev = normalizeClubName(club.abbrev);
    if (abbrev) {
      const list = byAbbrev.get(abbrev);
      if (list) list.push(club.tid);
      else byAbbrev.set(abbrev, [club.tid]);
    }
  }

  const byTid = new Map<number, string>();
  const namedTids = new Set<number>();
  const unmatched: string[] = [];

  for (const entry of pack.logos) {
    const key = normalizeClubName(entry.match);
    const named = byName.get(key);
    if (named) {
      for (const tid of named) {
        byTid.set(tid, entry.image);
        namedTids.add(tid);
      }
      continue;
    }
    // Only clubs no name has spoken for. Without this an abbreviation collision
    // could overwrite a badge a full name had already placed correctly.
    const abbreviated = (byAbbrev.get(key) ?? []).filter((tid) => !namedTids.has(tid));
    if (abbreviated.length > 0) {
      for (const tid of abbreviated) byTid.set(tid, entry.image);
      continue;
    }
    unmatched.push(entry.match);
  }

  return { byTid, unmatched };
}

/** A parsed logo pack with the name the user picked it by. */
export interface NamedLogoPack {
  name: string;
  pack: LogoPack;
}

export interface CombinedLogoPack {
  pack: LogoPack;
  /** Non-fatal issues (the same club named twice) worth showing the user. */
  warnings: string[];
}

/**
 * Fold several packs into the one the importer applies.
 *
 * Concatenation in load order, deduplicated by club: a world is assembled a
 * league at a time and each pack covers its own clubs, so they compose. Two
 * packs naming the same club is the one ambiguous case and the later wins,
 * exactly as `combineRosterFiles` resolves two files claiming one competition —
 * with the collision reported rather than silently taken, because a duplicate is
 * usually a mistake and always worth knowing about.
 */
export function combineLogoPacks(packs: NamedLogoPack[]): CombinedLogoPack {
  const byMatch = new Map<string, { entry: LogoPackEntry; from: string }>();
  const order: string[] = [];
  const warnings: string[] = [];

  for (const { name, pack } of packs) {
    for (const entry of pack.logos) {
      const key = normalizeClubName(entry.match);
      const existing = byMatch.get(key);
      if (existing) {
        if (existing.from !== name) {
          warnings.push(
            `"${entry.match}" is in both ${existing.from} and ${name}, so the one from ${name} was used.`,
          );
        }
      } else {
        order.push(key);
      }
      byMatch.set(key, { entry, from: name });
    }
  }

  return {
    pack: {
      format: LOGO_PACK_FORMAT,
      formatVersion: LOGO_PACK_VERSION,
      logos: order.map((key) => byMatch.get(key)!.entry),
    },
    warnings,
  };
}

/** Build a pack from resolved art, so a save's badges can be handed to someone else. */
export function buildLogoPack(
  clubs: readonly LogoTargetClub[],
  byTid: ReadonlyMap<number, string>,
): LogoPack {
  const nameByTid = new Map(clubs.map((c) => [c.tid, c.name]));
  const logos: LogoPackEntry[] = [];
  for (const [tid, image] of byTid) {
    const name = nameByTid.get(tid);
    if (name) logos.push({ match: name, image });
  }
  return { format: LOGO_PACK_FORMAT, formatVersion: LOGO_PACK_VERSION, logos };
}

/**
 * Parse and structurally validate raw file text as a LogoPack.
 *
 * Strict on shape and lenient on nothing, unlike the roster file's nationality
 * block: every field here is either a club name or an image, and a pack is
 * normally generated rather than hand-written, so a malformed entry is a bug in
 * whatever wrote it and worth reporting rather than skipping. Errors name the
 * offending path so the picker can say exactly what is wrong.
 */
export function parseLogoPack(text: string): LogoPack {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Invalid logo pack: not valid JSON.");
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Invalid logo pack: expected a JSON object.");
  }
  const obj = parsed as Record<string, unknown>;
  if (!isLogoPackFormat(obj.format)) {
    throw new Error(
      `Invalid logo pack: "format" must be "${LOGO_PACK_FORMAT}" (got ${JSON.stringify(obj.format)}).`,
    );
  }
  if (obj.formatVersion !== LOGO_PACK_VERSION) {
    throw new Error(
      `Unsupported logo pack version ${JSON.stringify(obj.formatVersion)}: this game reads version ${LOGO_PACK_VERSION}.`,
    );
  }
  if (!Array.isArray(obj.logos)) {
    throw new Error(`Invalid logo pack: "logos" must be an array.`);
  }
  if (obj.logos.length > MAX_LOGO_ENTRIES) {
    throw new Error(
      `Invalid logo pack: ${obj.logos.length} entries is more than the ${MAX_LOGO_ENTRIES} this game reads.`,
    );
  }

  const logos: LogoPackEntry[] = obj.logos.map((raw, i) => {
    if (typeof raw !== "object" || raw === null) {
      throw new Error(`Invalid logo pack: logos[${i}] must be an object.`);
    }
    const entry = raw as Record<string, unknown>;
    if (typeof entry.match !== "string" || entry.match.trim() === "") {
      throw new Error(`Invalid logo pack: logos[${i}].match must be a non-empty club name.`);
    }
    if (typeof entry.image !== "string") {
      throw new Error(`Invalid logo pack: logos[${i}].image must be a data URL string.`);
    }
    if (!isImageDataUrl(entry.image)) {
      throw new Error(
        `Invalid logo pack: logos[${i}].image must be a "data:image/..." URL. `
        + `A path or a web address won't work — the picture has to be inside the file.`,
      );
    }
    if (entry.image.length > MAX_LOGO_DATA_URL) {
      throw new Error(
        `Invalid logo pack: the image for "${entry.match}" is `
        + `${Math.round(entry.image.length / 1024)} KB, over the ${Math.round(MAX_LOGO_DATA_URL / 1024)} KB limit. `
        + `Shrink it, or load the picture files directly and let the game do it.`,
      );
    }
    return { match: entry.match, image: entry.image };
  });

  return { format: LOGO_PACK_FORMAT, formatVersion: LOGO_PACK_VERSION, logos };
}

/**
 * Is this a data URL holding an image?
 *
 * Checked on the way in rather than trusted, because these strings go straight
 * into an `<img src>`: `data:text/html` and `data:image/svg+xml` are both
 * data URLs, and an SVG in particular is a document that can carry script. The
 * allowed types are exactly the raster formats a canvas can produce, so a pack
 * this game wrote always passes and a hand-made one is held to the same bar.
 */
export function isImageDataUrl(value: string): boolean {
  return /^data:image\/(png|jpeg|webp|gif|avif);base64,[A-Za-z0-9+/]+=*$/.test(value);
}
