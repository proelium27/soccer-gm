import { useParams, Link } from "react-router-dom";
import { useLeague } from "../context/LeagueContext.js";
import type { PlayedMatch } from "../../core/standings.js";
import type { MatchEvent } from "../../engine/attribution.js";

function formatClock(seconds: number): string {
  const mins = Math.max(1, Math.ceil((5400 - seconds) / 60));
  return `${mins}'`;
}

function EventRow({ event, playerName }: { event: MatchEvent; playerName: (pid: number) => string }) {
  const time = formatClock(event.clock);
  const names = event.pids.map(playerName);

  switch (event.type) {
    case "goal":
      return (
        <div className={`pbp-event pbp-goal ${event.side === "home" ? "text-start" : "text-end"}`}>
          <strong>{time}</strong> GOAL — {names[0]}{names[1] ? ` (assist: ${names[1]})` : ""}
        </div>
      );
    case "shot_saved":
      return (
        <div className={`pbp-event ${event.side === "home" ? "text-start" : "text-end"}`}>
          <span className="text-muted">{time}</span> Shot saved — {names[0]}
        </div>
      );
    case "shot_blocked":
      return (
        <div className={`pbp-event ${event.side === "home" ? "text-start" : "text-end"}`}>
          <span className="text-muted">{time}</span> Shot blocked — {names[0]}
        </div>
      );
    case "shot_off_target":
      return (
        <div className={`pbp-event ${event.side === "home" ? "text-start" : "text-end"}`}>
          <span className="text-muted">{time}</span> Shot off target — {names[0]}
        </div>
      );
    case "yellow_card":
      return (
        <div className={`pbp-event ${event.side === "home" ? "text-start" : "text-end"}`}>
          <span className="text-warning">{time}</span> Yellow card — {names[0]}
        </div>
      );
    case "red_card":
      return (
        <div className={`pbp-event ${event.side === "home" ? "text-start" : "text-end"}`}>
          <span className="text-danger">{time}</span> Red card — {names[0]}
        </div>
      );
    case "substitution":
      return (
        <div className={`pbp-event ${event.side === "home" ? "text-start" : "text-end"}`}>
          <span className="text-muted">{time}</span> Substitution — {names[1]} on for {names[0]}
        </div>
      );
    case "corner":
      return (
        <div className={`pbp-event ${event.side === "home" ? "text-start" : "text-end"}`}>
          <span className="text-muted">{time}</span> Corner
        </div>
      );
    case "penalty":
      return (
        <div className={`pbp-event ${event.side === "home" ? "text-start" : "text-end"}`}>
          <span className="text-warning">{time}</span> Penalty — {names[0]} to take it
        </div>
      );
    case "injury":
      return (
        <div className={`pbp-event ${event.side === "home" ? "text-start" : "text-end"}`}>
          <span className="text-danger">{time}</span> Injury — {names[0]} goes down
        </div>
      );
    default:
      return null;
  }
}

export function BoxScore() {
  const { matchIndex } = useParams<{ matchIndex: string }>();
  const { league } = useLeague();

  if (!league || matchIndex === undefined) {
    return <p className="p-3">Loading...</p>;
  }

  const idx = parseInt(matchIndex, 10);
  const match: PlayedMatch | undefined = league.played[idx];

  if (!match) {
    return (
      <div className="container-fluid p-3">
        <p>Match not found.</p>
        <Link to="/schedule">Back to Schedule</Link>
      </div>
    );
  }

  const homeTeam = league.teams.find((t) => t.tid === match.home);
  const awayTeam = league.teams.find((t) => t.tid === match.away);
  const homeName = homeTeam?.name ?? "Home";
  const awayName = awayTeam?.name ?? "Away";

  const playerMap = new Map(league.players.map((p) => [p.pid, p]));
  const playerName = (pid: number) => playerMap.get(pid)?.name ?? `#${pid}`;
  const playerPos = (pid: number) => playerMap.get(pid)?.pos ?? "?";

  const possPct = Math.round(match.possessionHome * 100);

  const shotEvents = match.boxScore.events.filter(
    (e) => e.type !== "turnover",
  );
  shotEvents.sort((a, b) => b.clock - a.clock);

  return (
    <div className="container-fluid p-3">
      <Link to="/schedule" className="text-decoration-none">&larr; Schedule</Link>

      <div className="text-center my-3">
        <h4>
          {homeName} {match.homeGoals} — {match.awayGoals} {awayName}
        </h4>
        <small className="text-muted">Matchday {match.matchday}</small>
        <div className="mt-1">
          <small>Possession: {possPct}% — {100 - possPct}%</small>
        </div>
      </div>

      <div className="row">
        <div className="col-md-6">
          <h6>{homeName}</h6>
          <table className="table table-sm table-striped">
            <thead>
              <tr>
                <th>Player</th>
                <th>Pos</th>
                <th className="text-end">G</th>
                <th className="text-end">A</th>
                <th className="text-end">Sh</th>
                <th className="text-end">SoT</th>
                <th className="text-end">Sv</th>
                <th className="text-end">Tkl</th>
                <th className="text-end">YC</th>
                <th className="text-end">RC</th>
              </tr>
            </thead>
            <tbody>
              {match.boxScore.home.map((line) => (
                <tr key={line.pid}>
                  <td>{playerName(line.pid)}</td>
                  <td>{playerPos(line.pid)}</td>
                  <td className="text-end">{line.goals || ""}</td>
                  <td className="text-end">{line.assists || ""}</td>
                  <td className="text-end">{line.shots || ""}</td>
                  <td className="text-end">{line.shotsOnTarget || ""}</td>
                  <td className="text-end">{line.saves || ""}</td>
                  <td className="text-end">{line.tackles || ""}</td>
                  <td className="text-end">{line.yellowCards || ""}</td>
                  <td className="text-end">{line.redCards || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="col-md-6">
          <h6>{awayName}</h6>
          <table className="table table-sm table-striped">
            <thead>
              <tr>
                <th>Player</th>
                <th>Pos</th>
                <th className="text-end">G</th>
                <th className="text-end">A</th>
                <th className="text-end">Sh</th>
                <th className="text-end">SoT</th>
                <th className="text-end">Sv</th>
                <th className="text-end">Tkl</th>
                <th className="text-end">YC</th>
                <th className="text-end">RC</th>
              </tr>
            </thead>
            <tbody>
              {match.boxScore.away.map((line) => (
                <tr key={line.pid}>
                  <td>{playerName(line.pid)}</td>
                  <td>{playerPos(line.pid)}</td>
                  <td className="text-end">{line.goals || ""}</td>
                  <td className="text-end">{line.assists || ""}</td>
                  <td className="text-end">{line.shots || ""}</td>
                  <td className="text-end">{line.shotsOnTarget || ""}</td>
                  <td className="text-end">{line.saves || ""}</td>
                  <td className="text-end">{line.tackles || ""}</td>
                  <td className="text-end">{line.yellowCards || ""}</td>
                  <td className="text-end">{line.redCards || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <h6 className="mt-3">Play-by-Play</h6>
      <div className="border rounded p-2" style={{ maxHeight: "400px", overflowY: "auto" }}>
        {shotEvents.length === 0 ? (
          <p className="text-muted mb-0">No events recorded.</p>
        ) : (
          shotEvents.map((e, i) => (
            <EventRow key={i} event={e} playerName={playerName} />
          ))
        )}
      </div>
    </div>
  );
}
