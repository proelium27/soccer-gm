/**
 * Dynasty audit for the DIVISION pyramid: does each tier stay below the one
 * above it over a long save, and does the bottom tier stay solvent?
 *
 * The invariant this exists to protect is that a lower division cannot
 * out-strengthen the division above it. Relegation hands a tier-2 club a
 * full-strength tier-1 squad every season and nothing about that routes through
 * a market decision, so the drift is structural rather than probabilistic —
 * which is why `enforceDivisionCeilings` is a hard sweep rather than a nudge.
 * See DIVISION_2_OFFSET and divisionRefusalOvr in constants.ts.
 *
 * Reports per tier rather than for a hardcoded D1/D2 pair (2026-08-30), because
 * the big four now run three divisions. The headline check is the one the old
 * version made for a single pair, applied to EVERY adjacent pair:
 *
 *     tier N's strongest TEAM must not out-rate tier N-1's average TEAM.
 *
 * Two things this script gets right that are easy to get wrong:
 *
 *  - **simThrough HALTS before the user's cup final**, and simOffseason
 *    SILENTLY RETURNS THE LEAGUE UNCHANGED on any phase but "offseason". A
 *    dynasty whose unmanaged user club reached a final therefore simmed fewer
 *    seasons than it reported. weakLeaguesAudit hit this in 2026-08-13 and this
 *    script had never been given the same guard.
 *  - **The user's club is EXCLUDED from every metric.** It is unmanaged in a
 *    headless run, so it rots and produces all the extreme tails — the
 *    documented headless-audit artifact. The old version's "min budget ever
 *    observed" included it.
 *
 * Run: npx tsx scripts/divisionAudit.ts
 *      SEASONS=10 SEEDS=1 COUNTRY=England npx tsx scripts/divisionAudit.ts
 */
import { mulberry32 } from "../src/engine/rng.js";
import { createLeagueState, type LeagueStore } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { simOffseason } from "../src/core/offseason.js";
import { divisionsOf, competitionOf } from "../src/core/competitions.js";
import { divisionRefusalOvr } from "../src/core/constants.js";

const SEASONS = Number(process.env.SEASONS ?? 30);
const SEEDS = (process.env.SEEDS ?? "1,2,3").split(",").map(Number);
const COUNTRY = process.env.COUNTRY ?? "England";
const USER_TID = 0;

function avg(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function pctOver(xs: number[], t: number): number {
  return xs.length ? (100 * xs.filter((x) => x >= t).length) / xs.length : 0;
}

/** Play one season THROUGH — see the halt note in the file header. */
function playSeason(league: LeagueStore, rng: () => number): LeagueStore {
  let out = simThrough(league, "season", rng);
  for (let resumes = 0; (out.phase as string) !== "offseason"; resumes++) {
    if (resumes >= 3) throw new Error(`season ${out.season} refuses to finish (phase ${out.phase})`);
    out = simThrough(out, "season", rng);
  }
  return out;
}

interface TierStat {
  tier: number;
  name: string;
  playerOvrs: number[];
  teamAvgs: number[];
  wageBill: number;
  overCeiling: number;
}

function measure(league: LeagueStore): TierStat[] {
  const salaryByPid = new Map(league.players.map((p) => [p.pid, p.contract.salary]));
  const playerByPid = new Map(league.players.map((p) => [p.pid, p]));
  return divisionsOf(league.competitions, COUNTRY).map((comp) => {
    const teams = league.teams.filter((t) => t.compId === comp.id && t.tid !== USER_TID);
    const rosters = teams.map((t) => t.roster.map((pid) => playerByPid.get(pid)).filter((p) => p !== undefined));
    const ceiling = divisionRefusalOvr(comp.tier);
    return {
      tier: comp.tier,
      name: comp.name,
      playerOvrs: rosters.flat().map((p) => p!.ovr),
      teamAvgs: rosters.map((r) => avg(r.map((p) => p!.ovr))),
      wageBill: teams.reduce(
        (sum, t) => sum + t.roster.reduce((s, pid) => s + (salaryByPid.get(pid) ?? 0), 0), 0,
      ),
      // Players the ceiling sweep should have removed. Non-zero means the sweep
      // is leaking, which is the failure mode enforceDivisionCeilings exists for.
      overCeiling: rosters.flat().filter((p) => p!.ovr >= ceiling).length,
    };
  });
}

let failures = 0;

for (const seed of SEEDS) {
  console.log(`\n=== seed ${seed} — ${COUNTRY}, ${SEASONS} seasons ===`);
  const rng = mulberry32(seed);
  let league = createLeagueState(USER_TID, rng);

  let minBudget = Infinity;
  let minBudgetTier = 0;
  let minBudgetSeason = 0;
  const trackBudget = () => {
    for (const t of league.teams) {
      if (t.tid === USER_TID || t.budget >= minBudget) continue;
      minBudget = t.budget;
      minBudgetTier = competitionOf(league.competitions, t.compId).tier;
      minBudgetSeason = league.season;
    }
  };

  const first = measure(league);
  trackBudget();

  for (let s = 1; s <= SEASONS; s++) {
    league = playSeason(league, rng);
    trackBudget();
    league = simOffseason(league, rng);
    trackBudget();
  }

  const last = measure(league);

  console.log("tier  division                 mean   p90   max   80+     over-ceiling  wage bill");
  for (const t of last) {
    const sorted = [...t.playerOvrs].sort((a, b) => a - b);
    console.log(
      `  ${t.tier}   ${t.name.padEnd(22)} ${avg(t.playerOvrs).toFixed(1).padStart(5)} ` +
      `${String(sorted[Math.floor(sorted.length * 0.9)]).padStart(5)} ` +
      `${String(sorted[sorted.length - 1]).padStart(5)} ` +
      `${(pctOver(t.playerOvrs, 80).toFixed(1) + "%").padStart(6)} ` +
      `${String(t.overCeiling).padStart(13)}  ${(t.wageBill / 1e6).toFixed(1)}M`,
    );
  }

  // THE invariant, for every adjacent pair rather than just D1/D2.
  for (let i = 1; i < last.length; i++) {
    const upper = last[i - 1];
    const lower = last[i];
    const strongest = Math.max(...lower.teamAvgs);
    const average = avg(upper.teamAvgs);
    const ok = strongest <= average;
    if (!ok) failures++;
    console.log(
      `  ${ok ? "OK  " : "FAIL"} tier ${lower.tier}'s strongest team ${strongest.toFixed(1)} ` +
      `vs tier ${upper.tier}'s average team ${average.toFixed(1)} ` +
      `(gen: ${Math.max(...first[i].teamAvgs).toFixed(1)} vs ${avg(first[i - 1].teamAvgs).toFixed(1)})`,
    );
  }

  for (const t of last) {
    if (t.overCeiling === 0) continue;
    failures++;
    console.log(
      `  FAIL tier ${t.tier} holds ${t.overCeiling} players at or above its ` +
      `${divisionRefusalOvr(t.tier)} ceiling — the sweep is leaking`,
    );
  }

  const solvent = minBudget >= 0;
  if (!solvent) failures++;
  console.log(
    `  ${solvent ? "OK  " : "FAIL"} min AI budget ${(minBudget / 1e6).toFixed(2)}M ` +
    `(tier ${minBudgetTier}, season ${minBudgetSeason})`,
  );
}

console.log(failures === 0 ? "\nRESULT: all checks passed" : `\nRESULT: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
