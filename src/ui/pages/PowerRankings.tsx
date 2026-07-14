import { Fragment, useState } from "react";
import { useLeague } from "../context/LeagueContext.js";
import type { Player } from "../../core/players/types.js";
import { computeTeamRating } from "../../core/teams/teamRating.js";
import { formatWeeklyWage, seasonYear } from "../format.js";
import { PlayerRatingsTooltip } from "../components/PlayerRatingsTooltip.js";
import { Flag } from "../components/Flag.js";
import { sortByPosThenOvr } from "./Roster.js";

export function PowerRankings() {
  const { league } = useLeague();
  const [expandedTid, setExpandedTid] = useState<number | null>(null);

  if (!league) {
    return <p className="p-3">Loading...</p>;
  }

  const rankings = league.teams
    .map((team) => {
      const roster = league.players.filter((p) => team.roster.includes(p.pid));
      return { team, roster, rating: computeTeamRating(roster, team.starters) };
    })
    .sort((a, b) => b.rating.ovr - a.rating.ovr);

  return (
    <div className="container-fluid p-3">
      <h4>Power Rankings</h4>
      <p className="text-muted small mb-3">
        Teams ranked by squad OVR (Starting XI + bench, depth-weighted). Click a team to see its roster.
      </p>
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
          {rankings.map(({ team, roster, rating }, i) => {
            const isUser = team.tid === league.meta.userTid;
            const isExpanded = expandedTid === team.tid;
            return (
              <Fragment key={team.tid}>
                <tr
                  className={isUser ? "team-highlight" : undefined}
                  style={{ cursor: "pointer" }}
                  onClick={() => setExpandedTid(isExpanded ? null : team.tid)}
                >
                  <td className="text-end">{i + 1}</td>
                  <td>
                    <span className="d-inline-flex align-items-center gap-1">
                      <span className="text-muted" style={{ width: "1em", display: "inline-block" }}>
                        {isExpanded ? "▾" : "▸"}
                      </span>
                      <span className="color-swatch" style={{ backgroundColor: team.colors[0] }} />
                      {team.name}
                    </span>
                  </td>
                  <td className="text-end">{rating.ovr}</td>
                  <td className="text-end">{rating.pot}</td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td></td>
                    <td colSpan={3}>
                      <RosterPreview roster={roster} season={league.season} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RosterPreview({ roster, season }: { roster: Player[]; season: number }) {
  if (roster.length === 0) {
    return <p className="text-muted mb-2">No players on roster.</p>;
  }
  const players = sortByPosThenOvr(roster);
  return (
    <table className="table table-sm mb-2">
      <thead>
        <tr>
          <th>Name</th>
          <th>Pos</th>
          <th className="text-end">Age</th>
          <th className="text-end">Ovr</th>
          <th className="text-end">Pot</th>
          <th className="text-end">Wage</th>
          <th className="text-end">Contract</th>
        </tr>
      </thead>
      <tbody>
        {players.map((p) => (
          <tr key={p.pid}>
            <td>
              <PlayerRatingsTooltip player={p}>{p.name}</PlayerRatingsTooltip>{" "}
              <Flag nationality={p.nationality} />
            </td>
            <td>{p.pos}</td>
            <td className="text-end">{season - p.born}</td>
            <td className="text-end">{p.ovr}</td>
            <td className="text-end">{p.potential}</td>
            <td className="text-end">{formatWeeklyWage(p.contract.salary)}</td>
            <td className="text-end">
              {p.contract.expiresSeason <= season
                ? "Final year"
                : `Through ${seasonYear(p.contract.expiresSeason)}`}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
