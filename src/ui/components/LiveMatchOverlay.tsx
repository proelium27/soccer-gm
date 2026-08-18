import { useMemo, useState } from "react";
import type { PlayedMatch, MatchScore } from "../../core/standings.js";
import type { StoredTeam } from "../../core/teams/clubs.js";
import { ClubCrest } from "./ClubCrest.js";
import { KEY_EVENTS, TimelineRow } from "./matchEvents.js";
import { useMatchPlayback, type PlaybackSpeed } from "../live/useMatchPlayback.js";
import {
  eventsThrough,
  HALF_TIME_MINUTE,
  liveTableRows,
  scoreAtMinute,
  scoresAtMinute,
  statsAtMinute,
} from "../live/liveMatch.js";

/**
 * The live match viewer: your club's match replayed a minute at a time, with the
 * rest of the matchday landing beside it.
 *
 * Nothing here re-simulates anything. The match is already played and its event
 * stream already timestamped, so this reveals a recording — which is what makes
 * it safe to drop into a sim that is otherwise bit-for-bit deterministic.
 *
 * Presentational on purpose: it takes a match and calls `onComplete` when the
 * viewer is done. The league-committing version passes a callback that saves;
 * the rewatch-an-old-match version passes one that just closes.
 */

const SPEEDS: PlaybackSpeed[] = [1, 2, 4];

interface LiveMatchOverlayProps {
  open: boolean;
  /** The match being watched. */
  match: PlayedMatch;
  /** Every other match in the same competition on the same matchday. */
  otherMatches: PlayedMatch[];
  teams: StoredTeam[];
  playerName: (pid: number) => string;
  /** Every tid in the competition, for the live table. */
  compTeamIds: number[];
  /** Matches played before this matchday, i.e. the table's starting point. */
  priorMatches: MatchScore[];
  competitionName: string;
  /** Called when the user leaves the viewer — commits the matchday in the live flow. */
  onComplete: () => void;
  completeLabel?: string;
}

function PlayIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
      <path d="M2.5 1.2l8 4.8-8 4.8z" />
    </svg>
  );
}

function PauseIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
      <rect x="2.2" y="1.4" width="2.9" height="9.2" rx="0.6" />
      <rect x="6.9" y="1.4" width="2.9" height="9.2" rx="0.6" />
    </svg>
  );
}

function SkipIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
      <path d="M1.6 1.2l6.2 4.8-6.2 4.8z" />
      <rect x="8.6" y="1.2" width="2" height="9.6" rx="0.6" />
    </svg>
  );
}

