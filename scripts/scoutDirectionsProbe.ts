/**
 * What the scout directions actually do to a trial group, measured on a real
 * offseason rather than argued from the constants.
 *
 * Run it before touching SCOUT_POSITION_SHARE or SCOUT_PROFILE_TILT: both are
 * sized against what the user can SEE in his group, not against the share they
 * are applied at, and the two differ because positions and the profile reach
 * only the scouted extras (see SCOUT_POSITION_SHARE for why they must).
 *
 *   npx tsx scripts/scoutDirectionsProbe.ts
 *
 * The OVR line is the one to watch. A scouting profile is a trade and not an
 * upgrade — `applyProfileTilt` balances every tilt against the OVR it produces —
 * so the two rating lists must come out IDENTICAL. If they ever diverge the
 * profile has quietly become a balance lever, and it would then need the
 * dynasty audit it is built specifically to avoid needing.
 *
 * SEED=n picks a different world (default 4).
 */
import { mulberry32 } from "../src/engine/rng.js";
import { createLeagueState, type LeagueStore } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { simOffseason } from "../src/core/offseason.js";
import type { Position } from "../src/core/players/types.js";
import { SCOUT_PROFILES, type ScoutProfile } from "../src/core/scouting/scoutProfile.js";

const SEED = Number(process.env.SEED ?? 4);

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

function run(positions: Position[], profile: ScoutProfile | null) {
  const rng = mulberry32(SEED);
  let league = createLeagueState(0, rng);
  league = {
    ...league,
    teams: league.teams.map((t) => (t.tid === league.meta.userTid
      ? { ...t, scoutingPositions: positions, scoutingProfile: profile } as typeof t
      : t)),
  };
  league = simOffseason(playSeason(league, rng), rng);
  const byPid = new Map(league.players.map((p) => [p.pid, p]));
  const group = (league.teams.find((t) => t.tid === league.meta.userTid)!.youthTrialists ?? [])
    .map((pid) => byPid.get(pid)!);
  const mean = (f: (p: (typeof group)[number]) => number) =>
    group.reduce((s, p) => s + f(p), 0) / group.length;
  return {
    positions: group.map((p) => p.pos),
    ovrs: group.map((p) => p.ovr).sort((a, b) => b - a),
    speed: mean((p) => p.ratings.speed),
    shortPass: mean((p) => p.ratings.shortPass),
    positioning: mean((p) => p.ratings.positioning),
  };
}

// The three RAREST positions: ROSTER_COMPOSITION keeps only two of each, so an
// untargeted intake produces few and the skew has somewhere to show. Targeting
// CB/FB/CM would mostly be measuring the baseline back.
const TARGETS: Position[] = ["GK", "DM", "AM"];

const plain = run([], null);
const targeted = run(TARGETS, null);
const share = (r: { positions: Position[] }) =>
  r.positions.filter((p) => TARGETS.includes(p)).length / r.positions.length;

console.log(`seed ${SEED}, group of ${plain.positions.length}\n`);
console.log("POSITIONS");
console.log(`  target share (${TARGETS.join("/")}): ` +
  `${(share(plain) * 100).toFixed(1)}% -> ${(share(targeted) * 100).toFixed(1)}%`);
console.log(`  none    : ${plain.positions.join(" ")}`);
console.log(`  targeted: ${targeted.positions.join(" ")}\n`);

console.log("PROFILE (mean rating across the group)");
console.log("  profile        speed  shortPass  positioning   OVRs unchanged?");
const line = (name: string, r: ReturnType<typeof run>) =>
  `  ${name.padEnd(13)}${r.speed.toFixed(1).padStart(6)}${r.shortPass.toFixed(1).padStart(11)}` +
  `${r.positioning.toFixed(1).padStart(13)}   ` +
  (r.ovrs.join(",") === plain.ovrs.join(",") ? "yes" : "*** NO ***");
console.log(line("none", plain));
for (const profile of SCOUT_PROFILES) console.log(line(profile, run([], profile)));
console.log(`\n  OVRs: ${plain.ovrs.join(",")}`);
