import type { LeagueStore } from "../leagueState.js";
import type { StoredTeam } from "./clubs.js";
import type { Player, PlayerRatings, Position } from "../players/types.js";
import { SKILL_KEYS, POSITIONS } from "../players/types.js";
import type { RosterFile, RosterFilePlayer } from "./rosterFile.js";
import { resolveRosterSlots } from "./rosterFile.js";
import { applyTeamIdentities } from "./customize.js";
import { generatePlayer } from "../players/generate.js";
import { computeOvr } from "../players/ovr.js";
import { estimatePotential } from "../players/progression.js";
import { seasonSalaryForOvr } from "../contracts.js";
import { competitionOf } from "../competitions.js";
import { mulberry32, hashInts } from "../../engine/rng.js";
import {
  LEAGUE_BASE, RATING_MIN, RATING_MAX, ROSTER_COMPOSITION,
  INITIAL_AGE_MIN, INITIAL_AGE_MAX, CONTRACT_LENGTH_MIN, CONTRACT_LENGTH_MAX,
} from "../constants.js";

/**
 * How far below a club's own generation-strength anchor (academyBase) the
 * auto-generated filler that tops a real squad up to a legal shape is
 * generated — so filler reads as clearly sub-first-team reserve cover, never
 * competing with the imported real players.
 */
const FILLER_BASE_OFFSET = 12;

const clampInt = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(x)));

/**
 * Find a uniform shift of a position-shaped rating set that makes computeOvr
 * land on `target`. computeOvr is monotonic non-decreasing under a uniform
 * shift (clamping preserves monotonicity), so a binary search on the shift
 * converges to the exact integer overall (give or take 1 at the clamp
 * extremes, where a 99-target player is already maxed out).
 */
function shiftRatingsToOverall(
  pos: Position,
  shape: PlayerRatings,
  heightCm: number,
  target: number,
): PlayerRatings {
  const want = clampInt(target, RATING_MIN, RATING_MAX);
  const shifted = (s: number): PlayerRatings =>
    Object.fromEntries(
      SKILL_KEYS.map((k) => [k, clampInt(shape[k] + s, RATING_MIN, RATING_MAX)]),
    ) as PlayerRatings;
  let lo = -RATING_MAX;
  let hi = RATING_MAX;
  for (let it = 0; it < 40; it++) {
    const mid = (lo + hi) / 2;
    if (computeOvr(pos, shifted(mid), heightCm) < want) lo = mid;
    else hi = mid;
  }
  return shifted(hi);
}

function clampRatings(r: PlayerRatings): PlayerRatings {
  return Object.fromEntries(
    SKILL_KEYS.map((k) => [k, clampInt(r[k], RATING_MIN, RATING_MAX)]),
  ) as PlayerRatings;
}

interface MaterializeCtx {
  pid: number;
  season: number;
  rng: () => number;
  genSeed: number;
  country: string;
}

/** Turn one authored player spec into a full engine Player. */
function materializePlayer(spec: RosterFilePlayer, ctx: MaterializeCtx): Player {
  const age = clampInt(spec.age, INITIAL_AGE_MIN - 3, INITIAL_AGE_MAX + 6);
  // Archetype provides a position-appropriate rating shape, a default height,
  // and a country-appropriate default nationality — all overridable below.
  const archetype = generatePlayer(ctx.rng, spec.pos, LEAGUE_BASE, ctx.pid, age, ctx.season, ctx.genSeed, ctx.country);
  const heightCm = spec.heightCm != null ? clampInt(spec.heightCm, 150, 220) : archetype.heightCm;

  const ratings = spec.ratings
    ? clampRatings(spec.ratings)
    : shiftRatingsToOverall(spec.pos, archetype.ratings, heightCm, spec.overall ?? 50);

  const ovr = computeOvr(spec.pos, ratings, heightCm);
  const potential =
    spec.potential != null
      ? clampInt(spec.potential, ovr, RATING_MAX)
      : estimatePotential(ctx.rng, ratings, ovr, age, spec.pos, heightCm, ctx.pid);
  const length = CONTRACT_LENGTH_MIN + Math.floor(ctx.rng() * (CONTRACT_LENGTH_MAX - CONTRACT_LENGTH_MIN + 1));

  return {
    pid: ctx.pid,
    name: spec.name.trim(),
    nationality: spec.nationality?.trim() || archetype.nationality,
    born: ctx.season - age,
    pos: spec.pos,
    heightCm,
    ratings,
    ovr,
    potential,
    contract: { salary: seasonSalaryForOvr(ovr, ctx.pid, ctx.season), expiresSeason: ctx.season + length },
    injury: null,
    stats: [],
    hist: [{ season: ctx.season - 1, ratings, ovr, potential, academy: false }],
  };
}

