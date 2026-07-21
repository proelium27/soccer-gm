import { mulberry32, hashInts } from "../../engine/rng.js";
import {
  CUP_LEAGUE_PHASE_GAMES, CUP_LEAGUE_PHASE_POTS,
  CUP_LEAGUE_PHASE_MATCHDAYS, CUP_LP_DIRECT_QF, CUP_LP_PLAYOFF_TEAMS,
} from "../constants.js";
import type { CupLeaguePhase, LeaguePhaseMatch } from "./types.js";

/**
 * The Swiss league-phase draw.
 *
 * The field (already in seed order — strongest first) is split into two strength
 * pots. Each club plays `perPot` (= games / pots) opponents from each pot, so
 * everyone gets the same balanced spread of tough and winnable games. Two hard
 * constraints: no club plays another from its own league (competition), and no
 * club plays the same opponent twice. Each club ends with an even split of home
 * and away games, and plays exactly once per league-phase round.
 *
 * The schedule is built directly as CUP_LEAGUE_PHASE_GAMES edge-disjoint perfect
 * matchings — one per round — so "each club plays once per round" holds by
 * construction (a naive build-then-colour approach can produce a graph that
 * simply isn't 1-factorable). `perPot` of the rounds are intra-pot (pot A and
 * pot B each supply a matching) and `perPot` are cross-pot (a bijection between
 * the pots), which also gives every club exactly `perPot` opponents from each
 * pot. Home/away is then assigned by an Eulerian orientation so every club lands
 * an even split. All draws are seeded; the same-league rule is relaxed only as a
 * last resort so the draw always returns a valid schedule.
 */
export function drawLeaguePhase(
  teams: number[],
  compOf: Map<number, number>,
  seed: number,
): LeaguePhaseMatch[] {
  const size = teams.length;
  const perPot = CUP_LEAGUE_PHASE_GAMES / CUP_LEAGUE_PHASE_POTS;
  const potSize = size / CUP_LEAGUE_PHASE_POTS;
  if (CUP_LEAGUE_PHASE_POTS !== 2 || !Number.isInteger(perPot) || !Number.isInteger(potSize) || potSize - 1 < perPot) {
    throw new Error(`league-phase draw: ${size} teams don't split into ${CUP_LEAGUE_PHASE_POTS} pots of ${perPot} games`);
  }
  const rng = mulberry32(hashInts(seed, 0xc0ffee));
  const sameComp = (a: number, b: number): boolean => compOf.get(a) === compOf.get(b);

  // Pots in seed order: pot A = strongest half, pot B = the rest.
  const potA = teams.slice(0, potSize);
  const potB = teams.slice(potSize);

  // Each round is one perfect matching (every club plays once). Intra rounds pair
  // clubs within their pot (pot A's matching ∪ pot B's matching); cross rounds
  // pair pot A against pot B. perPot of each → CUP_LEAGUE_PHASE_GAMES rounds.
  const intraA = intraMatchings(potA, perPot, sameComp, rng);
  const intraB = intraMatchings(potB, perPot, sameComp, rng);
  const cross = crossMatchings(potA, potB, perPot, sameComp, rng);

  const roundPairs: [number, number][][] = [];
  for (let r = 0; r < perPot; r++) roundPairs.push([...intraA[r], ...intraB[r]]);
  for (let r = 0; r < perPot; r++) roundPairs.push(cross[r]);
  shuffle(roundPairs, rng); // scatter intra/cross rounds across the schedule

  // Orient home/away over the whole (even-degree) schedule for an even split.
  const allEdges = roundPairs.flat();
  const dir = new Map<string, [number, number]>();
  for (const [h, a] of orientBalanced(allEdges, teams, rng)) dir.set(edgeKey(h, a), [h, a]);

  const matches: LeaguePhaseMatch[] = [];
  roundPairs.forEach((pairs, round) => {
    for (const [a, b] of pairs) {
      const [home, away] = dir.get(edgeKey(a, b))!;
      matches.push({
        round,
        matchday: CUP_LEAGUE_PHASE_MATCHDAYS[round],
        home,
        away,
        played: false,
        homeGoals: -1,
        awayGoals: -1,
        boxScore: null,
      });
    }
  });
  return matches;
}

/** Fisher–Yates shuffle in place, seeded. */
function shuffle<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const edgeKey = (a: number, b: number): string => (a < b ? `${a}-${b}` : `${b}-${a}`);

