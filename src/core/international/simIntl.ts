import type { BoxScore } from "../../engine/attribution.js";
import type { TeamMatchData } from "../league/composites.js";
import type { CupTie } from "../cup/types.js";
import type { IntlGroup } from "./types.js";
import { simMatchDetailed } from "../../engine/matchSim.js";
import { resolveCupTie } from "../cup/simCup.js";
import { mulberry32, hashInts } from "../../engine/rng.js";
import { INTL_GROUPS, INTL_QUALIFY_PER_GROUP } from "../constants.js";
import { groupTable } from "./groups.js";

/**
 * rng-stream tags for international football. Every international match runs on
 * a stream seeded from (lid, season, tag) and NEVER on the league's shared rng —
 * the sim is seeded and deterministic, so a single extra draw taken from the
 * shared stream would shift every downstream club result in the save. This is
 * the same discipline the Continental Cup follows.
 */
const QUALIFYING_STREAM = 800;
const GROUP_STREAM = 810;
const KNOCKOUT_STREAM = 820;

/** International appearances/goals/assists gathered from a campaign's box scores. */
export type CareerDelta = Map<number, { caps: number; goals: number; assists: number }>;

export function emptyCareerDelta(): CareerDelta {
  return new Map();
}

/**
 * Fold `source` into `target` in place. A staged campaign produces one delta per
 * stage; the bulk path plays every stage into a single delta by merging, so a
 * click-through and a one-pass sim credit exactly the same caps/goals/assists.
 */
export function mergeCareerDelta(target: CareerDelta, source: CareerDelta): void {
  for (const [pid, s] of source) {
    const t = target.get(pid) ?? { caps: 0, goals: 0, assists: 0 };
    target.set(pid, { caps: t.caps + s.caps, goals: t.goals + s.goals, assists: t.assists + s.assists });
  }
}

/**
 * Fold one match's attribution into a career delta. A player has a box-score
 * line only if he actually featured, so a line is exactly one cap — the same
 * rule simThrough uses to count a club appearance.
 */
export function accumulate(delta: CareerDelta, box: BoxScore): void {
  for (const line of [...box.home, ...box.away]) {
    const entry = delta.get(line.pid) ?? { caps: 0, goals: 0, assists: 0 };
    entry.caps++;
    entry.goals += line.goals;
    entry.assists += line.assists;
    delta.set(line.pid, entry);
  }
}

/**
 * Add the pids that picked up an injury in this match to `injured`. Collected
 * only so the injury can be *carried into the club season* at the offseason
 * rollover — it is never stamped on the player mid-campaign, so it can't change
 * which international match a nation's XI plays or any scoreline (the same
 * post-hoc discipline as career caps). Injuries are surfaced as box-score
 * events by the match sim exactly as in a league game.
 */
export function collectInjured(box: BoxScore, injured: Set<number>): void {
  for (const e of box.events) if (e.type === "injury") injured.add(e.pids[0]);
}

/**
 * Play every unplayed match in `groups`, in full, on one seeded stream.
 * Group games are 90' only and may end level — no extra time, no shootout.
 *
 * `keepBoxScores` controls whether the per-match attribution is retained on the
 * fixture. Qualifying discards it (a campaign is ~80 matches and a long dynasty
 * plays dozens of campaigns; the career totals folded into `delta` are the
 * lasting record), while a tournament keeps it so its matches stay browsable.
 */
export function playGroups(
  groups: IntlGroup[],
  matchData: Map<number, TeamMatchData>,
  lid: number,
  season: number,
  stream: number,
  keepBoxScores: boolean,
  delta: CareerDelta,
  injured: Set<number>,
): IntlGroup[] {
  const rng = mulberry32(hashInts(lid, season, stream, 30));
  return groups.map((group) => ({
    ...group,
    matches: group.matches.map((m) => {
      if (m.homeGoals >= 0) return m;
      const hd = matchData.get(m.home);
      const ad = matchData.get(m.away);
      if (!hd || !ad) return m; // defensive: every entrant should be in matchData
      const result = simMatchDetailed(rng, hd.composites, ad.composites, hd.xi, ad.xi, hd.bench, ad.bench, {
        recompute: { home: hd.recompute, away: ad.recompute },
      });
      accumulate(delta, result.boxScore);
      collectInjured(result.boxScore, injured);
      return {
        ...m,
        homeGoals: result.home,
        awayGoals: result.away,
        boxScore: keepBoxScores ? result.boxScore : null,
      };
    }),
  }));
}

