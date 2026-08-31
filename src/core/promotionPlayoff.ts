import type { StandingsRow } from "./standings.js";
import type { StoredTeam } from "./teams/clubs.js";
import type { Player } from "./players/types.js";
import type { Competition } from "./competitions.js";
import type { TeamMatchData } from "./league/composites.js";
import type { CupTie } from "./cup/types.js";
import {
  countryDivisions, effectivePromotionSpots, competitionPlayoffFormat,
} from "./competitions.js";
import { leagueMatchData } from "./league/composites.js";
import { playFirstLeg, resolveTwoLeggedTie, resolveCupTie } from "./cup/simCup.js";
import { teamSeasonFormDelta, applySeasonForm } from "./teamSeasonForm.js";
import { mulberry32, hashInts } from "../engine/rng.js";
import { PROMOTION_PLAYOFF_SEMI_FINALS } from "./constants.js";

/**
 * rng-stream tag for the promotion playoff, kept clear of every other
 * competition's (continental 30, shield 70, domestic 0x0d0d, international
 * 900+). Each tie draws its own stream off (lid, season, d2 compId, round,
 * tie), never the shared league `rng` — so adding the playoff cannot move a
 * single league scoreline, exactly like the cups.
 */
export const PROMOTION_PLAYOFF_STREAM = 0x9a0f;

/** Semi-final round index within `PromotionPlayoff.ties` (English format only). */
export const PLAYOFF_ROUND_SEMI = 0;
/**
 * The deciding tie's round index: the English final, or the German playoff,
 * which is the whole thing. Sharing the index is safe because a country plays
 * one format or the other, never both.
 */
export const PLAYOFF_ROUND_FINAL = 1;

/** The format a played record was decided under. `none` never produces a record. */
export type PlayedPlayoffFormat = "english" | "german";

/**
 * One country's promotion playoff for its last promotion place.
 *
 * Two shapes, by `format`:
 *  - **english** — the four clubs below the automatic places contest two-legged
 *    semi-finals and a neutral-ground final. Entirely within tier 2; no
 *    top-flight club is at risk, and exactly one extra club goes up.
 *  - **german** — tier 2's next club plays tier 1's lowest safe club over two
 *    legs. Either the challenger goes up and the incumbent goes down, or
 *    neither moves and the country simply promotes and relegates one fewer.
 *
 * Played inside the offseason, on end-of-season squads, and stored on the
 * season-history entry for the season it decides. Box scores are deliberately
 * **never** kept — the whole world plays these ties every season and a save
 * keeps its history forever, so scorelines are the record (see CLAUDE.md's
 * save-size section for what happens when that rule is relaxed).
 */
export interface PromotionPlayoff {
  /** The season just finished — the one whose final tables seeded this. */
  season: number;
  country: string;
  /** The top flight the winner plays in next season. */
  d1CompId: number;
  /** The second tier the challenger (or challengers) came from. */
  d2CompId: number;
  format: PlayedPlayoffFormat;
  /**
   * The entrants. English: the four tier-2 clubs, best league finish first.
   * German: exactly two, the **tier-1 club first**, then the tier-2 challenger.
   */
  teams: number[];
  /** Each entrant's 1-based finishing position *in his own division's table*. */
  positions: number[];
  /** Which division each entrant came from, index-aligned with `teams`. */
  tiers: (1 | 2)[];
  /** How many tier-2 clubs go up on the table alone, before this decides the rest. */
  autoPromoted: number;
  /** How many tier-1 clubs go down on the table alone. */
  autoRelegated: number;
  /**
   * English: two semi-finals (round `PLAYOFF_ROUND_SEMI`) then the final.
   * German: the single two-legged tie, at `PLAYOFF_ROUND_FINAL`.
   * `boxScore` is always null — see the interface note.
   */
  ties: CupTie[];
  /**
   * Who won the deciding tie. For the English format that is always the club
   * promoted; for the German one it may be the **tier-1 club**, which means
   * nobody moves. Read `playoffOutcomes` rather than this field to find out
   * what actually happened to the table. Null only while unplayed.
   */
  winnerTid: number | null;
}

/** One country's playoff field, worked out from its final tables. */
export interface PlayoffField {
  country: string;
  d1CompId: number;
  d2CompId: number;
  format: PlayedPlayoffFormat;
  autoPromoted: number;
  autoRelegated: number;
  teams: number[];
  positions: number[];
  tiers: (1 | 2)[];
}

