/**
 * Do weak leagues actually produce more defensive counting stats?
 *
 * The Defender of the Year drifts toward weak leagues, and the standing
 * explanation is that tackles and interceptions are raw counts which are *not*
 * league-normalized the way match ratings are, so a defender in a weak league
 * collects more of them. That explanation has never been checked. Every
 * observation behind it came from award *winners*, who are by construction the
 * maximum of their group — and a maximum can look inflated in a weak league
 * purely because the distribution there is wider, without the mean moving at
 * all.
 *
 * So this measures the population rather than the winners: for every
 * competition, the mean tackles + interceptions **per appearance** across all
 * its defenders, and the mean saves per appearance across its keepers, against
 * that competition's mean ovr.
 *
 * How to read it:
 *
 *  - If per-appearance volume falls as league strength rises, the explanation
 *    holds and scaling those stats by league strength is a real correction.
 *  - If it is flat, the explanation is WRONG. The drift would then be coming
 *    from the spread of the distribution (weak leagues having more extreme
 *    outliers) rather than its centre, and a per-league scale factor would do
 *    nothing about it — the fix would have to be a within-position
 *    normalization instead.
 *
 * Reports Pearson correlation between a competition's mean ovr and its mean
 * per-appearance volume, plus the raw per-competition table so the shape is
 * visible rather than hidden behind one number.
 *
 *   SEASONS=3 SEEDS=1 npx tsx scripts/leagueVolumeProbe.ts
 */
import { mulberry32 } from "../src/engine/rng.js";
import { createLeagueState } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { simOffseason } from "../src/core/offseason.js";
import { competitionOf, tierOf } from "../src/core/competitions.js";
import { positionGroup, ovrDuringSeason, statsFor } from "../src/core/awards.js";

const SEASONS = Number(process.env.SEASONS ?? 3);
const SEEDS = (process.env.SEEDS ?? "1").split(",").map(Number);

interface Bucket {
  compId: number;
  label: string;
  tier: 1 | 2;
  ovrTotal: number;
  ovrCount: number;
  defEvents: number;
  defApps: number;
  gkSaves: number;
  gkApps: number;
  /** Goals, for the same comparison on the attacking side. */
  fwdGoals: number;
  fwdApps: number;
}

const buckets = new Map<number, Bucket>();

for (const seed of SEEDS) {
  const rng = mulberry32(seed);
  let league = createLeagueState(0, rng);

  for (let s = 0; s < SEASONS; s++) {
    league = simThrough(league, "season", rng);
    league = simOffseason(league, rng);
    const entry = league.seasonHistory.at(-1)!;

    for (const p of league.players) {
      const st = statsFor(p, entry.season);
      if (!st || st.appearances === 0) continue;
      const compId = entry.compsByTid[st.tid];
      if (compId === undefined) continue;
      const comp = competitionOf(league.competitions, compId);
      if (!comp) continue;

      let b = buckets.get(compId);
      if (!b) {
        b = {
          compId,
          label: `${comp.country} T${tierOf(league.competitions, compId)}`,
          tier: tierOf(league.competitions, compId),
          ovrTotal: 0, ovrCount: 0,
          defEvents: 0, defApps: 0,
          gkSaves: 0, gkApps: 0,
          fwdGoals: 0, fwdApps: 0,
        };
        buckets.set(compId, b);
      }

      b.ovrTotal += ovrDuringSeason(p, entry.season);
      b.ovrCount++;

      const group = positionGroup(p.pos);
      if (group === "DEF") {
        b.defEvents += st.tackles + st.interceptions;
        b.defApps += st.appearances;
      } else if (group === "GK") {
        b.gkSaves += st.saves;
        b.gkApps += st.appearances;
      } else if (group === "FWD") {
        b.fwdGoals += st.goals;
        b.fwdApps += st.appearances;
      }
    }
  }
}

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return NaN;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx, b = ys[i] - my;
    num += a * b; dx += a * a; dy += b * b;
  }
  return num / Math.sqrt(dx * dy);
}

const rows = [...buckets.values()]
  .map((b) => ({
    label: b.label,
    tier: b.tier,
    meanOvr: b.ovrTotal / b.ovrCount,
    defPerApp: b.defApps > 0 ? b.defEvents / b.defApps : 0,
    savesPerApp: b.gkApps > 0 ? b.gkSaves / b.gkApps : 0,
    goalsPerApp: b.fwdApps > 0 ? b.fwdGoals / b.fwdApps : 0,
  }))
  .sort((a, b) => b.meanOvr - a.meanOvr);

console.log(`\n${SEEDS.length} seed(s) x ${SEASONS} seasons, all competitions\n`);
console.log(`${"competition".padEnd(16)} ${"meanOvr".padStart(8)} ${"tkl+int/app".padStart(12)} ${"saves/app".padStart(10)} ${"goals/app".padStart(10)}`);
for (const r of rows) {
  console.log(
    `${r.label.padEnd(16)} ${r.meanOvr.toFixed(2).padStart(8)} ` +
    `${r.defPerApp.toFixed(3).padStart(12)} ${r.savesPerApp.toFixed(3).padStart(10)} ` +
    `${r.goalsPerApp.toFixed(3).padStart(10)}`,
  );
}

const ovrs = rows.map((r) => r.meanOvr);
console.log(`\ncorrelation of competition mean ovr with...`);
console.log(`  defender tackles+interceptions per appearance: ${pearson(ovrs, rows.map((r) => r.defPerApp)).toFixed(3)}`);
console.log(`  keeper saves per appearance:                   ${pearson(ovrs, rows.map((r) => r.savesPerApp)).toFixed(3)}`);
console.log(`  forward goals per appearance:                  ${pearson(ovrs, rows.map((r) => r.goalsPerApp)).toFixed(3)}`);
console.log(`\n  strongly negative => weak leagues really do inflate the stat, and a`);
console.log(`  league-strength scale factor is a real correction.`);
console.log(`  near zero => the volume story is wrong and scaling would do nothing.`);

// Tier-1 only, since tier 2 is a different population and could carry the
// whole correlation on its own.
const t1 = rows.filter((r) => r.tier === 1);
console.log(`\ntier 1 only (${t1.length} competitions):`);
console.log(`  defender tackles+interceptions per appearance: ${pearson(t1.map((r) => r.meanOvr), t1.map((r) => r.defPerApp)).toFixed(3)}`);
console.log(`  keeper saves per appearance:                   ${pearson(t1.map((r) => r.meanOvr), t1.map((r) => r.savesPerApp)).toFixed(3)}`);
