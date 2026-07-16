import { useState } from "react";
import { useLeague } from "../context/LeagueContext.js";
import { computeStandings, type StandingsRow } from "../../core/standings.js";
import { computeTeamRating } from "../../core/teams/teamRating.js";
import { TrophyIcon } from "../components/AwardIcons.js";
import { seasonYear } from "../format.js";

export function Standings() {
  const { league } = useLeague();
  const [season, setSeason] = useState<number | "current">("current");
  const [division, setDivision] = useState<0 | 1>(0);

  if (!league) {
    return <p className="p-3">Loading...</p>;
  }

  if (league.played.length === 0 && league.seasonHistory.length === 0) {
    return (
      <div className="container-fluid p-3">
        <h4>Standings</h4>
        <p>No matches played yet.</p>
      </div>
    );
  }

  const seasonOptions = [...league.seasonHistory.map((h) => h.season)].sort((a, b) => b - a);

  let standings: StandingsRow[];
  let championTid: number;
  if (season === "current") {
    const teamIds = league.teams.filter((t) => t.division === division).map((t) => t.tid);
    standings = computeStandings(teamIds, league.played.filter((m) => {
      const home = league.teams.find((t) => t.tid === m.home);
      return home?.division === division;
    }));
    // A "champion" only means something once the season has actually been
    // decided by played matches, not an arbitrary tid=0 tie at kickoff.
    championTid = league.played.length > 0 ? (standings[0]?.tid ?? -1) : -1;
  } else {
    const entry = league.seasonHistory.find((h) => h.season === season)!;
    const divisionTids = new Set(
      Object.entries(entry.divisionsByTid)
        .filter(([, d]) => d === division)
        .map(([tid]) => Number(tid)),
    );
    standings = entry.table.filter((row) => divisionTids.has(row.tid));
    championTid = division === 0 ? entry.championTid : (standings[0]?.tid ?? -1);
  }

  return (
    <div className="container-fluid p-3">
      <h4>Standings</h4>
      <div className="mb-3">
        <select
          className="form-select form-select-sm"
          style={{ width: "auto", display: "inline-block" }}
          value={season}
          onChange={(e) => setSeason(e.target.value === "current" ? "current" : Number(e.target.value))}
        >
          <option value="current">Current Season ({seasonYear(league.season)})</option>
          {seasonOptions.map((s) => (
            <option key={s} value={s}>{seasonYear(s)}</option>
          ))}
        </select>{" "}
        <select
          className="form-select form-select-sm"
          style={{ width: "auto", display: "inline-block" }}
          value={division}
          onChange={(e) => setDivision(Number(e.target.value) as 0 | 1)}
        >
          <option value={0}>English Division 1</option>
          <option value={1}>English Division 2</option>
        </select>
      </div>
      {standings.length === 0 ? (
        <p>No matches played yet.</p>
      ) : (
        <table className="table table-striped table-sm">
          <thead>
            <tr>
              <th className="text-end">#</th>
              <th>Team</th>
              <th className="text-end">P</th>
              <th className="text-end">W</th>
              <th className="text-end">D</th>
              <th className="text-end">L</th>
              <th className="text-end">GF</th>
              <th className="text-end">GA</th>
              <th className="text-end">GD</th>
              <th className="text-end">Pts</th>
              {season === "current" && <th className="text-end">OVR</th>}
              {season === "current" && <th className="text-end">POT</th>}
            </tr>
          </thead>
          <tbody>
            {standings.map((row, i) => {
              const team = league.teams.find((t) => t.tid === row.tid);
              const isUser = row.tid === league.meta.userTid;
              const isChampion = row.tid === championTid;
              const rowClass = [isUser && "team-highlight", isChampion && "champion-highlight"]
                .filter(Boolean)
                .join(" ") || undefined;
              const rating =
                season === "current" && team
                  ? computeTeamRating(
                      league.players.filter((p) => team.roster.includes(p.pid)),
                      team.starters,
                    )
                  : null;
              return (
                <tr key={row.tid} className={rowClass}>
                  <td className="text-end">{i + 1}</td>
                  <td>
                    <span className="d-inline-flex align-items-center gap-1">
                      <span
                        className="color-swatch"
                        style={{ backgroundColor: team?.colors[0] }}
                      />
                      {team?.name ?? `Team ${row.tid}`}
                      {isChampion && (
                        <span className="text-muted small d-inline-flex align-items-center gap-1">
                          {division === 0 ? <><TrophyIcon title="Champion" /> (Champion)</> : "(1st)"}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="text-end">{row.played}</td>
                  <td className="text-end">{row.won}</td>
                  <td className="text-end">{row.drawn}</td>
                  <td className="text-end">{row.lost}</td>
                  <td className="text-end">{row.gf}</td>
                  <td className="text-end">{row.ga}</td>
                  <td className="text-end">{row.gd}</td>
                  <td className="text-end">{row.points}</td>
                  {season === "current" && <td className="text-end">{rating?.ovr ?? "-"}</td>}
                  {season === "current" && <td className="text-end">{rating?.pot ?? "-"}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
