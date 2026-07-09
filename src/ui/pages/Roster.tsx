import { useLeague } from "../context/LeagueContext.js";
import { POSITIONS } from "../../core/players/types.js";
import type { Player } from "../../core/players/types.js";
import { RatingDelta, previousRatings } from "../components/RatingDelta.js";

export function Roster() {
  const { league, releasePlayerAction } = useLeague();

  if (!league) {
    return <p className="p-3">Loading...</p>;
  }

  const userTeam = league.teams.find((t) => t.tid === league.meta.userTid);
  if (!userTeam) {
    return <p className="p-3">Team not found.</p>;
  }

  const rosterPids = new Set(userTeam.roster);
  const players: Player[] = league.players.filter((p) =>
    rosterPids.has(p.pid),
  );

  const posOrder = new Map(POSITIONS.map((pos, i) => [pos, i]));
  players.sort((a, b) => {
    const posA = posOrder.get(a.pos) ?? 99;
    const posB = posOrder.get(b.pos) ?? 99;
    if (posA !== posB) return posA - posB;
    return b.ovr - a.ovr;
  });

  const hasStats = league.played.length > 0;

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
              <th className="text-end">Age</th>
              <th className="text-end">Ovr</th>
              <th className="text-end">Pot</th>
              {hasStats && (
                <>
                  <th className="text-end">Apps</th>
                  <th className="text-end">G</th>
                  <th className="text-end">A</th>
                  <th className="text-end">Sh</th>
                  <th className="text-end">Sv</th>
                  <th className="text-end">Tkl</th>
                </>
              )}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => {
              const ss = p.stats.find((s) => s.season === league.season);
              const prev = previousRatings(p);
              return (
                <tr key={p.pid}>
                  <td>{p.name}</td>
                  <td>{p.pos}</td>
                  <td className="text-end">{league.season - p.born}</td>
                  <td className="text-end">
                    <RatingDelta value={p.ovr} previous={prev?.ovr ?? null} />
                  </td>
                  <td className="text-end">
                    <RatingDelta value={p.potential} previous={prev?.potential ?? null} />
                  </td>
                  {hasStats && (
                    <>
                      <td className="text-end">{ss?.appearances ?? 0}</td>
                      <td className="text-end">{ss?.goals ?? 0}</td>
                      <td className="text-end">{ss?.assists ?? 0}</td>
                      <td className="text-end">{ss?.shots ?? 0}</td>
                      <td className="text-end">{ss?.saves ?? 0}</td>
                      <td className="text-end">{ss?.tackles ?? 0}</td>
                    </>
                  )}
                  <td className="text-end">
                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => releasePlayerAction(p.pid)}
                    >
                      Release
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