/**
 * Which countries hold a promotion playoff this season, who is in it, and under
 * which format.
 *
 * A country holds one when it has two divisions, its format is not `none`, and
 * its tables can actually seat the field. Two feasibility rules, one per format:
 *
 *  - **english** needs at least **two** promotion places, because the bracket
 *    sits *below* the automatic ones — with a single place the only bracket
 *    available would be positions 1-4, which takes promotion away from the
 *    champion rather than deciding a spare place. It also needs four clubs below
 *    those automatic places; a division too short holds no playoff rather than a
 *    smaller bracket, so the shape is identical everywhere it runs.
 *  - **german** works at any count from one upward, since it only needs one club
 *    on each side of the line.
 *
 * In both cases the **number of clubs that can move is unchanged**. The playoff
 * redistributes the last place, it never creates one — which matters beyond
 * tidiness, because every division's size is fixed and one extra club promoted
 * would mean one extra relegated.
 */
export function promotionPlayoffFields(
  competitions: Competition[],
  tablesByCompId: Map<number, StandingsRow[]>,
): PlayoffField[] {
  // The TOP link only, deliberately, even now a country can run three
  // divisions: `tier1Pairs` used to say this by being the only thing on offer,
  // and it has to be said out loud now that `promotionLinks` would hand back
  // every boundary. A second playoff between the lower two is a real feature
  // (England and Germany both hold one) but it is a feature, with its own page,
  // news and changelog — not something a deeper pyramid should switch on by
  // itself. computeCountrySwaps needs no matching guard: outcomes are keyed by
  // the LOWER division's compId, so a lower link simply finds none and takes
  // the plain top-N slice.
  return countryDivisions(competitions).flatMap(({ divisions }) => {
    const [d1, d2] = divisions;
    if (!d2) return [];
    const format = competitionPlayoffFormat(d1, d2);
    if (format === "none") return [];
    const d1Table = tablesByCompId.get(d1.id);
    const d2Table = tablesByCompId.get(d2.id);
    if (!d1Table || !d2Table) return [];
    const spots = effectivePromotionSpots(
      competitions, d1, d2, d1Table.length, d2Table.length,
    );
    if (spots <= 0) return [];
    const base = { country: d1.country, d1CompId: d1.id, d2CompId: d2.id };

    if (format === "english") {
      if (spots < 2) return [];
      const autoPromoted = spots - 1;
      const size = PROMOTION_PLAYOFF_SEMI_FINALS * 2;
      if (d2Table.length < autoPromoted + size) return [];
      const entrants = d2Table.slice(autoPromoted, autoPromoted + size);
      return {
        ...base,
        format,
        // Relegation is untouched by an English playoff: the same number still
        // goes down on the table, because the tie only decides which tier-2
        // club joins them going the other way.
        autoPromoted,
        autoRelegated: spots,
        teams: entrants.map((r) => r.tid),
        positions: entrants.map((_, i) => autoPromoted + 1 + i),
        tiers: entrants.map(() => 2 as const),
      };
    }

    // German: one club either side of the line. The tier-1 entrant is the
    // lowest club NOT already relegated on the table — index
    // `length - spots`, which sits exactly above the bottom `spots - 1`.
    const auto = spots - 1;
    const d1Index = d1Table.length - spots;
    if (d1Index < 0 || auto >= d2Table.length) return [];
    return {
      ...base,
      format,
      autoPromoted: auto,
      autoRelegated: auto,
      teams: [d1Table[d1Index].tid, d2Table[auto].tid],
      positions: [d1Index + 1, auto + 1],
      tiers: [1, 2],
    };
  });
}

/**
 * The English semi-final pairings: best entrant against worst, second against
 * third.
 *
 * Returned as indices into `field.teams` so the caller keeps the seeding in one
 * place. `home` is the **lower**-seeded club because it hosts the first leg, so
 * the better league finish takes the second leg at home — the real English
 * convention.
 *
 * **That is cosmetic in this engine, and it is worth knowing why**, because the
 * real rule is not: each club hosts exactly once, so `HOME_ATTACK_BONUS`
 * cancels over the two legs, and extra time and the shootout are then played on
 * raw composites (`playExtraTime`/`playShootout` never apply the bonus). So the
 * second leg at home buys nothing here, and reversing the leg order would
 * change no result. And the final is played at a neutral venue, so it carries no
 * home advantage either. Finishing higher is therefore worth exactly one thing:
 * the tie against the lowest-placed entrant. That is deliberately a thin edge —
 * the English playoff is close to a lottery by design, which is what keeps a
 * mid-table run-in worth playing.
 */
export function semiFinalPairings(size: number): { home: number; away: number }[] {
  const out: { home: number; away: number }[] = [];
  for (let i = 0; i < size / 2; i++) out.push({ home: size - 1 - i, away: i });
  return out;
}

