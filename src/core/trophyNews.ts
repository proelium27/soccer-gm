import type { CupState } from "./cup/types.js";
import type { IntlTournamentSummary } from "./international/types.js";

/**
 * Which competition a trophy row is reporting. The two club competitions name a
 * winning club; the two international ones name a winning nation.
 */
export type TrophyNewsKind =
  | "continentalCup"
  | "continentalShield"
  | "worldCup"
  | "confederationCup";

export interface TrophyNews {
  kind: TrophyNewsKind;
  /** What the competition is called. A confederation cup's name is its own ("Copa América"). */
  name: string;
  /** Winning club, for the club competitions. */
  tid?: number;
  /** Winning nation, for the international ones. */
  nation?: string;
  /** Who they beat in the final. Only the international summaries record it. */
  runnerUp?: string;
  /** The final scoreline, champion first, with a shootout appended if it went there. */
  score?: string;
}

/**
 * Everything the game keeps about who won what. Structural rather than a
 * `LeagueStore` so this stays testable, and because the live cup and the
 * archive are two different fields holding the same shape.
 */
export interface TrophyRecords {
  cup: CupState | null;
  cupHistory: CupState[];
  shield: CupState | null;
  shieldHistory: CupState[];
  international: {
    history: IntlTournamentSummary[];
    confederationCupHistory: IntlTournamentSummary[];
  } | null;
}

/**
 * Every trophy the save has a winner for, bucketed by the season it was won in.
 *
 * **Derived, like the individual honours in `awardNews.ts`, and for the same
 * reason**: a champion is already recorded (`CupState.championTid`,
 * `IntlTournamentSummary.champion`), so writing a news event for one would
 * duplicate the save's own record and could drift from it. An existing dynasty
 * therefore shows every trophy it ever awarded the moment this ships.
 *
 * One pass over all four records rather than a lookup per season, since the
 * feed builds every season's timeline at once.
 *
 * The live cup and the archive are both read, because a cup is only moved into
 * its history at the offseason rollover: without the live one, the club season's
 * biggest result would go unreported until the user clicked Advance. They can't
 * double up, since the live cup is rebuilt for the new season by the same step
 * that archives the old one.
 *
 * An international tournament is played in the offseason that *follows* a
 * season and is stamped with that season, which is the convention the awards
 * already use (`worldAwards.ts` scores the same campaign into the same season).
 * So a World Cup files alongside the honours of the club season it followed.
 */
export function trophyNewsBySeason(records: TrophyRecords): Map<number, TrophyNews[]> {
  const out = new Map<number, TrophyNews[]>();
  const add = (season: number, trophy: TrophyNews): void => {
    const bucket = out.get(season);
    if (bucket) bucket.push(trophy);
    else out.set(season, [trophy]);
  };

  const addCup = (cup: CupState | null, kind: TrophyNewsKind): void => {
    // A cup still being played has no champion yet.
    if (!cup || cup.championTid === null) return;
    add(cup.season, { kind, name: cup.name, tid: cup.championTid });
  };
  addCup(records.cup, "continentalCup");
  for (const c of records.cupHistory) addCup(c, "continentalCup");
  addCup(records.shield, "continentalShield");
  for (const c of records.shieldHistory) addCup(c, "continentalShield");

  const addTournament = (s: IntlTournamentSummary, kind: TrophyNewsKind): void => {
    const { champion, runnerUp } = s.finalScore;
    const pens = s.finalScore.pens;
    add(s.season, {
      kind,
      name: s.name,
      nation: s.champion,
      runnerUp: s.runnerUp,
      score: pens
        ? `${champion}-${runnerUp} (${pens.champion}-${pens.runnerUp} pens)`
        : `${champion}-${runnerUp}`,
    });
  };
  for (const s of records.international?.history ?? []) addTournament(s, "worldCup");
  for (const s of records.international?.confederationCupHistory ?? []) {
    addTournament(s, "confederationCup");
  }

  return out;
}
