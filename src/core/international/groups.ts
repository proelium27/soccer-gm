import type { IntlGroup, IntlGroupMatch } from "./types.js";

/** A bye slot, inserted when a group has an odd number of nations. */
const BYE = -1;

/**
 * A round-robin over `nids` by the circle method: every nation plays every
 * other, one match per round, with an odd field sitting one nation out each
 * round. Home and away alternate across the fixture list so no nation is stuck
 * hosting everything. Deterministic — the draw that produced the group order is
 * where the randomness lives.
 *
 * `legs` of 2 plays the whole thing twice with the venues reversed, which is
 * what qualifying uses. That is not decoration: over a single round-robin of
 * four games a five-nation group is mostly noise, and the strongest nations
 * were missing tournaments at a rate no amount of seeding could fix. Doubling
 * the fixtures halves that variance, and is how real qualifying is played.
 */
export function roundRobin(nids: number[], legs = 1): { round: number; home: number; away: number }[] {
  let arr = [...nids];
  if (arr.length % 2 === 1) arr.push(BYE);
  const n = arr.length;
  const half = n / 2;
  const single: { round: number; home: number; away: number }[] = [];

  for (let round = 0; round < n - 1; round++) {
    for (let i = 0; i < half; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a === BYE || b === BYE) continue;
      const flip = (round + i) % 2 === 1;
      single.push({ round, home: flip ? b : a, away: flip ? a : b });
    }
    // Rotate every position but the first.
    arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)];
  }

  const out = [...single];
  const roundsPerLeg = n - 1;
  for (let leg = 1; leg < legs; leg++) {
    for (const m of single) {
      out.push({ round: m.round + leg * roundsPerLeg, home: m.away, away: m.home });
    }
  }
  return out;
}

/** Build a group's unplayed fixture list from its nations. */
export function buildGroup(
  groupIndex: number,
  nids: number[],
  confederation: string | null,
  legs = 1,
): IntlGroup {
  const matches: IntlGroupMatch[] = roundRobin(nids, legs).map((m) => ({
    group: groupIndex,
    round: m.round,
    home: m.home,
    away: m.away,
    homeGoals: -1,
    awayGoals: -1,
    boxScore: null,
  }));
  return { nids, matches, confederation };
}

/**
 * Distribute a seeded list into `count` groups in serpentine order (1st, 2nd,
 * 3rd, 4th → then 8th, 7th, 6th, 5th → …), which balances group strength far
 * better than dealing straight through. Used for qualifying, where the field is
 * large, lopsided, and drawn without pots.
 */
export function serpentineGroups(seeded: number[], count: number): number[][] {
  const groups: number[][] = Array.from({ length: count }, () => []);
  seeded.forEach((nid, i) => {
    const row = Math.floor(i / count);
    const pos = i % count;
    groups[row % 2 === 0 ? pos : count - 1 - pos].push(nid);
  });
  return groups;
}

/**
 * The tournament draw: split the seeded field into `count` pots of equal size
 * (pot 1 = the strongest `count` nations, and so on) and deal one nation from
 * each pot into every group, shuffling within each pot. Every group therefore
 * gets exactly one top seed, one second seed, and so on — the standard format,
 * and the reason a group of death is possible but a group of four minnows is
 * not.
 */
export function potDraw(seeded: number[], count: number, rng: () => number): number[][] {
  const groups: number[][] = Array.from({ length: count }, () => []);
  const potSize = Math.ceil(seeded.length / count);
  for (let pot = 0; pot < potSize; pot++) {
    const members = seeded.slice(pot * count, (pot + 1) * count);
    // Fisher-Yates within the pot, then one member to each group in order.
    for (let i = members.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [members[i], members[j]] = [members[j], members[i]];
    }
    members.forEach((nid, g) => groups[g].push(nid));
  }
  return groups;
}

export interface GroupRow {
  nid: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
}

/**
 * A group's table, best first. Ordered on points, then goal difference, then
 * goals scored, then seed (nids are assigned in seed order, so the lower nid is
 * the stronger nation). Head-to-head is deliberately not used: with a single
 * round-robin it resolves too few ties to be worth the complexity, and it makes
 * the ordering non-transitive in three-way ties.
 */
export function groupTable(group: IntlGroup): GroupRow[] {
  const rows = new Map<number, GroupRow>(
    group.nids.map((nid) => [nid, { nid, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 }]),
  );
  for (const m of group.matches) {
    if (m.homeGoals < 0) continue;
    const home = rows.get(m.home);
    const away = rows.get(m.away);
    if (!home || !away) continue;
    home.played++;
    away.played++;
    home.gf += m.homeGoals;
    home.ga += m.awayGoals;
    away.gf += m.awayGoals;
    away.ga += m.homeGoals;
    if (m.homeGoals > m.awayGoals) {
      home.won++;
      home.points += 3;
      away.lost++;
    } else if (m.homeGoals < m.awayGoals) {
      away.won++;
      away.points += 3;
      home.lost++;
    } else {
      home.drawn++;
      away.drawn++;
      home.points++;
      away.points++;
    }
  }
  for (const row of rows.values()) row.gd = row.gf - row.ga;
  return [...rows.values()].sort(
    (a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.nid - b.nid,
  );
}

/**
 * Rank rows drawn from *different* groups (the best-runners-up comparison in
 * qualifying) on per-game rates rather than totals, because confederation
 * groups are not all the same size — a nation in a group of six would otherwise
 * outrank an equally good one from a group of four on volume alone.
 */
export function rankAcrossGroups(rows: GroupRow[]): GroupRow[] {
  const rate = (r: GroupRow, field: "points" | "gd" | "gf"): number =>
    r.played > 0 ? r[field] / r.played : 0;
  return [...rows].sort(
    (a, b) =>
      rate(b, "points") - rate(a, "points") ||
      rate(b, "gd") - rate(a, "gd") ||
      rate(b, "gf") - rate(a, "gf") ||
      a.nid - b.nid,
  );
}
