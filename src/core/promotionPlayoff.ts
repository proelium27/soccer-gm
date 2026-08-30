import type { StandingsRow } from "./standings.js";
import type { StoredTeam } from "./teams/clubs.js";
import type { Player } from "./players/types.js";
import type { Competition } from "./competitions.js";
import type { TeamMatchData } from "./league/composites.js";
import type { CupTie } from "./cup/types.js";
import { tier1Pairs, effectivePromotionSpots } from "./competitions.js";
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

/** Semi-final round index within `PromotionPlayoff.ties`. */
export const PLAYOFF_ROUND_SEMI = 0;
/** Final round index within `PromotionPlayoff.ties`. */
export const PLAYOFF_ROUND_FINAL = 1;

/**
 * One country's promotion playoff: the four clubs that finished just below the
 * automatic promotion places fight for the last spot in the top flight.
 *
 * Played inside the offseason, on end-of-season squads, and stored on the
 * season-history entry for the season it decides. Box scores are deliberately
 * **never** kept — the whole world plays 36 of these ties a season and a save
 * keeps its history forever, so scorelines are the record (see CLAUDE.md's
 * save-size section for what happens when that rule is relaxed).
 */
export interface PromotionPlayoff {
  /** The season just finished — the one whose tier-2 table seeded this. */
  season: number;
  country: string;
  /** The competition the winner is promoted into. */
  d1CompId: number;
  /** The competition the four entrants came from. */
  d2CompId: number;
  /**
   * The four entrants, best league finish first: tier-2 positions
   * `autoSpots + 1` through `autoSpots + 4`.
   */
  teams: number[];
  /** Each entrant's 1-based tier-2 finishing position, index-aligned with `teams`. */
  positions: number[];
  /** How many clubs went up automatically, i.e. this playoff decides place `autoSpots + 1`. */
  autoSpots: number;
  /**
   * Two semi-finals (round 0, two legs) then the final (round 1, one leg).
   * `boxScore` is always null — see the interface note.
   */
  ties: CupTie[];
  /** The club promoted. Null only while the playoff is still being played. */
  winnerTid: number | null;
}

/** One country's playoff field, worked out from its tier-2 table. */
export interface PlayoffField {
  country: string;
  d1CompId: number;
  d2CompId: number;
  autoSpots: number;
  /** The four entrants, best league finish first. */
  teams: number[];
  positions: number[];
}

/**
 * Which countries hold a promotion playoff this season, and who is in it.
 *
 * A country qualifies when it has two divisions, gives out **at least two**
 * promotion places, and has enough clubs below the automatic places to fill the
 * bracket. The two-place floor is the load-bearing rule: with a single place the
 * only "English style" bracket available would be positions 1-4, which takes
 * promotion away from the champion rather than deciding a spare place. Scotland
 * (one place) therefore keeps its straight single promotion.
 *
 * `autoSpots` is `effectivePromotionSpots - 1`, so the total number of clubs
 * going up is unchanged — the playoff redistributes the last place, it never
 * creates one. That matters beyond tidiness: every division's size is fixed, so
 * a country promoting one extra club would have to relegate one extra too.
 */
export function promotionPlayoffFields(
  competitions: Competition[],
  tablesByCompId: Map<number, StandingsRow[]>,
): PlayoffField[] {
  return tier1Pairs(competitions).flatMap(({ d1, d2 }) => {
    if (!d2) return [];
    const d1Table = tablesByCompId.get(d1.id);
    const d2Table = tablesByCompId.get(d2.id);
    if (!d1Table || !d2Table) return [];
    const spots = effectivePromotionSpots(d1, d2, d1Table.length, d2Table.length);
    if (spots < 2) return [];
    const autoSpots = spots - 1;
    // 1-based positions autoSpots+1 .. autoSpots+PROMOTION_PLAYOFF_SEMI_FINALS*2, i.e.
    // array indices autoSpots .. autoSpots+3. A division too short to seat all
    // four holds no playoff rather than a smaller one, so the bracket shape is
    // the same everywhere it runs.
    const size = PROMOTION_PLAYOFF_SEMI_FINALS * 2;
    if (d2Table.length < autoSpots + size) return [];
    const entrants = d2Table.slice(autoSpots, autoSpots + size);
    return {
      country: d1.country,
      d1CompId: d1.id,
      d2CompId: d2.id,
      autoSpots,
      teams: entrants.map((r) => r.tid),
      positions: entrants.map((_, i) => autoSpots + 1 + i),
    };
  });
}

