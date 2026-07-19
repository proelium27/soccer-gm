import { Fragment, useState } from "react";
import { Link } from "react-router-dom";
import { useLeague } from "../context/LeagueContext.js";
import type { Player } from "../../core/players/types.js";
import type { StoredTeam } from "../../core/teams/clubs.js";
import { teamSlots, teamFormation } from "../../core/lineup/formations.js";
import { resolveXI } from "../../core/lineup/resolveXI.js";
import { computeTeamRating } from "../../core/teams/teamRating.js";
import { computeTeamForm } from "../../core/teams/powerRanking.js";
import { competitionOf, tierOf } from "../../core/competitions.js";
import { layoutSlots } from "../pitchLayout.js";
import { getRatingColor } from "../utils/ratingColor.js";
import { formatWeeklyWage, seasonYear } from "../format.js";
import { PlayerRatingsTooltip } from "../components/PlayerRatingsTooltip.js";
import { PotDisplay } from "../components/PotDisplay.js";
import { Flag } from "../components/Flag.js";
import { ClubCrest } from "../components/ClubCrest.js";
import { CompetitionSelect } from "../components/CompetitionSelect.js";
import { sortByPosThenOvr } from "./Roster.js";

function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1];
}

export function PowerRankings() {
  const { league } = useLeague();
  const [expandedTid, setExpandedTid] = useState<number | null>(null);
  const [compId, setCompId] = useState<number | "all">("all");

  if (!league) {
    return <p className="p-3">Loading...</p>;
  }

  const playerByPid = new Map(league.players.map((p) => [p.pid, p]));
  const withRatings = league.teams
    .filter((team) => compId === "all" || team.compId === compId)
    .map((team) => {
      const roster = team.roster
        .map((pid) => playerByPid.get(pid))
        .filter((p): p is Player => p !== undefined);
      return { team, roster, rating: computeTeamRating(roster, team.starters, teamSlots(team)) };
    });
  const ovrByTid = new Map(withRatings.map(({ team, rating }) => [team.tid, rating.ovr]));
  const rankings = withRatings
    .map(({ team, roster, rating }) => {
      const form = computeTeamForm(team.tid, rating.ovr, league.played, ovrByTid);
      return { team, roster, rating, form, powerScore: rating.ovr + form.performanceBonus };
    })
    .sort((a, b) => b.powerScore - a.powerScore);

  const divisionRanks = new Map<number, number>();
  const divisionCounts = new Map<number, number>();
  for (const { team } of rankings) {
    const next = (divisionCounts.get(team.compId) ?? 0) + 1;
    divisionCounts.set(team.compId, next);
    divisionRanks.set(team.tid, next);
  }

  return (
    <div className="container-fluid p-3">
      <h4>Power Rankings</h4>
      <p className="text-muted small mb-3">
        Teams ranked by a blended Power score: squad OVR (Starting XI + bench, depth-weighted) plus
        a current-season form bonus — results weighted by opponent quality (beating a strong side
        counts for more than beating a weak one) and goal difference. Click a team to see its
        roster.
      </p>
      <div className="mb-3">
        <CompetitionSelect
          competitions={league.competitions}
          value={compId}
          onChange={setCompId}
          allOption
        />
      </div>
      <table className="table table-striped table-sm">
        <thead>
          <tr>
            <th className="text-end">#</th>
            <th>Team</th>
            <th className="text-end">Div</th>
            <th className="text-end">Record</th>
            <th className="text-end">GD</th>
            <th className="text-end">OVR</th>
            <th className="text-end">Power</th>
            <th className="text-end">POT</th>
          </tr>
        </thead>
        <tbody>
          {rankings.map(({ team, roster, rating, form, powerScore }, i) => {
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
                      <ClubCrest tid={team.tid} colors={team.colors} />
                      {team.name}
                    </span>
                  </td>
                  <td className="text-end">
                    {(() => {
                      const comp = competitionOf(league.competitions, team.compId);
                      const tier = tierOf(league.competitions, team.compId);
                      return (
                        <span
                          className={
                            "division-badge " +
                            (tier === 1 ? "division-badge--d1" : "division-badge--d2")
                          }
                          title={comp.name}
                        >
                          {comp.country.slice(0, 3).toUpperCase()} D{tier} #{divisionRanks.get(team.tid)}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="text-end">
                    {form.played > 0 ? `${form.won}-${form.drawn}-${form.lost}` : "—"}
                  </td>
                  <td className="text-end">
                    {form.played > 0 ? (form.gd > 0 ? `+${form.gd}` : form.gd) : "—"}
                  </td>
                  <td className="text-end">{rating.ovr}</td>
                  <td className="text-end">
                    <span className="fw-semibold">{Math.round(powerScore)}</span>
                    {form.played > 0 && Math.abs(form.performanceBonus) >= 0.5 && (
                      <span
                        className={
                          "small ms-1 " + (form.performanceBonus > 0 ? "text-success" : "text-danger")
                        }
                      >
                        ({form.performanceBonus > 0 ? "+" : ""}
                        {form.performanceBonus.toFixed(1)})
                      </span>
                    )}
                  </td>
                  <td className="text-end">{rating.pot}</td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td></td>
                    <td colSpan={7}>
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
  const slots = teamSlots(team);
  const coords = layoutSlots(teamFormation(team));
  const xi = resolveXI(roster, slots, team.starters);
  const xiPids = new Set(xi.map((p) => p.pid));
  const bench = sortByPosThenOvr(roster.filter((p) => !xiPids.has(p.pid)));

  return (
    <div className="mb-2">
      <div className="pitch-field">
        <div className="pitch-goal pitch-goal--left" />
        <div className="pitch-goal pitch-goal--right" />
        {xi.map((p, i) => {
          const coord = coords[i];
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
                  <td className="text-end"><PotDisplay player={p} /></td>
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
