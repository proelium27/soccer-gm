import { useState } from "react";
import { useLeague } from "../context/LeagueContext.js";
import { computeStandings, type StandingsRow } from "../../core/standings.js";
import { seasonYear } from "../format.js";

export function Standings() {
  const { league } = useLeague();
  const [season, setSeason] = useState<number | "current">("current");

  if (!league) {
    return <p className="p-3">Loading...</p>;
  }

  if (league.played.length === 0 && league.seasonHistory.length === 0) {
    return (
      <div className="container-fluid p-3">
        <h4>Standings</h4>
        <p>No matches played yet.</p>
      </div>
    );
  }

  const seasonOptions = [...league.seasonHistory.map((h) => h.season)].sort((a, b) => b - a);

  let standings: StandingsRow[];
  let championTid: number;
  if (season === "current") {
    standings = computeStandings(
      league.teams.map((t) => t.tid),
      league.played,
    );
    // A "champion" only means something once the season has actually been
    // decided by played matches, not an arbitrary tid=0 tie at kickoff.
    championTid = league.played.length > 0 ? (standings[0]?.tid ?? -1) : -1;
  } else {
    const entry = league.seasonHistory.find((h) => h.season === season)!;
    standings = entry.table;
    championTid = entry.championTid;
  }

  return (
    <div className="container-fluid p-3">
      <h4>Standings</h4>
      <div className="mb-3">
        <select
          className="form-select form-select-sm"
          style={{ width: "auto", display: "inline-block" }}
          value={season}
          onChange={(e) => setSeason(e.target.value === "current" ? "current" : Number(e.target.value))}
        >
          <option value="current">Current Season ({seasonYear(league.season)})</option>
          {seasonOptions.map((s) => (
            <option key={s} value={s}>{seasonYear(s)}</option>
          ))}
        </select>
      </div>
      {standings.length === 0 ? (
        <p>No matches played yet.</p>
      ) : (
        <table className="table table-striped table-sm">
          <thead>
            <tr>
              <th className="text-end">#</th>
              <th>Team</th>
              <th className="text-end">P</th>
              <th className="text-end">W</th>
              <th className="text-end">D</th>
              <th className="text-end">L</th>
              <th className="text-end">GF</th>
              <th className="text-end">GA</th>
              <th className="text-end">GD</th>
              <th className="text-end">Pts</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row, i) => {
              const team = league.teams.find((t) => t.tid === row.tid);
              const isUser = row.tid === league.meta.userTid;
              const isChampion = row.tid === championTid;
              const rowClass = [isUser && "team-highlight", isChampion && "champion-highlight"]
                .filter(Boolean)
                .join(" ") || undefined;
              return (
                <tr key={row.tid} className={rowClass}>
                  <td className="text-end">{i + 1}</td>
                  <td>
                    <span className="d-inline-flex align-items-center gap-1">
                      <span
                        className="color-swatch"
                        style={{ backgroundColor: team?.colors[0] }}
                      />
                      {team?.name ?? `Team ${row.tid}`}
                      {isChampion && <span className="text-muted small"> (Champion)</span>}
                    </span>
                  </td>
                  <td className="text-end">{row.played}</td>
                  <td className="text-end">{row.won}</td>
                  <td className="text-end">{row.drawn}</td>
                  <td className="text-end">{row.lost}</td>
                  <td className="text-end">{row.gf}</td>
                  <td className="text-end">{row.ga}</td>
                  <td className="text-end">{row.gd}</td>
                  <td className="text-end">{row.points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
