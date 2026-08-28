import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  WorldSetup, defaultWorldEntries, includedSpecs, leagueRosterFiles,
  strengthDial, strengthOffsetFromDial, type WorldEntry,
} from "../../src/ui/components/WorldSetup.js";
import {
  buildCompetitions, countriesOf, worldCompetitions, competitionStrengthOffset,
} from "../../src/core/competitions.js";
import { PROMOTION_RELEGATION_COUNT } from "../../src/core/constants.js";
import type { RosterFile } from "../../src/core/teams/rosterFile.js";
import { ROSTER_FILE_FORMAT } from "../../src/core/teams/rosterFile.js";

/** A roster file naming one competition with `clubs` clubs in it. */
function rosterFile(match: string, clubs: number): RosterFile {
  return {
    format: ROSTER_FILE_FORMAT,
    formatVersion: 1,
    competitions: [{
      match,
      clubs: Array.from({ length: clubs }, (_, i) => ({
        name: `Club ${i + 1}`,
        abbrev: `C${i + 1}`,
        colors: ["#101010", "#f0f0f0"] as [string, string],
      })),
    }],
  };
}

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
    expect(html).toContain("Money");
    expect(html).toContain("Continental Cup places");
    expect(html).toContain("Continental Shield places");
    expect(html).toContain("9 leagues, 360 clubs");
  });

  it("offers the up-and-down picker on an added league only", () => {
    const html = render(withAddedLeague());
    // One picker, on the one added league: the shipped countries aren't
    // editable, so they don't get one.
    expect(html.match(/Clubs promoted and relegated each season/g)).toHaveLength(1);
    expect(render(defaultWorldEntries()))
      .not.toContain("Clubs promoted and relegated each season");
  });

  it("starts the picker at the count every shipped country plays", () => {
    const html = render(withAddedLeague());
    expect(html).toContain(`<option value="${PROMOTION_RELEGATION_COUNT}" selected="">`);
    expect(html).toContain("3 up, 3 down");
    expect(html).toContain("None");
  });

  it("caps the picker at half the league's own divisions", () => {
    const entries = withAddedLeague();
    const last = entries.length - 1;
    entries[last] = {
      ...entries[last],
      spec: { ...entries[last].spec, d1Teams: 8, d2Teams: 8, promotionSpots: 6 },
    };
    const html = render(entries);
    expect(html).toContain("4 up, 4 down");
    expect(html).not.toContain("5 up, 5 down");
    // A count the divisions can no longer carry shows as the one they can, so
    // the picker never reads back a number the world wouldn't build.
    expect(html).toContain('<option value="4" selected="">');
  });

  it("hides the picker on a one-division league, which has nothing to swap with", () => {
    const entries = withAddedLeague();
    const last = entries.length - 1;
    entries[last] = { ...entries[last], spec: { ...entries[last].spec, divisions: 1 } };
    expect(render(entries)).not.toContain("Clubs promoted and relegated each season");
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

  it("offers a roster import on an added league and not on a shipped one", () => {
    const html = render(withAddedLeague());
    expect(html).toContain("Import roster");
    // One picker, on the one added league.
    expect(html.match(/Import roster/g)).toHaveLength(1);
  });

  it("offers a three-letter code box, suggesting one from the country name", () => {
    const html = render(withAddedLeague());
    expect(html).toContain('aria-label="Three-letter code"');
    // Neverland has no code set, so the box suggests NEV rather than pre-filling it.
    expect(html).toContain('placeholder="NEV"');
    expect(html).toContain('value=""');
  });

  it("keeps a code the player typed", () => {
    const entries = withAddedLeague();
    entries[entries.length - 1] = {
      ...entries[entries.length - 1],
      spec: { ...entries[entries.length - 1].spec, abbrev: "NVL" },
    };
    expect(render(entries)).toContain('value="NVL"');
  });

  it("points at manual editing beside the roster import", () => {
    // Two ways to get your own clubs in, and the file picker is the one people
    // find first, so it says what the other one is.
    const html = render(withAddedLeague());
    expect(html).toContain("Name the clubs");
    expect(html).toContain("yourself");
  });

  it("collects the explanations under the controls rather than between them", () => {
    const html = render(withAddedLeague());
    const money = html.indexOf('aria-label="Money"');
    const cupPlaces = html.indexOf("Continental Cup places");
    // The paragraph explaining strength, money and up-and-down used to be the
    // thing sampled here. It was removed (2026-08-26, user call): the controls
    // say what they do in their own labels and options, and the Manual carries
    // the full explanation, so a paragraph restating them was noise in the most
    // cramped part of the panel. The layout guarantee it was pinning is still
    // real, so this now samples prose that exists — the sections that DO explain
    // themselves sit below every numeric control rather than in between them.
    const nationalityProse = html.indexOf("Who this league produces");
    expect(money).toBeGreaterThan(-1);
    expect(cupPlaces).toBeGreaterThan(-1);
    expect(cupPlaces).toBeGreaterThan(money);
    expect(nationalityProse).toBeGreaterThan(cupPlaces);
  });

  it("names the loaded files and counts their clubs", () => {
    const entries = withAddedLeague();
    entries[entries.length - 1] = {
      ...entries[entries.length - 1],
      rosterSources: [{ name: "neverland.json", file: rosterFile("Top Flight", 3) }],
    };
    const html = render(entries);
    expect(html).toContain("neverland.json");
    expect(html).toContain("3 clubs");
    expect(html).toContain("Add another file");
  });

  it("offers to rename each shipped league", () => {
    // Divisions used to be named after their country and nothing else, so a
    // roster file written for "Premier League" could never find one — the game
    // had no league by that name and no way to give it one.
    const html = render(defaultWorldEntries());
    expect(html.match(/>Rename</g)).toHaveLength(8);
  });

  it("doesn't offer to rename a league that's switched off", () => {
    const entries = defaultWorldEntries().map((e, i) => ({ ...e, included: i === 0 }));
    expect(render(entries).match(/>Rename</g)).toHaveLength(1);
  });

  it("gives an added league its division-name boxes, defaults as placeholders", () => {
    const html = render(withAddedLeague());
    expect(html).toContain('aria-label="Top division name"');
    expect(html).toContain('aria-label="Second division name"');
    // Absent rather than pre-filled, so a name keeps following the country
    // while it's untouched.
    expect(html).toContain('placeholder="Neverland Division 1"');
    expect(html).toContain('placeholder="Neverland Division 2"');
  });

  it("shows a name the player set", () => {
    const entries = withAddedLeague();
    entries[entries.length - 1] = {
      ...entries[entries.length - 1],
      spec: { ...entries[entries.length - 1].spec, d1Name: "Eredivisie" },
    };
    expect(render(entries)).toContain('value="Eredivisie"');
  });

  it("asks for one name on a one-division league", () => {
    const entries = withAddedLeague();
    entries[entries.length - 1] = {
      ...entries[entries.length - 1],
      spec: { ...entries[entries.length - 1].spec, divisions: 1 },
    };
    const html = render(entries);
    expect(html).toContain('aria-label="League name"');
    expect(html).not.toContain('aria-label="Second division name"');
  });
});

