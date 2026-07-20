import { Link } from "react-router-dom";
import { useLeague } from "../context/LeagueContext.js";
import { PotHelp } from "../components/HelpHint.js";
import { freeAgentPids } from "../../core/freeAgency.js";
import type { Player } from "../../core/players/types.js";
import { contractTerms } from "../../core/contracts.js";
import { formatWeeklyWage } from "../format.js";
import { Flag } from "../components/Flag.js";
import { PlayerRatingsTooltip } from "../components/PlayerRatingsTooltip.js";
import { PotDisplay } from "../components/PotDisplay.js";
import { ROSTER_CAP, ACADEMY_ROSTER_CAP, PROSPECT_AGE_MAX } from "../../core/constants.js";

const MAX_LISTED = 25;

/**
 * Unsigned young players (age <= PROSPECT_AGE_MAX) available to sign — either
 * straight to the senior roster, or into the academy to develop first. Older
 * free agents live on the separate Free Agents page.
 */
export function IncomingTalent() {
  const { league, signFreeAgentAction, signToAcademyAction, simming } = useLeague();

  if (!league) {
    return <p className="p-3">Loading...</p>;
  }

  const faPids = freeAgentPids(league.teams, league.players, league.activeLoans);
  const availablePlayers: Player[] = league.players.filter(
    (p) => faPids.has(p.pid) && league.season - p.born <= PROSPECT_AGE_MAX,
  );

  const userTeam = league.teams.find((t) => t.tid === league.meta.userTid);
  const atRosterCap = (userTeam?.roster.length ?? 0) >= ROSTER_CAP;
  const atAcademyCap = (userTeam?.academyRoster.length ?? 0) >= ACADEMY_ROSTER_CAP;
  // Wages are paid up front each season, so a mid-season signing charges the
  // contract's full season salary at signing; offseason signings are covered
  // by the next season-start charge.
  const midSeason = league.phase === "regular";

  availablePlayers.sort((a, b) => b.ovr + b.potential - (a.ovr + a.potential));
  const shownPlayers = availablePlayers.slice(0, MAX_LISTED);

  return (
    <div className="container-fluid p-3">
      <h4>Incoming Talent</h4>
      <p className="text-muted" style={{ maxWidth: "48rem" }}>
        Every club's yearly academy intake is shaped by two things: a fixed academy strength set
        when the league was created, and how the club's finished in its league over the last few
        seasons. Young players are drawn to clubs that have been winning and steer clear of the
        strugglers. Your own intake lands on the Academy page each offseason, and the prospects
        below are the unsigned ones no club has claimed, free to join anyone.
      </p>
      {atRosterCap && (
        <div className="alert alert-warning">
          Your roster is full ({ROSTER_CAP}/{ROSTER_CAP}), so signing to the senior team is disabled.
        </div>
      )}
      {atAcademyCap && (
        <div className="alert alert-warning">
          Your academy is full ({ACADEMY_ROSTER_CAP}/{ACADEMY_ROSTER_CAP}), so signing to the
          academy is disabled.
        </div>
      )}
      {availablePlayers.length === 0 ? (
        <p>No available prospects.</p>
      ) : (
        <>
        <p className="text-muted">
          Showing top {shownPlayers.length} of {availablePlayers.length} by OVR + POT.
        </p>
        <table className="table table-striped table-sm">
          <thead>
            <tr>
              <th>Name</th>
              <th>Pos</th>
              <th className="text-end">OVR</th>
              <th className="text-end">POT <PotHelp /></th>
              <th className="text-end">Age</th>
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
                    <div className="d-inline-flex gap-1">
                      <button
                        className="btn btn-sm btn-primary text-nowrap"
                        disabled={simming || atRosterCap || unaffordable}
                        title={
                          unaffordable
                            ? "Mid-season signings charge the season's wages up front"
                            : undefined
                        }
                        onClick={() => signFreeAgentAction(p.pid)}
                      >
                        Sign to Senior &middot; {terms.lengthSeasons}y &middot;{" "}
                        {formatWeeklyWage(terms.salary)}
                      </button>
                      <button
                        className="btn btn-sm btn-outline-primary text-nowrap"
                        disabled={simming || atAcademyCap}
                        onClick={() => signToAcademyAction(p.pid)}
                      >
                        Sign to Academy
                      </button>
                    </div>
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
