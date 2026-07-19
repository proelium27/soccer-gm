import { Link } from "react-router-dom";
import { useLeague } from "../context/LeagueContext.js";
import { HelpHint } from "../components/HelpHint.js";
import type { ScheduleGame } from "../../core/schedule.js";

interface FixtureRow {
  matchday: number;
  home: number;
  away: number;
  result: { homeGoals: number; awayGoals: number; possessionHome: number } | null;
  playedIndex: number | null;
  sortKey: number;
}

export function Schedule() {
  const { league } = useLeague();

  if (!league) {
    return <p className="p-3">Loading...</p>;
  }

  const userTid = league.meta.userTid;

  const playedRows: FixtureRow[] = [];
  for (let mi = 0; mi < league.played.length; mi++) {
    const m = league.played[mi];
    if (m.home === userTid || m.away === userTid) {
      playedRows.push({
        matchday: m.matchday,
        home: m.home,
        away: m.away,
        result: { homeGoals: m.homeGoals, awayGoals: m.awayGoals, possessionHome: m.possessionHome },
        playedIndex: mi,
        sortKey: m.matchday,
      });
    }
  }

  const scheduledRows: FixtureRow[] = league.schedule
    .filter((g: ScheduleGame) => g.home === userTid || g.away === userTid)
    .map((g: ScheduleGame) => ({
      matchday: g.matchday,
      home: g.home,
      away: g.away,
      result: null,
      playedIndex: null,
      sortKey: g.matchday,
    }));

  const allRows = [...playedRows, ...scheduledRows].sort(
    (a, b) => a.sortKey - b.sortKey,
  );

  let lastPlayedIdx = -1;
  for (let i = 0; i < allRows.length; i++) {
    if (allRows[i].result !== null) {
      lastPlayedIdx = i;
    }
  }

  const teamName = (tid: number): string => {
    const team = league.teams.find((t) => t.tid === tid);
    return team?.name ?? `Team ${tid}`;
  };

  return (
    <div className="container-fluid p-3">
      <h4>
        Schedule
        <HelpHint>
          Every matchday's fixtures and results for the season. Click a played match to open
          its full box score.
        </HelpHint>
      </h4>
      {allRows.length === 0 ? (
        <p>No fixtures found.</p>
      ) : (
        <table className="table table-striped table-sm">
          <thead>
            <tr>
              <th className="text-end">MD</th>
              <th>Home</th>
              <th className="text-center">Score</th>
              <th>Away</th>
              <th className="text-center">Poss</th>
            </tr>
          </thead>
          <tbody>
            {allRows.map((row, i) => {
              const isLastPlayed = i === lastPlayedIdx;
              let outcome: "win" | "loss" | null = null;
              if (row.result) {
                const userIsHome = row.home === userTid;
                const userGoals = userIsHome ? row.result.homeGoals : row.result.awayGoals;
                const oppGoals = userIsHome ? row.result.awayGoals : row.result.homeGoals;
                if (userGoals > oppGoals) outcome = "win";
                else if (userGoals < oppGoals) outcome = "loss";
              }
              const outcomeClass =
                outcome === "win" ? "row-win" : outcome === "loss" ? "row-loss" : undefined;
              const rowClassName = [
                outcomeClass,
                isLastPlayed ? "border-start border-3 border-info" : undefined,
              ]
                .filter(Boolean)
                .join(" ") || undefined;
              return (
                <tr
                  key={`${row.home}-${row.away}-${row.sortKey}`}
                  className={rowClassName}
                >
                  <td className="text-end">{row.matchday}</td>
                  <td>{teamName(row.home)}</td>
                  <td className="text-center">
                    {row.result ? (
                      <Link to={`/box-score/${row.playedIndex}`}>
                        {row.result.homeGoals} - {row.result.awayGoals}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{teamName(row.away)}</td>
                  <td className="text-center text-muted">
                    {row.result
                      ? `${Math.round(row.result.possessionHome * 100)}–${Math.round((1 - row.result.possessionHome) * 100)}`
                      : ""}
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