describe("the strength dial reads the way a player expects", () => {
  it("counts up toward stronger, opposite the engine's handicap", () => {
    // The engine stores a handicap: 0 is the top of the game, higher is weaker.
    // The control shows the reverse.
    expect(strengthDial(0)).toBe(20);
    expect(strengthDial(20)).toBe(0);
    expect(strengthDial(5)).toBe(15);
  });

  it("round-trips, so moving the slider can't drift the stored value", () => {
    for (let dial = 0; dial <= 20; dial++) {
      expect(strengthDial(strengthOffsetFromDial(dial))).toBe(dial);
    }
  });

  it("puts the shipped leagues where the table says they are", () => {
    const byCountry = new Map(
      worldCompetitions().filter((c) => c.tier === 1).map((c) => [c.country, c]),
    );
    expect(strengthDial(competitionStrengthOffset(byCountry.get("England")!))).toBe(20);
    expect(strengthDial(competitionStrengthOffset(byCountry.get("France")!))).toBe(15);
    expect(strengthDial(competitionStrengthOffset(byCountry.get("Portugal")!))).toBe(10);
    expect(strengthDial(competitionStrengthOffset(byCountry.get("Turkey")!))).toBe(8);
  });

  it("shows the baseline table beside the sliders it calibrates", () => {
    const html = render(withAddedLeague());
    expect(html).toContain("Where the leagues already in the game sit");
    // Every shipped country, with its dial value and its money scale.
    for (const country of ["England", "France", "Portugal", "Turkey"]) {
      expect(html).toContain(country);
    }
    expect(html).toContain("0.40");
    expect(html).toContain("1.00");
  });

  it("doesn't show it when there is no league being set up", () => {
    // It belongs to the per-league editor, so a world of shipped countries only
    // — none of which are editable — has nothing to calibrate against.
    expect(render(defaultWorldEntries())).not.toContain("Where the leagues already in the game sit");
  });
});

describe("per-league roster files are retargeted onto their own league", () => {
  it("points a file at the divisions of the league it was attached to", () => {
    const entries = withAddedLeague();
    entries[entries.length - 1] = {
      ...entries[entries.length - 1],
      rosterSources: [{ name: "a.json", file: rosterFile("Whatever It Was Called", 2) }],
    };
    const competitions = buildCompetitions(includedSpecs(entries));
    const { files } = leagueRosterFiles(entries, competitions);

    expect(files).toHaveLength(1);
    expect(files[0].file.competitions[0].match).toBe("Neverland Division 1");
    expect(files[0].name).toContain("Neverland");
  });

  it("follows the league's current name, so renaming after loading still works", () => {
    const entries = withAddedLeague();
    const last = entries.length - 1;
    entries[last] = {
      ...entries[last],
      spec: { ...entries[last].spec, country: "Ruritania" },
      rosterSources: [{ name: "a.json", file: rosterFile("Anything", 1) }],
    };
    const competitions = buildCompetitions(includedSpecs(entries));
    const { files } = leagueRosterFiles(entries, competitions);
    expect(files[0].file.competitions[0].match).toBe("Ruritania Division 1");
  });

  it("ignores a file on a league that has been switched off", () => {
    const entries = withAddedLeague();
    entries[entries.length - 1] = {
      ...entries[entries.length - 1],
      included: false,
      rosterSources: [{ name: "a.json", file: rosterFile("Anything", 1) }],
    };
    const competitions = buildCompetitions(includedSpecs(entries));
    expect(leagueRosterFiles(entries, competitions).files).toHaveLength(0);
  });

  it("returns nothing when no league carries a file", () => {
    const entries = withAddedLeague();
    const competitions = buildCompetitions(includedSpecs(entries));
    expect(leagueRosterFiles(entries, competitions).files).toHaveLength(0);
  });
});

describe("WorldSetup wiring", () => {
  it("keeps the entries it renders in step with the world they build", () => {
    const entries = withAddedLeague();
    const countries = countriesOf(buildCompetitions(includedSpecs(entries)));
    expect(countries).toHaveLength(9);
    expect(countries[countries.length - 1]).toBe("Neverland");
  });
});
