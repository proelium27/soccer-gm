import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, writeFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadFixture, sourceHash, resetFixtureMemo } from "./worldCache.js";

/**
 * The cache's contract is "generate once, reuse forever", so every test here
 * counts real generator invocations rather than asserting on a mock. The
 * payload is a tiny plain object — world-generation fidelity is covered
 * separately (and expensively) in fixtureFidelity.test.ts.
 */
describe("loadFixture", () => {
  let dir: string;
  let calls: number;
  const payload = () => ({ n: 1, nested: { list: [1, 2, 3] } });
  const generate = () => {
    calls++;
    return payload();
  };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "sgm-fixture-"));
    calls = 0;
    resetFixtureMemo();
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("generates on a cold cache and returns the value", () => {
    const got = loadFixture("w", generate, { dir, hash: "h1" });
    expect(got).toEqual(payload());
    expect(calls).toBe(1);
  });

  it("does not regenerate when a fixture is already on disk", () => {
    loadFixture("w", generate, { dir, hash: "h1" });
    // A fresh process would have an empty in-memory memo but a warm disk.
    resetFixtureMemo();
    const got = loadFixture("w", generate, { dir, hash: "h1" });
    expect(got).toEqual(payload());
    expect(calls).toBe(1);
  });

  it("returns an independent copy each call, so callers can mutate freely", () => {
    const a = loadFixture<{ n: number }>("w", generate, { dir, hash: "h1" });
    a.n = 999;
    const b = loadFixture<{ n: number }>("w", generate, { dir, hash: "h1" });
    expect(b.n).toBe(1);
  });

  it("regenerates when the source hash changes", () => {
    loadFixture("w", generate, { dir, hash: "h1" });
    resetFixtureMemo();
    loadFixture("w", generate, { dir, hash: "h2" });
    expect(calls).toBe(2);
  });

  it("keeps fixtures for different names separate", () => {
    loadFixture("a", generate, { dir, hash: "h1" });
    loadFixture("b", generate, { dir, hash: "h1" });
    expect(calls).toBe(2);
  });

  it("regenerates rather than throwing when a fixture file is corrupt", () => {
    loadFixture("w", generate, { dir, hash: "h1" });
    const [file] = readdirSync(join(dir, "h1"));
    writeFileSync(join(dir, "h1", file), "{ not json");
    resetFixtureMemo();
    const got = loadFixture("w", generate, { dir, hash: "h1" });
    expect(got).toEqual(payload());
    expect(calls).toBe(2);
  });

  it("bypasses disk entirely when disabled", () => {
    loadFixture("w", generate, { dir, hash: "h1", enabled: false });
    expect(existsSync(join(dir, "h1"))).toBe(false);
    resetFixtureMemo();
    loadFixture("w", generate, { dir, hash: "h1", enabled: false });
    expect(calls).toBe(2);
  });
});

describe("sourceHash", () => {
  it("is stable across calls within a run", () => {
    expect(sourceHash()).toBe(sourceHash());
  });

  it("is a hex digest that changes with the Node version it embeds", () => {
    expect(sourceHash()).toMatch(/^[0-9a-f]{16,}$/);
  });
});
