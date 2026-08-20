import type { Player, SeasonStats } from "./players/types.js";
import type { Competition } from "./competitions.js";
import type { CupState } from "./cup/types.js";
import type { CupStatLine } from "./cup/cupStats.js";
import { cupStatsByPid, cupAvgRating } from "./cup/cupStats.js";
import { cupRoundsFromFinal } from "./cup/cup.js";
import type { DomesticCupState } from "./domesticCup/types.js";
import { domesticStatsByPid } from "./domesticCup/stats.js";
import { FORMATIONS } from "./lineup/formations.js";
import { RATING_BASELINE } from "../engine/matchRating.js";
import {
  type PositionGroup,
  positionGroup, statsFor, ovrDuringSeason, potyScore, totsScore,
} from "./awards.js";
import {
  AWARD_MIN_APPEARANCES, AWARD_OVR_BASELINE, BALLON_DOR_SHORTLIST, WORLD_AWARD_OVR_WEIGHT,
  POTY_GOAL_WEIGHT, POTY_ASSIST_WEIGHT, TOTS_GOAL_WEIGHT, TOTS_ASSIST_WEIGHT,
  WORLD_AWARD_LEAGUE_STRENGTH_WEIGHT, WORLD_AWARD_CUP_MULTIPLIER,
  WORLD_AWARD_CUP_RATING_WEIGHT, WORLD_AWARD_CUP_FULL_INVOLVEMENT, WORLD_AWARD_CUP_RUN_BONUS,
  WORLD_AWARD_LEAGUE_TITLE_BONUS, WORLD_AWARD_TITLE_FULL_SEASON, WORLD_AWARD_INTL_GOAL_WEIGHT, WORLD_AWARD_INTL_ASSIST_WEIGHT,
  WORLD_AWARD_INTL_CAP_WEIGHT, WORLD_AWARD_INTL_TOURNAMENT_MULTIPLIER, WORLD_AWARD_WORLD_CUP_BONUS,
  WORLD_AWARD_DOMESTIC_CUP_BONUS, WORLD_AWARD_DOMESTIC_CUP_FULL_INVOLVEMENT,
  WORLD_AWARD_INTL_CONFEDERATION_CUP_MULTIPLIER, WORLD_AWARD_CONFEDERATION_CUP_BONUS,
} from "./constants.js";

/**
 * One player's Ballon d'Or case, broken into the parts that made it up so the
 * award page can show *why* he won rather than just a number.
 */
export interface BallonDOrEntry {
  pid: number;
  /** Club he finished the season at (SeasonStats.tid), for display after he later moves. */
  tid: number;
  score: number;
  /** Domestic league season, league-strength corrected, including both ovr terms (AWARD_OVR_WEIGHT + WORLD_AWARD_OVR_WEIGHT). */
  league: number;
  /** Continental Cup: his own end product and rating there, plus how far his club went. */
  cup: number;
  /** The offseason's international campaign, plus a World Cup winner's bonus. */
  intl: number;
  /** Winning his own domestic league. */
  title: number;
  /**
   * Winning his own domestic cup, pro-rated by ties played. **Optional**: every
   * WorldAwards entry persisted before domestic cups existed lacks it, and
   * their `score` was computed without it, so readers default it to 0 rather
   * than treating its absence as a bug. A required field would have made every
   * one of those stored entries fail to typecheck for no gain.
   */
  domesticCup?: number;
}

/** One completed season's worldwide honors, stored on SeasonHistoryEntry alongside the per-competition ones. */
export interface WorldAwards {
  /** The ranking, best first, up to BALLON_DOR_SHORTLIST. `[0]` is the winner; empty if nobody was eligible. */
  ballonDOr: BallonDOrEntry[];
  /** 11 pids (or null where no eligible player existed), index-aligned with FORMATIONS["4-3-3"]. */
  worldTeamOfYear: (number | null)[];
}

/**
 * Everything outside the players themselves that a worldwide award needs. All
 * of it is either already snapshotted on a SeasonHistoryEntry or derivable from
 * the archived cup, so past seasons can be scored exactly like fresh ones (see
 * migrate.ts's backfill).
 */
