import type { LeagueStore } from "../leagueState.js";

/** A user edit to one club's identity from the Customize Teams editor. */
export interface TeamIdentityEdit {
  tid: number;
  name: string;
  abbrev: string;
  colors: [string, string];
}

/**
 * Apply user edits to club identities. Leagues are named after the user's
 * club at creation, so a rename of that club carries over to the league name
 * — but only while they still match, so a league name the user has diverged
 * (e.g. via a future rename-league feature) is left alone.
 */
export function applyTeamIdentities(
  league: LeagueStore,
  edits: TeamIdentityEdit[],
): LeagueStore {
  const byTid = new Map(edits.map((e) => [e.tid, e]));
  const oldUserName = league.teams.find((t) => t.tid === league.meta.userTid)?.name;
  const teams = league.teams.map((t) => {
    const edit = byTid.get(t.tid);
    return edit
      ? {
          ...t,
          name: edit.name.trim(),
          abbrev: edit.abbrev.trim().toUpperCase(),
          colors: edit.colors,
        }
      : t;
  });
  const newUserName = teams.find((t) => t.tid === league.meta.userTid)?.name;
  const meta =
    oldUserName && newUserName && league.meta.name === oldUserName
      ? { ...league.meta, name: newUserName }
      : league.meta;
  return { ...league, teams, meta };
}