/** The seeded stream for one tie of one country's playoff. */
function tieRng(lid: number, season: number, d2CompId: number, round: number, tie: number) {
  return mulberry32(hashInts(lid, season, d2CompId, round, tie, PROMOTION_PLAYOFF_STREAM));
}

/**
 * Play one country's playoff, dispatched on its format.
 *
 * Every tie runs on its own seeded stream derived from
 * (lid, season, d2 competition, round, tie index) — never the shared league
 * `rng`, and never a stream any cup uses. The whole thing is therefore
 * reproducible from the league's content alone, which is what lets it be played
 * either at the offseason transition or lazily at the top of `simOffseason` and
 * come out the same.
 */
export function playPromotionPlayoff(
  field: PlayoffField,
  matchData: Map<number, TeamMatchData>,
  lid: number,
  season: number,
): PromotionPlayoff {
  const base: PromotionPlayoff = {
    season,
    country: field.country,
    d1CompId: field.d1CompId,
    d2CompId: field.d2CompId,
    format: field.format,
    teams: field.teams,
    positions: field.positions,
    tiers: field.tiers,
    autoPromoted: field.autoPromoted,
    autoRelegated: field.autoRelegated,
    ties: [],
    winnerTid: null,
  };

  // A club with no match data can't be fielded. Only reachable if a club left
  // its division between the table and here, but the tie must still produce
  // exactly one winner or the swap is left holding an undecided place.
  const canPlay = (tid: number): boolean => matchData.has(tid);
  if (!field.teams.every(canPlay)) {
    // The incumbent keeps his place when the tie cannot be played, which for
    // the German format means nobody moves and for the English one hands the
    // place to the best-placed entrant who can field a side.
    const fallback = field.format === "german"
      ? field.teams[0]
      : field.teams.find(canPlay) ?? field.teams[0];
    return { ...base, winnerTid: fallback };
  }

  if (field.format === "german") {
    // The tier-2 challenger hosts the first leg and the top-flight club the
    // second, the same way round the English bracket does it. Cosmetic here for
    // the reason semiFinalPairings sets out, so no result rests on it.
    const [topFlight, challenger] = field.teams;
    const rng = tieRng(lid, season, field.d2CompId, PLAYOFF_ROUND_FINAL, 0);
    const hd = matchData.get(challenger)!;
    const ad = matchData.get(topFlight)!;
    const leg1 = playFirstLeg(rng, challenger, topFlight, hd, ad, PLAYOFF_ROUND_FINAL);
    const tie = resolveTwoLeggedTie(rng, leg1, hd, ad, 0);
    return { ...base, ties: [{ ...tie, boxScore: null }], winnerTid: tie.winner };
  }

  const ties: CupTie[] = [];
  const finalists: number[] = [];
  semiFinalPairings(field.teams.length).forEach(({ home, away }, i) => {
    const homeTid = field.teams[home];
    const awayTid = field.teams[away];
    const rng = tieRng(lid, season, field.d2CompId, PLAYOFF_ROUND_SEMI, i);
    const hd = matchData.get(homeTid)!;
    const ad = matchData.get(awayTid)!;
    const leg1 = playFirstLeg(rng, homeTid, awayTid, hd, ad, PLAYOFF_ROUND_SEMI);
    const tie = resolveTwoLeggedTie(rng, leg1, hd, ad, 0);
    ties.push({ ...tie, boxScore: null });
    finalists.push(tie.winner);
  });

  // The better league finisher is listed first. `teams` is already in finishing
  // order, so the lower index is the higher finish.
  finalists.sort((a, b) => field.teams.indexOf(a) - field.teams.indexOf(b));
  const [finalHome, finalAway] = finalists;
  const decider = resolveCupTie(
    tieRng(lid, season, field.d2CompId, PLAYOFF_ROUND_FINAL, 0),
    finalHome,
    finalAway,
    matchData.get(finalHome)!,
    matchData.get(finalAway)!,
    PLAYOFF_ROUND_FINAL,
    0,
    // Neutral venue: England plays this at Wembley and neither finalist is at
    // home. Extra time and the shootout never applied the bonus anyway, so the
    // tie is neutral end to end.
    true,
  );
  ties.push({ ...decider, boxScore: null });

  return { ...base, ties, winnerTid: decider.winner };
}

