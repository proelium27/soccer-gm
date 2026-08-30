/**
 * Dynasty audit for slot-aware composites.
 *
 * The risk this checks for is NOT the average case. Punishing a side for
 * fielding a man out of position hits thin squads hardest, which could sharpen
 * the strong/weak gap and turn the title race into a procession. So the metric
 * that matters is title churn: how many distinct clubs win a league over a long
 * run, and how concentrated the wins are on the best one.
 *
 * Also tracks the anti-inflation and D2-ceiling invariants, since any change
 * that moves match results moves who develops, gets bought, and gets relegated.
 *
 * userTid is excluded from tail metrics: the user's club is unmanaged in a
 * headless run, so it produces every worst-case figure.
 *
 * Run on both sides of the change and compare.
 */
import { mulberry32 } from "../src/engine/rng.js";
import { createLeagueState } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { simOffseason } from "../src/core/offseason.js";
import { computeStandings } from "../src/core/standings.js";
import { DIVISION_2_REFUSAL_OVR_THRESHOLD } from "../src/core/constants.js";

const SEASONS = Number(process.argv[2] ?? 25);
const SEEDS = (process.argv[3] ?? "1,2").split(",").map(Number);

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

for (const seed of SEEDS) {
  const rng = mulberry32(seed);
  let league = createLeagueState(0, rng);
  const userTid = league.meta.userTid;

  /** compId -> tid -> titles won */
  const titles = new Map<number, Map<number, number>>();
  const championPts: number[] = [];
  const meanOvrBySeason: number[] = [];
  let d2OverThreshold = 0;
  let d2MaxSeen = 0;

  for (let s = 1; s <= SEASONS; s++) {
    league = simThrough(league, "season", rng);

    const tier1 = league.competitions.filter((c) => c.tier === 1);
    for (const comp of tier1) {
      const tids = league.teams.filter((t) => t.compId === comp.id).map((t) => t.tid);
      const tidSet = new Set(tids);
      const table = computeStandings(tids, league.played.filter((m) => tidSet.has(m.home)));
      if (table.length === 0) continue;
      championPts.push(table[0].points);
      const byTid = titles.get(comp.id) ?? new Map<number, number>();
      byTid.set(table[0].tid, (byTid.get(table[0].tid) ?? 0) + 1);
      titles.set(comp.id, byTid);
    }

    league = simOffseason(league, rng);

    const tierByTid = new Map(
      league.teams.map((t) => [t.tid, league.competitions.find((c) => c.id === t.compId)?.tier ?? 1]),
    );
    const onRoster = new Map<number, number>();
    for (const t of league.teams) for (const pid of t.roster) onRoster.set(pid, t.tid);

    const d1: number[] = [];
    const d2: number[] = [];
    for (const p of league.players) {
      const tid = onRoster.get(p.pid);
      if (tid === undefined || tid === userTid) continue;
      (tierByTid.get(tid) === 2 ? d2 : d1).push(p.ovr);
    }
    meanOvrBySeason.push(avg([...d1, ...d2]));
    // The real invariant enforceDivisionCeilings holds is "no AI tier-2 player
    // at or above DIVISION_2_REFUSAL_OVR_THRESHOLD" — not "below the D1 mean",
    // which a mid-tier D2 player clears routinely and which therefore carries
    // no signal at all.
    d2OverThreshold += d2.filter((o) => o >= DIVISION_2_REFUSAL_OVR_THRESHOLD).length;
    if (d2.length) d2MaxSeen = Math.max(d2MaxSeen, Math.max(...d2));
  }

  // Churn: distinct winners per league, and the share taken by the most
  // dominant club. A procession shows up as few distinct winners / a high share.
  const distinct: number[] = [];
  const topShare: number[] = [];
  for (const byTid of titles.values()) {
    distinct.push(byTid.size);
    const wins = [...byTid.values()];
    topShare.push(Math.max(...wins) / wins.reduce((a, b) => a + b, 0));
  }

  const firstThird = meanOvrBySeason.slice(0, Math.floor(SEASONS / 3));
  const lastThird = meanOvrBySeason.slice(-Math.floor(SEASONS / 3));

  console.log(`\n=== seed ${seed} (${SEASONS} seasons, ${titles.size} tier-1 leagues) ===`);
  console.log(`  distinct champions per league : avg ${avg(distinct).toFixed(2)} of ${SEASONS} seasons  (min ${Math.min(...distinct)}, max ${Math.max(...distinct)})`);
  console.log(`  most dominant club's share    : avg ${(100 * avg(topShare)).toFixed(1)}%  (max ${(100 * Math.max(...topShare)).toFixed(1)}%)`);
  console.log(`  champion points               : avg ${avg(championPts).toFixed(2)}  min ${Math.min(...championPts)}  max ${Math.max(...championPts)}`);
  console.log(`  league mean ovr               : first third ${avg(firstThird).toFixed(2)} -> last third ${avg(lastThird).toFixed(2)}  (drift ${(avg(lastThird) - avg(firstThird)).toFixed(2)})`);
  console.log(`  D2 ceiling                    : ${d2OverThreshold} AI player-seasons at/above ${DIVISION_2_REFUSAL_OVR_THRESHOLD} (want 0); strongest D2 player seen ${d2MaxSeen}`);
}