export interface WorldAwardContext {
  /** tid → compId *during the season being judged* (SeasonHistoryEntry.compsByTid). */
  compsByTid: Record<number, number>;
  competitions: Competition[];
  /** compId → champion tid, tier-1 only (SeasonHistoryEntry.championTidByCompId). */
  championTidByCompId: Record<number, number>;
  /** The Continental Cup played *during* that season, or null (season 1, or a world too small for one). */
  cup: CupState | null;
  /**
   * That season's domestic cups, one per country. Optional and defaulted to
   * empty: a save from before domestic cups existed has none for its past
   * seasons, and the backfill scores them the same way it always did.
   */
  domesticCups?: DomesticCupState[];
  /** Nation that won the World Cup in the offseason right after that season, or null (a qualifying year). */
  worldCupChampion: string | null;
  /**
   * Nations that won a confederation cup in that same offseason — the
   * Euro, Copa America and AFCON are all played at once, so this is a set
   * rather than one nation. Empty in the three offseasons of four that stage
   * none. Optional so an older caller that doesn't supply it simply scores no
   * confederation cup credit rather than failing to compile.
   */
  confederationCupChampions?: ReadonlySet<string>;
}

interface Entry {
  player: Player;
  stats: SeasonStats;
  group: PositionGroup;
  /** The competition he played that season in (SeasonStats records the club, not the league). */
  compId: number;
  /** The ovr he actually played the season with — see awards.ts's ovrDuringSeason. */
  ovr: number;
  cupLine: CupStatLine | undefined;
  /** Rating-unit correction for how strong his competition was — see leagueStrengthOffsets. */
  strength: number;
}

/**
 * How much to add to (or subtract from) a player's rating-based score for the
 * competition he played in, keyed by compId.
 *
 * Match ratings are z-normalized *within* each competition, so every league's
 * average player rates ~6.0 no matter how good that league actually is. Left
 * uncorrected, a worldwide award would systematically favour the weakest
 * leagues, where a good player stands further above his peers. The correction
 * is each competition's mean ovr relative to the world's, converted into rating
 * units by WORLD_AWARD_LEAGUE_STRENGTH_WEIGHT.
 *
 * Ovr is the right yardstick here precisely because it is *not* normalized: it
 * is the one player number that means the same thing in every league.
 */
function leagueStrengthOffsets(entries: Entry[]): Map<number, number> {
  const sums = new Map<number, { total: number; count: number }>();
  let worldTotal = 0;
  let worldCount = 0;
  for (const e of entries) {
    const bucket = sums.get(e.compId) ?? { total: 0, count: 0 };
    bucket.total += e.ovr;
    bucket.count++;
    sums.set(e.compId, bucket);
    worldTotal += e.ovr;
    worldCount++;
  }
  const worldMean = worldCount > 0 ? worldTotal / worldCount : 0;
  const offsets = new Map<number, number>();
  for (const [compId, bucket] of sums) {
    offsets.set(compId, (bucket.total / bucket.count - worldMean) * WORLD_AWARD_LEAGUE_STRENGTH_WEIGHT);
  }
  return offsets;
}

/**
 * A player's Continental Cup contribution. Goals and assists use the same
 * position weights as the domestic award, scaled up by WORLD_AWARD_CUP_MULTIPLIER;
 * his cup rating and his club's run are pro-rated by how much of the campaign he
 * actually played, so a bit-part player doesn't collect a full winner's share.
 *
 * The rating term takes no league-strength correction: cup matches normalize
 * against the whole pooled field, so they're already on one scale.
 */
