import { useLeague } from "../context/LeagueContext.js";
import { freeAgentPids } from "../../core/freeAgency.js";
import { POSITIONS } from "../../core/players/types.js";
import type { Player } from "../../core/players/types.js";
import { contractTerms } from "../../core/contracts.js";
import { formatWeeklyWage } from "../format.js";
import { Flag } from "../components/Flag.js";
import { PlayerRatingsTooltip } from "../components/PlayerRatingsTooltip.js";
import { ROSTER_CAP, PROSPECT_AGE_MAX } from "../../core/constants.js";

/**
 * General free-agent signing: unsigned players over PROSPECT_AGE_MAX. Young
 * unsigned players (prospects) live on the Incoming Talent page instead,
 * with the option to sign them to the academy.
 */
export function FreeAgents() {
  const { league, signFreeAgentAction, simming } = useLeague();

  if (!league) {
    return <p className="p-3">Loading...</p>;
  }

  const faPids = freeAgentPids(league.teams, league.players);
  const availablePlayers: Player[] = league.players.filter(
    (p) => faPids.has(p.pid) && league.season - p.born > PROSPECT_AGE_MAX,
  );

  const userTeam = league.teams.find((t) => t.tid === league.meta.userTid);
  const atCap = (userTeam?.roster.length ?? 0) >= ROSTER_CAP;
  // Wages are paid up front each season, so a mid-season signing charges the
  // contract's full season salary at signing; offseason signings are covered
  // by the next season-start charge.
  const midSeason = league.phase === "regular";

  const posOrder = new Map(POSITIONS.map((pos, i) => [pos, i]));
  availablePlayers.sort((a, b) => {
    const posA = posOrder.get(a.pos) ?? 99;
    const posB = posOrder.get(b.pos) ?? 99;
    if (posA !== posB) return posA - posB;
    return b.ovr - a.ovr;
  });

  return (
    <div className="container-fluid p-3">
      <h4>Free Agents</h4>
      {atCap && (
        <div className="alert alert-warning">
          Your roster is full ({ROSTER_CAP}/{ROSTER_CAP}). Release a player before signing another.
        </div>
      )}
      {availablePlayers.length === 0 ? (
        <p>No available players.</p>
      ) : (
        <table className="table table-striped table-sm">
          <thead>
            <tr>
              <th>Name</th>
              <th>Pos</th>
              <th className="text-end">OVR</th>
              <th className="text-end">POT</th>
              <th className="text-end">Age</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {availablePlayers.map((p) => {
              const terms = contractTerms(p, league.season);
              const unaffordable = midSeason && terms.salary > (userTeam?.budget ?? 0);
              return (
                <tr key={p.pid}>
                  <td>
                    <PlayerRatingsTooltip player={p}>{p.name}</PlayerRatingsTooltip>{" "}
                    <Flag nationality={p.nationality} />
                  </td>
                  <td>{p.pos}</td>
                  <td className="text-end">{p.ovr}</td>
                  <td className="text-end">{p.potential}</td>
                  <td className="text-end">{league.season - p.born}</td>
                  <td className="text-end">
                    <button
                      className="btn btn-sm btn-primary text-nowrap"
                      disabled={simming || atCap || unaffordable}
                      title={
                        unaffordable
                          ? "Mid-season signings charge the season's wages up front"
                          : undefined
                      }
                      onClick={() => signFreeAgentAction(p.pid)}
                    >
                      Sign {terms.lengthSeasons}y &middot; {formatWeeklyWage(terms.salary)}
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
