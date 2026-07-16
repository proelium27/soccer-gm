import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLeague } from "../context/LeagueContext.js";
import { computeStandings, type StandingsRow } from "../../core/standings.js";
import { nextMatchday, transferWindowState } from "../../core/transfers/window.js";
import { TRANSFER_DEADLINE_MATCHDAY } from "../../core/calendar.js";
import { SCOUTING_SPEND_MAX } from "../../core/constants.js";
import { wageBill } from "../../core/finance/budget.js";
import { buildSeasonTimeline, type FeedItem } from "../newsFeedTimeline.js";
import { currency, ordinal, seasonYear } from "../format.js";
import { Flag } from "../components/Flag.js";
import type { Player, SeasonStats } from "../../core/players/types.js";

const STANDINGS_TOP_N = 8;
const NEWS_TOP_N = 8;
const LEADER_STAT_KEYS: { key: keyof SeasonStats; label: string }[] = [
  { key: "goals", label: "Goals" },
  { key: "assists", label: "Assists" },
  { key: "tackles", label: "Tackles" },
  { key: "avgRating", label: "Match Rating" },
];
const LEADERS_PER_STAT = 3;

interface StatLeaderRow {
  player: Player;
  value: number;
}

function topByStat(
  players: Player[],
  pidPool: Set<number>,
  season: number,
  key: keyof SeasonStats,
): StatLeaderRow[] {
  const rows: StatLeaderRow[] = [];
  for (const p of players) {
    if (!pidPool.has(p.pid)) continue;
    const ss = p.stats.find((s) => s.season === season);
    if (ss && Number(ss[key]) > 0) {
      rows.push({ player: p, value: Number(ss[key]) });
    }
  }
  rows.sort((a, b) => b.value - a.value);
  return rows.slice(0, LEADERS_PER_STAT);
}

