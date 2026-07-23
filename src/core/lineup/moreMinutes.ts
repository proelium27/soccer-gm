import type { LeagueStore } from "../leagueState.js";

/**
 * Flag (or unflag) one of the user's own players for "more minutes" — the
 * in-match sub logic then favors bringing him on from the bench (see
 * SUB_MINUTES_BOOST). No-op unless the pid is on the user's senior roster.
 * Only ever mutates the user's team; AI clubs never flag anyone.
 */
export function setMoreMinutes(league: LeagueStore, pid: number, enabled: boolean): LeagueStore {
  const userTid = league.meta.userTid;
  return {
    ...league,
    teams: league.teams.map((t) => {
      if (t.tid !== userTid || !t.roster.includes(pid)) return t;
      const has = t.moreMinutes.includes(pid);
      if (enabled === has) return t;
      return {
        ...t,
        moreMinutes: enabled
          ? [...t.moreMinutes, pid]
          : t.moreMinutes.filter((p) => p !== pid),
      };
    }),
  };
}
