import { describe, it, expect } from "vitest";
import { makeLeague } from "../helpers/league.js";
import { buildCompetitions, worldLeagueSpecs, worldTeamSlots } from "../../src/core/competitions.js";
import {
  buildRosterFile,
  competitionRefFromName,
  parseRosterFile,
  resolveRosterSlots,
  retargetRosterFile,
  ROSTER_FILE_FORMAT,
  type RosterFile,
} from "../../src/core/teams/rosterFile.js";

/**
 * A division's name is the player's to change in World setup; the country it
 * belongs to is not (on a shipped league it is not even editable). So a roster
 * file — every one the EA FC converter has written included, since they all name
 * competitions "English Division 1" — has to keep finding its league after a
 * rename, or renaming quietly costs you the whole import with only a warning.
 */
describe("finding a competition whose name has changed", () => {
  /** The shipped world with England's two divisions renamed. */
  const renamed = () => {
    const competitions = buildCompetitions(
      worldLeagueSpecs().map((s) =>
        s.country === "England"
          ? { ...s, d1Name: "Premier League", d2Name: "The Championship" }
          : s,
      ),
    );
    return { competitions, teams: worldTeamSlots(competitions) };
  };

  const club = (name: string) => ({
    name, abbrev: "XXX", colors: ["#111111", "#ffffff"] as [string, string],
  });
  const fileOf = (competitions: RosterFile["competitions"]): RosterFile => ({
    format: ROSTER_FILE_FORMAT, formatVersion: 1, competitions,
  });
  const landedIn = (world: ReturnType<typeof renamed>, tid: number) =>
    world.competitions.find(
      (c) => c.id === world.teams.find((t) => t.tid === tid)!.compId,
    )!;

  it("reads a shipped name back as the country and tier it stands for", () => {
    expect(competitionRefFromName("English Division 1")).toEqual({ country: "England", tier: 1 });
    expect(competitionRefFromName("Dutch Division 2")).toEqual({ country: "Netherlands", tier: 2 });
  });

  it("reads an added league's default name back as its own country", () => {
    expect(competitionRefFromName("Neverland Division 2")).toEqual({ country: "Neverland", tier: 2 });
  });

  it("gives up on a name that says nothing about a country", () => {
    expect(competitionRefFromName("Eredivisie")).toBeNull();
  });

  it("lands a file written for the old name on the renamed division", () => {
    const world = renamed();
    const { slots, warnings } = resolveRosterSlots(
      world,
      fileOf([{ match: "English Division 1", clubs: [club("Arsenal")] }]),
    );
    expect(warnings).toEqual([]);
    expect(slots).toHaveLength(1);
    expect(landedIn(world, slots[0].tid).name).toBe("Premier League");
  });

  it("keeps the two tiers apart when both were renamed", () => {
    const world = renamed();
    const { slots } = resolveRosterSlots(
      world,
      fileOf([{ match: "English Division 2", clubs: [club("Leeds")] }]),
    );
    expect(landedIn(world, slots[0].tid).name).toBe("The Championship");
  });

  it("leaves an untouched country exactly where it was", () => {
    const world = renamed();
    const { slots } = resolveRosterSlots(
      world,
      fileOf([{ match: "Spanish Division 1", clubs: [club("Madrid")] }]),
    );
    expect(landedIn(world, slots[0].tid).name).toBe("Spanish Division 1");
  });

  it("takes a stated country over a name that matches nothing", () => {
    const world = renamed();
    const { slots } = resolveRosterSlots(
      world,
      fileOf([{ match: "Eredivisie", country: "Netherlands", tier: 1, clubs: [club("Ajax")] }]),
    );
    expect(landedIn(world, slots[0].tid).country).toBe("Netherlands");
  });

  it("defaults a stated country with no tier to the top flight", () => {
    const world = renamed();
    const { slots } = resolveRosterSlots(
      world,
      fileOf([{ match: "Anything", country: "Spain", clubs: [club("Madrid")] }]),
    );
    expect(landedIn(world, slots[0].tid).tier).toBe(1);
  });

  it("still prefers an exact name match to the country the name implies", () => {
    const world = renamed();
    const { slots } = resolveRosterSlots(
      world,
      fileOf([{ match: "premier league", clubs: [club("Arsenal")] }]),
    );
    expect(landedIn(world, slots[0].tid).name).toBe("Premier League");
  });

  it("still skips a name that matches nothing and names no country", () => {
    const { slots, warnings } = resolveRosterSlots(
      renamed(),
      fileOf([{ match: "Some Other League", clubs: [club("Nobody")] }]),
    );
    expect(slots).toEqual([]);
    expect(warnings[0]).toContain("Some Other League");
  });

  it("lets one competition be claimed once, and says which entry lost", () => {
    const world = renamed();
    const { slots, warnings } = resolveRosterSlots(
      world,
      fileOf([
        { match: "Premier League", clubs: [club("First")] },
        { match: "English Division 1", clubs: [club("Second")] },
      ]),
    );
    expect(slots.map((s) => s.club.name)).toEqual(["First"]);
    expect(warnings[0]).toContain("same division");
  });

  it("does not send a retargeted file back to the country it was written for", () => {
    const competitions = buildCompetitions([...worldLeagueSpecs(), { country: "Neverland" }]);
    const world = { competitions, teams: worldTeamSlots(competitions) };
    const source = fileOf([
      { match: "English Division 1", country: "England", tier: 1, clubs: [club("Arsenal")] },
    ]);
    const { file } = retargetRosterFile(source, ["Neverland Division 1"]);
    const { slots } = resolveRosterSlots(world, file);
    expect(landedIn(world, slots[0].tid).country).toBe("Neverland");
  });
});

describe("country and tier on the wire", () => {
  const withComp = (comp: unknown) => JSON.stringify({
    format: ROSTER_FILE_FORMAT, formatVersion: 1, competitions: [comp],
  });

  it("are read when present and left absent when not", () => {
    const stated = parseRosterFile(
      withComp({ match: "X", country: "England", tier: 2, clubs: [] }),
    ).competitions[0];
    expect(stated.country).toBe("England");
    expect(stated.tier).toBe(2);

    const bare = parseRosterFile(withComp({ match: "X", clubs: [] })).competitions[0];
    expect(bare.country).toBeUndefined();
    expect(bare.tier).toBeUndefined();
  });

  it("reject a wrong shape rather than guessing", () => {
    expect(() => parseRosterFile(withComp({ match: "X", country: 42, clubs: [] }))).toThrow(/country/);
    expect(() => parseRosterFile(withComp({ match: "X", tier: 3, clubs: [] }))).toThrow(/tier/);
  });

  it("are emitted by buildRosterFile, so a template survives a later rename", () => {
    const league = makeLeague(0, 7, 7);
    const file = buildRosterFile(league);
    for (const comp of league.competitions) {
      const entry = file.competitions.find((c) => c.match === comp.name)!;
      expect(entry.country).toBe(comp.country);
      expect(entry.tier).toBe(comp.tier);
    }
  });
});
