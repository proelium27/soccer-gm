import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useLeague } from "../context/LeagueContext.js";
import { usePlayerMap } from "../usePlayerMap.js";
import type { PlayedMatch } from "../../core/standings.js";
import type { MatchEvent, MatchEventType, PlayerMatchLine } from "../../engine/attribution.js";
import { Flag } from "../components/Flag.js";
import { ClubCrest } from "../components/ClubCrest.js";

/** Match clock counts down from 5400s, so elapsed minutes read off the remainder. */
function formatClock(seconds: number): string {
  const mins = Math.max(1, Math.ceil((5400 - seconds) / 60));
  return `${mins}'`;
}

function ratingClass(rating: number): string {
  if (rating >= 8) return "text-success fw-semibold";
  if (rating < 6) return "text-danger";
  return "";
}

/* ---------------------------------------------------------------------------
   Icons. Hand-drawn inline SVG, never emoji (UI convention).
   --------------------------------------------------------------------------- */

function StarIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l2.9 6.26L21.6 9.2l-4.9 4.66 1.22 6.94L12 17.5l-5.92 3.3 1.22-6.94L2.4 9.2l6.7-.94z" />
    </svg>
  );
}

function BallIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 1.6a10.4 10.4 0 1 0 0 20.8 10.4 10.4 0 0 0 0-20.8zm0 2.1l3.4 2.47-1.3 4h-4.2l-1.3-4zm-5.6 4.2l1.3 4-3.4 2.5A8.4 8.4 0 0 1 6.4 7.9zm11.2 0a8.4 8.4 0 0 1 2.1 6.5l-3.4-2.5zM9.9 13.8h4.2l1.3 4L12 20.3l-3.5-2.5z" />
    </svg>
  );
}

function CardIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size * 1.25} viewBox="0 0 16 20" fill="currentColor" aria-hidden="true">
      <rect x="1" y="1" width="14" height="18" rx="2.5" />
    </svg>
  );
}

function SubInIcon({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
      <path d="M6 0.8l4.4 5.2H7.6V11.2H4.4V6H1.6z" />
    </svg>
  );
}

function SubOutIcon({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
      <path d="M6 11.2L1.6 6h2.8V0.8h3.2V6h2.8z" />
    </svg>
  );
}

function InjuryIcon({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
      <path d="M4 0h2v4h4v2H6v4H4V6H0V4h4z" />
    </svg>
  );
}

function WhistleIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M14 5.5a6.5 6.5 0 1 0 5.9 9.2l2.3-5.6a1 1 0 0 0-.6-1.3L14.6 5.6a6.5 6.5 0 0 0-.6-.1zM8.5 9.5a3 3 0 1 1 0 6 3 3 0 0 1 0-6z" />
    </svg>
  );
}

function CornerIcon({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
      <path d="M2 0h1.4v12H2z" />
      <path d="M3.8 0.8L10 3.2 3.8 5.6z" />
    </svg>
  );
}

/* ---------------------------------------------------------------------------
   Scoreboard header
   --------------------------------------------------------------------------- */

function ScoreboardSide({
  name,
  tid,
  colors,
  goals,
  won,
  lost,
  align,
}: {
  name: string;
  tid: number;
  colors: [string, string];
  goals: number;
  won: boolean;
  lost: boolean;
  align: "home" | "away";
}) {
  const nameEl = (
    <span className={`bs-club-name${won ? " bs-club-name--won" : ""}${lost ? " bs-club-name--lost" : ""}`}>
      {name}
    </span>
  );
  const crest = <ClubCrest tid={tid} colors={colors} size={30} />;
  return (
    <div className={`bs-club bs-club--${align}`}>
      {align === "home" ? (
        <>
          {nameEl}
          {crest}
        </>
      ) : (
        <>
          {crest}
          {nameEl}
        </>
      )}
      <span className={`bs-goals${lost ? " bs-goals--lost" : ""}`}>{goals}</span>
    </div>
  );
}

