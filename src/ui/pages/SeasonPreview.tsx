import { Link } from "react-router-dom";
import { useLeague } from "../context/LeagueContext.js";
import type { Player } from "../../core/players/types.js";
import type { StoredTeam } from "../../core/teams/clubs.js";
import { computeTeamRating } from "../../core/teams/teamRating.js";
import { currency, seasonYear } from "../format.js";
import { PlayerRatingsTooltip } from "../components/PlayerRatingsTooltip.js";
import { PotDisplay } from "../components/PotDisplay.js";
import { Flag } from "../components/Flag.js";
import { ClubCrest } from "../components/ClubCrest.js";

const TOP_N = 10;

export function SeasonPreview() {
  const { league } = useLeague();

  if (!league) {
    return <p className="p-3">Loading...</p>;
  }

  const teamByPid = new Map<number, StoredTeam>();
  for (const team of league.teams) {
    for (const pid of team.roster) teamByPid.set(pid, team);
  }

  const topPlayers = league.players
    .filter((p) => teamByPid.has(p.pid))
    .sort((a, b) => b.ovr - a.ovr)
    .slice(0, TOP_N);

  const topTeams = league.teams
    .map((team) => {
      const roster = league.players.filter((p) => team.roster.includes(p.pid));
      return { team, rating: computeTeamRating(roster, team.starters) };
    })
    .sort((a, b) => b.rating.ovr - a.rating.ovr)
    .slice(0, TOP_N);

  const teamsByTid = new Map(league.teams.map((t) => [t.tid, t]));
  const playersByPid = new Map(league.players.map((p) => [p.pid, p]));
  const topTransfers = league.transfers
    .filter((t) => t.season === league.season && t.window === "summer")
    .sort((a, b) => b.fee - a.fee)
    .slice(0, TOP_N);

  return (
    <div className="container-fluid p-3">
      <h4>Season Preview — {seasonYear(league.season)}</h4>
      <p className="text-muted small mb-4">
        Here's how the offseason shook out before {seasonYear(league.season)} kicks off.
      </p>

      <div className="row g-4">
        <div className="col-lg-6">
          <h5>Top {TOP_N} Rated Players</h5>
          <table className="table table-striped table-sm">
            <thead>
              <tr>
                <th className="text-end">#</th>
                <th>Player</th>
                <th>Team</th>
                <th className="text-end">OVR</th>
                <th className="text-end">POT</th>
              </tr>
            </thead>
            <tbody>
              {topPlayers.map((player: Player, i) => {
                const team = teamByPid.get(player.pid);
                return (
                  <tr key={player.pid} className={team?.tid === league.meta.userTid ? "team-highlight" : undefined}>
                    <td className="text-end">{i + 1}</td>
                    <td>
                      <PlayerRatingsTooltip player={player}>
                        <span className="d-inline-flex align-items-center gap-1">
                          <Flag nationality={player.nationality} />
                          <Link to={`/player/${player.pid}`}>{player.name}</Link>
                        </span>
                      </PlayerRatingsTooltip>
                    </td>
                    <td>{team?.name ?? "—"}</td>
                    <td className="text-end">{player.ovr}</td>
                    <td className="text-end"><PotDisplay player={player} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="col-lg-6">
          <h5>Top {TOP_N} Rated Teams</h5>
          <table className="table table-striped table-sm">
            <thead>
              <tr>
                <th className="text-end">#</th>
                <th>Team</th>
                <th className="text-end">OVR</th>
                <th className="text-end">POT</th>
              </tr>
            </thead>
            <tbody>
              {topTeams.map(({ team, rating }, i) => (
                <tr key={team.tid} className={team.tid === league.meta.userTid ? "team-highlight" : undefined}>
                  <td className="text-end">{i + 1}</td>
                  <td>
                    <span className="d-inline-flex align-items-center gap-1">
                      <ClubCrest tid={team.tid} colors={team.colors} />
                      {team.name}
                    </span>
                  </td>
                  <td className="text-end">{rating.ovr}</td>
                  <td className="text-end">{rating.pot}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <h5 className="mt-4">Top {TOP_N} Offseason Transfers</h5>
      {topTransfers.length === 0 ? (
        <p className="text-muted">No transfers went through during the offseason window.</p>
      ) : (
        <table className="table table-striped table-sm">
          <thead>
            <tr>
              <th className="text-end">#</th>
              <th>Player</th>
              <th>From</th>
              <th>To</th>
              <th className="text-end">Fee</th>
            </tr>
          </thead>
          <tbody>
            {topTransfers.map((t, i) => {
              const player = playersByPid.get(t.pid);
              const from = teamsByTid.get(t.fromTid);
              const to = teamsByTid.get(t.toTid);
              return (
                <tr key={`${t.pid}-${t.season}-${i}`}>
                  <td className="text-end">{i + 1}</td>
                  <td>{player ? <Link to={`/player/${player.pid}`}>{player.name}</Link> : "—"}</td>
                  <td>{from?.name ?? "—"}</td>
                  <td>{to?.name ?? "—"}</td>
                  <td className="text-end">{currency.format(t.fee)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <Link to="/awards" className="btn btn-primary mt-2">
        View Season Awards
      </Link>
    </div>
  );
}
