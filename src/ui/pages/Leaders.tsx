import { useState } from "react";
import { useLeague } from "../context/LeagueContext.js";
import type { Player, SeasonStats } from "../../core/players/types.js";
import { Flag } from "../components/Flag.js";

type StatKey = "goals" | "assists" | "shots" | "shotsOnTarget" | "saves" | "tackles" | "avgRating";

const STAT_OPTIONS: { key: StatKey; label: string }[] = [
  { key: "goals", label: "Goals" },
  { key: "assists", label: "Assists" },
  { key: "shots", label: "Shots" },
  { key: "shotsOnTarget", label: "Shots on Target" },
  { key: "saves", label: "Saves" },
  { key: "tackles", label: "Tackles" },
  { key: "avgRating", label: "Match Rating" },
];

interface LeaderRow {
  player: Player;
  teamName: string;
  isUserTeam: boolean;
  stats: SeasonStats;
}

export function Leaders() {
  const { league } = useLeague();
  const [stat, setStat] = useState<StatKey>("goals");

  if (!league) {
    return <p className="p-3">Loading...</p>;
  }

  if (league.played.length === 0) {
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
  for (const p of league.players) {
    const ss = p.stats.find((s) => s.season === league.season);
    if (ss && ss[stat] > 0) {
      rows.push({
        player: p,
        teamName: teamByPid.get(p.pid) ?? "Unknown",
        isUserTeam: tidByPid.get(p.pid) === league.meta.userTid,
        stats: ss,
      });
    }
  }
  rows.sort((a, b) => b.stats[stat] - a.stats[stat]);
  const top = rows.slice(0, 30);

  return (
    <div className="container-fluid p-3">
      <h4>Stat Leaders</h4>
      <div className="mb-3">
        <select
          className="form-select form-select-sm"
          style={{ width: "auto", display: "inline-block" }}
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
            <th className="text-end">Apps</th>
            <th className="text-end">G</th>
            <th className="text-end">A</th>
            <th className="text-end">Sh</th>
            <th className="text-end">SoT</th>
            <th className="text-end">Sv</th>
            <th className="text-end">Tkl</th>
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
              <td className="text-end">{row.stats.appearances}</td>
              <td className="text-end">{row.stats.goals}</td>
              <td className="text-end">{row.stats.assists}</td>
              <td className="text-end">{row.stats.shots}</td>
              <td className="text-end">{row.stats.shotsOnTarget}</td>
              <td className="text-end">{row.stats.saves}</td>
              <td className="text-end">{row.stats.tackles}</td>
              <td className="text-end">{row.stats.avgRating.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
