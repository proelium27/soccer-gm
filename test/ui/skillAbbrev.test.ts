import { describe, expect, it } from "vitest";
import { SKILL_KEYS } from "../../src/core/players/types.js";
import { SKILL_ABBREV, SKILL_LABELS } from "../../src/ui/components/PlayerRatingsTooltip.js";

/**
 * The attribute-table column headers.
 *
 * These used to be derived from SKILL_LABELS by taking each word's initial,
 * which silently produced **three columns headed "S"** (Speed, Strength,
 * Stamina) in a fourteen-column table. Nothing failed; it just could not be
 * read. Now they are spelled out, and the property that matters — every header
 * is distinct — is asserted rather than assumed, since the failure mode is
 * invisible to types and to a rendering test.
 */
describe("skill abbreviations", () => {
  it("covers every skill", () => {
    for (const key of SKILL_KEYS) {
      expect(SKILL_ABBREV[key], `missing abbreviation for ${key}`).toBeTruthy();
    }
    expect(Object.keys(SKILL_ABBREV).sort()).toEqual([...SKILL_KEYS].sort());
  });

  it("is unique per skill, which the old initials scheme was not", () => {
    const values = SKILL_KEYS.map((k) => SKILL_ABBREV[k]);
    expect(new Set(values).size).toBe(values.length);

    // The scheme this replaced, kept as the counter-example: it collapses
    // Speed/Strength/Stamina onto one label, which is the bug.
    const initials = SKILL_KEYS.map((k) =>
      SKILL_LABELS[k].split(" ").map((w) => w[0]).join(""),
    );
    expect(new Set(initials).size).toBeLessThan(initials.length);
  });

  it("stays short enough to head a dense numeric column", () => {
    for (const key of SKILL_KEYS) {
      expect(SKILL_ABBREV[key].length, `${key} abbreviation too long`).toBeLessThanOrEqual(3);
    }
  });
});