function cupComponent(
  e: Entry,
  roundsFromFinal: Map<number, number>,
  goalWeight: Record<PositionGroup, number>,
  assistWeight: Record<PositionGroup, number>,
): number {
  const line = e.cupLine;
  if (!line || line.appearances === 0) return 0;
  const involvement = Math.min(1, line.appearances / WORLD_AWARD_CUP_FULL_INVOLVEMENT);
  let score =
    (line.goals * goalWeight[e.group] + line.assists * assistWeight[e.group]) * WORLD_AWARD_CUP_MULTIPLIER;
  const avg = cupAvgRating(line);
  if (avg !== null) score += (avg - RATING_BASELINE) * WORLD_AWARD_CUP_RATING_WEIGHT * involvement;
  const rounds = roundsFromFinal.get(e.stats.tid);
  if (rounds !== undefined) score += (WORLD_AWARD_CUP_RUN_BONUS[rounds] ?? 0) * involvement;
  return score;
}

/**
 * A player's international contribution: everything he played in the offseason
 * straight after this season (see core/international). Knockout football counts
 * for more than a qualifier — a World Cup goal is worth double a qualifying one
 * and a confederation cup goal one and a half times — and a winner's
 * medal is worth a flat bonus on top of that.
 *
 * **Every line for the season is summed, not just the first.** The offseason
 * that stages the confederation cups also plays a World Cup qualifying
 * leg, so a player can hold two lines for one season; taking the first would
 * silently drop whichever campaign happened to be appended second. (Before the
 * championships existed there was only ever one line, so this was a latent
 * problem rather than a live one.)
 *
 * Reads Player.intl.seasons, which only exists from the save where per-campaign
 * lines started being recorded; older saves simply score zero here rather than
 * guessing from career totals.
 */
function intlComponent(
  p: Player,
  season: number,
  worldCupChampion: string | null,
  confederationCupChampions: ReadonlySet<string>,
): number {
  const lines = p.intl?.seasons.filter((l) => l.season === season) ?? [];
  let score = 0;
  for (const line of lines) {
    const multiplier = line.kind === "tournament"
      ? WORLD_AWARD_INTL_TOURNAMENT_MULTIPLIER
      : line.kind === "confederation"
        ? WORLD_AWARD_INTL_CONFEDERATION_CUP_MULTIPLIER
        : 1;
    score +=
      (line.goals * WORLD_AWARD_INTL_GOAL_WEIGHT +
        line.assists * WORLD_AWARD_INTL_ASSIST_WEIGHT +
        line.caps * WORLD_AWARD_INTL_CAP_WEIGHT) * multiplier;
    // A medal counts only for a player who actually featured, so a squad
    // member who never got on doesn't collect one.
    if (line.caps === 0) continue;
    if (line.kind === "tournament" && worldCupChampion !== null && p.nationality === worldCupChampion) {
      score += WORLD_AWARD_WORLD_CUP_BONUS;
    }
    if (line.kind === "confederation" && confederationCupChampions.has(p.nationality)) {
      score += WORLD_AWARD_CONFEDERATION_CUP_BONUS;
    }
  }
  return score;
}

/** The confederation cup champions on a context, defaulting to none. */
const NO_CHAMPIONS: ReadonlySet<string> = new Set();

/**
 * The extra ovr weight the worldwide awards apply on top of the one already
 * baked into potyScore/totsScore — see WORLD_AWARD_OVR_WEIGHT for why it's a
 * separate constant rather than a bigger AWARD_OVR_WEIGHT.
 *
 * Uses the same AWARD_OVR_BASELINE, so it's a straight continuation of the same
 * line rather than a second, differently-shaped term.
 */
function worldOvrComponent(e: Entry): number {
  return (e.ovr - AWARD_OVR_BASELINE) * WORLD_AWARD_OVR_WEIGHT;
}

/** Winning your own league, pro-rated by how much of the season you played. Tier-2 titles aren't in championTidByCompId, so they score nothing. */
function titleComponent(e: Entry, championTidByCompId: Record<number, number>): number {
  if (championTidByCompId[e.compId] !== e.stats.tid) return 0;
  return WORLD_AWARD_LEAGUE_TITLE_BONUS * Math.min(1, e.stats.appearances / WORLD_AWARD_TITLE_FULL_SEASON);
}

