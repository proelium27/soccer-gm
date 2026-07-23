import type { BoxScore } from "../../engine/attribution.js";
import type { CupTie } from "../cup/types.js";
import type { FormationId } from "../lineup/formations.js";

/**
 * A nation's named squad for one campaign. Within a campaign a nation is
 * identified by its `nid` — its index into that campaign's `nations` array —
 * because the match sim and the knockout code both key teams by number. Nation
 * *names* are what persist across campaigns; nids are only stable inside one.
 */
export interface NationSquad {
  nation: string;
  /** INTL_SQUAD_SIZE pids at most (fewer if the nation's pool is thin). */
  pids: number[];
  formation: FormationId;
  /** Mean OVR of the named squad — seeds the draw, then display only. */
  rating: number;
}

/**
 * One 90' group match. Group games can end level (no extra time), so unlike a
 * knockout tie this carries only the scoreline. `boxScore` is null for archived
 * campaigns and for qualifying, which is played in bulk and never keeps its
 * per-match attribution (see InternationalState).
 */
export interface IntlGroupMatch {
  group: number;
  round: number;
  home: number; // nid
  away: number; // nid
  homeGoals: number;
  awayGoals: number;
  boxScore: BoxScore | null;
}

/** One group: its nations in seed order plus its full single round-robin. */
export interface IntlGroup {
  nids: number[];
  matches: IntlGroupMatch[];
  /** Confederation this group qualifies through; null for tournament groups (mixed by design). */
  confederation: string | null;
}

/**
 * A completed qualifying campaign: every eligible nation, split into
 * confederation groups, playing a single round-robin for the places its
 * confederation was allocated. Played in one pass during an odd season's
 * offseason; `qualified` is what the next tournament is built from.
 */
export interface IntlQualifyingCampaign {
  /** The season whose offseason played this campaign. */
  season: number;
  nations: string[]; // nid → nation name
  squads: NationSquad[]; // parallel to `nations`
  groups: IntlGroup[];
  /** The INTL_FIELD_SIZE qualifiers, strongest first — the next tournament's field. */
  qualified: string[];
}

/**
 * One tournament: INTL_GROUPS groups of INTL_GROUP_SIZE, whose top
 * INTL_QUALIFY_PER_GROUP feed an INTL_KO_SIZE bracket. The knockout reuses the
 * Continental Cup's `CupTie` and `resolveCupTie` outright — the shape is
 * identical (scoreline after extra time, shootout recorded separately, winner,
 * box score) and `home`/`away` being plain numbers means nids drop straight in.
 * `matchday` on those ties is always 0: international football has no place in
 * the club calendar.
 */
export interface IntlTournament {
  /** The season whose offseason played this tournament. */
  season: number;
  name: string;
  nations: string[]; // nid → nation name
  squads: NationSquad[]; // parallel to `nations`
  groups: IntlGroup[];
  /** INTL_KO_SIZE nids in bracket order; empty until the groups complete. */
  bracket: number[];
  ties: CupTie[]; // round 0 = QF, 1 = SF, 2 = Final
  championNid: number | null;
}

/**
 * An archived tournament, kept forever. Deliberately far smaller than the
 * tournament itself: box scores and squads are dropped, because a 30-season
 * dynasty plays 15 tournaments and holding every one's full attribution would
 * bloat the save for a page nobody browses that deeply. Career totals survive
 * on each player instead (see Player.intl).
 */
export interface IntlTournamentSummary {
  season: number;
  name: string;
  champion: string;
  runnerUp: string;
  /** Final scoreline from the champion's perspective, plus shootout if it went there. */
  finalScore: { champion: number; runnerUp: number; pens: { champion: number; runnerUp: number } | null };
  /** The tournament's leading scorer, or null if nobody scored. */
  topScorer: { pid: number; nation: string; goals: number } | null;
  /** The full field, strongest first. */
  field: string[];
}

/**
 * All international state for a save.
 *
 * Only the *current* qualifying campaign and the *current* tournament are held
 * in full; everything older collapses into `history`. The cycle alternates:
 * an odd season's offseason writes `qualifying` (and clears `tournament`), the
 * following even season's offseason consumes it to play `tournament`.
 */
export interface InternationalState {
  /** The most recent qualifying campaign, whose `qualified` field seeds the next tournament. */
  qualifying: IntlQualifyingCampaign | null;
  /** The most recently played tournament, in full. */
  tournament: IntlTournament | null;
  /** Every completed tournament, oldest first. */
  history: IntlTournamentSummary[];
}

/**
 * A player's international career is accumulated at sim time and kept on the
 * player (rather than derived from box scores) because qualifying keeps no
 * attribution and archived tournaments drop theirs — those totals are the only
 * lasting record. It lives in ./career.js to stay import-cycle-free; see there.
 */
export type { IntlCareer } from "./career.js";
export { emptyIntlCareer } from "./career.js";
