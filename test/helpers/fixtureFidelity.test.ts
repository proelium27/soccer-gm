import { describe, it, expect } from "vitest";
import { createLeagueState, type LeagueStore } from "../../src/core/leagueState.js";
import { mulberry32 } from "../../src/engine/rng.js";
import { makeLeague, fixtureNameFor } from "./league.js";
import { resetFixtureMemo, sourceHash } from "./worldCache.js";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));

/**
 * The cache is a trust boundary: every other test in the suite now reads its
 * world through it, so if a cached world ever differed from a freshly
 * generated one, the whole suite would silently validate against the wrong
 * data. These tests are what make that impossible to do quietly.
 */
/**
 * `meta.created` is `Date.now()` at generation, the one field that legitimately
 * differs between two same-seed worlds. Everything the sim reads is compared.
 */
function withoutTimestamp(league: LeagueStore): unknown {
  return { ...league, meta: { ...league.meta, created: 0 } };
}

describe("world fixture fidelity", () => {
  it("generates deterministically apart from the created timestamp", () => {
    // The precondition the entire disk cache rests on. If this ever fails,
    // caching worlds is unsound and `makeLeague` must go back to generating.
    const a = createLeagueState(0, mulberry32(1), 0);
    const b = createLeagueState(0, mulberry32(1), 0);
    expect(JSON.stringify(withoutTimestamp(a))).toBe(JSON.stringify(withoutTimestamp(b)));
  }, 600000);

  it("hands back a world identical to a freshly generated one", () => {
    const fresh = createLeagueState(0, mulberry32(1), 0);
    // Force a disk round-trip rather than an in-process memo hit.
    resetFixtureMemo();
    const cached = makeLeague(0, 1);
    expect(withoutTimestamp(cached)).toEqual(withoutTimestamp(fresh));
    // toEqual ignores keys whose value is undefined; JSON equality catches a
    // field the round-trip dropped entirely.
    expect(JSON.stringify(withoutTimestamp(cached))).toBe(JSON.stringify(withoutTimestamp(fresh)));
  }, 600000);

  it("gives each caller an independently mutable world", () => {
    const a = makeLeague(0, 1);
    const originalName = a.teams[0].name;
    a.teams[0].name = "Mutated FC";
    a.players[0].ovr = 1;
    const b = makeLeague(0, 1);
    expect(b.teams[0].name).toBe(originalName);
    expect(b.players[0].ovr).not.toBe(1);
  }, 600000);

  it("persists the world under the current source hash", () => {
    makeLeague(0, 1);
    const file = join(
      REPO_ROOT, "node_modules", ".cache", "soccer-gm-worlds",
      sourceHash(), `${fixtureNameFor(0, 1, 0)}.json`,
    );
    expect(existsSync(file)).toBe(true);
  }, 600000);
});