/**
 * Play every country's promotion playoff for the season that just finished.
 *
 * **Which clubs share a normalization baseline depends on the format, and this
 * is the same lesson `cupMatchData` and the domestic cups already carry.**
 * Composites are z-normalized within the pool they are built from, so:
 *
 *  - an **English** bracket pools the tier-2 division alone, which is exactly
 *    right because all four entrants come from it — measuring them against that
 *    division is measuring them against each other;
 *  - a **German** tie pools **both divisions**, because it is cross-division. A
 *    tier-2 club measured against its own division reads as an average side and
 *    would meet a top-flight club as an equal, which would make the incumbent's
 *    advantage vanish.
 *
 * Season form is applied, because the playoff is the last act of the season it
 * decides. Suspensions are deliberately not carried in, the same call the cups
 * make: a ban is served in league matchdays and the offseason has no matchday
 * clock to serve one against. Injuries **are** honoured, since
 * `leagueMatchData` filters them for every caller.
 */
export function playPromotionPlayoffs(
  competitions: Competition[],
  teams: StoredTeam[],
  players: Player[],
  tablesByCompId: Map<number, StandingsRow[]>,
  lid: number,
  season: number,
): PromotionPlayoff[] {
  const fields = promotionPlayoffFields(competitions, tablesByCompId);
  if (fields.length === 0) return [];

  return fields.map((field) => {
    const pool = field.format === "german"
      ? new Set([field.d1CompId, field.d2CompId])
      : new Set([field.d2CompId]);
    const poolTeams = teams.filter((t) => pool.has(t.compId));
    const data = leagueMatchData({
      teams: poolTeams.map((t) => ({
        tid: t.tid,
        name: t.name,
        roster: t.roster,
        avgOvr: 0,
        academyBase: t.academyBase,
        compId: t.compId,
        starters: t.starters,
        formation: t.formation,
        moreMinutes: t.moreMinutes,
      })),
      players,
    });
    const matchData = new Map<number, TeamMatchData>();
    poolTeams.forEach((t, i) => {
      const delta = teamSeasonFormDelta(lid, season, t.tid);
      const d = data[i];
      matchData.set(t.tid, delta === 0 ? d : {
        ...d,
        composites: applySeasonForm(d.composites, delta),
        recompute: (onPitch) => applySeasonForm(d.recompute(onPitch), delta),
      });
    });
    return playPromotionPlayoff(field, matchData, lid, season);
  });
}

/**
 * What a played playoff does to its country's swap.
 *
 * The two formats reach the table differently, which is why this exists rather
 * than a bare map of winners: an English playoff always sends one extra club up
 * and changes relegation not at all, while a German one either swaps a pair or
 * moves nobody, cutting *both* sides of the swap by one when the incumbent
 * holds on. Either way the two counts stay equal, so division sizes hold.
 */
export interface PlayoffOutcome {
  /**
   * Which system decided it. The swap derives its own automatic counts from
   * this and the country's *current* promotion places, rather than trusting
   * counts carried on the record.
   *
   * That is deliberate and it is a correctness guard, not a style choice. The
   * record is computed at the season boundary and read during the offseason, so
   * a caller that changes a country's `promotionSpots` in between (tests do; a
   * save cannot) would otherwise hand the swap counts that disagree with the
   * tables — and the swap would promote and relegate different numbers of
   * clubs, changing the division sizes everything rests on. Deriving keeps one
   * source of truth for N, which is the same reason `effectivePromotionSpots`
   * exists at all.
   */
  format: PlayedPlayoffFormat;
  /** The extra club the playoff promotes, or null if it promoted nobody. */
  promotedTid: number | null;
  /** The extra club the playoff relegates, or null. Always null for English. */
  relegatedTid: number | null;
}

/**
 * Each played playoff's effect on the table, keyed by the tier-2 competition.
 *
 * A playoff still in progress (no winner) is skipped, so the swap falls back to
 * the plain top-N slice rather than leaving a place undecided.
 */
export function playoffOutcomes(playoffs: PromotionPlayoff[]): Map<number, PlayoffOutcome> {
  const out = new Map<number, PlayoffOutcome>();
  for (const p of playoffs) {
    if (p.winnerTid === null) continue;
    if (p.format === "german") {
      // teams[0] is the top-flight incumbent, teams[1] the challenger.
      const challengerWon = p.winnerTid === p.teams[1];
      out.set(p.d2CompId, {
        format: "german",
        promotedTid: challengerWon ? p.teams[1] : null,
        relegatedTid: challengerWon ? p.teams[0] : null,
      });
      continue;
    }
    out.set(p.d2CompId, {
      format: "english", promotedTid: p.winnerTid, relegatedTid: null,
    });
  }
  return out;
}

/** The playoffs held for `season`, or [] if none were (or the save predates them). */
export function playoffsForSeason(
  playoffs: PromotionPlayoff[] | undefined,
  season: number,
): PromotionPlayoff[] {
  return (playoffs ?? []).filter((p) => p.season === season);
}
