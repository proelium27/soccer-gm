import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * `ROSTER_DOWNLOAD_URL` is computed once at module load from a build-time
 * environment value, so every case here has to reset the module registry and
 * re-import rather than calling a function.
 *
 * What's worth pinning is the failure direction. The Import screen renders the
 * download link only when this is non-null, so "unset" and "malformed" must
 * both come out null: a build that forgets the variable should be missing a
 * button, never showing one that 404s. The protocol check matters for a
 * different reason — the value is inlined from a committed mode file straight
 * into an `href`, so a `javascript:` URL there would be script injection with a
 * download button on it.
 */
async function load(value?: string): Promise<string | null> {
  vi.resetModules();
  if (value === undefined) vi.stubEnv("VITE_ROSTER_DOWNLOAD_URL", "");
  else vi.stubEnv("VITE_ROSTER_DOWNLOAD_URL", value);
  const mod = await import("../../src/ui/rosterDownload.js");
  return mod.ROSTER_DOWNLOAD_URL;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("ROSTER_DOWNLOAD_URL", () => {
  it("is null when the build was given no URL", async () => {
    expect(await load()).toBeNull();
  });

  it("is null for a blank or whitespace-only value", async () => {
    expect(await load("   ")).toBeNull();
  });

  it("accepts an https URL", async () => {
    expect(await load("https://example.com/real-players-teams.json")).toBe(
      "https://example.com/real-players-teams.json",
    );
  });

  it("accepts plain http", async () => {
    expect(await load("http://example.com/roster.json")).toBe("http://example.com/roster.json");
  });

  it("trims surrounding whitespace", async () => {
    expect(await load("  https://example.com/roster.json  ")).toBe(
      "https://example.com/roster.json",
    );
  });

  it("rejects a javascript: URL rather than putting it in an href", async () => {
    expect(await load("javascript:alert(1)")).toBeNull();
  });

  it("rejects a data: URL", async () => {
    expect(await load("data:application/json,{}")).toBeNull();
  });

  it("rejects a value that isn't a URL at all", async () => {
    expect(await load("real-players-teams.json")).toBeNull();
  });
});
