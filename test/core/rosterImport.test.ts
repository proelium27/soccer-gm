import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { createLeagueState } from "../../src/core/leagueState.js";
import { parseRosterFile, type RosterFile } from "../../src/core/teams/rosterFile.js";
import { applyRosterFile } from "../../src/core/teams/rosterImport.js";
import { POSITIONS, SKILL_KEYS, type PlayerRatings } from "../../src/core/players/types.js";
import { ROSTER_COMPOSITION } from "../../src/core/constants.js";

const base = createLeagueState(0, mulberry32(11), 11);
const league = { ...base, meta: { ...base.meta, name: base.teams[0].name } };

// Slot 0 of English Division 1 (the user's club here).
const d1 = league.competitions.find((c) => c.name === "English Division 1")!;
const d1Slot0 = league.teams.filter((t) => t.compId === d1.id).sort((a, b) => a.tid - b.tid)[0];

function fileWithSquad(players: unknown[]): RosterFile {
  return parseRosterFile(
    JSON.stringify({
      format: "soccer-gm-roster",
      formatVersion: 1,
      competitions: [
        { match: "English Division 1", clubs: [{ name: "Real Import", abbrev: "IMP", colors: ["#111111", "#eeeeee"], players }] },
      ],
    }),
  );
}

const flatRatings = (v: number): PlayerRatings =>
  Object.fromEntries(SKILL_KEYS.map((k) => [k, v])) as PlayerRatings;

describe("applyRosterFile — squad import", () => {
  it("materializes an `overall` player to (about) that overall, at the right position", () => {
    const file = fileWithSquad([{ name: "Star Striker", pos: "ST", age: 25, overall: 88, nationality: "Brazil" }]);
    const { league: out, squadsReplaced, playersAdded } = applyRosterFile(league, file);
    expect(squadsReplaced).toBe(1);
    const star = out.players.find((p) => p.name === "Star Striker")!;
    expect(star).toBeTruthy();
    expect(star.pos).toBe("ST");
    expect(star.nationality).toBe("Brazil");
    expect(Math.abs(star.ovr - 88)).toBeLessThanOrEqual(1);
    expect(star.potential).toBeGreaterThanOrEqual(star.ovr);
    // Full roster was topped up to a legal squad.
    expect(playersAdded).toBe(out.teams.find((t) => t.tid === d1Slot0.tid)!.roster.length);
  });

  it("uses exact `ratings` when provided, and computes ovr from them", () => {
    const ratings = { ...flatRatings(70), finishing: 90, dribbling: 88 };
    const file = fileWithSquad([{ name: "Exact Guy", pos: "AM", age: 27, ratings }]);
    const { league: out } = applyRosterFile(league, file);
    const p = out.players.find((pp) => pp.name === "Exact Guy")!;
    expect(p.ratings.finishing).toBe(90);
    expect(p.ratings.dribbling).toBe(88);
    expect(p.ratings.speed).toBe(70);
    expect(p.ovr).toBeGreaterThan(0);
  });

  it("tops up an under-filled squad so every position meets its composition and a GK exists", () => {
    // Only two outfielders provided — everything else must be filled.
    const file = fileWithSquad([
      { name: "Lonely Striker", pos: "ST", age: 24, overall: 80 },
      { name: "One Winger", pos: "W", age: 22, overall: 75 },
    ]);
    const { league: out } = applyRosterFile(league, file);
    const team = out.teams.find((t) => t.tid === d1Slot0.tid)!;
    const roster = team.roster.map((pid) => out.players.find((p) => p.pid === pid)!);
    const byPos: Record<string, number> = {};
    for (const p of roster) byPos[p.pos] = (byPos[p.pos] ?? 0) + 1;
    for (const pos of POSITIONS) {
      expect(byPos[pos] ?? 0).toBeGreaterThanOrEqual(ROSTER_COMPOSITION[pos]);
    }
    expect(byPos.GK).toBeGreaterThanOrEqual(1);
    expect(roster.length).toBeGreaterThanOrEqual(25);
  });

  it("replaces the club's roster and drops the old fictional players (fresh save, no history)", () => {
    const oldPids = new Set(d1Slot0.roster);
    const file = fileWithSquad([{ name: "New One", pos: "CM", age: 26, overall: 82 }]);
    const { league: out } = applyRosterFile(league, file);
    const team = out.teams.find((t) => t.tid === d1Slot0.tid)!;
    // None of the old pids remain on the roster...
    expect(team.roster.some((pid) => oldPids.has(pid))).toBe(false);
    // ...and since they never played, they're gone from the pool entirely.
    expect(out.players.some((p) => oldPids.has(p.pid))).toBe(false);
    // Stale user-XI selection is cleared.
    expect(team.starters).toBeNull();
  });

  it("leaves a club's roster untouched when it supplies no players (identity-only)", () => {
    const file = parseRosterFile(
      JSON.stringify({
        format: "soccer-gm-roster",
        formatVersion: 1,
        competitions: [
          { match: "English Division 1", clubs: [{ name: "Renamed Only", abbrev: "RNO", colors: ["#000000", "#ffffff"] }] },
        ],
      }),
    );
    const { league: out, squadsReplaced, clubsRenamed } = applyRosterFile(league, file);
    expect(clubsRenamed).toBe(1);
    expect(squadsReplaced).toBe(0);
    const team = out.teams.find((t) => t.tid === d1Slot0.tid)!;
    expect(team.name).toBe("Renamed Only");
    expect(team.roster).toEqual(d1Slot0.roster); // unchanged
  });

  it("is deterministic — same file yields identical pids, ovrs, and roster", () => {
    const file = fileWithSquad([{ name: "Repeatable", pos: "CB", age: 28, overall: 79 }]);
    const a = applyRosterFile(league, file);
    const b = applyRosterFile(league, file);
    const ta = a.league.teams.find((t) => t.tid === d1Slot0.tid)!;
    const tb = b.league.teams.find((t) => t.tid === d1Slot0.tid)!;
    expect(ta.roster).toEqual(tb.roster);
    const ovrsA = ta.roster.map((pid) => a.league.players.find((p) => p.pid === pid)!.ovr);
    const ovrsB = tb.roster.map((pid) => b.league.players.find((p) => p.pid === pid)!.ovr);
    expect(ovrsA).toEqual(ovrsB);
  });

  it("passes warnings through for an unmatched competition and applies nothing", () => {
    const file = parseRosterFile(
      JSON.stringify({
        format: "soccer-gm-roster",
        formatVersion: 1,
        competitions: [
          { match: "Martian League", clubs: [{ name: "X", abbrev: "X", colors: ["#000000", "#ffffff"], players: [{ name: "y", pos: "GK", age: 24, overall: 70 }] }] },
        ],
      }),
    );
    const { warnings, squadsReplaced, clubsRenamed } = applyRosterFile(league, file);
    expect(clubsRenamed).toBe(0);
    expect(squadsReplaced).toBe(0);
    expect(warnings[0]).toContain("Martian League");
  });

  it("does not change any other club's roster", () => {
    const otherSlot = league.teams.filter((t) => t.compId === d1.id).sort((a, b) => a.tid - b.tid)[5];
    const file = fileWithSquad([{ name: "Solo", pos: "ST", age: 25, overall: 85 }]);
    const { league: out } = applyRosterFile(league, file);
    const other = out.teams.find((t) => t.tid === otherSlot.tid)!;
    expect(other.roster).toEqual(otherSlot.roster);
  });
});
