import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  TeamIdentityEditor, type EditableTeam,
} from "../../src/ui/components/TeamIdentityEditor.js";

/**
 * Render harness for the club naming/colour editor. It predates the world
 * editor but is now on the ordinary New League path (the "Name the clubs
 * yourself" checkbox), including for worlds whose competitions the player
 * invented, so it is worth pinning that it renders every competition it is
 * handed rather than assuming the shipped table.
 */
function team(tid: number, compId: number, name: string): EditableTeam {
  return {
    tid,
    compId,
    name,
    abbrev: name.slice(0, 3).toUpperCase(),
    colors: ["#101010", "#f0f0f0"],
  };
}

const COMPETITIONS = [
  { id: 0, name: "Neverland Division 1" },
  { id: 1, name: "Neverland Division 2" },
  { id: 2, name: "Ruritania Division 1" },
];

const TEAMS = [
  team(0, 0, "Alderworth United"),
  team(1, 0, "Briarholt Rovers"),
  team(2, 1, "Cindermoor Town"),
  team(3, 2, "Darnley Athletic"),
];

function render(userTid = 0): string {
  return renderToStaticMarkup(
    createElement(TeamIdentityEditor, {
      initialTeams: TEAMS,
      competitions: COMPETITIONS,
      userTid,
      saveLabel: "Start League",
      savingLabel: "Starting...",
      saving: false,
      onSave: () => {},
      onCancel: () => {},
    }),
  );
}

describe("TeamIdentityEditor renders", () => {
  it("lists every competition it is given, invented ones included", () => {
    const html = render();
    for (const comp of COMPETITIONS) expect(html).toContain(comp.name);
  });

  it("shows the clubs of the competition the user's own club is in", () => {
    const html = render(0);
    expect(html).toContain("Alderworth United");
    expect(html).toContain("Briarholt Rovers");
    // Other competitions are only rendered once selected.
    expect(html).not.toContain("Cindermoor Town");
  });

  it("opens on the user's competition rather than the first one", () => {
    // tid 3 plays in Ruritania, the third competition in the list.
    const html = render(3);
    expect(html).toContain("Darnley Athletic");
    expect(html).not.toContain("Alderworth United");
  });

  it("offers a name, an abbreviation and both colours per club", () => {
    const html = render();
    expect(html).toContain('value="Alderworth United"');
    expect(html).toContain('value="ALD"');
    expect(html.match(/type="color"/g)?.length).toBe(4); // two clubs x two colours
  });

  it("marks the user's own club", () => {
    expect(render(0)).toContain("You");
  });
});