/** Auto-generated reserve cover to fill a hole the imported squad left. */
function makeFiller(pos: Position, base: number, ctx: MaterializeCtx): Player {
  const age = INITIAL_AGE_MIN + Math.floor(ctx.rng() * (INITIAL_AGE_MAX - INITIAL_AGE_MIN + 1));
  const p = generatePlayer(ctx.rng, pos, base, ctx.pid, age, ctx.season, ctx.genSeed, ctx.country);
  const length = CONTRACT_LENGTH_MIN + Math.floor(ctx.rng() * (CONTRACT_LENGTH_MAX - CONTRACT_LENGTH_MIN + 1));
  p.contract.expiresSeason = ctx.season + length;
  return p;
}

/**
 * Build a club's replacement squad from its imported players, topping up each
 * under-filled position with filler so the result is always a legal,
 * sub-capable squad (every position at least its ROSTER_COMPOSITION count).
 * Provided extras beyond a position's target are kept, never trimmed.
 */
function materializeSquad(
  specs: RosterFilePlayer[],
  team: StoredTeam,
  season: number,
  startPid: number,
  competitionCountry: string,
): { players: Player[]; nextPid: number } {
  const rng = mulberry32(hashInts(team.tid, season, startPid, 0x5c0));
  const genSeed = hashInts(team.tid, season, 0xf1);
  let pid = startPid;
  const mkCtx = (): MaterializeCtx => ({ pid, season, rng, genSeed, country: competitionCountry });

  const real = specs.map((spec) => {
    const p = materializePlayer(spec, mkCtx());
    pid++;
    return p;
  });

  const have: Record<string, number> = {};
  for (const p of real) have[p.pos] = (have[p.pos] ?? 0) + 1;

  const fillerBase = Math.max(RATING_MIN + 5, team.academyBase - FILLER_BASE_OFFSET);
  const filler: Player[] = [];
  for (const pos of POSITIONS as readonly Position[]) {
    const need = Math.max(0, ROSTER_COMPOSITION[pos] - (have[pos] ?? 0));
    for (let i = 0; i < need; i++) {
      const p = makeFiller(pos, fillerBase, mkCtx());
      pid++;
      filler.push(p);
    }
  }

  return { players: [...real, ...filler], nextPid: pid };
}

export interface RosterFileApplyResult {
  league: LeagueStore;
  warnings: string[];
  /** Clubs whose identity was changed. */
  clubsRenamed: number;
  /** Clubs whose squad was replaced with imported players. */
  squadsReplaced: number;
  /** Imported + filler players added. */
  playersAdded: number;
}

/**
 * Apply a parsed roster file to a save: overlay club identities everywhere, and
 * for each club that supplied `players`, replace its senior squad with the
 * imported players (topped up with filler). Pure — returns a new LeagueStore.
 *
 * Replaced players are removed from the club's roster. Those who never played
 * (no recorded season stats — the normal case when importing onto a fresh save)
 * are dropped from the player pool entirely so it doesn't accumulate orphans;
 * any replaced player who *does* have history is kept as a free agent so his
 * record survives. The club's saved starting XI is cleared (the old XI's pids
 * are gone) and stale scouting/transfer-list references are pruned.
 */
export function applyRosterFile(league: LeagueStore, file: RosterFile): RosterFileApplyResult {
  const { slots, warnings } = resolveRosterSlots(league, file);

  const withIdentities = applyTeamIdentities(
    league,
    slots.map(({ tid, club }) => ({ tid, name: club.name, abbrev: club.abbrev, colors: club.colors })),
  );

  const teams = withIdentities.teams.map((t) => ({ ...t }));
  const teamByTid = new Map(teams.map((t) => [t.tid, t]));
  let players = [...withIdentities.players];
  let nextPid = players.reduce((m, p) => Math.max(m, p.pid), -1) + 1;
  const season = withIdentities.season;

  const removedPids = new Set<number>();
  let squadsReplaced = 0;
  let playersAdded = 0;

  for (const { tid, club } of slots) {
    if (!club.players || club.players.length === 0) continue;
    const team = teamByTid.get(tid);
    if (!team) continue;
    const country = competitionOf(withIdentities.competitions, team.compId).country;

    const built = materializeSquad(club.players, team, season, nextPid, country);
    nextPid = built.nextPid;

    for (const pid of team.roster) removedPids.add(pid);
    team.roster = built.players.map((p) => p.pid);
    team.starters = null; // old XI's pids are gone
    team.transferListed = team.transferListed.filter((pid) => !removedPids.has(pid));
    if (team.scoutingObserved && Object.keys(team.scoutingObserved).length > 0) {
      team.scoutingObserved = Object.fromEntries(
        Object.entries(team.scoutingObserved).filter(([pid]) => !removedPids.has(Number(pid))),
      );
    }

    players.push(...built.players);
    playersAdded += built.players.length;
    squadsReplaced++;
  }

  if (removedPids.size > 0) {
    // Keep replaced players who actually have history (as free agents); drop
    // the rest so a fresh-save import doesn't leave hundreds of orphans.
    players = players.filter((p) => !removedPids.has(p.pid) || p.stats.length > 0);
  }

  return {
    league: { ...withIdentities, teams, players },
    warnings,
    clubsRenamed: slots.length,
    squadsReplaced,
    playersAdded,
  };
}
