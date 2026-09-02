import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ClubCrest } from "../../src/ui/components/ClubCrest.js";
import {
  worldCompetitions, worldTeamSlots, competitionOf, countryClubRanges,
} from "../../src/core/competitions.js";

const COLORS: [string, string] = ["#123456", "#abcdef"];
const draw = (tid: number) =>
  renderToStaticMarkup(createElement(ClubCrest, { tid, colors: COLORS }));

const hasArt = (tid: number) => draw(tid).includes("<img");

describe("crest art is anchored to a country, not to a raw tid", () => {
  const comps = worldCompetitions();
  const slots = worldTeamSlots(comps);
  const tierOf = new Map(
    slots.map((s) => [s.tid, competitionOf(comps, s.compId).tier]),
  );
  const countryOf = new Map(
    slots.map((s) => [s.tid, competitionOf(comps, s.compId).country]),
  );

  it("gives every third-division club colors rather than another club's badge", () => {
    // The art was drawn for a world of two 20-club divisions per country, so
    // there is none for a third tier. Reusing a badge drawn for someone else is
    // worse than a swatch — which is how this was first noticed, with English
    // third-division clubs wearing crests drawn for Spain's top flight.
    const thirds = [...tierOf].filter(([, tier]) => tier === 3).map(([tid]) => tid);
    expect(thirds.length).toBeGreaterThan(0);
    for (const tid of thirds) expect(hasArt(tid)).toBe(false);
  });

  it("keeps each country's art on that country, whatever the pyramid's shape", () => {
    // England and Spain are the two countries with art, 40 slots each: their
    // top two divisions. A raw-tid lookup slid Spain's sheet onto England once
    // a third division was inserted into England's block.
    for (const country of ["England", "Spain"]) {
      const range = countryClubRanges(comps).find((r) => r.country === country)!;
      const withArt = [...tierOf.keys()]
        .filter((tid) => hasArt(tid) && countryOf.get(tid) === country);
      expect(withArt).toHaveLength(40);
      // Contiguous from the country's own block start, never another's.
      expect(Math.min(...withArt)).toBe(range.start);
      expect(Math.max(...withArt)).toBe(range.start + 39);
    }
  });

  it("draws the two-color swatch when there is no art", () => {
    const bare = [...tierOf.keys()].find((tid) => !hasArt(tid))!;
    const html = draw(bare);
    expect(html).toContain("club-crest-fallback");
    expect(html).toContain(COLORS[0]);
    expect(html).toContain(COLORS[1]);
  });
});
