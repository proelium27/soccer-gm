import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLeague } from "../context/LeagueContext.js";
import { ClubLink } from "../components/ClubLink.js";
import type { LeagueStore } from "../../core/leagueState.js";
import type { StoredTeam } from "../../core/teams/clubs.js";
import { HelpHint } from "../components/HelpHint.js";
import { computeStandings, type StandingsRow } from "../../core/standings.js";
import { nextMatchday, transferWindowState } from "../../core/transfers/window.js";
import { SimTargetForm } from "../components/SimTargetForm.js";
import { JumpSeasonsForm } from "../components/JumpSeasonsForm.js";
import { SCOUTING_SPEND_MAX, RATING_LEADER_QUALIFY_FRACTION } from "../../core/constants.js";
import { wageBill } from "../../core/finance/budget.js";
import { cupFinalists, isCupComplete } from "../../core/cup/cup.js";
import { domesticFinalists } from "../../core/domesticCup/cup.js";
import { isIntlStagePending, roundsRemaining, editableSquad } from "../../core/international/index.js";
import { confidenceMood, confidenceLabel } from "../../core/manager/confidence.js";
import type { IntlConfederationCup, IntlTournament } from "../../core/international/index.js";
import { INTL_TOURNAMENT_NAME, INTL_QUAL_LEGS, qualifyingLeg } from "../../core/constants.js";

/** Bootstrap bar colour per board mood — kept beside the Manager page's copy of the same map. */
const BOARD_MOOD_CLASS: Record<string, string> = {
  secure: "bg-success",
  settled: "bg-info",
  uneasy: "bg-warning",
  danger: "bg-danger",
};
import type { IntlStage } from "../../core/international/index.js";
import { buildSeasonTimeline, type FeedItem } from "../newsFeedTimeline.js";
import { unpackPositionChange } from "../../core/newsEvents.js";
import { seasonAwardNews } from "../../core/awardNews.js";
import { trophyNewsBySeason } from "../../core/trophyNews.js";
import { isFreeAgentTid } from "../../core/transfers/negotiation.js";
import { currency, ordinal, seasonYear } from "../format.js";
import { Flag } from "../components/Flag.js";
import { ClubCrest } from "../components/ClubCrest.js";
import type { Player, SeasonStats } from "../../core/players/types.js";
import { isSuspended, matchesLabel } from "../../core/suspensions.js";

/** A pending staged international stage — every IntlStage that still has play left. */
type PlayableStage = Exclude<IntlStage, null | "done">;

/** True for either of the confederation cup stages. */
function isConfederationCupStage(stage: IntlStage): boolean {
  return stage === "confederation-groups" || stage === "confederation-ko";
}

/** Where the "follow it here" link points for the stage being played. */
function intlStageLink(stage: PlayableStage): string {
  if (stage === "qualifying") return "/national-teams/qualifying";
  if (isConfederationCupStage(stage)) return "/national-teams/confederation-cups";
  return "/national-teams/world-cup";
}

/**
 * The confederation cups this offseason is staging, written out as prose
 * ("the European Championship, Copa América and the Africa Cup of Nations").
 * Empty string when there are none.
 */