/** One row of the head-to-head strip: a value each side, a shared label, two proportional bars. */
function CompareRow({
  label,
  home,
  away,
  format,
}: {
  label: string;
  home: number;
  away: number;
  format?: (n: number) => string;
}) {
  const total = home + away;
  const homePct = total > 0 ? (home / total) * 100 : 0;
  const awayPct = total > 0 ? (away / total) * 100 : 0;
  const show = format ?? ((n: number) => String(n));
  return (
    <div className="bs-compare-row">
      <span className="bs-compare-val stat-num">{show(home)}</span>
      <span className="bs-compare-track bs-compare-track--home">
        <span className="bs-compare-fill" style={{ width: `${homePct}%` }} />
      </span>
      <span className="bs-compare-label">{label}</span>
      <span className="bs-compare-track bs-compare-track--away">
        <span className="bs-compare-fill" style={{ width: `${awayPct}%` }} />
      </span>
      <span className="bs-compare-val stat-num">{show(away)}</span>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Team box score
   --------------------------------------------------------------------------- */

/** Column groups, so 19 stat columns read as six scannable blocks rather than one wall. */
const COLUMN_GROUPS: { label: string; span: number }[] = [
  { label: "", span: 3 },
  { label: "Attacking", span: 5 },
  { label: "Keeping", span: 3 },
  { label: "Defending", span: 2 },
  { label: "Passing", span: 2 },
  { label: "Discipline", span: 3 },
  { label: "", span: 1 },
];

function TeamBoxTable({
  teamName,
  tid,
  colors,
  lines,
  playerName,
  playerPos,
  playerNationality,
  motmPid,
}: {
  teamName: string;
  tid: number;
  colors: [string, string];
  lines: PlayerMatchLine[];
  playerName: (pid: number) => string;
  playerPos: (pid: number) => string;
  playerNationality: (pid: number) => string | undefined;
  motmPid: number | null;
}) {
  return (
    <section className="bs-team-block">
      <h6 className="bs-team-heading">
        <ClubCrest tid={tid} colors={colors} size={18} />
        {teamName}
      </h6>
      <table className="table table-sm table-striped bs-table">
        <thead>
          <tr className="bs-group-row">
            {COLUMN_GROUPS.map((g, i) => (
              <th key={i} colSpan={g.span} className={g.label ? "bs-group" : undefined}>
                {g.label}
              </th>
            ))}
          </tr>
          <tr>
            <th>Player</th>
            <th>Pos</th>
            <th className="text-end">Min</th>
            <th className="text-end bs-group" title="Goals">G</th>
            <th className="text-end" title="Assists">A</th>
            <th className="text-end" title="Shots">Sh</th>
            <th className="text-end" title="Shots on target">SoT</th>
            <th className="text-end" title="Expected goals">xG</th>
            <th className="text-end bs-group" title="Saves">Sv</th>
            <th className="text-end" title="Goals against (keeper)">GA</th>
            <th className="text-end" title="Expected goals against (keeper)">xGA</th>
            <th className="text-end bs-group" title="Tackles">Tkl</th>
            <th className="text-end" title="Interceptions">Int</th>
            <th className="text-end bs-group" title="Passes completed / attempted">Pass</th>
            <th className="text-end" title="Crosses">Crs</th>
            <th className="text-end bs-group" title="Fouls committed">Fls</th>
            <th className="text-end" title="Yellow cards">YC</th>
            <th className="text-end" title="Red cards">RC</th>
            <th className="text-end bs-group" title="Match rating">Rtg</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const isKeeper = playerPos(line.pid) === "GK";
            const nat = playerNationality(line.pid);
            return (
              <tr key={line.pid} className={line.pid === motmPid ? "bs-row-motm" : undefined}>
                <td className="bs-player-cell">
                  {line.pid === motmPid && (
                    <span className="bs-motm-mark" title="Man of the match" aria-label="Man of the match">
                      <StarIcon />
                    </span>
                  )}
                  <Link to={`/player/${line.pid}`}>{playerName(line.pid)}</Link>
                  {nat && <Flag nationality={nat} />}
                </td>
                <td className="bs-pos">{playerPos(line.pid)}</td>
                <td className="text-end">{line.minutesPlayed}</td>
                <td className="text-end bs-group">{line.goals || ""}</td>
                <td className="text-end">{line.assists || ""}</td>
                <td className="text-end">{line.shots || ""}</td>
                <td className="text-end">{line.shotsOnTarget || ""}</td>
                <td className="text-end">{line.xg > 0 ? line.xg.toFixed(2) : ""}</td>
                <td className="text-end bs-group">{line.saves || ""}</td>
                <td className="text-end">{isKeeper ? line.goalsAgainst : ""}</td>
                <td className="text-end">{isKeeper ? line.xga.toFixed(2) : ""}</td>
                <td className="text-end bs-group">{line.tackles || ""}</td>
                <td className="text-end">{line.interceptions || ""}</td>
                <td className="text-end bs-group">
                  {line.passes ? `${line.passesCompleted}/${line.passes}` : ""}
                </td>
                <td className="text-end">{line.crosses || ""}</td>
                <td className="text-end bs-group">{line.foulsCommitted || ""}</td>
                <td className="text-end">{line.yellowCards || ""}</td>
                <td className="text-end">{line.redCards || ""}</td>
                <td className={`text-end bs-group ${ratingClass(line.rating)}`}>
                  {line.rating.toFixed(1)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
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

/* ---------------------------------------------------------------------------
   Play-by-play timeline
   --------------------------------------------------------------------------- */

/** The events worth reading by default: everything that changed the game or the teams. */
const KEY_EVENTS = new Set<MatchEventType>([
  "goal",
  "yellow_card",
  "red_card",
  "substitution",
  "penalty",
  "injury",
]);

/** How each event colours its clock chip on the spine. */
function chipTone(type: MatchEventType): string {
  switch (type) {
    case "goal":
      return "bs-chip--goal";
    case "red_card":
    case "injury":
      return "bs-chip--danger";
    case "yellow_card":
    case "penalty":
      return "bs-chip--warn";
    default:
      return "";
  }
}

function EventBody({
  event,
  playerName,
}: {
  event: MatchEvent;
  playerName: (pid: number) => string;
}) {
  const link = (pid: number) => (
    <Link key={pid} to={`/player/${pid}`}>
      {playerName(pid)}
    </Link>
  );

  switch (event.type) {
    case "goal":
      return (
        <div className="bs-ev-body bs-ev-body--goal">
          <span className="bs-ev-icon">
            <BallIcon />
          </span>
          <span>
            <strong className="bs-ev-headline">Goal</strong> {link(event.pids[0])}
            {event.pids[1] !== undefined && (
              <span className="bs-ev-sub">assist {playerName(event.pids[1])}</span>
            )}
          </span>
        </div>
      );
    case "yellow_card":
    case "red_card": {
      const red = event.type === "red_card";
      return (
        <div className="bs-ev-body">
          <span className={`bs-ev-icon ${red ? "bs-ev-icon--red" : "bs-ev-icon--yellow"}`}>
            <CardIcon />
          </span>
          <span>
            <span className="bs-ev-kind">{red ? "Red card" : "Yellow card"}</span>{" "}
            {link(event.pids[0])}
          </span>
        </div>
      );
    }
    case "substitution":
      return (
        <div className="bs-ev-body">
          <span className="bs-sub-pair">
            <span className="bs-sub-on">
              <SubInIcon size={8} /> {link(event.pids[1])}
            </span>
            <span className="bs-sub-off">
              <SubOutIcon size={8} /> {playerName(event.pids[0])}
            </span>
          </span>
        </div>
      );
    case "penalty":
      return (
        <div className="bs-ev-body">
          <span className="bs-ev-icon bs-ev-icon--warn">
            <WhistleIcon />
          </span>
          <span>
            <span className="bs-ev-kind">Penalty</span> {link(event.pids[0])} steps up
          </span>
        </div>
      );
    case "injury":
      return (
        <div className="bs-ev-body">
          <span className="bs-ev-icon bs-ev-icon--red">
            <InjuryIcon />
          </span>
          <span>
            <span className="bs-ev-kind">Injury</span> {link(event.pids[0])} goes down
          </span>
        </div>
      );
    case "corner":
      return (
        <div className="bs-ev-body bs-ev-body--quiet">
          <span className="bs-ev-icon">
            <CornerIcon />
          </span>
          <span className="bs-ev-kind">Corner</span>
        </div>
      );
    case "shot_saved":
    case "shot_blocked":
    case "shot_off_target": {
      const label =
        event.type === "shot_saved"
          ? "Saved"
          : event.type === "shot_blocked"
            ? "Blocked"
            : "Off target";
      return (
        <div className="bs-ev-body bs-ev-body--quiet">
          <span className="bs-ev-kind">{label}</span> {link(event.pids[0])}
        </div>
      );
    }
    default:
      return null;
  }
}

function TimelineRow({
  event,
  playerName,
}: {
  event: MatchEvent;
  playerName: (pid: number) => string;
}) {
  const body = <EventBody event={event} playerName={playerName} />;
  if (!body) return null;
  return (
    <div className={`bs-ev bs-ev--${event.side}`}>
      <div className="bs-ev-cell bs-ev-cell--home">{event.side === "home" && body}</div>
      <div className="bs-ev-spine">
        <span className={`bs-ev-chip stat-num ${chipTone(event.type)}`}>
          {formatClock(event.clock)}
        </span>
      </div>
      <div className="bs-ev-cell bs-ev-cell--away">{event.side === "away" && body}</div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Page
   --------------------------------------------------------------------------- */

export function BoxScore() {
  const { matchIndex } = useParams<{ matchIndex: string }>();
  const { league } = useLeague();
  const playerMap = usePlayerMap(league?.players);
  const [showAllEvents, setShowAllEvents] = useState(false);

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
  const homeColors: [string, string] = homeTeam?.colors ?? ["#888888", "#888888"];
  const awayColors: [string, string] = awayTeam?.colors ?? ["#888888", "#888888"];
  const compName = league.competitions.find((c) => c.id === homeTeam?.compId)?.name;

  const playerName = (pid: number) => playerMap.get(pid)?.name ?? `#${pid}`;
  const playerPos = (pid: number) => playerMap.get(pid)?.pos ?? "?";
  const playerNationality = (pid: number) => playerMap.get(pid)?.nationality;

  const sum = (lines: PlayerMatchLine[], pick: (l: PlayerMatchLine) => number) =>
    lines.reduce((total, l) => total + pick(l), 0);

  const home = match.boxScore.home;
  const away = match.boxScore.away;
  const possHome = Math.round(match.possessionHome * 100);
  const corners = (side: "home" | "away") =>
    match.boxScore.events.filter((e) => e.type === "corner" && e.side === side).length;

  const motm = manOfTheMatch(match);
  const motmIsHome = motm ? home.some((l) => l.pid === motm.pid) : false;

  const events = match.boxScore.events
    .filter((e) => e.type !== "turnover")
    .filter((e) => showAllEvents || KEY_EVENTS.has(e.type))
    // The clock counts down, so descending clock is chronological order.
    .sort((a, b) => b.clock - a.clock);

  return (
    <div className="container-fluid p-3 bs-page">
      <Link to="/schedule" className="bs-back">
        &larr; Schedule
      </Link>

      <header className="bs-scoreboard">
        <div className="bs-eyebrow">
          {compName ? `${compName} · ` : ""}Matchday {match.matchday}
        </div>
        <div className="bs-scoreline">
          <ScoreboardSide
            name={homeName}
            tid={match.home}
            colors={homeColors}
            goals={match.homeGoals}
            won={match.homeGoals > match.awayGoals}
            lost={match.homeGoals < match.awayGoals}
            align="home"
          />
          <span className="bs-score-sep" aria-hidden="true" />
          <ScoreboardSide
            name={awayName}
            tid={match.away}
            colors={awayColors}
            goals={match.awayGoals}
            won={match.awayGoals > match.homeGoals}
            lost={match.awayGoals < match.homeGoals}
            align="away"
          />
        </div>

        {motm && (
          <div className={`bs-motm bs-motm--${motmIsHome ? "home" : "away"}`}>
            <span className="bs-motm-mark">
              <StarIcon size={11} />
            </span>
            <span className="bs-motm-label">Man of the match</span>
            <Link to={`/player/${motm.pid}`} className="bs-motm-name">
              {playerName(motm.pid)}
            </Link>
            <span className="bs-motm-meta">
              {playerPos(motm.pid)} · {motmIsHome ? homeName : awayName} ·{" "}
              <span className="stat-num">{motm.rating.toFixed(1)}</span>
            </span>
          </div>
        )}
      </header>

      <section className="bs-compare" aria-label="Match statistics">
        <CompareRow label="Possession" home={possHome} away={100 - possHome} format={(n) => `${n}%`} />
        <CompareRow label="Shots" home={sum(home, (l) => l.shots)} away={sum(away, (l) => l.shots)} />
        <CompareRow
          label="On target"
          home={sum(home, (l) => l.shotsOnTarget)}
          away={sum(away, (l) => l.shotsOnTarget)}
        />
        <CompareRow
          label="xG"
          home={sum(home, (l) => l.xg)}
          away={sum(away, (l) => l.xg)}
          format={(n) => n.toFixed(2)}
        />
        <CompareRow label="Corners" home={corners("home")} away={corners("away")} />
        <CompareRow
          label="Fouls"
          home={sum(home, (l) => l.foulsCommitted)}
          away={sum(away, (l) => l.foulsCommitted)}
        />
      </section>

      <TeamBoxTable
        teamName={homeName}
        tid={match.home}
        colors={homeColors}
        lines={home}
        playerName={playerName}
        playerPos={playerPos}
        playerNationality={playerNationality}
        motmPid={motm?.pid ?? null}
      />
      <TeamBoxTable
        teamName={awayName}
        tid={match.away}
        colors={awayColors}
        lines={away}
        playerName={playerName}
        playerPos={playerPos}
        playerNationality={playerNationality}
        motmPid={motm?.pid ?? null}
      />

      <div className="bs-timeline-head">
        <h6>Play-by-play</h6>
        <div className="btn-group btn-group-sm" role="group" aria-label="Event detail">
          <button
            type="button"
            className={`btn ${showAllEvents ? "btn-outline-success" : "btn-success"}`}
            onClick={() => setShowAllEvents(false)}
          >
            Key events
          </button>
          <button
            type="button"
            className={`btn ${showAllEvents ? "btn-success" : "btn-outline-success"}`}
            onClick={() => setShowAllEvents(true)}
          >
            Every event
          </button>
        </div>
      </div>

      <div className="bs-timeline">
        {events.length === 0 ? (
          <p className="text-muted mb-0 p-3">Nothing worth reporting happened.</p>
        ) : (
          events.map((e, i) => <TimelineRow key={i} event={e} playerName={playerName} />)
        )}
      </div>
    </div>
  );
}
