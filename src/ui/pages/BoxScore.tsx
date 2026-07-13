import { useParams, Link } from "react-router-dom";
import { useLeague } from "../context/LeagueContext.js";
import type { PlayedMatch } from "../../core/standings.js";
import type { MatchEvent, PlayerMatchLine } from "../../engine/attribution.js";
import { Flag } from "../components/Flag.js";

function formatClock(seconds: number): string {
  const mins = Math.max(1, Math.ceil((5400 - seconds) / 60));
  return `${mins}'`;
}

function ratingClass(rating: number): string {
  if (rating >= 8) return "text-success fw-semibold";
  if (rating < 6) return "text-danger";
  return "";
}

function TeamBoxTable({
  teamName,
  lines,
  playerName,
  playerPos,
  playerNationality,
  motmPid,
}: {
  teamName: string;
  lines: PlayerMatchLine[];
  playerName: (pid: number) => string;
  playerPos: (pid: number) => string;
  playerNationality: (pid: number) => string | undefined;
  motmPid: number | null;
}) {
  return (
    <div className="col-md-6">
      <h6>{teamName}</h6>
      <table className="table table-sm table-striped">
        <thead>
          <tr>
            <th>Player</th>
            <th>Pos</th>
            <th className="text-end">Min</th>
            <th className="text-end">G</th>
            <th className="text-end">A</th>
            <th className="text-end">Sh</th>
            <th className="text-end">SoT</th>
            <th className="text-end">Sv</th>
            <th className="text-end">Tkl</th>
            <th className="text-end">Int</th>
            <th className="text-end">YC</th>
            <th className="text-end">RC</th>
            <th className="text-end">Rtg</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.pid} className={line.pid === motmPid ? "table-warning" : undefined}>
              <td>
                {line.pid === motmPid && <span title="Man of the Match">⭐ </span>}
                {playerName(line.pid)}{" "}
                {playerNationality(line.pid) && (
                  <Flag nationality={playerNationality(line.pid)!} />
                )}
              </td>
              <td>{playerPos(line.pid)}</td>
              <td className="text-end">{line.minutesPlayed}</td>
              <td className="text-end">{line.goals || ""}</td>
              <td className="text-end">{line.assists || ""}</td>
              <td className="text-end">{line.shots || ""}</td>
              <td className="text-end">{line.shotsOnTarget || ""}</td>
              <td className="text-end">{line.saves || ""}</td>
              <td className="text-end">{line.tackles || ""}</td>
              <td className="text-end">{line.interceptions || ""}</td>
              <td className="text-end">{line.yellowCards || ""}</td>
              <td className="text-end">{line.redCards || ""}</td>
              <td className={`text-end ${ratingClass(line.rating)}`}>{line.rating.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Highest-rated player with actual minutes on the pitch, across both sides. */
function manOfTheMatch(match: PlayedMatch): PlayerMatchLine | null {
  const candidates = [...match.boxScore.home, ...match.boxScore.away].filter(
    (l) => l.minutesPlayed > 0,
  );
  if (candidates.length === 0) return null;
  return candidates.reduce((best, l) => (l.rating > best.rating ? l : best));
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
  const playerNationality = (pid: number) => playerMap.get(pid)?.nationality;

  const possPct = Math.round(match.possessionHome * 100);
  const motm = manOfTheMatch(match);

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
        {motm && (
          <div className="mt-1">
            <small>
              ⭐ Man of the Match: <strong>{playerName(motm.pid)}</strong>{" "}
              ({playerPos(motm.pid)}, {motm.rating.toFixed(1)} rating)
            </small>
          </div>
        )}
      </div>

      <div className="row">
        <TeamBoxTable
          teamName={homeName}
          lines={match.boxScore.home}
          playerName={playerName}
          playerPos={playerPos}
          playerNationality={playerNationality}
          motmPid={motm?.pid ?? null}
        />
        <TeamBoxTable
          teamName={awayName}
          lines={match.boxScore.away}
          playerName={playerName}
          playerPos={playerPos}
          playerNationality={playerNationality}
          motmPid={motm?.pid ?? null}
        />
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