/**
 * `count` edge-disjoint perfect matchings within one pot (even size), avoiding
 * same-league pairs. Each matching pairs up every club once; across matchings no
 * pair repeats. Relaxes the same-league rule after many failed attempts so a
 * tight constraint set can't wedge the draw.
 */
function intraMatchings(
  pot: number[],
  count: number,
  sameComp: (a: number, b: number) => boolean,
  rng: () => number,
): [number, number][][] {
  for (let attempt = 0; attempt < 600; attempt++) {
    const relax = attempt >= 300;
    const used = new Set<string>();
    const matchings: [number, number][][] = [];
    let ok = true;
    for (let r = 0; r < count; r++) {
      const m = randomMatching(pot, used, relax ? null : sameComp, rng);
      if (!m) { ok = false; break; }
      m.forEach(([a, b]) => used.add(edgeKey(a, b)));
      matchings.push(m);
    }
    if (ok) return matchings;
  }
  throw new Error("league-phase draw: could not build intra-pot matchings");
}

/** A single perfect matching on `nodes` (even count) avoiding used pairs and (unless null) same-league pairs. */
function randomMatching(
  nodes: number[],
  used: Set<string>,
  sameComp: ((a: number, b: number) => boolean) | null,
  rng: () => number,
): [number, number][] | null {
  for (let attempt = 0; attempt < 400; attempt++) {
    const shuffled = shuffle([...nodes], rng);
    const pairs: [number, number][] = [];
    let ok = true;
    for (let i = 0; i < shuffled.length; i += 2) {
      const a = shuffled[i];
      const b = shuffled[i + 1];
      if (used.has(edgeKey(a, b)) || (sameComp && sameComp(a, b))) { ok = false; break; }
      pairs.push([a, b]);
    }
    if (ok) return pairs;
  }
  return null;
}

/**
 * `count` edge-disjoint perfect matchings between two equal-size pots (each a
 * bijection A → B), avoiding same-league pairs. Together they give every club
 * `count` cross-pot opponents.
 */
function crossMatchings(
  left: number[],
  right: number[],
  count: number,
  sameComp: (a: number, b: number) => boolean,
  rng: () => number,
): [number, number][][] {
  for (let attempt = 0; attempt < 600; attempt++) {
    const relax = attempt >= 300;
    const used = new Set<string>();
    const matchings: [number, number][][] = [];
    let ok = true;
    for (let r = 0; r < count; r++) {
      const m = crossMatching(left, right, used, relax ? null : sameComp, rng);
      if (!m) { ok = false; break; }
      m.forEach(([a, b]) => used.add(edgeKey(a, b)));
      matchings.push(m);
    }
    if (ok) return matchings;
  }
  throw new Error("league-phase draw: could not build cross-pot matchings");
}

/** A single bijection left[i] ↔ a shuffled right, avoiding used and (unless null) same-league pairs. */
function crossMatching(
  left: number[],
  right: number[],
  used: Set<string>,
  sameComp: ((a: number, b: number) => boolean) | null,
  rng: () => number,
): [number, number][] | null {
  for (let attempt = 0; attempt < 400; attempt++) {
    const permB = shuffle([...right], rng);
    const pairs: [number, number][] = [];
    let ok = true;
    for (let i = 0; i < left.length; i++) {
      const a = left[i];
      const b = permB[i];
      if (used.has(edgeKey(a, b)) || (sameComp && sameComp(a, b))) { ok = false; break; }
      pairs.push([a, b]);
    }
    if (ok) return pairs;
  }
  return null;
}

/**
 * Orient each undirected game as [home, away] so every club ends with an equal
 * number of home and away games. The schedule graph is even-degree at every
 * vertex (each club plays CUP_LEAGUE_PHASE_GAMES games), so an Eulerian
 * orientation — walking each connected component's Euler circuit and pointing
 * every edge the way it's traversed — leaves in-degree = out-degree everywhere.
 */
