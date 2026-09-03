import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../../src/engine/rng.js";
import { playFullSeason } from "../../helpers/offseasonLeague.js";
import { simOffseason } from "../../../src/core/offseason.js";
import type { LeagueStore } from "../../../src/core/leagueState.js";
import type { TransferClause } from "../../../src/core/transfers/clauses.js";
import { BONUS_APPEARANCE_THRESHOLD } from "../../../src/core/constants.js";

/**
 * The offseason half of transfer clauses, end to end through a real
 * `simOffseason`.
 *
 * `settleBonuses` is pure and tested on its own; what this covers is the
 * WIRING at step 6.7 that feeds it — building the roster map, working out who
 * was promoted by comparing tiers either side of the swap, and asking
 * `qualificationByTid` who reached Europe. That wiring is simple, and simple
 * wiring across a boundary is exactly where this codebase's silent bugs have
 * come from (see the `cupChampions` note on the worker detach).
 *
 * One full season is ~60s, so this lives in its own file rather than bloating
 * the fast `clauses.test.ts`.
 */
describe("bonuses settle through a real offseason", () => {
  /** A club with a player who played enough games to earn an appearance bonus. */
  function earnedIt(league: LeagueStore) {
    for (const team of league.teams) {
      if (team.tid === league.meta.userTid) continue;
      for (const pid of team.roster) {
        const player = league.players.find((p) => p.pid === pid);
        const line = player?.stats.find((st) => st.season === league.season);
        if (line && line.appearances >= BONUS_APPEARANCE_THRESHOLD) {
          return { tid: team.tid, pid };
        }
      }
    }
    return null;
  }

  it("pays an earned bonus, moves the money both ways, and retires the clause", () => {
    const rng = mulberry32(11);
    const base = playFullSeason(rng);
    const target = earnedIt(base);
    expect(target).not.toBeNull();

    // A third club is owed the bonus by the club he plays for.
    const beneficiaryTid = base.teams.find(
      (t) => t.tid !== target!.tid && t.tid !== base.meta.userTid,
    )!.tid;
    const clause: TransferClause = {
      kind: "bonus", pid: target!.pid,
      beneficiaryTid, obligorTid: target!.tid,
      season: base.season, expires: base.season + 3,
      trigger: "appearances", amount: 1_000_000,
    };
    const league: LeagueStore = { ...base, transferClauses: [clause] };

    const budgetOf = (l: LeagueStore, tid: number) => l.teams.find((t) => t.tid === tid)!.budget;
    const withClause = simOffseason(league, mulberry32(22));
    const without = simOffseason(base, mulberry32(22));

    // The clause is spent, not carried forward.
    expect(withClause.transferClauses).toEqual([]);
    // And the money genuinely moved between the two clubs. Compared against the
    // identical offseason run WITHOUT the clause rather than against a raw
    // before/after, since an offseason moves every budget for a dozen other
    // reasons (wages, prize money, transfers).
    expect(budgetOf(withClause, beneficiaryTid) - budgetOf(without, beneficiaryTid))
      .toBe(clause.amount);
    expect(budgetOf(withClause, target!.tid) - budgetOf(without, target!.tid))
      .toBe(-clause.amount);
  });

  it("leaves an unearned bonus alive for another season", () => {
    const rng = mulberry32(11);
    const base = playFullSeason(rng);
    const target = earnedIt(base)!;
    const beneficiaryTid = base.teams.find(
      (t) => t.tid !== target.tid && t.tid !== base.meta.userTid,
    )!.tid;
    // A goals bonus far beyond anything he could have scored.
    const clause: TransferClause = {
      kind: "bonus", pid: target.pid,
      beneficiaryTid, obligorTid: target.tid,
      season: base.season, expires: base.season + 3,
      trigger: "goals", amount: 1_000_000,
    };
    const out = simOffseason({ ...base, transferClauses: [clause] }, mulberry32(22));
    // Survives only if he is still at the club that owes it; the ownership
    // prune is the other half of step 6.7 and would have dropped him otherwise.
    const survived = out.transferClauses.length === 1;
    const soldOrReleased = out.transferClauses.length === 0
      && !out.teams.find((t) => t.tid === target.tid)!.roster.includes(target.pid);
    expect(survived || soldOrReleased).toBe(true);
  });

  it("does not disturb the offseason when no clauses exist", () => {
    const rng = mulberry32(11);
    const base = playFullSeason(rng);
    const a = simOffseason(base, mulberry32(22));
    const b = simOffseason({ ...base, transferClauses: [] }, mulberry32(22));
    expect(a.teams.map((t) => t.budget)).toEqual(b.teams.map((t) => t.budget));
    expect(a.transferClauses).toEqual([]);
  });
});