export function LiveMatchOverlay({
  open,
  match,
  otherMatches,
  teams,
  playerName,
  compTeamIds,
  priorMatches,
  competitionName,
  onComplete,
  completeLabel = "Continue",
}: LiveMatchOverlayProps) {
  const [showAllEvents, setShowAllEvents] = useState(true);
  const playback = useMatchPlayback(match.boxScore.events, { autoStart: open });
  const { minute, finished } = playback;

  const teamOf = useMemo(() => {
    const map = new Map<number, StoredTeam>();
    for (const t of teams) map.set(t.tid, t);
    return map;
  }, [teams]);

  const score = scoreAtMinute(match.boxScore.events, minute);
  const stats = statsAtMinute(match.boxScore.events, minute);

  // Newest first — a live feed reads top-down as it arrives, which also spares
  // an auto-scroll. The box score's own timeline stays oldest-first, since a
  // finished match reads as a story from kickoff.
  const feed = eventsThrough(match.boxScore.events, minute)
    .filter((e) => e.type !== "turnover")
    .filter((e) => showAllEvents || KEY_EVENTS.has(e.type))
    .reverse();

  const rail = scoresAtMinute(otherMatches, minute);
  const table = liveTableRows(compTeamIds, priorMatches, [match, ...otherMatches], minute);

  if (!open) return null;

  const homeTeam = teamOf.get(match.home);
  const awayTeam = teamOf.get(match.away);
  const nameOf = (tid: number) => teamOf.get(tid)?.name ?? `#${tid}`;
  const abbrevOf = (tid: number) => teamOf.get(tid)?.abbrev ?? `#${tid}`;

  const clockLabel = minute === 0 ? "Kickoff" : finished ? "Full time" : `${minute}'`;
  const atHalfTime = minute === HALF_TIME_MINUTE && !finished;

  return (
    <div className="sim-overlay">
      <div className="live-panel card">
        <div className="live-main">
          <header className="bs-scoreboard live-scoreboard">
            <div className="bs-eyebrow">
              {competitionName} · Matchday {match.matchday}
            </div>
            <div className="bs-scoreline">
              <div className="bs-club bs-club--home">
                <span className="bs-club-name">{homeTeam?.name ?? nameOf(match.home)}</span>
                <ClubCrest tid={match.home} colors={homeTeam?.colors ?? ["#888", "#444"]} size={30} />
              </div>
              <div className="live-score stat-num">
                {score.home} - {score.away}
              </div>
              <div className="bs-club bs-club--away">
                <ClubCrest tid={match.away} colors={awayTeam?.colors ?? ["#888", "#444"]} size={30} />
                <span className="bs-club-name">{awayTeam?.name ?? nameOf(match.away)}</span>
              </div>
            </div>
            <div className={`live-clock stat-num${atHalfTime ? " live-clock--break" : ""}`}>
              {atHalfTime ? "Half time" : clockLabel}
            </div>
          </header>

          <div className="live-controls">
            {!finished && (
              <>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={playback.toggle}
                >
                  {playback.playing ? <PauseIcon /> : <PlayIcon />}{" "}
                  {playback.playing ? "Pause" : "Play"}
                </button>
                <div className="btn-group btn-group-sm" role="group" aria-label="Playback speed">
                  {SPEEDS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`btn btn-outline-secondary${playback.speed === s ? " active" : ""}`}
                      onClick={() => playback.setSpeed(s)}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={playback.skipToEnd}
                >
                  <SkipIcon /> Skip to end
                </button>
              </>
            )}
            {finished && (
              <button type="button" className="btn btn-sm btn-primary" onClick={onComplete}>
                {completeLabel}
              </button>
            )}
            <label className="live-toggle form-check form-switch">
              <input
                className="form-check-input"
                type="checkbox"
                checked={showAllEvents}
                onChange={(e) => setShowAllEvents(e.target.checked)}
              />
              <span className="form-check-label">Every chance</span>
            </label>
          </div>

          <div className="live-stats stat-num">
            <span>
              Shots {stats.home.shots}-{stats.away.shots}
            </span>
            <span>
              On target {stats.home.onTarget}-{stats.away.onTarget}
            </span>
            <span>
              Corners {stats.home.corners}-{stats.away.corners}
            </span>
            <span>
              Cards {stats.home.yellows + stats.home.reds}-{stats.away.yellows + stats.away.reds}
            </span>
          </div>

          <div className="live-feed">
            {feed.length === 0 ? (
              <p className="text-muted small live-feed-empty">
                {minute === 0 ? "Just about to kick off." : "Nothing doing yet."}
              </p>
            ) : (
              feed.map((e, i) => (
                <TimelineRow key={`${e.clock}-${e.type}-${i}`} event={e} playerName={playerName} />
              ))
            )}
          </div>
        </div>

        <aside className="live-rail">
          <div className="live-rail-head">Elsewhere</div>
          {rail.length === 0 ? (
            <p className="text-muted small">No other matches today.</p>
          ) : (
            <ul className="live-rail-list">
              {rail.map(({ match: m, score: s, justScored }) => (
                <li
                  key={`${m.home}-${m.away}`}
                  className={`live-rail-row${justScored ? " live-rail-row--scored" : ""}`}
                >
                  <span className="live-rail-club">{abbrevOf(m.home)}</span>
                  <span className="live-rail-score stat-num">
                    {s.home}-{s.away}
                  </span>
                  <span className="live-rail-club live-rail-club--away">{abbrevOf(m.away)}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="live-rail-head">Live table</div>
          <ol className="live-rail-table">
            {table.slice(0, 8).map((row, i) => (
              <li
                key={row.tid}
                className={`live-rail-trow${
                  row.tid === match.home || row.tid === match.away ? " live-rail-trow--mine" : ""
                }`}
              >
                <span className="live-rail-pos stat-num">{i + 1}</span>
                <span className="live-rail-club">{abbrevOf(row.tid)}</span>
                <span className="live-rail-pts stat-num">{row.points}</span>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  );
}
