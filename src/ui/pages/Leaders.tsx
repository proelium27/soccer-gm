import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLeague } from "../context/LeagueContext.js";
import type { LeagueStore } from "../../core/leagueState.js";
import type { Player, SeasonStats } from "../../core/players/types.js";
import { emptySeasonStats } from "../../core/players/types.js";
import { computeTeamSeasonStats, type TeamSeasonStats } from "../../core/standings.js";
import { Flag } from "../components/Flag.js";
import { PlayerRatingsTooltip } from "../components/PlayerRatingsTooltip.js";
import { CompetitionSelect } from "../components/CompetitionSelect.js";
import { seasonYear } from "../format.js";
import {
  RATING_LEADER_QUALIFY_FRACTION,
  RATING_LEADER_MIN_CAREER_APPEARANCES,
} from "../../core/constants.js";

type StatKey =
  | "goals"
  | "assists"
  | "shots"
  | "shotsOnTarget"
  | "xg"
  | "saves"
  | "tackles"
  | "interceptions"
  | "passes"
  | "crosses"
  | "foulsCommitted"
  | "avgRating"
  | "minutesPlayed";

const STAT_OPTIONS: { key: StatKey; label: string }[] = [
  { key: "goals", label: "Goals" },
  { key: "assists", label: "Assists" },
  { key: "shots", label: "Shots" },
  { key: "shotsOnTarget", label: "Shots on Target" },
  { key: "xg", label: "xG" },
  { key: "saves", label: "Saves" },
  { key: "tackles", label: "Tackles" },
  { key: "interceptions", label: "Interceptions" },
  { key: "passes", label: "Passes" },
  { key: "crosses", label: "Crosses" },
  { key: "foulsCommitted", label: "Fouls" },
  { key: "avgRating", label: "Match Rating" },
  { key: "minutesPlayed", label: "Minutes" },
];

type Scope = "career" | "single";
type LeadersTab = "players" | "teams";

interface LeaderRow {
  player: Player;
  teamName: string;
  isUserTeam: boolean;
  stats: SeasonStats;
  /** Which season this row's stat line belongs to; shown when browsing all seasons. */
  season: number | null;
}

/** Sum a player's stats across every season into one aggregate line. */
function careerTotals(seasons: SeasonStats[]): SeasonStats {
  const total = emptySeasonStats(0);
  for (const s of seasons) {
    total.appearances += s.appearances;
    total.goals += s.goals;
    total.assists += s.assists;
    total.shots += s.shots;
    total.shotsOnTarget += s.shotsOnTarget;
    total.xg += s.xg;
    total.saves += s.saves;
    total.tackles += s.tackles;
    total.interceptions += s.interceptions;
    total.passes += s.passes;
    total.passesCompleted += s.passesCompleted;
    total.crosses += s.crosses;
    total.foulsCommitted += s.foulsCommitted;
    total.minutesPlayed += s.minutesPlayed;
    total.ratingSum += s.ratingSum;
  }
  total.avgRating = total.appearances > 0 ? total.ratingSum / total.appearances : 0;
  return total;
}

export function Leaders() {
  const { league } = useLeague();
  const [tab, setTab] = useState<LeadersTab>("players");
  const [compIdOverride, setCompIdOverride] = useState<number | null>(null);

  if (!league) {
    return <p className="p-3">Loading...</p>;
  }

  const userTeam = league.teams.find((t) => t.tid === league.meta.userTid);
  const compId = compIdOverride ?? userTeam?.compId ?? league.competitions[0].id;

  return (
    <div className="container-fluid p-3">
      <h4>Stat Leaders</h4>
      <div className="mb-3 d-flex gap-2 align-items-center">
        <div className="btn-group" role="group">
          <button
            type="button"
            className={`btn btn-sm ${tab === "players" ? "btn-primary" : "btn-outline-primary"}`}
            onClick={() => setTab("players")}
          >
            Players
          </button>
          <button
            type="button"
            className={`btn btn-sm ${tab === "teams" ? "btn-primary" : "btn-outline-primary"}`}
            onClick={() => setTab("teams")}
          >
            Teams
          </button>
        </div>
        <CompetitionSelect
          competitions={league.competitions}
          value={compId}
          onChange={(v) => setCompIdOverride(v === "all" ? null : v)}
          style={{ width: "auto" }}
        />
      </div>
      {tab === "players" ? <PlayerLeaders compId={compId} /> : <TeamLeaders compId={compId} />}
    </div>
  );
}