export const QUALIFYING_GROUP_STREAM = QUALIFYING_STREAM;
export const TOURNAMENT_GROUP_STREAM = GROUP_STREAM;

/**
 * Seed the knockout bracket from completed tournament groups: each group's top
 * INTL_QUALIFY_PER_GROUP advance, paired so that a group winner always meets a
 * runner-up from a different group in the quarter-finals (A1-B2, C1-D2, B1-A2,
 * D1-C2) and two nations from the same group can only meet again in the final.
 * Returns the eight nids in bracket order — consecutive pairs are ties.
 */
export function seedBracket(groups: IntlGroup[]): number[] {
  const advancing = groups.map((g) => groupTable(g).slice(0, INTL_QUALIFY_PER_GROUP).map((r) => r.nid));
  const winner = (g: number): number => advancing[g][0];
  const runnerUp = (g: number): number => advancing[g][1];
  const bracket: number[] = [];
  // Pair group g's winner with the runner-up of its partner group (0↔1, 2↔3),
  // then the mirror pairing, so the two halves of the draw stay separated.
  for (let pair = 0; pair < INTL_GROUPS / 2; pair++) {
    const a = pair * 2;
    const b = a + 1;
    bracket.push(winner(a), runnerUp(b));
    bracket.push(winner(b), runnerUp(a));
  }
  return bracket;
}

/**
 * Play exactly one knockout round — every tie between consecutive pairs of the
 * current `field` — and return the round's ties plus the nids that advanced.
 * `round` picks the seeded stream (`KNOCKOUT_STREAM + round`), so a round plays
 * identically whether it is reached in one bulk pass or one user click at a
 * time: the staged offseason and the bulk `playKnockout` share this function and
 * therefore always agree. Each tie is decided by the Continental Cup's own
 * `resolveCupTie` — 90', extra time if level, shootout if still level.
 * `matchday` is 0 on every tie: international football sits outside the club
 * calendar entirely.
 */
export function playKnockoutRound(
  field: number[],
  matchData: Map<number, TeamMatchData>,
  lid: number,
  season: number,
  round: number,
  delta: CareerDelta,
  injured: Set<number>,
): { ties: CupTie[]; winners: number[] } {
  const rng = mulberry32(hashInts(lid, season, KNOCKOUT_STREAM + round, 30));
  const ties: CupTie[] = [];
  const winners: number[] = [];
  for (let i = 0; i + 1 < field.length; i += 2) {
    const home = field[i];
    const away = field[i + 1];
    const hd = matchData.get(home);
    const ad = matchData.get(away);
    if (!hd || !ad) continue; // defensive
    const tie = resolveCupTie(rng, home, away, hd, ad, round, 0);
    accumulate(delta, tie.boxScore);
    collectInjured(tie.boxScore, injured);
    ties.push(tie);
    winners.push(tie.winner);
  }
  return { ties, winners };
}

/**
 * Play the whole knockout from a seeded bracket in one pass: quarter-finals,
 * semi-finals, final. A thin loop over `playKnockoutRound`, so a bulk sim and a
 * click-through of the same bracket produce byte-identical results.
 */
export function playKnockout(
  bracket: number[],
  matchData: Map<number, TeamMatchData>,
  lid: number,
  season: number,
  delta: CareerDelta,
  injured: Set<number>,
): { ties: CupTie[]; championNid: number | null } {
  const ties: CupTie[] = [];
  let field = [...bracket];
  let round = 0;
  let championNid: number | null = null;

  while (field.length > 1) {
    const { ties: roundTies, winners } = playKnockoutRound(field, matchData, lid, season, round, delta, injured);
    if (winners.length === 0) break; // defensive: nothing playable
    ties.push(...roundTies);
    if (winners.length === 1) championNid = winners[0];
    field = winners;
    round++;
  }

  return { ties, championNid };
}
