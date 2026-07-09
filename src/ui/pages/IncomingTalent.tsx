import { useLeague } from "../context/LeagueContext.js";
import { freeAgentPids } from "../../core/freeAgency.js";
import { POSITIONS } from "../../core/players/types.js";
import type { Player } from "../../core/players/types.js";

/**
 * Stub for now: lists unsigned players available to sign. The full vision
 * (youth academy, scouted global prospects, transfer windows) is designed
 * but deferred to a later milestone — see memory "M6 finance design".
 */
export function IncomingTalent() {
  const { league, signFreeAgentAction, simming } = useLeague();

  if (!league) {
    return <p className="p-3">Loading...</p>;
  }

  const faPids = freeAgentPids(league.teams, league.players);
  const availablePlayers: Player[] = league.players.filter((p) => faPids.has(p.pid));

  const posOrder = new Map(POSITIONS.map((pos, i) => [pos, i]));
  availablePlayers.sort((a, b) => {
    const posA = posOrder.get(a.pos) ?? 99;
    const posB = posOrder.get(b.pos) ?? 99;
    if (posA !== posB) return posA - posB;
    return b.ovr - a.ovr;
  });

  return (
    <div className="container-fluid p-3">
      <h4>Incoming Talent</h4>
      {availablePlayers.length === 0 ? (
        <p>No available players.</p>
      ) : (
        <table className="table table-striped table-sm">
          <thead>
            <tr>
              <th>Name</th>
              <th>Pos</th>
              <th className="text-end">OVR</th>
              <th className="text-end">Age</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {availablePlayers.map((p) => (
              <tr key={p.pid}>
                <td>{p.name}</td>
                <td>{p.pos}</td>
                <td className="text-end">{p.ovr}</td>
                <td className="text-end">{league.season - p.born}</td>
                <td className="text-end">
                  <button
                    className="btn btn-sm btn-primary"
                    disabled={simming}
                    onClick={() => signFreeAgentAction(p.pid)}
                  >
                    Sign
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
