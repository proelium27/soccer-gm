import type { LeagueStore } from "../core/leagueState.js";

/**
 * Serialize a league to JSON and trigger a browser file download.
 */
export function exportLeagueJSON(league: LeagueStore): void {
  const json = JSON.stringify(league, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `soccer-gm-league-${league.lid}.json`;
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
  const text = await file.text();

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

  return parsed as LeagueStore;
}
