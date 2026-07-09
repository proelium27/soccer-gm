import { useLeague } from "../context/LeagueContext.js";
import { computeStandings } from "../../core/standings.js";

export function Standings() {
  const { league } = useLeague();

  if (!league) {
    return <p className="p-3">Loading...</p>;
  }

  const standings = computeStandings(
    league.teams.map((t) => t.tid),
    league.played,
  );

  if (league.played.length === 0) {
    return (
      <div className="container-fluid p-3">
        <h4>Standings</h4>
        <p>No matches played yet.</p>
      </div>
    );
  }

  return (
    <div className="container-fluid p-3">
      <h4>Standings</h4>
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
            return (
              <tr key={row.tid} className={isUser ? "team-highlight" : undefined}>
                <td className="text-end">{i + 1}</td>
                <td>
                  <span className="d-inline-flex align-items-center gap-1">
                    <span
                      className="color-swatch"
                      style={{ backgroundColor: team?.colors[0] }}
                    />
                    {team?.name ?? `Team ${row.tid}`}
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
    </div>
  );
}
