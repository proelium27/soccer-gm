/**
 * Is the academy a viable route on its own? Ten seasons of a save that never
 * signs anybody else, played for real.
 *
 *   SEEDS=1,2,3 TID=0 SEASONS=10 npx tsx scripts/academyOnlyProbe.ts
 *
 * Plays the save with the policy a player would actually use — sign the best
 * trialists on estimated potential each summer, extend the academy deals before
 * they lapse, extend the senior squad, promote at 18 — and reports what the
 * graduates became. `TID` picks the club: 0 is England's top flight (the
 * strongest academies in the world), 578 Serbia's (the weakest top flight), 40
 * an English third division.
 *
 * **It AGGREGATES ACROSS SEEDS and so must not be split by `audit:cluster`** —
 * the headline number is a correlation pooled over every graduate of every
 * seed, and half the sample computed on one machine is a different, quieter
 * statistic wearing the same name. It is on that script's refuse list.
 *
 * ## Three harness details, each of which produced a wrong answer first
 *
 * **(a) The senior squad must be re-signed every summer.** The user's club is
 * unmanaged in a headless run — CLAUDE.md's standing warning — so no AI renewal
 * touches it and `releaseExpiredContracts` drops each graduate the moment his
 * deal lapses. He lands in free agency, stops playing, and progression's
 * `minutesFactor` stalls him. The first version of this probe omitted the
 * renewal and reported peaks depressed by the harness rather than by the game
 * (one graduate read peak 76 / now 63 at 25, having simply stopped playing).
 * Calling `extendContracts` is what the "Extend all" button does.
 *
 * **(b) Measure the players, not the roster.** A graduate's peak is his own
 * property and survives him leaving; "who is still at the club" is a fact about
 * the harness's squad management. Both are printed, but the peaks are the
 * answer to the question.
 *
 * **(c) `ensureUserRosterSafety` can sign free agents.** That would quietly
 * stop the run being academy-only, so the report counts non-academy arrivals
 * and any number above zero invalidates it.
 */
import { mulberry32 } from "../src/engine/rng.js";
import { createLeagueState, type LeagueStore } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { simOffseason } from "../src/core/offseason.js";
import { signTrialist, promoteFromAcademy } from "../src/core/freeAgency.js";
import { extendAcademyContracts, extendContracts } from "../src/core/contracts.js";
import { competitionOf } from "../src/core/competitions.js";
import { ACADEMY_ROSTER_CAP, ROSTER_CAP, YOUTH_TRIAL_SIGN_LIMIT } from "../src/core/constants.js";

const TID = Number(process.env.TID ?? 0);
const SEASONS = Number(process.env.SEASONS ?? 10);
const SEEDS = (process.env.SEEDS ?? "4").split(",").map((s) => Number(s.trim()));

interface Graduate {
  potAtSigning: number;
  signedSeason: number;
  peak: number;
  now: number;
  age: number;
  pos: string;
  stillHere: boolean;
}

/**
 * simThrough halts before the user's own cup final, so one call finishes a
 * season only when his club happens not to reach one — and simOffseason handed
 * a half-played season silently does nothing at all.
 */
function playSeason(league: LeagueStore, rng: () => number): LeagueStore {
  let out = league;
  for (let i = 0; i < 4 && out.phase !== "offseason"; i++) out = simThrough(out, "season", rng);
  if (out.phase !== "offseason") throw new Error(`season did not finish (phase ${out.phase})`);
  return out;
}