function StatLeaderList({ title, rows, decimals }: { title: string; rows: StatLeaderRow[]; decimals?: boolean }) {
  return (
    <div className="mb-2">
      <div className="text-muted small fw-semibold">{title}</div>
      {rows.length === 0 ? (
        <div className="text-muted small">No data yet</div>
      ) : (
        <ol className="mb-0 ps-3 small">
          {rows.map((r) => (
            <li key={r.player.pid}>
              <Link to={`/player/${r.player.pid}`}>{r.player.name}</Link>{" "}
              <Flag nationality={r.player.nationality} />{" "}
              <span className="text-muted">— {decimals ? r.value.toFixed(2) : r.value}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function Dashboard() {
  const { league, simAction, offseasonAction, setScoutingSpendAction, simming } = useLeague();
  const navigate = useNavigate();
  // Slider position while dragging; persisted (and clamped) only on release
  // so we don't write to IndexedDB on every drag tick.
  const [scoutingDraft, setScoutingDraft] = useState<number | null>(null);

  if (!league) {
    return <p className="p-3">Loading...</p>;
  }

  const userTeam = league.teams.find((t) => t.tid === league.meta.userTid);
  if (!userTeam) {
    return <p className="p-3">Team not found.</p>;
  }

  const commitScoutingDraft = async () => {
    if (scoutingDraft === null) return;
    // Persist first, then drop the draft, so the slider never flashes the
    // stale stored value while the save is in flight.
    await setScoutingSpendAction(scoutingDraft);
    setScoutingDraft(null);
  };

  // Compute standings (user's own division) and find user's row
  const divisionTids = league.teams.filter((t) => t.division === userTeam.division).map((t) => t.tid);
  const standings = computeStandings(
    divisionTids,
    league.played.filter((m) => {
      const home = league.teams.find((t) => t.tid === m.home);
      return home?.division === userTeam.division;
    }),
  );
  const userRow = standings.find((r) => r.tid === league.meta.userTid);
  const leaguePosition = standings.findIndex((r) => r.tid === league.meta.userTid) + 1;

  const standingsTop: StandingsRow[] = standings.slice(0, STANDINGS_TOP_N);
  const userInTop = standingsTop.some((r) => r.tid === league.meta.userTid);

  // Next match: lowest matchday in schedule, find user's fixture
  let nextMatchInfo: React.ReactNode;
  if (league.schedule.length === 0) {
    nextMatchInfo = <span>Season Complete</span>;
  } else {
    const minMatchday = Math.min(
      ...league.schedule.map((g) => g.matchday),
    );
    const userFixture = league.schedule.find(
      (g) =>
        g.matchday === minMatchday &&
        (g.home === league.meta.userTid || g.away === league.meta.userTid),
    );
    if (userFixture) {
      const isHome = userFixture.home === league.meta.userTid;
      const opponentTid = isHome ? userFixture.away : userFixture.home;
      const opponent = league.teams.find((t) => t.tid === opponentTid);
      nextMatchInfo = (
        <span>
          {isHome ? "vs" : "@"} {opponent?.name ?? "Unknown"} (Matchday{" "}
          {minMatchday})
        </span>
      );
    } else {
      nextMatchInfo = <span>Bye (Matchday {minMatchday})</span>;
    }
  }

  // News headlines: most recent items from the current season's timeline.
  const currentSeasonTransfers = league.transfers.filter((t) => t.season === league.season);
  const currentSeasonEvents = league.newsEvents.filter((e) => e.season === league.season);
  const newsTimeline = buildSeasonTimeline(currentSeasonTransfers, currentSeasonEvents);
  const newsHeadlines = [...newsTimeline].slice(-NEWS_TOP_N).reverse();
  const teamByTid = new Map(league.teams.map((t) => [t.tid, t]));
  const playerByPid = new Map(league.players.map((p) => [p.pid, p]));

  const playerLink = (player: Player | undefined): React.ReactNode =>
    player ? <Link to={`/player/${player.pid}`}>{player.name}</Link> : "A player";

  const headlineNode = (item: FeedItem): React.ReactNode => {
    if (item.kind === "transfer") {
      const t = item.data;
      const player = playerByPid.get(t.pid);
      const from = teamByTid.get(t.fromTid);
      const to = teamByTid.get(t.toTid);
      return (
        <>
          {playerLink(player)} moves from {from?.name ?? "?"} to {to?.name ?? "?"} ({currency.format(t.fee)})
        </>
      );
    }
    const e = item.data;
    const player = playerByPid.get(e.pid);
    switch (e.type) {
      case "hattrick":
        return <>{playerLink(player)} scores a hat-trick ({e.detail} goals)</>;
      case "standoutRating":
        return <>{playerLink(player)} is the standout performer ({(e.detail / 10).toFixed(1)} rating)</>;
      case "goalMilestoneSeason":
        return <>{playerLink(player)} reaches {e.detail} goals this season</>;
      case "goalMilestoneCareer":
        return <>{playerLink(player)} reaches {e.detail} career goals</>;
    }
  };

  // Stat leaders: league-wide (user's division) vs. the user's own team only.
  const leaguePidPool = new Set<number>();
  for (const t of league.teams) {
    if (t.division !== userTeam.division) continue;
    for (const pid of t.roster) leaguePidPool.add(pid);
  }
  const teamPidPool = new Set(userTeam.roster);

  const disableSim = simming || league.phase === "offseason";
  // Once the user is standing on deadline day (or past it), "sim to the
  // deadline" has nowhere left to go — simThrough treats it as a no-op.
  const nextMd = nextMatchday(league);
  const atOrPastDeadline = nextMd === null || nextMd >= TRANSFER_DEADLINE_MATCHDAY;

  return (
    <div className="container-fluid p-3">
      {/* Team header */}
      <div className="card mb-3">
        <div className="card-body">
          <h4 className="card-title d-flex align-items-center gap-2">
            <span
              className="color-swatch"
              style={{ backgroundColor: userTeam.colors[0] }}
            />
            <span
              className="color-swatch"
              style={{ backgroundColor: userTeam.colors[1] }}
            />
            {userTeam.name}
          </h4>
        </div>
      </div>

      {/* Sim controls */}
      <div className="card mb-3">
        <div className="card-body">
          <h5 className="card-title">Simulation</h5>
          <div className="btn-group" role="group">
            <button
              className="btn btn-primary"
              disabled={disableSim}
              onClick={() => simAction("game")}
            >
              Sim One Game
            </button>
            <button
              className="btn btn-primary"
              disabled={disableSim}
              onClick={() => simAction("month")}
            >
              Sim to End of Month
            </button>
            <button
              className="btn btn-primary"
              disabled={disableSim || atOrPastDeadline}
              title={
                !disableSim && atOrPastDeadline
                  ? "The transfer deadline has been reached this season"
                  : undefined
              }
              onClick={() => simAction("deadline")}
            >
              Sim to Transfer Deadline
            </button>
            <button
              className="btn btn-primary"
              disabled={disableSim}
              onClick={() => simAction("season")}
            >
              Sim to End of Season
            </button>
          </div>
        </div>
      </div>

      {/* Offseason */}
      {league.phase === "offseason" && (
        <div className="card mb-3">
          <div className="card-body">
            <h5 className="card-title">Offseason</h5>
            <p className="card-text">
              {seasonYear(league.season)} is complete. Advancing will run player
              progression, retirements, AI free agency, and youth intake, then
              start {seasonYear(league.season + 1)}.
            </p>
            <button
              className="btn btn-success"
              disabled={simming}
              onClick={() => offseasonAction().then(() => navigate("/season-preview"))}
            >
              Advance to {seasonYear(league.season + 1)}
            </button>
          </div>
        </div>
      )}

      {/* Standings | Record + Next Match | News headlines */}
      <div className="row g-3 mb-3">
        <div className="col-lg-3 order-lg-1">
          <div className="card h-100">
            <div className="card-body">
              <h5 className="card-title">Standings</h5>
              <table className="table table-striped table-sm mb-1">
                <thead>
                  <tr>
                    <th className="text-end">#</th>
                    <th>Team</th>
                    <th className="text-end">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {standingsTop.map((row, i) => {
                    const team = teamByTid.get(row.tid);
                    const isUser = row.tid === league.meta.userTid;
                    return (
                      <tr key={row.tid} className={isUser ? "team-highlight" : undefined}>
                        <td className="text-end">{i + 1}</td>
                        <td>{team?.name ?? `Team ${row.tid}`}</td>
                        <td className="text-end">{row.points}</td>
                      </tr>
                    );
                  })}
                  {!userInTop && userRow && (
                    <tr className="team-highlight">
                      <td className="text-end">{leaguePosition}</td>
                      <td>{userTeam.name}</td>
                      <td className="text-end">{userRow.points}</td>
                    </tr>
                  )}
                </tbody>
              </table>
              <Link to="/standings" className="small">Full standings</Link>
            </div>
          </div>
        </div>

        <div className="col-lg-6 order-lg-2">
          <div className="card h-100">
            <div className="card-body text-center">
              <h5 className="card-title">Current Record</h5>
              {userRow && userRow.played > 0 ? (
                <p className="display-6 mb-1">
                  {userRow.won}-{userRow.drawn}-{userRow.lost}
                </p>
              ) : (
                <p className="display-6 mb-1">0-0-0</p>
              )}
              <p className="text-muted mb-3">
                {userRow && userRow.played > 0
                  ? `${userRow.points} pts · ${ordinal(leaguePosition)} in league`
                  : "No matches played yet"}
              </p>
              <h6 className="text-muted">Next Match</h6>
              <p className="mb-3">{nextMatchInfo}</p>

              <hr />

              <h5 className="card-title text-start">Finances</h5>
              <div className="text-start">
                <p className="card-text mb-2">
                  Budget: {currency.format(userTeam.budget)} &middot; Hype: {Math.round(userTeam.hype)}/100
                  {" "}&middot; <Link to="/finance">Full breakdown</Link>
                </p>
                <p className="card-text mb-2">
                  Season wage bill:{" "}
                  <strong>
                    {currency.format(
                      wageBill(
                        [...userTeam.roster, ...userTeam.academyRoster],
                        new Map(league.players.map((p) => [p.pid, p.contract.salary])),
                      ),
                    )}
                  </strong>{" "}
                  &middot; paid up front each season
                </p>
                <p className="card-text mb-2">
                  {(() => {
                    const ws = transferWindowState(league);
                    return ws.open ? (
                      <>
                        {ws.window === "summer" ? "Summer" : "Winter"} transfer window{" "}
                        <strong>open</strong> &middot; <Link to="/transfers">Go to Transfers</Link>
                      </>
                    ) : (
                      <>Transfer window closed</>
                    );
                  })()}
                </p>
                <label className="form-label mb-1" htmlFor="scouting-spend">
                  Scouting spend this season: {currency.format(scoutingDraft ?? userTeam.scoutingSpend)}
                </label>
                <input
                  id="scouting-spend"
                  type="range"
                  className="form-range"
                  min={0}
                  max={SCOUTING_SPEND_MAX}
                  step={100_000}
                  value={scoutingDraft ?? userTeam.scoutingSpend}
                  disabled={simming}
                  onChange={(e) => setScoutingDraft(Number(e.target.value))}
                  onPointerUp={commitScoutingDraft}
                  onBlur={commitScoutingDraft}
                />
                <p className="card-text text-muted small mb-0 mt-1">
                  Sharpens your read on transfer targets and offers — raise it before a window
                  where you plan to buy or sell.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-3 order-lg-3">
          <div className="card h-100">
            <div className="card-body">
              <h5 className="card-title">News</h5>
              {newsHeadlines.length === 0 ? (
                <p className="text-muted small">Nothing to report yet.</p>
              ) : (
                <ul className="list-unstyled small mb-1">
                  {newsHeadlines.map((item, i) => (
                    <li key={i} className="mb-2">{headlineNode(item)}</li>
                  ))}
                </ul>
              )}
              <Link to="/news" className="small">Full news feed</Link>
            </div>
          </div>
        </div>
      </div>

      {/* Stat leaders */}
      <div className="card mb-3">
        <div className="card-body">
          <h5 className="card-title">Stat Leaders</h5>
          <div className="row">
            <div className="col-md-6">
              <div className="text-muted small text-uppercase mb-1">League-wide</div>
              {LEADER_STAT_KEYS.map(({ key, label }) => (
                <StatLeaderList
                  key={key}
                  title={label}
                  decimals={key === "avgRating"}
                  rows={topByStat(league.players, leaguePidPool, league.season, key)}
                />
              ))}
            </div>
            <div className="col-md-6">
              <div className="text-muted small text-uppercase mb-1">{userTeam.name}</div>
              {LEADER_STAT_KEYS.map(({ key, label }) => (
                <StatLeaderList
                  key={key}
                  title={label}
                  decimals={key === "avgRating"}
                  rows={topByStat(league.players, teamPidPool, league.season, key)}
                />
              ))}
            </div>
          </div>
          <Link to="/leaders" className="small">Full stat leaders</Link>
        </div>
      </div>
    </div>
  );
}
