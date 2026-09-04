import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ClubCrest, CrestArtProvider, CustomCrestProvider,
} from "../../src/ui/components/ClubCrest.js";
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

const CUSTOM = "data:image/webp;base64,CUSTOMBADGE";

/** The two providers nested exactly as Layout and the new-league picker nest them. */
const drawIn = (
  tid: number,
  { custom, suppressed }: { custom?: Map<number, string>; suppressed?: number[] },
) =>
  renderToStaticMarkup(
    createElement(CustomCrestProvider, {
      crests: custom ?? new Map<number, string>(),
      children: createElement(CrestArtProvider, {
        tids: suppressed ?? [],
        children: createElement(ClubCrest, { tid, colors: COLORS }),
      }),
    }),
  );

describe("a badge the player brought in", () => {
  // England's first slot, which the shipped art covers — the one place where
  // "custom wins" and "custom is merely present" say different things.
  const WITH_ART = 0;

  it("replaces the shipped art for that slot", () => {
    expect(hasArt(WITH_ART)).toBe(true);
    expect(drawIn(WITH_ART, { custom: new Map([[WITH_ART, CUSTOM]]) })).toContain(CUSTOM);
  });

  it("shows through the suppression an import turns on", () => {
    // Suppression exists to stop a real club wearing the fictional badge of the
    // slot it took. A custom badge is the answer to exactly that, so hiding it
    // behind the same flag would refuse the one thing the feature is for.
    const html = drawIn(WITH_ART, {
      custom: new Map([[WITH_ART, CUSTOM]]),
      suppressed: [WITH_ART],
    });
    expect(html).toContain(CUSTOM);
    expect(html).not.toContain("club-crest-fallback");
  });

  it("leaves suppression working for a club it doesn't cover", () => {
    const html = drawIn(WITH_ART, { custom: new Map([[999, CUSTOM]]), suppressed: [WITH_ART] });
    expect(html).toContain("club-crest-fallback");
  });

  it("gives a club with no shipped art a badge where it had only colors", () => {
    const bare = 500; // deep in the world, well past the two art sheets
    expect(hasArt(bare)).toBe(false);
    expect(drawIn(bare, { custom: new Map([[bare, CUSTOM]]) })).toContain(CUSTOM);
  });

  it("keeps the box square whatever shape the file was", () => {
    // Every caller sizes its layout on `size`, so a wide badge stretching the
    // box would shift the row around it.
    expect(drawIn(WITH_ART, { custom: new Map([[WITH_ART, CUSTOM]]) }))
      .toContain("object-fit:contain");
  });
});
