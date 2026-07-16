import { Fragment, useState } from "react";
import { Link } from "react-router-dom";
import { useLeague } from "../context/LeagueContext.js";
import type { Player } from "../../core/players/types.js";
import type { StoredTeam } from "../../core/teams/clubs.js";
import { FORMATIONS } from "../../core/lineup/formations.js";
import { resolveXI } from "../../core/lineup/resolveXI.js";
import { computeTeamRating } from "../../core/teams/teamRating.js";
import { layoutSlots } from "../pitchLayout.js";
import { getRatingColor } from "../utils/ratingColor.js";
import { formatWeeklyWage, seasonYear } from "../format.js";
import { PlayerRatingsTooltip } from "../components/PlayerRatingsTooltip.js";
import { Flag } from "../components/Flag.js";
import { sortByPosThenOvr } from "./Roster.js";

const SLOTS = FORMATIONS["4-3-3"];
const COORDS = layoutSlots(SLOTS);

function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1];
}

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

  const divisionRanks = new Map<number, number>();
  const divisionCounts = new Map<number, number>();
  for (const { team } of rankings) {
    const next = (divisionCounts.get(team.division) ?? 0) + 1;
    divisionCounts.set(team.division, next);
    divisionRanks.set(team.tid, next);
  }

  return (
    <div className="container-fluid p-3">
      <h4>Power Rankings</h4>
      <p className="text-muted small mb-3">
        Teams ranked by squad OVR (Starting XI + bench, depth-weighted) across both divisions. Click a
        team to see its roster.
      </p>
      <table className="table table-striped table-sm">
        <thead>
          <tr>
            <th className="text-end">#</th>
            <th>Team</th>
            <th className="text-end">Div</th>
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
                  <td className="text-end">
                    <span
                      className={
                        "division-badge " +
                        (team.division === 0 ? "division-badge--d1" : "division-badge--d2")
                      }
                      title={team.division === 0 ? "English Division 1" : "English Division 2"}
                    >
                      D{team.division + 1} #{divisionRanks.get(team.tid)}
                    </span>
                  </td>
                  <td className="text-end">{rating.ovr}</td>
                  <td className="text-end">{rating.pot}</td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td></td>
                    <td colSpan={4}>
                      <RosterPreview team={team} roster={roster} season={league.season} />
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

function RosterPreview({
  team,
  roster,
  season,
}: {
  team: StoredTeam;
  roster: Player[];
  season: number;
}) {
  if (roster.length === 0) {
    return <p className="text-muted mb-2">No players on roster.</p>;
  }
  const xi = resolveXI(roster, SLOTS, team.starters);
  const xiPids = new Set(xi.map((p) => p.pid));
  const bench = sortByPosThenOvr(roster.filter((p) => !xiPids.has(p.pid)));

  return (
    <div className="mb-2">
      <div className="pitch-field">
        <div className="pitch-goal pitch-goal--left" />
        <div className="pitch-goal pitch-goal--right" />
        {xi.map((p, i) => {
          const coord = COORDS[i];
          return (
            <div
              key={p.pid}
              className="pitch-slot"
              style={{ left: `${coord.x}%`, top: `${coord.y}%` }}
            >
              <PlayerRatingsTooltip player={p}>
                <span
                  className={"pitch-chip" + (p.pos === "GK" ? " pitch-chip--gk" : "")}
                  style={{ borderColor: getRatingColor(p.ovr), cursor: "default" }}
                >
                  <Link to={`/player/${p.pid}`} className="pitch-chip-name">
                    {shortName(p.name)}
                  </Link>
                  <span className="pitch-chip-ovr">{p.ovr}</span>
                </span>
              </PlayerRatingsTooltip>
            </div>
          );
        })}
      </div>
      {bench.length > 0 && (
        <>
          <h6 className="mt-3">Bench</h6>
          <table className="table table-sm mb-0">
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
              {bench.map((p) => (
                <tr key={p.pid}>
                  <td>
                    <PlayerRatingsTooltip player={p}>
                      <Link to={`/player/${p.pid}`}>{p.name}</Link>
                    </PlayerRatingsTooltip>{" "}
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
        </>
      )}
    </div>
  );
}