/**
 * The semi-final pairings: best entrant against worst, second against third.
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
 * change no result. Finishing higher is worth exactly two things: the tie
 * against the lowest-placed entrant, and home advantage in the one-off final.
 */
export function semiFinalPairings(size: number): { home: number; away: number }[] {
  const out: { home: number; away: number }[] = [];
  for (let i = 0; i < size / 2; i++) out.push({ home: size - 1 - i, away: i });
  return out;
}

/**
 * Play one country's playoff: both two-legged semi-finals, then the final.
 *
 * Every tie runs on its own seeded stream derived from
 * (lid, season, d2 competition, round, tie index) — never the shared league
 * `rng`, and never a stream any cup uses. The whole thing is therefore
 * reproducible from the league's content alone, which is what lets it be played
 * either at the offseason transition or lazily at the top of `simOffseason` and
 * come out the same.
 *
 * The final is single-leg with the better league finisher at home. There is no
 * neutral venue in the engine (`HOME_ATTACK_BONUS` is unconditional), so rather
 * than pretend, the home tie goes to whoever finished higher — which is the
 * league season still counting for something at the last.
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
    teams: field.teams,
    positions: field.positions,
    autoSpots: field.autoSpots,
    ties: [],
    winnerTid: null,
  };

  // A club with no match data can't be fielded. Only reachable if a club left
  // the division between the table and here, but every tie must still produce
  // exactly one winner or the final is drawn from the wrong number of clubs.
  const canPlay = (tid: number): boolean => matchData.has(tid);
  if (!field.teams.every(canPlay)) {
    const survivor = field.teams.find(canPlay) ?? field.teams[0];
    return { ...base, winnerTid: survivor };
  }

  const ties: CupTie[] = [];
  const finalists: number[] = [];
  semiFinalPairings(field.teams.length).forEach(({ home, away }, i) => {
    const homeTid = field.teams[home];
    const awayTid = field.teams[away];
    const rng = mulberry32(
      hashInts(lid, season, field.d2CompId, PLAYOFF_ROUND_SEMI, i, PROMOTION_PLAYOFF_STREAM),
    );
    const hd = matchData.get(homeTid)!;
    const ad = matchData.get(awayTid)!;
    const leg1 = playFirstLeg(rng, homeTid, awayTid, hd, ad, PLAYOFF_ROUND_SEMI);
    const tie = resolveTwoLeggedTie(rng, leg1, hd, ad, 0);
    ties.push({ ...tie, boxScore: null });
    finalists.push(tie.winner);
  });

  // The better league finisher hosts. `teams` is already in finishing order, so
  // the lower index is the higher finish.
  finalists.sort((a, b) => field.teams.indexOf(a) - field.teams.indexOf(b));
  const [finalHome, finalAway] = finalists;
  const finalRng = mulberry32(
    hashInts(lid, season, field.d2CompId, PLAYOFF_ROUND_FINAL, 0, PROMOTION_PLAYOFF_STREAM),
  );
  const decider = resolveCupTie(
    finalRng,
    finalHome,
    finalAway,
    matchData.get(finalHome)!,
    matchData.get(finalAway)!,
    PLAYOFF_ROUND_FINAL,
    0,
  );
  ties.push({ ...decider, boxScore: null });

  return { ...base, ties, winnerTid: decider.winner };
}

/**
 * Play every country's promotion playoff for the season that just finished.
 *
 * Composites are z-normalized **within the tier-2 competition** — which is
 * exactly right here and is why this needs no pooling of the kind the cups do:
 * all four entrants come from that one division, so measuring them against it
 * is measuring them against each other. Season form is applied, because the
 * playoff is the last act of the season it decides, not a separate competition.
 *
 * Suspensions are deliberately not carried in. A ban is served in league
 * matchdays and there is no matchday clock in the offseason to serve one
 * against — the same call the cups make. Injuries **are** honoured, since
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
    const divisionTeams = teams.filter((t) => t.compId === field.d2CompId);
    const data = leagueMatchData({
      teams: divisionTeams.map((t) => ({
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
    divisionTeams.forEach((t, i) => {
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
 * Each playoff's winner, keyed by the tier-2 competition he is promoted out of
 * — the shape `computeCountrySwaps` consumes. A playoff still in progress (no
 * winner) is skipped, so the swap falls back to the plain table order rather
 * than promoting nobody.
 */
export function playoffWinnersByCompId(playoffs: PromotionPlayoff[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const p of playoffs) {
    if (p.winnerTid !== null) out.set(p.d2CompId, p.winnerTid);
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
