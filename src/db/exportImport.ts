import type { LeagueStore } from "../core/leagueState.js";
import { isRosterFileFormat } from "../core/teams/rosterFile.js";
import { migrateLeague } from "./migrate.js";

/**
 * The first two bytes of every gzip stream. Import sniffs for these rather than
 * trusting the file extension, so a save stays readable however it was renamed
 * on its way between two people.
 */
const GZIP_MAGIC = [0x1f, 0x8b];

/**
 * Serialize a league to the bytes the export button writes: compact JSON, gzipped.
 *
 * Both halves are pure size. The pretty-printed form this replaced was ~half
 * indentation whitespace and nothing ever read the file as formatted text, and
 * a league save is thousands of records repeating the same key names, which is
 * the shape gzip is best at. Measured on an 8-season save: 84 MB → 5.2 MB.
 *
 * Lossless, so this is not the "prune history to shrink the save" trade in open
 * design decision 6 — every byte survives the round trip.
 */
export async function encodeLeagueFile(
  league: LeagueStore,
): Promise<Uint8Array<ArrayBuffer>> {
  const json = JSON.stringify(league);
  const gzipped = new Blob([json])
    .stream()
    .pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(gzipped).arrayBuffer());
}

/**
 * Read any file the game accepts as text, decompressing it if it's gzipped.
 *
 * Every reader of a picked file goes through here, so gzipped and plain files
 * are indistinguishable from that point on and back-compatibility costs the
 * callers nothing: saves exported before this shipped are plain JSON and still
 * load, and so do hand-written roster files, which are never compressed.
 */
export async function readLeagueFileText(file: Blob): Promise<string> {
  const buf = await file.arrayBuffer();
  const head = new Uint8Array(buf);
  if (head[0] !== GZIP_MAGIC[0] || head[1] !== GZIP_MAGIC[1]) {
    return new TextDecoder().decode(buf);
  }
  const plain = new Blob([buf])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  return await new Response(plain).text();
}

/**
 * Serialize a league and trigger a browser file download.
 */
export async function exportLeagueJSON(league: LeagueStore): Promise<void> {
  const bytes = await encodeLeagueFile(league);
  const blob = new Blob([bytes], { type: "application/gzip" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `soccer-gm-league-${league.lid}.json.gz`;
  a.style.display = "none";

  document.body.appendChild(a);
  a.click();

  // Clean up
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Read a File, parse it as JSON, validate the shape, and return a LeagueStore.
 * Throws a descriptive error if validation fails.
 */
export async function importLeagueJSON(file: File): Promise<LeagueStore> {
  const text = await readLeagueFileText(file);

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(
      `Failed to parse JSON from file "${file.name}": invalid JSON`,
    );
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error(
      `Invalid league file "${file.name}": expected a JSON object`,
    );
  }

  const obj = parsed as Record<string, unknown>;

  // The game reads two kinds of JSON and their files are easy to mix up: this
  // one takes a whole saved game (from Export Save), while a roster file (from
  // the AI prompt, or hand-written) starts a new league. Name that mistake
  // rather than reporting a missing "players" array.
  //
  // Reachable only from the New League screen's "Import League": the Leagues
  // page's Import button sniffs the same field first and routes a roster file
  // to the club picker, so it never gets here. isRosterFileFormat rather than a
  // bare equality check, so a file written before the format was renamed is
  // still recognized and still gets the helpful message.
  if (isRosterFileFormat(obj.format)) {
    throw new Error(
      `"${file.name}" is a roster file, not a saved game. To use it, go to the Leagues page and press "Import" — it starts a new league from the clubs in the file.`,
    );
  }

  // Validate required top-level fields
  const requiredArrays = ["teams", "players", "schedule", "played"] as const;
  for (const key of requiredArrays) {
    if (!Array.isArray(obj[key])) {
      throw new Error(
        `Invalid league file "${file.name}": missing or invalid "${key}" array`,
      );
    }
  }

  if (typeof obj.season !== "number") {
    throw new Error(
      `Invalid league file "${file.name}": missing or invalid "season" (expected number)`,
    );
  }

  if (obj.phase !== "regular" && obj.phase !== "offseason") {
    throw new Error(
      `Invalid league file "${file.name}": missing or invalid "phase" (expected "regular" or "offseason")`,
    );
  }

  if (typeof obj.meta !== "object" || obj.meta === null) {
    throw new Error(
      `Invalid league file "${file.name}": missing or invalid "meta" object`,
    );
  }

  const meta = obj.meta as Record<string, unknown>;
  if (typeof meta.name !== "string") {
    throw new Error(
      `Invalid league file "${file.name}": missing or invalid "meta.name" (expected string)`,
    );
  }
  if (typeof meta.created !== "number") {
    throw new Error(
      `Invalid league file "${file.name}": missing or invalid "meta.created" (expected number)`,
    );
  }
  if (typeof meta.userTid !== "number") {
    throw new Error(
      `Invalid league file "${file.name}": missing or invalid "meta.userTid" (expected number)`,
    );
  }

  return migrateLeague(parsed as LeagueStore);
}