/**
 * Winning your own domestic cup, pro-rated by ties played.
 *
 * A **team** term, like the league title above and unlike the Continental Cup
 * component: no domestic cup goals, assists or ratings enter the award. Those
 * ratings normalize within one country, so they carry exactly the weak-league
 * bias `leagueStrengthOffsets` exists to remove, and there is no equivalent
 * correction available for them. A flat squad bonus has no such bias.
 *
 * Pro-rated on domestic cup appearances rather than league ones, because the
 * question is what he did in *this* competition — a man who played every league
 * game and no cup ties didn't win it.
 *
 * Second-tier winners count. A tier-2 club really can win the thing, and unlike
 * a tier-2 league title (which `championTidByCompId` excludes by construction)
 * there is no weaker version of this trophy to confuse it with.
 */
function domesticCupComponent(
  e: Entry,
  champions: ReadonlySet<number>,
  lines: Map<number, CupStatLine>,
): number {
  if (!champions.has(e.stats.tid)) return 0;
  const appearances = lines.get(e.player.pid)?.appearances ?? 0;
  return WORLD_AWARD_DOMESTIC_CUP_BONUS
    * Math.min(1, appearances / WORLD_AWARD_DOMESTIC_CUP_FULL_INVOLVEMENT);
}

/**
 * The Ballon d'Or score: a POTY-style domestic season on a worldwide scale,
 * plus the cross-league competitions the domestic award can't see.
 */
function ballonDOrParts(
  e: Entry,
  season: number,
  ctx: WorldAwardContext,
  roundsFromFinal: Map<number, number>,
  domesticChampions: ReadonlySet<number>,
  domesticLines: Map<number, CupStatLine>,
): BallonDOrEntry {
  // The ovr terms fold into `league` rather than becoming a fifth part: the UI
  // already labels that column as including an ovr term, and adding a field
  // would break WorldAwards entries already persisted on old saves.
  const league = potyScore(e.player, e.stats, season) + e.strength + worldOvrComponent(e);
  const cup = cupComponent(e, roundsFromFinal, POTY_GOAL_WEIGHT, POTY_ASSIST_WEIGHT);
  const intl = intlComponent(e.player, season, ctx.worldCupChampion, ctx.confederationCupChampions ?? NO_CHAMPIONS);
  const title = titleComponent(e, ctx.championTidByCompId);
  const domesticCup = domesticCupComponent(e, domesticChampions, domesticLines);
  return {
    pid: e.player.pid, tid: e.stats.tid,
    score: league + cup + intl + title + domesticCup,
    league, cup, intl, title, domesticCup,
  };
}

/**
 * The World Team of the Year score: the same worldwide adjustments, but built
 * on the Team-of-the-Season formula, which credits defensive work and clean
 * sheets so defenders and keepers can win their slots on merit.
 */
function worldTotsScore(
  e: Entry,
  season: number,
  ctx: WorldAwardContext,
  roundsFromFinal: Map<number, number>,
  domesticChampions: ReadonlySet<number>,
  domesticLines: Map<number, CupStatLine>,
): number {
  return totsScore(e.player, e.stats, season)
    + e.strength
    + worldOvrComponent(e)
    + cupComponent(e, roundsFromFinal, TOTS_GOAL_WEIGHT, TOTS_ASSIST_WEIGHT)
    + intlComponent(e.player, season, ctx.worldCupChampion, ctx.confederationCupChampions ?? NO_CHAMPIONS)
    + titleComponent(e, ctx.championTidByCompId)
    + domesticCupComponent(e, domesticChampions, domesticLines);
}

function pickWorldTeam(
  entries: Entry[],
  scores: Map<number, number>,
): (number | null)[] {
  const used = new Set<number>();
  return FORMATIONS["4-3-3"].map((slotPos) => {
    let best: Entry | null = null;
    let bestScore = 0;
    for (const e of entries) {
      if (e.player.pos !== slotPos || used.has(e.player.pid)) continue;
      // Qualified players always outrank unqualified ones, so a thin position
      // still fills its slot rather than going empty (same rule as the
      // per-competition Team of the Season).
      const score = (e.stats.appearances >= AWARD_MIN_APPEARANCES ? 1000 : 0) + scores.get(e.player.pid)!;
      if (best === null || score > bestScore) {
        best = e;
        bestScore = score;
      }
    }
    if (best === null) return null;
    used.add(best.player.pid);
    return best.player.pid;
  });
}