function PlayerLeaders({ compId }: { compId: number }) {
  const { league } = useLeague();

  const seasonOptions = useMemo(
    () => [
      ...new Set((league?.players ?? []).flatMap((p) => p.stats.map((s) => s.season))),
    ].sort((a, b) => b - a),
    [league?.players],
  );

  if (!league) {
    return <p className="p-3">Loading...</p>;
  }

  if (seasonOptions.length === 0) {
    return <p>No matches played yet.</p>;
  }

  return <PlayerLeadersBody league={league} compId={compId} seasonOptions={seasonOptions} />;
}

// Split out from the guards above so its hooks run unconditionally, which lets
// every derivation below be memoized. All of it is O(players) — three separate
// scans over the whole world's player pool, each reading multi-season stat
// histories — and all of it sits directly on the interaction path: changing the
// season, scope, or stat dropdown re-renders this component. Unmemoized, each
// of those clicks redid the lot, which is what put this page's INP in the
// 8-14 second range on mobile.
function PlayerLeadersBody({
  league,
  compId,
  seasonOptions,
}: {
  league: LeagueStore;
  compId: number;
  seasonOptions: number[];
}) {
  const [stat, setStat] = useState<StatKey>("goals");
  const [season, setSeason] = useState<number | "all">("all");
  const [scope, setScope] = useState<Scope>("career");
  const [initializedSeason, setInitializedSeason] = useState(false);

  useEffect(() => {
    if (initializedSeason) return;
    if (seasonOptions.includes(league.season)) {
      setSeason(league.season);
    } else if (seasonOptions.length > 0) {
      // The current season has no recorded stats yet (e.g. right after
      // advancing to a new season, before its first match) — default to the
      // most recent season that actually has something to show instead of
      // silently falling back to "All Seasons".
      setSeason(seasonOptions[0]);
    }
    setInitializedSeason(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [league, initializedSeason]);

  // A player's *current* team (used for the Career aggregate, which spans
  // many seasons and has no single "correct" historical team to show).
  const { teamByPid, tidByPid, compTids } = useMemo(() => {
    const teamByPid = new Map<number, string>();
    const tidByPid = new Map<number, number>();
    const compTids = new Set<number>();
    for (const team of league.teams) {
      if (team.compId !== compId) continue;
      compTids.add(team.tid);
      for (const pid of team.roster) {
        teamByPid.set(pid, team.name);
        tidByPid.set(pid, team.tid);
      }
    }
    return { teamByPid, tidByPid, compTids };
  }, [league.teams, compId]);

  // How many games this competition has played in a given season — the
  // denominator the Match Rating qualifier takes a fraction of. The current
  // season is in progress (count distinct matchdays played so far); any earlier
  // season is complete, so it's the full double round-robin.
  const matchesPlayedInSeason = useMemo(() => {
    const mds = new Set<number>();
    for (const m of league.played) {
      if (compTids.has(m.home) || compTids.has(m.away)) mds.add(m.matchday);
    }
    const currentMatchdaysPlayed = mds.size;
    const fullSeasonMatches = Math.max(0, 2 * (compTids.size - 1));
    return (s: number): number =>
      s === league.season ? currentMatchdaysPlayed : fullSeasonMatches;
  }, [league.played, league.season, compTids]);

  // A specific season's stat line carries the team the player was actually
  // on that season (SeasonStats.tid); this map resolves any tid to its
  // current display name/division, since a club's compId can itself have
  // changed since then (promotion/relegation).
  const { teamNameByTid, compByTidForSeason } = useMemo(() => {
    const teamNameByTid = new Map<number, string>();
    const currentCompByTid = new Map<number, number>();
    for (const team of league.teams) {
      teamNameByTid.set(team.tid, team.name);
      currentCompByTid.set(team.tid, team.compId);
    }
    const compByTidCache = new Map<number, Map<number, number>>();
    const compByTidForSeason = (s: number): Map<number, number> => {
      let m = compByTidCache.get(s);
      if (!m) {
        const entry = league.seasonHistory.find((h) => h.season === s);
        m = entry
          ? new Map(Object.entries(entry.compsByTid).map(([k, v]) => [Number(k), v]))
          : currentCompByTid;
        compByTidCache.set(s, m);
      }
      return m;
    };
    return { teamNameByTid, compByTidForSeason };
  }, [league.teams, league.seasonHistory]);

  const rows = useMemo(() => {
    const rows: LeaderRow[] = [];
    if (season !== "all") {
      const compByTid = compByTidForSeason(season);
      for (const p of league.players) {
        const ss = p.stats.find((s) => s.season === season);
        if (!ss || ss[stat] <= 0) continue;
        if (compByTid.get(ss.tid) !== compId) continue;
        rows.push({
          player: p,
          teamName: teamNameByTid.get(ss.tid) ?? "Unknown",
          isUserTeam: ss.tid === league.meta.userTid,
          stats: ss,
          season: null,
        });
      }
    } else if (scope === "career") {
      for (const p of league.players) {
        if (!tidByPid.has(p.pid)) continue;
        const total = careerTotals(p.stats);
        if (total[stat] > 0) {
          rows.push({
            player: p,
            teamName: teamByPid.get(p.pid) ?? "Unknown",
            isUserTeam: tidByPid.get(p.pid) === league.meta.userTid,
            stats: total,
            season: null,
          });
        }
      }
    } else {
      // Single season: each player's own best individual season for this stat,
      // shown with the team he was actually on that season.
      for (const p of league.players) {
        let best: SeasonStats | null = null;
        for (const s of p.stats) {
          if (s[stat] > 0 && (!best || s[stat] > best[stat])) best = s;
        }
        if (!best) continue;
        const compByTid = compByTidForSeason(best.season);
        if (compByTid.get(best.tid) !== compId) continue;
        rows.push({
          player: p,
          teamName: teamNameByTid.get(best.tid) ?? "Unknown",
          isUserTeam: best.tid === league.meta.userTid,
          stats: best,
          season: best.season,
        });
      }
    }
    return rows;
  }, [
    league.players, league.meta.userTid, season, scope, stat, compId,
    compByTidForSeason, teamNameByTid, teamByPid, tidByPid,
  ]);

  // Match Rating is an average, so a player with only a game or two of data
  // would otherwise sit atop the chart on a single hot cameo. Require him to
  // have appeared in a fraction of the games played *so far* — scaling to
  // games-played keeps the board honest ten games in as well as at season's
  // end (counting stats like goals are unaffected).
  const top = useMemo(() => {
    const appsToQualify = (s: number): number =>
      Math.max(1, Math.ceil(RATING_LEADER_QUALIFY_FRACTION * matchesPlayedInSeason(s)));
    let ratingQualifies: (row: LeaderRow) => boolean;
    if (season !== "all") {
      const threshold = appsToQualify(season);
      ratingQualifies = (r) => r.stats.appearances >= threshold;
    } else if (scope === "career") {
      // Career aggregate spans many seasons — use a flat cumulative floor.
      ratingQualifies = (r) => r.stats.appearances >= RATING_LEADER_MIN_CAREER_APPEARANCES;
    } else {
      // Single best season: each row carries its own season (row.season).
      ratingQualifies = (r) => r.stats.appearances >= appsToQualify(r.season ?? league.season);
    }
    const qualified = stat === "avgRating" ? rows.filter(ratingQualifies) : rows;
    return [...qualified].sort((a, b) => b.stats[stat] - a.stats[stat]).slice(0, 30);
  }, [rows, stat, season, scope, league.season, matchesPlayedInSeason]);

  const showSeasonColumn = season === "all" && scope === "single";

  return (
    <>
      <div className="mb-3 d-flex gap-2">
        <select
          className="form-select form-select-sm"
          style={{ width: "auto" }}
          value={season}
          onChange={(e) => setSeason(e.target.value === "all" ? "all" : Number(e.target.value))}
        >
          <option value="all">All Seasons</option>
          {seasonOptions.map((s) => (
            <option key={s} value={s}>{seasonYear(s)}</option>
          ))}
        </select>
        {season === "all" && (
          <select
            className="form-select form-select-sm"
            style={{ width: "auto" }}
            value={scope}
            onChange={(e) => setScope(e.target.value as Scope)}
          >
            <option value="career">Career</option>
            <option value="single">Single Season</option>
          </select>
        )}
        <select
          className="form-select form-select-sm"
          style={{ width: "auto" }}
          value={stat}
          onChange={(e) => setStat(e.target.value as StatKey)}
        >
          {STAT_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>{o.label}</option>
          ))}
        </select>
      </div>
      <table className="table table-striped table-sm">
        <thead>
          <tr>
            <th className="text-end">#</th>
            <th>Player</th>
            <th>Team</th>
            <th>Pos</th>
            {showSeasonColumn && <th className="text-end">Season</th>}
            <th className="text-end">Apps</th>
            <th className="text-end">Min</th>
            <th className="text-end">G</th>
            <th className="text-end">A</th>
            <th className="text-end">Sh</th>
            <th className="text-end">SoT</th>
            <th className="text-end">xG</th>
            <th className="text-end">Sv</th>
            <th className="text-end">Tkl</th>
            <th className="text-end">Int</th>
            <th className="text-end" title="Passes completed / attempted">Pass</th>
            <th className="text-end" title="Crosses">Crs</th>
            <th className="text-end" title="Fouls committed">Fls</th>
            <th className="text-end">Rtg</th>
          </tr>
        </thead>
        <tbody>
          {top.map((row, i) => (
            <tr
              key={row.player.pid}
              className={row.isUserTeam ? "text-primary fw-semibold" : undefined}
            >
              <td className="text-end">{i + 1}</td>
              <td>
                <PlayerRatingsTooltip player={row.player}>
                  <Link to={`/player/${row.player.pid}`}>{row.player.name}</Link>
                </PlayerRatingsTooltip>{" "}
                <Flag nationality={row.player.nationality} />
              </td>
              <td>{row.teamName}</td>
              <td>{row.player.pos}</td>
              {showSeasonColumn && row.season !== null && (
                <td className="text-end">{seasonYear(row.season)}</td>
              )}
              <td className="text-end">{row.stats.appearances}</td>
              <td className="text-end">{row.stats.minutesPlayed}</td>
              <td className="text-end">{row.stats.goals}</td>
              <td className="text-end">{row.stats.assists}</td>
              <td className="text-end">{row.stats.shots}</td>
              <td className="text-end">{row.stats.shotsOnTarget}</td>
              <td className="text-end">{row.stats.xg.toFixed(2)}</td>
              <td className="text-end">{row.stats.saves}</td>
              <td className="text-end">{row.stats.tackles}</td>
              <td className="text-end">{row.stats.interceptions}</td>
              <td className="text-end">{row.stats.passes ? `${row.stats.passesCompleted}/${row.stats.passes}` : ""}</td>
              <td className="text-end">{row.stats.crosses}</td>
              <td className="text-end">{row.stats.foulsCommitted}</td>
              <td className="text-end">{row.stats.avgRating.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

type TeamStatKey =
  | "goals" | "assists" | "shots" | "shotsOnTarget" | "xg" | "goalsAgainst" | "xga"
  | "saves" | "tackles" | "possessionPct" | "avgRating";

const TEAM_STAT_OPTIONS: { key: TeamStatKey; label: string }[] = [
  { key: "goals", label: "Goals" },
  { key: "assists", label: "Assists" },
  { key: "shots", label: "Shots" },
  { key: "shotsOnTarget", label: "Shots on Target" },
  { key: "xg", label: "xG" },
  { key: "goalsAgainst", label: "Goals Against" },
  { key: "xga", label: "xG Against" },
  { key: "saves", label: "Saves" },
  { key: "tackles", label: "Tackles" },
  { key: "possessionPct", label: "Possession" },
  { key: "avgRating", label: "Match Rating" },
];

interface TeamLeaderRow extends TeamSeasonStats {
  teamName: string;
  isUserTeam: boolean;
}

function TeamLeaders({ compId }: { compId: number }) {
  const { league } = useLeague();
  const [stat, setStat] = useState<TeamStatKey>("goals");
  const [season, setSeason] = useState<number | "current">("current");

  if (!league) {
    return <p className="p-3">Loading...</p>;
  }

  const seasonOptions = [...league.seasonHistory.map((h) => h.season)].sort((a, b) => b - a);

  if (league.played.length === 0 && seasonOptions.length === 0) {
    return <p>No matches played yet.</p>;
  }

  const teamIds = league.teams.filter((t) => t.compId === compId).map((t) => t.tid);
  const teamStats: TeamSeasonStats[] = season === "current"
    ? computeTeamSeasonStats(teamIds, league.played)
    : (league.seasonHistory.find((h) => h.season === season)?.teamStats ?? [])
        .filter((s) => league.seasonHistory.find((h) => h.season === season)?.compsByTid[s.tid] === compId);

  const teamByTid = new Map(league.teams.map((t) => [t.tid, t.name]));
  const rows: TeamLeaderRow[] = teamStats.map((s) => ({
    ...s,
    teamName: teamByTid.get(s.tid) ?? "Unknown",
    isUserTeam: s.tid === league.meta.userTid,
  }));
  rows.sort((a, b) => b[stat] - a[stat]);

  return (
    <>
      <div className="mb-3 d-flex gap-2">
        <select
          className="form-select form-select-sm"
          style={{ width: "auto" }}
          value={season}
          onChange={(e) => setSeason(e.target.value === "current" ? "current" : Number(e.target.value))}
        >
          <option value="current">Current Season ({seasonYear(league.season)})</option>
          {seasonOptions.map((s) => (
            <option key={s} value={s}>{seasonYear(s)}</option>
          ))}
        </select>
        <select
          className="form-select form-select-sm"
          style={{ width: "auto" }}
          value={stat}
          onChange={(e) => setStat(e.target.value as TeamStatKey)}
        >
          {TEAM_STAT_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>{o.label}</option>
          ))}
        </select>
      </div>
      {rows.length === 0 ? (
        <p className="text-muted">
          No team stats recorded for this season (saves from before Team Stat Leaders history
          don't have box-score data for seasons that already ended).
        </p>
      ) : (
        <table className="table table-striped table-sm">
          <thead>
            <tr>
              <th className="text-end">#</th>
              <th>Team</th>
              <th className="text-end">Pld</th>
              <th className="text-end">G</th>
              <th className="text-end">A</th>
              <th className="text-end">Sh</th>
              <th className="text-end">SoT</th>
              <th className="text-end">xG</th>
              <th className="text-end">GA</th>
              <th className="text-end">xGA</th>
              <th className="text-end">Sv</th>
              <th className="text-end">Tkl</th>
              <th className="text-end">Poss%</th>
              <th className="text-end">Rtg</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.tid}
                className={row.isUserTeam ? "text-primary fw-semibold" : undefined}
              >
                <td className="text-end">{i + 1}</td>
                <td>{row.teamName}</td>
                <td className="text-end">{row.played}</td>
                <td className="text-end">{row.goals}</td>
                <td className="text-end">{row.assists}</td>
                <td className="text-end">{row.shots}</td>
                <td className="text-end">{row.shotsOnTarget}</td>
                <td className="text-end">{row.xg.toFixed(2)}</td>
                <td className="text-end">{row.goalsAgainst}</td>
                <td className="text-end">{row.xga.toFixed(2)}</td>
                <td className="text-end">{row.saves}</td>
                <td className="text-end">{row.tackles}</td>
                <td className="text-end">{row.possessionPct.toFixed(1)}</td>
                <td className="text-end">{row.avgRating.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
