import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  WorldSetup, defaultWorldEntries, includedSpecs, type WorldEntry,
} from "../../src/ui/components/WorldSetup.js";
import { buildCompetitions, countriesOf } from "../../src/core/competitions.js";

/**
 * Render harness for the world editor. Typecheck can't reach a render path, and
 * this component is the one place a player shapes a world before it exists, so a
 * throw here would take out the New League screen entirely.
 *
 * Server rendering does NOT run error boundaries (React re-throws to the
 * caller), so a raw throw surfaces as a failure regardless of the boundaries
 * App and Layout install.
 */
function render(entries: WorldEntry[]): string {
  return renderToStaticMarkup(
    createElement(WorldSetup, { entries, onChange: () => {} }),
  );
}

/** The shipped countries plus one added league, expanded (its sliders shown). */
function withAddedLeague(): WorldEntry[] {
  return [
    ...defaultWorldEntries(),
    {
      id: "added:test",
      spec: {
        country: "Neverland",
        strengthOffset: 8,
        academyOffset: 3,
        budgetScale: 0.6,
        cupSlots: 2,
        shieldSlots: 2,
      },
      included: true,
      shipped: false,
      linkMoney: true,
    },
  ];
}

describe("WorldSetup renders", () => {
  it("renders the shipped world with every country listed and no warnings", () => {
    const html = render(defaultWorldEntries());
    for (const country of ["England", "Spain", "Italy", "Germany", "France", "Portugal", "Belgium", "Turkey"]) {
      expect(html).toContain(country);
    }
    expect(html).toContain("8 leagues, 320 clubs");
    expect(html).not.toContain("alert-warning");
  });

  it("renders an added league's settings", () => {
    const html = render(withAddedLeague());
    expect(html).toContain("Neverland");
    expect(html).toContain("Strength");
    expect(html).toContain("Academies");
    expect(html).toContain("Money");
    expect(html).toContain("Continental Cup places");
    expect(html).toContain("Continental Shield places");
    // The academy label says which way the league will move.
    expect(html).toContain("rising");
    expect(html).toContain("9 leagues, 360 clubs");
  });

  it("renders the warning when money and strength disagree", () => {
    const entries = withAddedLeague();
    entries[entries.length - 1] = {
      ...entries[entries.length - 1],
      linkMoney: false,
      spec: { ...entries[entries.length - 1].spec, budgetScale: 1.2 },
    };
    const html = render(entries);
    expect(html).toContain("alert-warning");
    expect(html).toContain("richer");
  });

  it("renders a world with countries switched off", () => {
    const entries = defaultWorldEntries().map((e, i) => ({ ...e, included: i < 2 }));
    const html = render(entries);
    expect(html).toContain("2 leagues, 80 clubs");
    // Two countries can't field the Continental Cup, and it says so.
    expect(html).toContain("Continental Cup");
  });

  it("renders an empty world without throwing", () => {
    const html = render(defaultWorldEntries().map((e) => ({ ...e, included: false })));
    expect(html).toContain("0 leagues, 0 clubs");
    expect(html).toContain("at least one league");
  });

  it("keeps the entries it renders in step with the world they build", () => {
    const entries = withAddedLeague();
    const countries = countriesOf(buildCompetitions(includedSpecs(entries)));
    expect(countries).toHaveLength(9);
    expect(countries[countries.length - 1]).toBe("Neverland");
  });
});