function orientBalanced(
  edges: [number, number][],
  nodes: number[],
  rng: () => number,
): [number, number][] {
  const adj = new Map<number, { to: number; id: number }[]>();
  for (const n of nodes) adj.set(n, []);
  edges.forEach(([a, b], id) => {
    adj.get(a)!.push({ to: b, id });
    adj.get(b)!.push({ to: a, id });
  });
  for (const n of nodes) shuffle(adj.get(n)!, rng); // vary the circuit per seed

  const used = new Array<boolean>(edges.length).fill(false);
  const nextIdx = new Map<number, number>(nodes.map((n) => [n, 0]));
  const directed: [number, number][] = [];

  // Hierholzer per component: each even-degree component has an Euler circuit.
  for (const start of nodes) {
    let hasUnused = false;
    for (const e of adj.get(start)!) if (!used[e.id]) { hasUnused = true; break; }
    if (!hasUnused) continue;

    const stack: number[] = [start];
    const trail: number[] = [];
    while (stack.length) {
      const v = stack[stack.length - 1];
      const list = adj.get(v)!;
      let advanced = false;
      let i = nextIdx.get(v)!;
      for (; i < list.length; i++) {
        if (!used[list[i].id]) {
          used[list[i].id] = true;
          nextIdx.set(v, i + 1);
          stack.push(list[i].to);
          advanced = true;
          break;
        }
      }
      if (!advanced) {
        nextIdx.set(v, i);
        trail.push(stack.pop()!);
      }
    }
    for (let k = 0; k + 1 < trail.length; k++) directed.push([trail[k], trail[k + 1]]);
  }
  return directed;
}

/** One club's line in the league-phase table. */
export interface LeaguePhaseStanding {
  tid: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
  /** 1-based qualification seed, used as the final, fully deterministic tiebreak. */
  seed: number;
}

/**
 * The combined league-phase table from the matches played so far. Points 3/1/0;
 * ranked by points, then goal difference, goals for, wins, and finally seed
 * (head-to-head is unreliable in a Swiss draw, so — like the real UCL — we fall
 * back to these overall metrics). `seeds` maps tid → its 1-based qualification
 * seed for the final deterministic tiebreak.
 */
export function leaguePhaseTable(
  lp: CupLeaguePhase,
  seeds: Record<number, number>,
): LeaguePhaseStanding[] {
  const rows = new Map<number, LeaguePhaseStanding>();
  for (const tid of lp.teams) {
    rows.set(tid, { tid, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0, seed: seeds[tid] ?? 9999 });
  }
  for (const m of lp.matches) {
    if (!m.played) continue;
    const h = rows.get(m.home);
    const a = rows.get(m.away);
    if (!h || !a) continue;
    h.played++; a.played++;
    h.gf += m.homeGoals; h.ga += m.awayGoals;
    a.gf += m.awayGoals; a.ga += m.homeGoals;
    if (m.homeGoals > m.awayGoals) { h.won++; h.points += 3; a.lost++; }
    else if (m.homeGoals < m.awayGoals) { a.won++; a.points += 3; h.lost++; }
    else { h.drawn++; a.drawn++; h.points++; a.points++; }
  }
  for (const r of rows.values()) r.gd = r.gf - r.ga;
  return [...rows.values()].sort(
    (x, y) => y.points - x.points || y.gd - x.gd || y.gf - x.gf || y.won - x.won || x.seed - y.seed,
  );
}

/**
 * Split a completed league-phase table three ways: the top CUP_LP_DIRECT_QF go
 * straight to the quarter-finals, the next CUP_LP_PLAYOFF_TEAMS contest the
 * single-leg playoff, and the rest are eliminated. Returns each group's tids in
 * finishing order.
 */
export function splitLeaguePhase(
  table: LeaguePhaseStanding[],
): { directQF: number[]; playoff: number[]; out: number[] } {
  const tids = table.map((r) => r.tid);
  return {
    directQF: tids.slice(0, CUP_LP_DIRECT_QF),
    playoff: tids.slice(CUP_LP_DIRECT_QF, CUP_LP_DIRECT_QF + CUP_LP_PLAYOFF_TEAMS),
    out: tids.slice(CUP_LP_DIRECT_QF + CUP_LP_PLAYOFF_TEAMS),
  };
}

/** Whether every league-phase match has been played (so the table can be split). */
export function leaguePhaseComplete(lp: CupLeaguePhase): boolean {
  return lp.matches.every((m) => m.played);
}

/** The league-phase matches due on `matchday` and not yet played. */
export function leaguePhaseMatchesDue(lp: CupLeaguePhase, matchday: number): LeaguePhaseMatch[] {
  return lp.matches.filter((m) => !m.played && m.matchday === matchday);
}

/** Whether any league-phase match is due (unplayed) on `matchday`. */
export function leaguePhaseDue(lp: CupLeaguePhase, matchday: number): boolean {
  return lp.matches.some((m) => !m.played && m.matchday === matchday);
}
