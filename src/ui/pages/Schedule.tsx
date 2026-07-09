import { useLeague } from "../context/LeagueContext.js";
import type { ScheduleGame } from "../../core/schedule.js";

interface FixtureRow {
  matchday: number | null;
  home: number;
  away: number;
  result: { homeGoals: number; awayGoals: number } | null;
  sortKey: number;
}

export function Schedule() {
  const { league } = useLeague();

  if (!league) {
    return <p className="p-3">Loading...</p>;
  }

  const userTid = league.meta.userTid;

  // Build rows from played matches (no matchday stored, so number sequentially)
  const playedRows: FixtureRow[] = [];
  let playedIndex = 0;
  for (const m of league.played) {
    if (m.home === userTid || m.away === userTid) {
      playedIndex++;
      playedRows.push({
        matchday: null,
        home: m.home,
        away: m.away,
        result: { homeGoals: m.homeGoals, awayGoals: m.awayGoals },
        sortKey: playedIndex,
      });
    }
  }

  // Build rows from upcoming schedule (has matchday)
  const scheduledRows: FixtureRow[] = league.schedule
    .filter((g: ScheduleGame) => g.home === userTid || g.away === userTid)
    .map((g: ScheduleGame) => ({
      matchday: g.matchday,
      home: g.home,
      away: g.away,
      result: null,
      sortKey: g.matchday + 1000, // ensure upcoming sort after played
    }));

  // Combine: played first in order, then upcoming by matchday
  const allRows = [...playedRows, ...scheduledRows].sort(
    (a, b) => a.sortKey - b.sortKey,
  );

  // Find the most recently played match row index (last played row)
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
      <h4>Schedule</h4>
      {allRows.length === 0 ? (
        <p>No fixtures found.</p>
      ) : (
        <table className="table table-striped table-sm">
          <thead>
            <tr>
              <th className="text-end">Matchday</th>
              <th>Home</th>
              <th className="text-center">Score</th>
              <th>Away</th>
            </tr>
          </thead>
          <tbody>
            {allRows.map((row, i) => {
              const isLastPlayed = i === lastPlayedIdx;
              return (
                <tr
                  key={`${row.home}-${row.away}-${row.sortKey}`}
                  className={isLastPlayed ? "table-info" : undefined}
                >
                  <td className="text-end">
                    {row.matchday != null ? row.matchday : i + 1}
                  </td>
                  <td>{teamName(row.home)}</td>
                  <td className="text-center">
                    {row.result
                      ? `${row.result.homeGoals} - ${row.result.awayGoals}`
                      : "—"}
                  </td>
                  <td>{teamName(row.away)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
