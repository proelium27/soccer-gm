/**
 * Finding and editing the squad of the nation the user manages.
 *
 * A campaign's squads live in three different places — the qualifying campaign,
 * the World Cup, and an array of confederation cups — and which of them is the
 * one you are picking a team for depends on which stage the offseason is on.
 * This is the single answer to that question, so the action layer, the squad
 * screen and any future caller cannot disagree about which squad a change
 * applies to.
 *
 * Pure and rng-free.
 */
import type { Player } from "../players/types.js";
import type { InternationalState, NationSquad } from "./types.js";
import { INTL_SQUAD_SIZE, INTL_MIN_KEEPERS } from "../constants.js";

/** Which of the three campaign slots a squad sits in. */
export type CampaignSlot =
  | { kind: "qualifying" }
  | { kind: "tournament" }
  | { kind: "confederation"; index: number };

export interface FoundSquad {
  slot: CampaignSlot;
  squad: NationSquad;
  /** The competition's name, for the page heading. */
  competition: string;
}

const findIn = (squads: NationSquad[], nation: string): NationSquad | undefined =>
  squads.find((s) => s.nation === nation);

/**
 * The campaign whose team the user is picking right now, or null if there isn't
 * one.
 *
 * Keyed off the pending stage rather than off "the most recent campaign",
 * because editing only means anything while there are matches left to play: the
 * stage says which competition the next click will play, and that is the one a
 * lineup change will actually reach. A finished offseason edits nothing.
 */
export function editableSquad(intl: InternationalState, nation: string | null): FoundSquad | null {
  if (!nation) return null;
  switch (intl.stage) {
    case "qualifying": {
      const squad = intl.qualifying && findIn(intl.qualifying.squads, nation);
      return squad ? { slot: { kind: "qualifying" }, squad, competition: "qualifying" } : null;
    }
    case "groups":
    case "knockout": {
      const squad = intl.tournament && findIn(intl.tournament.squads, nation);
      return squad
        ? { slot: { kind: "tournament" }, squad, competition: intl.tournament!.name }
        : null;
    }
    case "confederation-groups":
    case "confederation-ko": {
      const index = intl.confederationCups.findIndex((c) => c.squads.some((s) => s.nation === nation));
      if (index < 0) return null;
      const cup = intl.confederationCups[index];
      return {
        slot: { kind: "confederation", index },
        squad: findIn(cup.squads, nation)!,
        competition: cup.name,
      };
    }
    default:
      return null;
  }
}

/**
 * The squad to *show* on the national-team screen: the one being picked if a
 * campaign is live, otherwise the most recent squad this nation named, so the
 * page has something to say between campaigns rather than going blank for three
 * quarters of every cycle.
 */
export function displaySquad(intl: InternationalState, nation: string | null): FoundSquad | null {
  if (!nation) return null;
  const editable = editableSquad(intl, nation);
  if (editable) return editable;

  const candidates: { season: number; found: FoundSquad }[] = [];
  if (intl.tournament) {
    const squad = findIn(intl.tournament.squads, nation);
    if (squad) {
      candidates.push({
        season: intl.tournament.season,
        found: { slot: { kind: "tournament" }, squad, competition: intl.tournament.name },
      });
    }
  }
  if (intl.qualifying) {
    const squad = findIn(intl.qualifying.squads, nation);
    if (squad) {
      candidates.push({
        season: intl.qualifying.season,
        found: { slot: { kind: "qualifying" }, squad, competition: "qualifying" },
      });
    }
  }
  intl.confederationCups.forEach((cup, index) => {
    const squad = findIn(cup.squads, nation);
    if (squad) {
      candidates.push({
        season: cup.season,
        found: { slot: { kind: "confederation", index }, squad, competition: cup.name },
      });
    }
  });

  candidates.sort((a, b) => b.season - a.season);
  return candidates[0]?.found ?? null;
}

/** Replace one nation's squad in one campaign slot, leaving everything else alone. */
export function writeSquad(
  intl: InternationalState,
  slot: CampaignSlot,
  nation: string,
  squad: NationSquad,
): InternationalState {
  const swap = (squads: NationSquad[]): NationSquad[] =>
    squads.map((s) => (s.nation === nation ? squad : s));

  if (slot.kind === "qualifying") {
    return intl.qualifying
      ? { ...intl, qualifying: { ...intl.qualifying, squads: swap(intl.qualifying.squads) } }
      : intl;
  }
  if (slot.kind === "tournament") {
    return intl.tournament
      ? { ...intl, tournament: { ...intl.tournament, squads: swap(intl.tournament.squads) } }
      : intl;
  }
  const cup = intl.confederationCups[slot.index];
  if (!cup) return intl;
  return {
    ...intl,
    confederationCups: intl.confederationCups.map((c, i) =>
      (i === slot.index ? { ...c, squads: swap(c.squads) } : c)),
  };
}

/**
 * Whether a set of pids is a squad a nation could actually field.
 *
 * Checked at the action layer before anything is persisted, on the same
 * reasoning as `isValidStarters`: the screen can be trusted to build a sensible
 * list, but the store must never hold one it can't.
 *
 * The keeper floor is the one that matters. `selectXI` fills an empty GK slot
 * with an outfielder rather than refusing, which silently wrecks the keeping
 * composite — the same correctness requirement `INTL_MIN_POOL` documents.
 */
export function isValidNationSquad(pids: number[], pool: Player[]): boolean {
  if (pids.length < 11 || pids.length > INTL_SQUAD_SIZE) return false;
  if (new Set(pids).size !== pids.length) return false;
  const byPid = new Map(pool.map((p) => [p.pid, p]));
  const named = pids.map((pid) => byPid.get(pid));
  if (named.some((p) => p === undefined)) return false;
  return named.filter((p) => p!.pos === "GK").length >= INTL_MIN_KEEPERS;
}
