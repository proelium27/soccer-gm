import { describe, it, expect } from "vitest";
import { makeTeam } from "../src/engine/composites.js";

describe("makeTeam", () => {
  it("defaults every composite to league-average 0.5", () => {
    const t = makeTeam("Average");
    expect(t).toEqual({
      name: "Average",
      attack: 0.5,
      finishing: 0.5,
      defense: 0.5,
      keeping: 0.5,
      control: 0.5,
    });
  });

  it("applies overrides and keeps defaults for the rest", () => {
    const t = makeTeam("Strong", { attack: 0.63, keeping: 0.6 });
    expect(t.attack).toBe(0.63);
    expect(t.keeping).toBe(0.6);
    expect(t.defense).toBe(0.5);
  });
});