function runSeed(seed: number): { grads: Graduate[]; label: string; intruders: number } {
  const rng = mulberry32(seed);
  let league = createLeagueState(TID, rng);
  const team0 = league.teams.find((t) => t.tid === TID)!;
  const comp = competitionOf(league.competitions, team0.compId);
  const label = `${team0.name} — ${comp.name} (${comp.country}, tier ${comp.tier})`;

  const signed = new Map<number, { potAtSigning: number; signedSeason: number }>();
  const startingPids = new Set(league.players.map((p) => p.pid));

  for (let s = 0; s < SEASONS; s++) {
    league = simOffseason(playSeason(league, rng), rng);
    const season = league.season;

    // Sign the best trialists on estimated potential, which is all the player
    // has to go on. Bounded by the academy cap, not by the sign limit alone.
    {
      const team = league.teams.find((t) => t.tid === TID)!;
      const byPid = new Map(league.players.map((p) => [p.pid, p]));
      const room = Math.max(0, ACADEMY_ROSTER_CAP - team.academyRoster.length);
      const pick = (team.youthTrialists ?? [])
        .map((pid) => byPid.get(pid))
        .filter((p): p is NonNullable<typeof p> => p != null)
        .sort((a, b) => b.potential - a.potential || b.ovr - a.ovr)
        .slice(0, Math.min(YOUTH_TRIAL_SIGN_LIMIT, room));
      for (const p of pick) {
        const before = league.teams.find((t) => t.tid === TID)!.academyRoster.length;
        const out = signTrialist(league.teams, league.players, TID, p.pid, season);
        league = { ...league, teams: out.teams, players: out.players };
        if (league.teams.find((t) => t.tid === TID)!.academyRoster.length > before) {
          signed.set(p.pid, { potAtSigning: p.potential, signedSeason: season });
        }
      }
    }

    // (a) above: both lists, every summer, or the graduates leak away.
    {
      const team = league.teams.find((t) => t.tid === TID)!;
      let players = extendAcademyContracts(league.players, team.academyRoster, season);
      players = extendContracts(players, team.roster, season);
      league = { ...league, players };
    }

    // Promote at 18 so he gets senior minutes rather than backing the cap up.
    {
      const byPid = new Map(league.players.map((p) => [p.pid, p]));
      const ready = league.teams.find((t) => t.tid === TID)!.academyRoster
        .map((pid) => byPid.get(pid))
        .filter((p): p is NonNullable<typeof p> => p != null && season - p.born >= 18)
        .sort((a, b) => b.ovr - a.ovr);
      for (const p of ready) {
        if (league.teams.find((t) => t.tid === TID)!.roster.length >= ROSTER_CAP) break;
        const out = promoteFromAcademy(league.teams, league.players, TID, p.pid, season, "offseason");
        league = { ...league, teams: out.teams, players: out.players };
      }
    }
  }

  const byPid = new Map(league.players.map((p) => [p.pid, p]));
  const team = league.teams.find((t) => t.tid === TID)!;
  const squad = new Set([...team.roster, ...team.academyRoster]);
  const grads: Graduate[] = [];
  for (const [pid, meta] of signed) {
    const p = byPid.get(pid);
    if (!p) continue;
    grads.push({
      ...meta,
      peak: p.peakOvr ?? p.ovr,
      now: p.ovr,
      age: league.season - p.born,
      pos: p.pos,
      stillHere: squad.has(pid),
    });
  }
  grads.sort((a, b) => b.peak - a.peak);

  // (c): anything here means the run was not academy-only after all.
  const intruders = team.roster
    .filter((pid) => !signed.has(pid) && !startingPids.has(pid)).length;

  const best11 = team.roster
    .map((pid) => byPid.get(pid))
    .filter((p): p is NonNullable<typeof p> => p != null && signed.has(p.pid))
    .sort((a, b) => b.ovr - a.ovr)
    .slice(0, 11);
  console.log(`\n=== seed ${seed}: ${label} ===`);
  console.log(`signed ${grads.length} over ${SEASONS} seasons `
    + `(${(grads.length / SEASONS).toFixed(1)}/season), non-academy arrivals: ${intruders}`);
  console.log(`best XI, all home-grown: ${best11.map((p) => `${p.pos} ${p.ovr}`).join(", ")}`);
  console.log("  peak  now  age  pos   POT@sign  signed");
  for (const g of grads.slice(0, 12)) {
    console.log(`  ${String(g.peak).padStart(4)}${String(g.now).padStart(5)}`
      + `${String(g.age).padStart(5)}  ${g.pos.padEnd(4)}${String(g.potAtSigning).padStart(9)}`
      + `${String(g.signedSeason).padStart(8)}`);
  }
  return { grads, label, intruders };
}

const pooled: Graduate[] = [];
let anyIntruders = 0;
for (const seed of SEEDS) {
  const r = runSeed(seed);
  pooled.push(...r.grads);
  anyIntruders += r.intruders;
}

const pearson = (xs: number[], ys: number[]): number => {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0; let dx = 0; let dy = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  return dx > 0 && dy > 0 ? num / Math.sqrt(dx * dy) : NaN;
};

const hit = (t: number) => pooled.filter((g) => g.peak >= t).length;
console.log(`\n=== POOLED over ${SEEDS.length} seed(s), ${pooled.length} graduates ===`);
console.log(`peaked 80+: ${hit(80)}   75+: ${hit(75)}   70+: ${hit(70)}   65+: ${hit(65)}`);
console.log(`mean peak: ${(pooled.reduce((a, g) => a + g.peak, 0) / pooled.length).toFixed(1)}`
  + `   best: ${Math.max(...pooled.map((g) => g.peak))}`);

/**
 * The headline. POT is a scout's ESTIMATE and the design says so, but this puts
 * a number on how little it tells you: if this is near zero, picking the top
 * few off the Youth Intake page is barely better than picking at random, and
 * the lever that matters is how many you can hold rather than which you take.
 * Computed over EVERY graduate, not a top-N slice — sorting by peak and then
 * truncating attenuates the correlation toward zero on its own.
 */
const r = pearson(pooled.map((g) => g.potAtSigning), pooled.map((g) => g.peak));
console.log(`\nr(POT at signing, peak OVR reached) = ${r >= 0 ? "+" : ""}${r.toFixed(2)}`);
console.log(`  mean POT at signing ${(pooled.reduce((a, g) => a + g.potAtSigning, 0) / pooled.length).toFixed(1)}`
  + ` -> mean peak ${(pooled.reduce((a, g) => a + g.peak, 0) / pooled.length).toFixed(1)}`);
if (anyIntruders > 0) {
  console.log(`\n*** ${anyIntruders} non-academy arrivals: the safety net signed free agents, `
    + "so this run was NOT academy-only and the numbers above are not the thing they claim.");
}