/**
 * Compute a completed season's worldwide honors — the Ballon d'Or ranking and
 * the World Team of the Year — from every player in the world who featured that
 * season, however many competitions they're spread across.
 *
 * Pure and re-runnable, exactly like computeSeasonAwards: it reads only
 * append-only records (Player.stats / Player.hist / Player.intl.seasons) plus a
 * context of things already snapshotted per season, so it can be run for any
 * past season — used both by simOffseason (fresh) and migrateLeague (backfill).
 * No rng of any kind.
 */
export function computeWorldAwards(
  players: Player[],
  season: number,
  ctx: WorldAwardContext,
): WorldAwards {
  const cupLines = ctx.cup ? cupStatsByPid(ctx.cup) : new Map<number, CupStatLine>();
  const roundsFromFinal = ctx.cup ? cupRoundsFromFinal(ctx.cup) : new Map<number, number>();
  // Domestic cups: who won each country's, and how many ties each player made.
  // Both empty on a save whose past seasons predate domestic cups, which scores
  // exactly as it did before the competition existed.
  const domesticCups = ctx.domesticCups ?? [];
  const domesticChampions = new Set<number>(
    domesticCups.map((c) => c.championTid).filter((tid): tid is number => tid !== null),
  );
  const domesticLines = domesticStatsByPid(domesticCups);

  const entries: Entry[] = [];
  for (const player of players) {
    const stats = statsFor(player, season);
    if (!stats || stats.appearances === 0) continue;
    const compId = ctx.compsByTid[stats.tid];
    // A club with no competition recorded for that season (a tid that no longer
    // exists, or history from before compsByTid was snapshotted) can't be placed
    // on the world scale, so it sits out rather than being scored uncorrected.
    if (compId === undefined) continue;
    entries.push({
      player,
      stats,
      group: positionGroup(player.pos),
      compId,
      ovr: ovrDuringSeason(player, season),
      cupLine: cupLines.get(player.pid),
      strength: 0,
    });
  }
  if (entries.length === 0) return { ballonDOr: [], worldTeamOfYear: FORMATIONS["4-3-3"].map(() => null) };

  const offsets = leagueStrengthOffsets(entries);
  for (const e of entries) e.strength = offsets.get(e.compId) ?? 0;

  // Ballon d'Or: a full season's worth of appearances is the bar, but if a world
  // is small or short enough that nobody clears it, everyone who played is
  // considered rather than leaving the award vacant.
  const qualified = entries.filter((e) => e.stats.appearances >= AWARD_MIN_APPEARANCES);
  const pool = qualified.length > 0 ? qualified : entries;
  const ranked = pool
    .map((e) => ({
      entry: e,
      parts: ballonDOrParts(e, season, ctx, roundsFromFinal, domesticChampions, domesticLines),
    }))
    // Ties break on end product, then pid — the same order the per-competition
    // Player of the Season uses, so both awards resolve a dead heat identically.
    .sort((a, b) => {
      if (b.parts.score !== a.parts.score) return b.parts.score - a.parts.score;
      const ga = b.entry.stats.goals + b.entry.stats.assists
        - (a.entry.stats.goals + a.entry.stats.assists);
      return ga !== 0 ? ga : a.parts.pid - b.parts.pid;
    })
    .slice(0, BALLON_DOR_SHORTLIST)
    .map((x) => x.parts);

  const totyScores = new Map<number, number>();
  for (const e of entries) {
    totyScores.set(
      e.player.pid,
      worldTotsScore(e, season, ctx, roundsFromFinal, domesticChampions, domesticLines),
    );
  }

  return { ballonDOr: ranked, worldTeamOfYear: pickWorldTeam(entries, totyScores) };
}
