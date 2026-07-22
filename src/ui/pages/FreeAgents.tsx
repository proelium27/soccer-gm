import { Link } from "react-router-dom";
import { useLeague } from "../context/LeagueContext.js";
import { HelpHint, PotHelp } from "../components/HelpHint.js";
import { freeAgentPids } from "../../core/freeAgency.js";
import type { Player } from "../../core/players/types.js";
import { contractTerms } from "../../core/contracts.js";
import { formatWeeklyWage } from "../format.js";
import { Flag } from "../components/Flag.js";
import { PlayerRatingsTooltip } from "../components/PlayerRatingsTooltip.js";
import { PotDisplay } from "../components/PotDisplay.js";
import { SortableTh, useTableSort, sortRows } from "../components/SortableTable.js";
import { ROSTER_CAP, PROSPECT_AGE_MAX } from "../../core/constants.js";

const MAX_LISTED = 25;

type FaSortKey = "name" | "pos" | "ovr" | "pot" | "age";

/**
 * General free-agent signing: unsigned players over PROSPECT_AGE_MAX. Young
 * unsigned players (prospects) live on the Incoming Talent page instead,
 * with the option to sign them to the academy.
 */
export function FreeAgents() {
  const { league, signFreeAgentAction, simming } = useLeague();
  const { sort, toggle } = useTableSort<FaSortKey>("ovr", "desc");

  if (!league) {
    return <p className="p-3">Loading...</p>;
  }

  const faPids = freeAgentPids(league.teams, league.players, league.activeLoans);
  const availablePlayers: Player[] = league.players.filter(
    (p) => faPids.has(p.pid) && league.season - p.born > PROSPECT_AGE_MAX,
  );

  const userTeam = league.teams.find((t) => t.tid === league.meta.userTid);
  const atCap = (userTeam?.roster.length ?? 0) >= ROSTER_CAP;
  // Wages are paid up front each season, so a mid-season signing charges the
  // contract's full season salary at signing; offseason signings are covered
  // by the next season-start charge.
  const midSeason = league.phase === "regular";

  // Pool: the top players by OVR+POT (caps the render size). Sorting below only
  // reorders this shown set, so a re-sort never surfaces a 40-ovr filler player.
  availablePlayers.sort((a, b) => b.ovr + b.potential - (a.ovr + a.potential));
  const pool = availablePlayers.slice(0, MAX_LISTED);
  const shownPlayers = sortRows(pool, sort, {
    name: (p) => p.name,
    pos: (p) => p.pos,
    ovr: (p) => p.ovr,
    pot: (p) => p.potential,
    age: (p) => league.season - p.born,
  });

  return (
    <div className="container-fluid p-3">
      <h4>
        Free Agents
        <HelpHint>
          Unsigned players you can add on a free transfer (no fee), at a wage based on their
          rating. Released veterans end up here. Younger prospects live on the Incoming Talent
          page.
        </HelpHint>
      </h4>
      {atCap && (
        <div className="alert alert-warning">
          Your roster is full ({ROSTER_CAP}/{ROSTER_CAP}). Release a player before signing another.
        </div>
      )}
      {availablePlayers.length === 0 ? (
        <p>No available players.</p>
      ) : (
        <>
        <p className="text-muted">
          Showing top {shownPlayers.length} of {availablePlayers.length} by OVR + POT.
        </p>
        <table className="table table-striped table-sm">
          <thead>
            <tr>
              <SortableTh sortKey="name" sort={sort} onSort={toggle} defaultDir="asc">Name</SortableTh>
              <SortableTh sortKey="pos" sort={sort} onSort={toggle} defaultDir="asc">Pos</SortableTh>
              <SortableTh sortKey="ovr" sort={sort} onSort={toggle} className="text-end">OVR</SortableTh>
              <SortableTh sortKey="pot" sort={sort} onSort={toggle} className="text-end">POT <PotHelp /></SortableTh>
              <SortableTh sortKey="age" sort={sort} onSort={toggle} className="text-end" defaultDir="asc">Age</SortableTh>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {shownPlayers.map((p) => {
              const terms = contractTerms(p, league.season);
              const unaffordable = midSeason && terms.salary > (userTeam?.budget ?? 0);
              return (
                <tr key={p.pid}>
                  <td>
                    <PlayerRatingsTooltip player={p}>
                      <Link to={`/player/${p.pid}`}>{p.name}</Link>
                    </PlayerRatingsTooltip>{" "}
                    <Flag nationality={p.nationality} />
                  </td>
                  <td>{p.pos}</td>
                  <td className="text-end">{p.ovr}</td>
                  <td className="text-end"><PotDisplay player={p} /></td>
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
        </>
      )}
    </div>
  );
}
