import { useState } from "react";
import { useLeague } from "../context/LeagueContext.js";
import type { Player, SeasonStats } from "../../core/players/types.js";
import { emptySeasonStats } from "../../core/players/types.js";
import { Flag } from "../components/Flag.js";

type StatKey =
  | "goals"
  | "assists"
  | "shots"
  | "shotsOnTarget"
  | "saves"
  | "tackles"
  | "interceptions"
  | "avgRating"
  | "minutesPlayed";

const STAT_OPTIONS: { key: StatKey; label: string }[] = [
  { key: "goals", label: "Goals" },
  { key: "assists", label: "Assists" },
  { key: "shots", label: "Shots" },
  { key: "shotsOnTarget", label: "Shots on Target" },
  { key: "saves", label: "Saves" },
  { key: "tackles", label: "Tackles" },
  { key: "interceptions", label: "Interceptions" },
  { key: "avgRating", label: "Match Rating" },
  { key: "minutesPlayed", label: "Minutes" },
];

type Scope = "career" | "single";

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
    total.saves += s.saves;
    total.tackles += s.tackles;
    total.interceptions += s.interceptions;
    total.minutesPlayed += s.minutesPlayed;
    total.ratingSum += s.ratingSum;
  }
  total.avgRating = total.appearances > 0 ? total.ratingSum / total.appearances : 0;
  return total;
}

export function Leaders() {
  const { league } = useLeague();
  const [stat, setStat] = useState<StatKey>("goals");
  const [season, setSeason] = useState<number | "all">("all");
  const [scope, setScope] = useState<Scope>("career");

  if (!league) {
    return <p className="p-3">Loading...</p>;
  }

  const seasonOptions = [
    ...new Set(league.players.flatMap((p) => p.stats.map((s) => s.season))),
  ].sort((a, b) => b - a);

  if (seasonOptions.length === 0) {
    return (
      <div className="container-fluid p-3">
        <h4>Stat Leaders</h4>
        <p>No matches played yet.</p>
      </div>
    );
  }

  const teamByPid = new Map<number, string>();
  const tidByPid = new Map<number, number>();
  for (const team of league.teams) {
    for (const pid of team.roster) {
      teamByPid.set(pid, team.name);
      tidByPid.set(pid, team.tid);
    }
  }

  const rows: LeaderRow[] = [];
  if (season !== "all") {
    for (const p of league.players) {
      const ss = p.stats.find((s) => s.season === season);
      if (ss && ss[stat] > 0) {
        rows.push({
          player: p,
          teamName: teamByPid.get(p.pid) ?? "Unknown",
          isUserTeam: tidByPid.get(p.pid) === league.meta.userTid,
          stats: ss,
          season: null,
        });
      }
    }
  } else if (scope === "career") {
    for (const p of league.players) {
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
    // Single season: each player's own best individual season for this stat.
    for (const p of league.players) {
      let best: SeasonStats | null = null;
      for (const s of p.stats) {
        if (s[stat] > 0 && (!best || s[stat] > best[stat])) best = s;
      }
      if (best) {
        rows.push({
          player: p,
          teamName: teamByPid.get(p.pid) ?? "Unknown",
          isUserTeam: tidByPid.get(p.pid) === league.meta.userTid,
          stats: best,
          season: best.season,
        });
      }
    }
  }
  rows.sort((a, b) => b.stats[stat] - a.stats[stat]);
  const top = rows.slice(0, 30);
  const showSeasonColumn = season === "all" && scope === "single";

  return (
    <div className="container-fluid p-3">
      <h4>Stat Leaders</h4>
      <div className="mb-3 d-flex gap-2">
        <select
          className="form-select form-select-sm"
          style={{ width: "auto" }}
          value={season}
          onChange={(e) => setSeason(e.target.value === "all" ? "all" : Number(e.target.value))}
        >
          <option value="all">All Seasons</option>
          {seasonOptions.map((s) => (
            <option key={s} value={s}>{s}</option>
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
            <th className="text-end">Sv</th>
            <th className="text-end">Tkl</th>
            <th className="text-end">Int</th>
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
                {row.player.name} <Flag nationality={row.player.nationality} />
              </td>
              <td>{row.teamName}</td>
              <td>{row.player.pos}</td>
              {showSeasonColumn && <td className="text-end">{row.season}</td>}
              <td className="text-end">{row.stats.appearances}</td>
              <td className="text-end">{row.stats.minutesPlayed}</td>
              <td className="text-end">{row.stats.goals}</td>
              <td className="text-end">{row.stats.assists}</td>
              <td className="text-end">{row.stats.shots}</td>
              <td className="text-end">{row.stats.shotsOnTarget}</td>
              <td className="text-end">{row.stats.saves}</td>
              <td className="text-end">{row.stats.tackles}</td>
              <td className="text-end">{row.stats.interceptions}</td>
              <td className="text-end">{row.stats.avgRating.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
