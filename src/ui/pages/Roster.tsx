import { useLeague } from "../context/LeagueContext.js";
import { POSITIONS } from "../../core/players/types.js";
import type { Player } from "../../core/players/types.js";

export function Roster() {
  const { league } = useLeague();

  if (!league) {
    return <p className="p-3">Loading...</p>;
  }

  const userTeam = league.teams.find((t) => t.tid === league.meta.userTid);
  if (!userTeam) {
    return <p className="p-3">Team not found.</p>;
  }

  // Gather user's players
  const rosterPids = new Set(userTeam.roster);
  const players: Player[] = league.players.filter((p) =>
    rosterPids.has(p.pid),
  );

  // Sort by position order (GK first, then CB, ..., ST), then by OVR desc within position
  const posOrder = new Map(POSITIONS.map((pos, i) => [pos, i]));
  players.sort((a, b) => {
    const posA = posOrder.get(a.pos) ?? 99;
    const posB = posOrder.get(b.pos) ?? 99;
    if (posA !== posB) return posA - posB;
    return b.ovr - a.ovr;
  });

  return (
    <div className="container-fluid p-3">
      <h4>{userTeam.name} Roster</h4>
      {players.length === 0 ? (
        <p>No players on roster.</p>
      ) : (
        <table className="table table-striped table-sm">
          <thead>
            <tr>
              <th>Name</th>
              <th>Pos</th>
              <th className="text-end">OVR</th>
              <th className="text-end">Age</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.pid}>
                <td>{p.name}</td>
                <td>{p.pos}</td>
                <td className="text-end">{p.ovr}</td>
                <td className="text-end">{league.season - p.born}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
