import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { generateName } from "../../src/core/players/names.js";

describe("generateName", () => {
  it("produces a non-empty 'First Last' string", () => {
    const name = generateName(mulberry32(1), "Genero");
    expect(name).toMatch(/^\S+ \S+$/);
  });
  it("is deterministic for a given seed", () => {
    expect(generateName(mulberry32(42), "Genero")).toBe(generateName(mulberry32(42), "Genero"));
  });
});
