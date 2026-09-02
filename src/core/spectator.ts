/**
 * Spectator saves: a league nobody manages.
 *
 * The whole feature is the same one-line trick `autopilot.ts` documents —
 * `meta.userTid` points at a tid no club owns, so the ~110 "do this for every
 * club except `userTid`" gates scattered through the market, free agency,
 * renewals, roster trimming, formation picking, the Division-2 sweep and the
 * finance scale all fall through onto every club in the world. Nothing in
 * `simThrough`/`simOffseason` branches on it, so a spectated season is
 * bit-identical to the season that world would have produced anyway, and the
 * RNG stream is untouched.
 *
 * **What is new here is that the sentinel persists.** `autopilot.ts` is explicit
 * that its own sentinel "can never reach disk — a save carrying it would be a
 * save whose owner manages no club", and `manager/types.ts` states that "there
 * is no unemployed state, by design: every page in the game assumes you have a
 * club". Both were true and both are now qualified rather than repealed:
 *
 * - A **managed** save still cannot reach an unemployed state. A sacked manager
 *   still has to take one of the offers on the table; nothing in the manager
 *   career can strand you.
 * - A **spectator** save is club-free from the moment it is created and stays
 *   that way for its whole life. There is no route in or out, which is what
 *   makes it safe: the handover problems `switchClub` exists to solve (an
 *   academy of zombie players an AI club will never promote, pay off or
 *   release; a stale manual XI; live negotiations with nobody on one end) can
 *   only arise when a club changes hands, and here no club ever does.
 *
 * So the honest statement of the invariant is now: *within one save, whether
 * anybody is managing a club never changes.*
 *
 * ### Why its own sentinel rather than reusing AUTOPILOT_TID
 *
 * The two states are not the same thing and should not be spelled the same way.
 * Autopilot is temporary and reversible by construction — `endAutopilot` puts a
 * real tid back, and the repairs it makes (re-fogging the squad, guaranteeing a
 * fieldable eleven) only mean anything because somebody is about to take the
 * club back. A spectator has no tid to restore and nothing to repair. Sharing
 * one number would make `isSpectator` unanswerable, and would leave the next
 * person to write `if (userTid === AUTOPILOT_TID)` for a jump-specific reason
 * silently catching spectator saves too.
 *
 * A spectator save can still *jump*: `beginAutopilot` swaps -3 for -2 and
 * `endAutopilot` swaps it back, both no-ops in substance because the club-side
 * repairs find no club. That is the correct behaviour and it needed no code.
 */

/**
 * `meta.userTid` for a save with no manager.
 *
 * Negative so it can never collide with a real tid (they are dense indices from
 * 0), and deliberately distinct from the two negatives already in use:
 * `FREE_AGENT_TID` (-1), a live value in `CompletedTransfer.fromTid`/`toTid`,
 * and `AUTOPILOT_TID` (-2), the temporary stand-in a season jump runs under.
 */
export const SPECTATOR_TID = -3;

/** True when this tid means "no club is being managed". */
export function isSpectatorTid(tid: number): boolean {
  return tid === SPECTATOR_TID;
}

/**
 * True when nobody manages a club in this save.
 *
 * Typed structurally rather than against `LeagueStore` so the predicate can be
 * called from `core` modules that `leagueState.ts` itself imports.
 */
export function isSpectator(league: { meta: { userTid: number } }): boolean {
  return isSpectatorTid(league.meta.userTid);
}