function confederationCupLabel(tournaments: IntlConfederationCup[]): string {
  const names = tournaments.map((t) => t.name);
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and the ${names[names.length - 1]}`;
}

/**
 * What to call a knockout round that has `roundsLeft` rounds still to play,
 * counting backwards from the final. Backwards because bracket depth varies —
 * four rounds for the World Cup's 32-nation field, three for a 16-nation
 * confederation cup, one for a tournament that is only a final — so a round's
 * name follows from how much is left, never from a fixed position.
 */
function knockoutRoundName(roundsLeft: number): string {
  if (roundsLeft >= 4) return "round of 16";
  if (roundsLeft === 3) return "quarterfinals";
  if (roundsLeft === 2) return "semifinals";
  return "final";
}

/**
 * What the next confederation cup knockout stage is called. The cups are
 * aligned on their finals (see core/international/confederationCup.ts), so the
 * round is however many the deepest one has left — and since several finish
 * together the last one is plural: "the finals", not "the final".
 */
function confederationCupRoundName(tournaments: IntlConfederationCup[]): string {
  const name = knockoutRoundName(Math.max(0, ...tournaments.map(roundsRemaining)));
  return name === "final" ? "finals" : name;
}

/** What the next World Cup knockout round is called, read off its own bracket. */
function worldCupRoundName(tournament: IntlTournament | null): string {
  return knockoutRoundName(tournament ? roundsRemaining(tournament) : 1);
}

/** The button label for playing the next staged international stage. `qualRound` is 1-based. */
function intlStageButton(
  stage: PlayableStage,
  qualRound: number,
  confederationCups: IntlConfederationCup[],
  tournament: IntlTournament | null,
): string {
  switch (stage) {
    case "qualifying":
      return `Play qualifying (round ${qualRound} of ${INTL_QUAL_LEGS})`;
    case "groups":
      return "Play the group stage";
    case "knockout":
      return `Play the ${worldCupRoundName(tournament)}`;
    case "confederation-groups":
      return "Play the group stage";
    case "confederation-ko":
      return `Play the ${confederationCupRoundName(confederationCups)}`;
  }
}

/**
 * A one-line status for the staged international campaign on the Dashboard.
 *
 * The World Cup knockout is one repeating stage, so its line is built from the
 * bracket rather than written per round: the lead-in comes from whether any tie
 * has been played yet, which stays true whatever depth the bracket is (an old
 * save mid-tournament still has the three-round one).
 */
function intlStageHeadline(
  stage: PlayableStage,
  qualRound: number,
  confederationCups: IntlConfederationCup[],
  tournament: IntlTournament | null,
): string {
  switch (stage) {
    case "qualifying":
      return qualRound < INTL_QUAL_LEGS
        ? `World Cup qualifying is on, round ${qualRound} of ${INTL_QUAL_LEGS}. Play it to move the campaign along.`
        : `The final round of World Cup qualifying, ${qualRound} of ${INTL_QUAL_LEGS}. Play it to lock in who reaches the finals.`;
    case "groups":
      return `The ${INTL_TOURNAMENT_NAME} is here. Play the group stage to get things underway.`;
    case "knockout": {
      const round = worldCupRoundName(tournament);
      if (round === "final") return "Two nations left. It's the final.";
      const lead = (tournament?.ties.length ?? 0) === 0 ? "The group stage is done. " : "";
      return `${lead}The ${round} ${round === "round of 16" ? "is" : "are"} next.`;
    }
    case "confederation-groups":
      return `Qualifying is done for the summer. Now for the ${confederationCupLabel(confederationCups)}: play the group stage to get things underway.`;
    case "confederation-ko":
      return confederationCupRoundName(confederationCups) === "finals"
        ? "Every cup is down to two. The finals are next."
        : `The ${confederationCupRoundName(confederationCups)} are next.`;
  }
}

/**
 * One job's standing, as a single line: who you answer to, a thin bar, and
 * where you stand with them.
 *
 * Both meters share this so the club board and the federation can't drift into
 * looking like two different things — they are the same relationship from two
 * chairs, and the Manager and Federation pages already mirror each other.
 *
 * `value` null means there is no bar to draw: a manager being courted by
 * countries while managing none has a standing with nobody, and a meter sitting
 * at its starting value would invent one.
 */
function ConfidenceLine({ label, mood, value, note, to }: {
  label: string;
  mood: string;
  value: number | null;
  note: string;
  to: string;
}) {
  return (
    <div className="d-flex align-items-center gap-2">
      <Link to={to} className="small text-body text-decoration-none flex-shrink-0">{label}</Link>
      {value !== null && (
        <div className="progress flex-grow-1" style={{ height: 4, minWidth: 40 }}>
          <div
            className={`progress-bar ${BOARD_MOOD_CLASS[mood] ?? "bg-secondary"}`}
            style={{ width: `${Math.round(value)}%` }}
          />
        </div>
      )}
      <span className={`small text-nowrap ${value === null ? "flex-grow-1" : "flex-shrink-0"} text-muted`}>
        {note}
      </span>
    </div>
  );
}

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
  const {
    simAction, simLiveAction, jumpSeasonsAction, setScoutingSpendAction, intlStageAction, simming,
  } = useLeague();
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
    // The season in progress has no seasonHistory snapshot yet, so the live
    // teams are its competition map (see NewsFeed.tsx for the general case).
    const comps: Record<number, number> = {};
    for (const t of league.teams) comps[t.tid] = t.compId;
    const userTid = league.meta.userTid;

    // A season's honours are written into history by the offseason that ends
    // it, which is the same step that moves the clock on — so the season the
    // awards belong to is never the season this panel is showing, and passing
    // it its own awards would always pass none. What the manager wants at that
    // moment is last season's, so they ride along until the new season kicks
    // off (`played` is emptied every offseason) and then drop out on their own.
    //
    // Only his own club's, and only here: the full slate is 27 honours against
    // a panel of NEWS_TOP_N, so the world's would be all a reader ever saw.
    // The News Feed carries the rest.
    const lastSeasonHonours = league.played.length === 0
      ? seasonAwardNews(league.seasonHistory.find((h) => h.season === league.season - 1))
          .filter((a) => a.tid === userTid)
      : [];

    // Trophies need no club filter: each is a single row for the whole world,
    // where the honours run to 27. This season's arrive as they are won (the
    // Continental Cup final, then the World Cup in the offseason, both while
    // the clock still reads this season), and last season's ride along through
    // the rollover the same way the honours do.
    const trophies = trophyNewsBySeason({
      cup: league.cup,
      cupHistory: league.cupHistory,
      shield: league.shield,
      shieldHistory: league.shieldHistory,
      international: league.international,
    });
    const shownTrophies = [
      ...(league.played.length === 0 ? trophies.get(league.season - 1) ?? [] : []),
      ...(trophies.get(league.season) ?? []),
    ];

    const newsTimeline = buildSeasonTimeline(currentSeasonTransfers, currentSeasonEvents, {
      userTid,
      userCompId: comps[userTid],
      compOf: (tid) => comps[tid],
    }, lastSeasonHonours, shownTrophies);
    return [...newsTimeline].slice(-NEWS_TOP_N).reverse();
  }, [
    league.transfers, league.newsEvents, league.season, league.played,
    league.meta.userTid, league.teams, league.seasonHistory,
    league.cup, league.cupHistory, league.shield, league.shieldHistory, league.international,
  ]);

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
    if (item.kind === "trophy") {
      const t = item.data;
      const winner = t.tid !== undefined
        ? teamByTid.get(t.tid)?.name ?? "A club"
        : t.nation ?? "A nation";
      return <>{winner} win the {t.name}</>;
    }
    if (item.kind === "award") {
      const a = item.data;
      const who = playerLink(playerByPid.get(a.pid));
      const comp = league.competitions.find((c) => c.id === a.compId)?.name;
      switch (a.kind) {
        case "ballonDOr":
          return a.placing === 1
            ? <>{who} wins the Ballon d'Or</>
            : <>{who} finishes {a.placing === 2 ? "2nd" : "3rd"} in the Ballon d'Or</>;
        case "worldTeamOfYear":
          return <>{who} makes the World Team of the Year</>;
        case "goalkeeperOfYear":
          return <>{who} is Goalkeeper of the Year</>;
        case "defenderOfYear":
          return <>{who} is Defender of the Year</>;
        case "playerOfSeason":
          return <>{who} is {comp ?? "his league"} Player of the Season</>;
        case "goldenBoot":
          return <>{who} wins the {comp ?? "league"} Golden Boot</>;
        case "teamOfSeason":
          return <>{who} makes the {comp ?? "league"} Team of the Season</>;
      }
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
      case "positionChange": {
        const { from, to } = unpackPositionChange(e.detail);
        return <>{playerLink(player)} is now a {to}, after playing at {from}</>;
      }
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

  // Banned players sit alongside the injured for the same reason: the sim
  // leaves them out on its own, so this is the only warning before you advance.
  const suspendedPlayers = useMemo(() => {
    const roster = new Set(userTeam.roster);
    return league.players
      .filter((p) => roster.has(p.pid) && isSuspended(p))
      .sort((a, b) => b.suspension!.matchesRemaining - a.suspension!.matchesRemaining);
  }, [league.players, userTeam.roster]);

  const disableSim = simming || league.phase === "offseason";
  const boardMood = confidenceMood(league.manager.confidence, league.manager.sackingEnabled);
  const nationMood = confidenceMood(
    league.nationalManager.confidence, league.nationalManager.sackingEnabled,
  );
  // Your country is in the campaign this stage belongs to, so there is a team to
  // pick before the next click plays it.
  const myNationPlaying = editableSquad(league.international, league.nationalManager.nation) !== null;
  // The matchday the club is standing on, and the last one left this season —
  // the bounds the "sim to matchday" box accepts.
  const nextMd = nextMatchday(league);
  const lastMd = league.schedule.length > 0
    ? Math.max(...league.schedule.map((g) => g.matchday))
    : null;

  return (
    <div className="container-fluid p-3">
      {/* Team header */}
      {/*
        The club, and beside it how your two employers rate you.

        Here rather than in a card of their own because that is what these are:
        a property of the job, read at a glance on the way past, not a section.
        Up at the top rather than at the foot of the page because the whole point
        of a visible meter is that trouble is something you watch build — at the
        bottom you meet it on the way out, which is too late to be a warning.
      */}
      <div className="card mb-3">
        <div className="card-body">
          <div className="d-flex flex-wrap align-items-center gap-3">
            <h4 className="card-title d-flex align-items-center gap-2 mb-0">
              <ClubCrest tid={userTeam.tid} colors={userTeam.colors} size={32} />
              {userTeam.name}
            </h4>
            <div className="d-flex flex-wrap gap-3 ms-auto">
              <div style={{ minWidth: 190 }}>
                <ConfidenceLine
                  label="Board"
                  mood={boardMood}
                  value={league.manager.confidence}
                  to="/manager"
                  note={league.manager.offers.length > 0
                    ? `${league.manager.offers.length} club${league.manager.offers.length === 1 ? "" : "s"} want you`
                    : confidenceLabel(boardMood)}
                />
              </div>
              {/*
                Only when there is a country or somebody asking: a manager who
                has never taken an international job should not be shown a meter
                for a job they don't have.
              */}
              {(league.nationalManager.nation || league.nationalManager.offers.length > 0) && (
                <div style={{ minWidth: 190 }}>
                  <ConfidenceLine
                    label={league.nationalManager.nation ?? "Federation"}
                    mood={nationMood}
                    value={league.nationalManager.nation ? league.nationalManager.confidence : null}
                    to="/national-teams/federation"
                    note={league.nationalManager.offers.length > 0
                      ? `${league.nationalManager.offers.length} countr${league.nationalManager.offers.length === 1 ? "y wants" : "ies want"} you`
                      : confidenceLabel(nationMood)}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* A continental final: the season sim halts before it, so flag why. The
          user's club can only be in one of the two competitions. */}
      {([["cup", league.cup], ["shield", league.shield]] as const).map(([kind, comp]) =>
        comp && !isCupComplete(comp) && cupFinalists(comp).includes(league.meta.userTid) ? (
          <div key={kind} className="alert alert-warning d-flex justify-content-between align-items-center mb-3">
            <span>
              Your club has reached the {comp.name} final. Simming pauses here so you can prepare.
            </span>
            <Link to={`/${kind}`} className="btn btn-sm btn-outline-warning">View bracket</Link>
          </div>
        ) : null,
      )}

      {/* Domestic cup final: the season sim halts before this one too. */}
      {(league.domesticCups ?? []).some(
        (c) => c.championTid === null && domesticFinalists(c).includes(league.meta.userTid),
      ) && (
        <div className="alert alert-warning d-flex justify-content-between align-items-center mb-3">
          <span>Your club has reached the domestic cup final. Simming pauses here so you can prepare.</span>
          <Link to="/domestic-cup" className="btn btn-sm btn-outline-warning">View the cup</Link>
        </div>
      )}

      {/* Sim controls */}
      <div className="card mb-3">
        <div className="card-body">
          <h5 className="card-title">Simulation</h5>
          {/* One row: the fixed jumps and the live viewer, then the
              pick-your-own control, so the card doesn't leave a band of empty
              space to their right. */}
          <div className="d-flex align-items-start gap-2 flex-wrap">
            <button
              className="btn btn-primary"
              disabled={disableSim}
              onClick={() => simAction("game")}
            >
              Sim One Game
            </button>
            {/*
              Same matchday, watched instead of skipped. Deliberately its own
              button rather than a saved preference: watching is a mood, and
              a setting you have to go and flip is worse than a second button
              you can ignore.
            */}
            <button
              className="btn btn-primary"
              disabled={disableSim}
              title="Watch your club's match play out minute by minute"
              onClick={() => simLiveAction()}
            >
              Watch Next Game
            </button>
            <button
              className="btn btn-primary"
              disabled={disableSim}
              onClick={() => simAction("season")}
            >
              Sim to End of Season
            </button>
            {nextMd !== null && lastMd !== null && (
              <SimTargetForm
                current={nextMd}
                last={lastMd}
                disabled={disableSim}
                onSim={(matchday) => simAction({ matchday })}
              />
            )}
          </div>
        </div>
      </div>

      {/*
        Jump ahead. Its own card rather than a fifth button in Simulation: that
        card plays matchdays of the season you're managing and is dead in the
        offseason, while this hands the club over entirely and works from either
        phase. Putting them together would make the two read as the same kind of
        thing, and they are not.
      */}
      <div className="card mb-3">
        <div className="card-body">
          <h5 className="card-title">Jump ahead</h5>
          <JumpSeasonsForm
            season={league.season}
            disabled={simming}
            onJump={(seasons) => jumpSeasonsAction(seasons)}
          />
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

      {/* Suspensions: who's banned, and for how much longer. */}
      {suspendedPlayers.length > 0 && (
        <div className="card mb-3">
          <div className="card-body">
            <h5 className="card-title">
              Suspensions <span className="text-muted small">({suspendedPlayers.length} out)</span>
            </h5>
            <ul className="list-unstyled small mb-0">
              {suspendedPlayers.map((p) => (
                <li key={p.pid} className="mb-1">
                  <Link to={`/player/${p.pid}`}>{p.name}</Link>{" "}
                  <Flag nationality={p.nationality} />
                  <span className="text-muted">
                    {" "}({p.pos}) — {p.suspension!.reason}, out of the next{" "}
                    {matchesLabel(p.suspension!.matchesRemaining)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="text-muted small mt-2">
              Bans only cover league matches, so these players can still play in the cup.
            </div>
          </div>
        </div>
      )}

      {/* Offseason */}
      {league.phase === "offseason" && (
        <div className="card mb-3">
          <div className="card-body">
            <h5 className="card-title">Offseason</h5>
            {league.manager.sacked ? (
              <>
                <p className="card-text">
                  The board has seen enough. You're out of a job, and the season
                  can't move on until you've found a new one.
                </p>
                <button className="btn btn-danger" onClick={() => navigate("/manager")}>
                  See who'll have you
                </button>
              </>
            ) : isIntlStagePending(league.international) ? (
              <>
                <p className="card-text">
                  {intlStageHeadline(
                    league.international.stage as PlayableStage,
                    qualifyingLeg(league.season) + 1,
                    league.international.confederationCups,
                    league.international.tournament,
                  )}{" "}
                  Follow it on the{" "}
                  <Link to={intlStageLink(league.international.stage as PlayableStage)}>
                    National Teams
                  </Link>{" "}
                  pages. You'll advance to {seasonYear(league.season + 1)} once it wraps up, or you
                  can skip it and go straight to the offseason.
                </p>
                {/*
                  Your own country is in this one, so there is a team to pick
                  before the next click plays it. Placed here rather than left to
                  the sidebar because the stage button is the thing about to make
                  the decision permanent.
                */}
                {myNationPlaying && (
                  <p className="card-text">
                    <strong>{league.nationalManager.nation}</strong> are in it, and you pick
                    the team.{" "}
                    <Link to="/national-teams/my-squad">Name your squad</Link> before you
                    play the next round.
                  </p>
                )}
                <div className="d-flex flex-wrap gap-2">
                  <button
                    className="btn btn-primary"
                    disabled={simming}
                    onClick={() => intlStageAction("stage")}
                  >
                    {intlStageButton(
                      league.international.stage as PlayableStage,
                      qualifyingLeg(league.season) + 1,
                      league.international.confederationCups,
                      league.international.tournament,
                    )}
                  </button>
                  {league.international.stage !== "qualifying" && (
                    <button
                      className="btn btn-outline-primary"
                      disabled={simming}
                      onClick={() => intlStageAction("through")}
                    >
                      Sim through the {isConfederationCupStage(league.international.stage) ? "the cups" : INTL_TOURNAMENT_NAME}
                    </button>
                  )}
                  {/*
                    Skip: go straight to the offseason without watching any of
                    this. Nothing is thrown away — the advance itself plays out
                    every stage the user left unplayed (simOffseason opens with
                    simThroughInternational), on the same seeded streams, so the
                    results are identical to having clicked through them and are
                    waiting on the National Teams pages afterwards.
                  */}
                  <button
                    className="btn btn-outline-secondary"
                    disabled={simming}
                    onClick={() => navigate("/set-scouting")}
                  >
                    {league.international.stage === "qualifying"
                      ? "Skip qualifying"
                      : isConfederationCupStage(league.international.stage)
                        ? "Skip the cups"
                        : `Skip the ${INTL_TOURNAMENT_NAME}`}
                  </button>
                </div>
                <p className="card-text text-muted small mt-2 mb-0">
                  Skipping still plays the games out, you just don't watch them. The results will be
                  on the National Teams pages when you get there.
                </p>
              </>
            ) : (
              <>
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
              </>
            )}
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
                    const isUser = row.tid === league.meta.userTid;
                    return (
                      <tr key={row.tid} className={isUser ? "team-highlight" : undefined}>
                        <td className="text-end">{i + 1}</td>
                        <td><ClubLink tid={row.tid} /></td>
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
                {userTeam.budget < 0 && (
                  <div className="alert alert-danger py-2 text-start" role="alert">
                    You're in the red, so you can't sign anyone and your scouting is switched
                    off until you're back in the black. <Link to="/finance">See the finances</Link>
                    {" "}or sell someone you can do without.
                  </div>
                )}
                <p className="card-text mb-2">
                  Budget:{" "}
                  <span className={userTeam.budget < 0 ? "text-danger fw-semibold" : undefined}>
                    {currency.format(userTeam.budget)}
                  </span>
                  {" "}&middot; Hype: {Math.round(userTeam.hype)}/100
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
