import { describe, expect, it } from "vitest";
import {
  intlStageButton,
  intlStageLink,
  intlStageSkipLabel,
  intlStageThroughLabel,
  isConfederationCupStage,
  type PlayableStage,
} from "../../src/ui/intlStageLabels.js";
import { INTL_QUAL_LEGS } from "../../src/core/constants.js";
import type { IntlConfederationCup, IntlTournament } from "../../src/core/international/index.js";

/**
 * These labels are shared by the Dashboard's Simulation card and the top bar's
 * Sim menu. Both name the same stage from the same functions, so what needs
 * pinning is the functions themselves — chiefly that every label reads as a
 * sentence, which is where the copy previously went wrong.
 */
const STAGES: PlayableStage[] = [
  "qualifying",
  "groups",
  "knockout",
  "confederation-groups",
  "confederation-ko",
];

/**
 * A tournament with `n` knockout rounds still to play and none played yet.
 * `roundsRemaining` reads the seeded field, so a 2^n-nation bracket is n rounds.
 */
function bracket(n: number): IntlTournament {
  const field = Array.from({ length: 2 ** n }, (_, i) => i);
  return { championNid: null, bracket: field, ties: [] } as unknown as IntlTournament;
}

const NO_CUPS: IntlConfederationCup[] = [];

describe("international stage labels", () => {
  it("names the qualifying round it is about to play", () => {
    expect(intlStageButton("qualifying", 2, NO_CUPS, null)).toBe(
      `Play qualifying (round 2 of ${INTL_QUAL_LEGS})`,
    );
  });

  it("reads the knockout round off the bracket rather than a fixed position", () => {
    // Bracket depth varies with the field, so the name has to come from how
    // much is left. Four rounds is the 32-nation World Cup, one is a final.
    expect(intlStageButton("knockout", 1, NO_CUPS, bracket(4))).toBe("Play the round of 16");
    expect(intlStageButton("knockout", 1, NO_CUPS, bracket(2))).toBe("Play the semifinals");
    expect(intlStageButton("knockout", 1, NO_CUPS, bracket(1))).toBe("Play the final");
  });

  it("never doubles the article", () => {
    // "Sim through the" + "the cups" was the shipped bug, and it is the kind a
    // reader notices and a type checker never will.
    for (const stage of STAGES) {
      for (const label of [
        intlStageButton(stage, 1, NO_CUPS, bracket(3)),
        intlStageThroughLabel(stage),
        intlStageSkipLabel(stage),
      ]) {
        expect(label, label).not.toMatch(/\bthe the\b/i);
      }
    }
  });

  it("sends each stage to the page that shows it", () => {
    expect(intlStageLink("qualifying")).toBe("/national-teams/qualifying");
    expect(intlStageLink("confederation-ko")).toBe("/national-teams/confederation-cups");
    expect(intlStageLink("knockout")).toBe("/national-teams/world-cup");
  });

  it("groups both confederation stages together and nothing else", () => {
    expect(STAGES.filter(isConfederationCupStage)).toEqual([
      "confederation-groups",
      "confederation-ko",
    ]);
  });
});
