import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLeague } from "../context/LeagueContext.js";
import type { LeagueStore } from "../../core/leagueState.js";
import type { StoredTeam } from "../../core/teams/clubs.js";
import { HelpHint } from "../components/HelpHint.js";
import { computeStandings, type StandingsRow } from "../../core/standings.js";
import { nextMatchday, transferWindowState } from "../../core/transfers/window.js";
import { TRANSFER_DEADLINE_MATCHDAY } from "../../core/calendar.js";
import { SCOUTING_SPEND_MAX, RATING_LEADER_QUALIFY_FRACTION } from "../../core/constants.js";
import { wageBill } from "../../core/finance/budget.js";
import { cupFinalists, isCupComplete } from "../../core/cup/cup.js";
import { buildSeasonTimeline, type FeedItem } from "../newsFeedTimeline.js";
import { isFreeAgentTid } from "../../core/transfers/negotiation.js";
import { currency, ordinal, seasonYear } from "../format.js";
import { Flag } from "../components/Flag.js";
import { ClubCrest } from "../components/ClubCrest.js";
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
  ratingMinApps: number,
): StatLeaderRow[] {
  const rows: StatLeaderRow[] = [];
  for (const p of players) {
    if (!pidPool.has(p.pid)) continue;
    const ss = p.stats.find((s) => s.season === season);
    if (!ss || Number(ss[key]) <= 0) continue;
    // Match Rating is an average: a one-off cameo shouldn't top the board. The
    // threshold scales with how many games have been played (see caller).
    if (key === "avgRating" && ss.appearances < ratingMinApps) continue;
    rows.push({ player: p, value: Number(ss[key]) });
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
  const { league } = useLeague();

  if (!league) {
    return <p className="p-3">Loading...</p>;
  }

  const userTeam = league.teams.find((t) => t.tid === league.meta.userTid);
  if (!userTeam) {
    return <p className="p-3">Team not found.</p>;
  }

  return <DashboardBody league={league} userTeam={userTeam} />;
}

// The rendered body lives in its own component so its hooks run unconditionally
// (after the null-guards above). Every expensive derivation is memoized on the
// specific league slice it reads, so a re-render that doesn't touch that slice
// — most importantly dragging the scouting slider, which only changes local
// draft state — skips recomputing standings, the news timeline, the lookup
// maps, the wage bill, and the stat-leader scans over the whole player pool.
function DashboardBody({ league, userTeam }: { league: LeagueStore; userTeam: StoredTeam }) {
  const { simAction, setScoutingSpendAction, simming } = useLeague();
  const navigate = useNavigate();
  // Slider position while dragging; persisted (and clamped) only on release
  // so we don't write to IndexedDB on every drag tick.
  const [scoutingDraft, setScoutingDraft] = useState<number | null>(null);

  const commitScoutingDraft = async () => {
    if (scoutingDraft === null) return;
    // Persist first, then drop the draft, so the slider never flashes the
    // stale stored value while the save is in flight.
    await setScoutingSpendAction(scoutingDraft);
    setScoutingDraft(null);
  };

  // Compute standings (user's own division) and find user's row
  const { userRow, leaguePosition, standingsTop, userInTop } = useMemo(() => {
    const divisionTids = league.teams.filter((t) => t.compId === userTeam.compId).map((t) => t.tid);
    const standings = computeStandings(
      divisionTids,
      league.played.filter((m) => {
        const home = league.teams.find((t) => t.tid === m.home);
        return home?.compId === userTeam.compId;
      }),
    );
    const userRow = standings.find((r) => r.tid === league.meta.userTid);
    const leaguePosition = standings.findIndex((r) => r.tid === league.meta.userTid) + 1;
    const standingsTop: StandingsRow[] = standings.slice(0, STANDINGS_TOP_N);
    const userInTop = standingsTop.some((r) => r.tid === league.meta.userTid);
    return { userRow, leaguePosition, standingsTop, userInTop };
  }, [league.teams, league.played, league.meta.userTid, userTeam.compId]);

  // Next match: lowest matchday in schedule, find user's fixture
  const nextMatchInfo = useMemo<React.ReactNode>(() => {
    if (league.schedule.length === 0) {
      return <span>Season Complete</span>;
    }
    const minMatchday = Math.min(...league.schedule.map((g) => g.matchday));
    const userFixture = league.schedule.find(
      (g) =>
        g.matchday === minMatchday &&
        (g.home === league.meta.userTid || g.away === league.meta.userTid),
    );
    if (userFixture) {
      const isHome = userFixture.home === league.meta.userTid;
      const opponentTid = isHome ? userFixture.away : userFixture.home;
      const opponent = league.teams.find((t) => t.tid === opponentTid);
      return (
        <span>
          {isHome ? "vs" : "@"} {opponent?.name ?? "Unknown"} (Matchday {minMatchday})
        </span>
      );
    }
    return <span>Bye (Matchday {minMatchday})</span>;
  }, [league.schedule, league.teams, league.meta.userTid]);

  // News headlines: most recent items from the current season's timeline.
  const newsHeadlines = useMemo(() => {
    const currentSeasonTransfers = league.transfers.filter((t) => t.season === league.season);
    const currentSeasonEvents = league.newsEvents.filter((e) => e.season === league.season);
    const newsTimeline = buildSeasonTimeline(currentSeasonTransfers, currentSeasonEvents, league.meta.userTid);
    return [...newsTimeline].slice(-NEWS_TOP_N).reverse();
  }, [league.transfers, league.newsEvents, league.season, league.meta.userTid]);

  const teamByTid = useMemo(() => new Map(league.teams.map((t) => [t.tid, t])), [league.teams]);
  const playerByPid = useMemo(() => new Map(league.players.map((p) => [p.pid, p])), [league.players]);

  const playerLink = (player: Player | undefined): React.ReactNode =>
    player ? <Link to={`/player/${player.pid}`}>{player.name}</Link> : "A player";

  const headlineNode = (item: FeedItem): React.ReactNode => {
    if (item.kind === "transfer") {
      const t = item.data;
      const player = playerByPid.get(t.pid);
      const to = teamByTid.get(t.toTid);
      // A free-agent signing (fromTid is the sentinel) reads as a free move, not
      // a club-to-club transfer with a phantom "?" origin.
      if (isFreeAgentTid(t.fromTid)) {
        return (
          <>
            {playerLink(player)} signs for {to?.name ?? "?"} on a free
          </>
        );
      }
      const from = teamByTid.get(t.fromTid);
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
      case "generationalTalent":
        return (
          <>
            {playerLink(player)}, a once-in-a-generation talent, joins {teamByTid.get(e.tid)?.name ?? "?"} (age {e.detail})
          </>
        );
    }
  };

  // Stat leaders: league-wide (user's division) vs. the user's own team only.
  const leaguePidPool = useMemo(() => {
    const pool = new Set<number>();
    for (const t of league.teams) {
      if (t.compId !== userTeam.compId) continue;
      for (const pid of t.roster) pool.add(pid);
    }
    return pool;
  }, [league.teams, userTeam.compId]);
  const teamPidPool = useMemo(() => new Set(userTeam.roster), [userTeam.roster]);

  // The Match Rating board needs a player to have appeared in a fraction of the
  // games played *so far* — count the matchdays this division has completed and
  // take that fraction, so a hot cameo can't top the board ten games in.
  const ratingMinApps = useMemo(() => {
    const compTids = new Set(
      league.teams.filter((t) => t.compId === userTeam.compId).map((t) => t.tid),
    );
    const mds = new Set<number>();
    for (const m of league.played) {
      if (compTids.has(m.home) || compTids.has(m.away)) mds.add(m.matchday);
    }
    return Math.max(1, Math.ceil(RATING_LEADER_QUALIFY_FRACTION * mds.size));
  }, [league.teams, league.played, userTeam.compId]);

  // Pre-scan the stat leaders once per pool (each is an O(players) sweep). Index
  // aligns with LEADER_STAT_KEYS so the JSX below just reads the ith result.
  const leagueLeaders = useMemo(
    () => LEADER_STAT_KEYS.map(({ key }) => topByStat(league.players, leaguePidPool, league.season, key, ratingMinApps)),
    [league.players, leaguePidPool, league.season, ratingMinApps],
  );
  const teamLeaders = useMemo(
    () => LEADER_STAT_KEYS.map(({ key }) => topByStat(league.players, teamPidPool, league.season, key, ratingMinApps)),
    [league.players, teamPidPool, league.season, ratingMinApps],
  );

  // Season wage bill: senior roster + academy, priced from every player's
  // salary. Memoized so the O(players) salary map isn't rebuilt each render.
  const seasonWageBill = useMemo(
    () => wageBill(
      [...userTeam.roster, ...userTeam.academyRoster],
      new Map(league.players.map((p) => [p.pid, p.contract.salary])),
    ),
    [userTeam.roster, userTeam.academyRoster, league.players],
  );

  // Injured players in the user's squad — surfaced so you know who's out before
  // simming (they get auto-benched during the sim, so this is the heads-up).
  const injuredPlayers = useMemo(() => {
    const roster = new Set(userTeam.roster);
    return league.players
      .filter((p) => roster.has(p.pid) && p.injury)
      .sort((a, b) => (b.injury!.gamesRemaining - a.injury!.gamesRemaining));
  }, [league.players, userTeam.roster]);

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
            <ClubCrest tid={userTeam.tid} colors={userTeam.colors} size={32} />
            {userTeam.name}
          </h4>
        </div>
      </div>

      {/* Continental Cup final: the season sim halts before it, so flag why. */}
      {league.cup &&
        !isCupComplete(league.cup) &&
        cupFinalists(league.cup).includes(league.meta.userTid) && (
          <div className="alert alert-warning d-flex justify-content-between align-items-center mb-3">
            <span>Your club has reached the Continental Cup final. Simming pauses here so you can prepare.</span>
            <Link to="/cup" className="btn btn-sm btn-outline-warning">View bracket</Link>
          </div>
        )}

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

      {/* Injury report: who on your squad is currently sidelined. */}
      {injuredPlayers.length > 0 && (
        <div className="card mb-3">
          <div className="card-body">
            <h5 className="card-title">
              Injuries <span className="text-muted small">({injuredPlayers.length} out)</span>
            </h5>
            <ul className="list-unstyled small mb-0">
              {injuredPlayers.map((p) => (
                <li key={p.pid} className="mb-1">
                  <Link to={`/player/${p.pid}`}>{p.name}</Link>{" "}
                  <Flag nationality={p.nationality} />
                  <span className="text-muted">
                    {" "}({p.pos}) — {p.injury!.type}, out about {p.injury!.gamesRemaining}{" "}
                    {p.injury!.gamesRemaining === 1 ? "match" : "matches"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Offseason */}
      {league.phase === "offseason" && (
        <div className="card mb-3">
          <div className="card-body">
            <h5 className="card-title">Offseason</h5>
            <p className="card-text">
              {seasonYear(league.season)} is complete. First you'll set your
              scouting budget for the new season, then advancing runs player
              progression, retirements, AI free agency, and youth intake, and
              starts {seasonYear(league.season + 1)}.
            </p>
            <button
              className="btn btn-success"
              disabled={simming}
              onClick={() => navigate("/set-scouting")}
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
                  <strong>{currency.format(seasonWageBill)}</strong>{" "}
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
                {(() => {
                  const isOffseason = league.phase === "offseason";
                  return (
                    <>
                      <label className="form-label mb-1" htmlFor="scouting-spend">
                        {isOffseason ? (
                          <>Scouting budget for next season: {currency.format(scoutingDraft ?? userTeam.nextScoutingSpend)}</>
                        ) : (
                          <>Scouting spend this season: {currency.format(userTeam.scoutingSpend)} (locked)</>
                        )}
                        <HelpHint>
                          {isOffseason
                            ? "More scouting spend sharpens everything you see all season. Transfer valuations for targets and for your own players get way more accurate, and players' potential (POT) shows as an exact number sooner instead of a wide range."
                            : "Wait until the offseason to set your scouting budget."}
                        </HelpHint>
                      </label>
                      <input
                        id="scouting-spend"
                        type="range"
                        className="form-range"
                        min={0}
                        max={SCOUTING_SPEND_MAX}
                        step={100_000}
                        value={isOffseason ? (scoutingDraft ?? userTeam.nextScoutingSpend) : userTeam.scoutingSpend}
                        disabled={simming || !isOffseason}
                        onChange={(e) => setScoutingDraft(Number(e.target.value))}
                        onPointerUp={commitScoutingDraft}
                        onBlur={commitScoutingDraft}
                      />
                    </>
                  );
                })()}
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
              {LEADER_STAT_KEYS.map(({ key, label }, i) => (
                <StatLeaderList
                  key={key}
                  title={label}
                  decimals={key === "avgRating"}
                  rows={leagueLeaders[i]}
                />
              ))}
            </div>
            <div className="col-md-6">
              <div className="text-muted small text-uppercase mb-1">{userTeam.name}</div>
              {LEADER_STAT_KEYS.map(({ key, label }, i) => (
                <StatLeaderList
                  key={key}
                  title={label}
                  decimals={key === "avgRating"}
                  rows={teamLeaders[i]}
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
