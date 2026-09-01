/**
 * The Dashboard for a save nobody manages.
 *
 * Its own page rather than a branch through `Dashboard.tsx`, because that page
 * is built around a `userTeam` that does not exist here: its table position,
 * next fixture, injury list, board meter, wage bill, scouting slider and squad
 * stat leaders are all readings of one club. Threading a null through them
 * would leave a dashboard that is mostly empty cards apologising for
 * themselves, and would put a conditional in front of every derivation on the
 * hottest page in the game.
 *
 * What survives is the part that was never about your club: the controls that
 * move time forward, and the world they move. So this page is the sim controls
 * plus a league table you choose, and it leans on the existing world pages for
 * the rest rather than rebuilding them.
 */
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLeague } from "../context/LeagueContext.js";
import { useOffseasonAdvance } from "../useOffseasonAdvance.js";
import type { LeagueStore } from "../../core/leagueState.js";
import { ClubLink } from "../components/ClubLink.js";
import { computeStandings } from "../../core/standings.js";
import { nextMatchday } from "../../core/transfers/window.js";
import { SimTargetForm } from "../components/SimTargetForm.js";
import { JumpSeasonsForm } from "../components/JumpSeasonsForm.js";
import { isIntlStagePending } from "../../core/international/index.js";
import {
  intlStageButton,
  intlStageHeadline,
  intlStageLink,
  intlStageSkipLabel,
  intlStageThroughLabel,
  type PlayableStage,
} from "../intlStageLabels.js";
import { buildSeasonTimeline, type FeedItem } from "../newsFeedTimeline.js";
import { newsHeadlineNode } from "../components/NewsHeadline.js";
import { seasonAwardNews } from "../../core/awardNews.js";
import { trophyNewsBySeason } from "../../core/trophyNews.js";
import { promotionNewsBySeason } from "../../core/promotionNews.js";
import { seasonYear } from "../format.js";
import { qualifyingLeg } from "../../core/constants.js";

/** How many standings rows the table snippet shows before pointing at /standings. */
const STANDINGS_TOP_N = 8;
/** How many headlines the news panel shows. */
const NEWS_TOP_N = 8;

export function SpectatorDashboard({ league }: { league: LeagueStore }) {
  const { simAction, jumpSeasonsAction, intlStageAction, simming } = useLeague();
  const advanceOffseason = useOffseasonAdvance();
  const navigate = useNavigate();

  // Which league's table to show. A view, not save state — a spectator has no
  // home division, so this is simply the last one they looked at.
  const [compId, setCompId] = useState<number>(() => league.competitions[0]?.id ?? 0);
  const competition =
    league.competitions.find((c) => c.id === compId) ?? league.competitions[0];

  const standings = useMemo(() => {
    if (!competition) return [];
    const divisionTids = league.teams
      .filter((t) => t.compId === competition.id)
      .map((t) => t.tid);
    const tidSet = new Set(divisionTids);
    return computeStandings(
      divisionTids,
      league.played.filter((m) => tidSet.has(m.home)),
    );
  }, [league.teams, league.played, competition]);

  // The same world feed the News Feed builds. The audience is the spectator
  // themselves: `userTid` matches no club and there is no `userCompId`, so
  // `buildSeasonTimeline` keeps only its world tier — which is exactly right
  // here, since a spectator has no league of their own for the middle tier to
  // mean anything about.
  const headlines = useMemo(() => {
    const comps: Record<number, number> = {};
    for (const t of league.teams) comps[t.tid] = t.compId;

    const lastSeasonHonours = league.played.length === 0
      ? seasonAwardNews(league.seasonHistory.find((h) => h.season === league.season - 1))
      : [];

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

    const promotions = promotionNewsBySeason([
      ...league.promotionPlayoffs,
      ...(league.played.length === 0
        ? (league.seasonHistory.find((h) => h.season === league.season - 1)?.promotionPlayoffs ?? [])
        : []),
    ]);
    const shownPromotions = [
      ...(promotions.get(league.season) ?? []),
      ...(promotions.get(league.season - 1) ?? []),
    ];

    const timeline = buildSeasonTimeline(
      league.transfers.filter((t) => t.season === league.season),
      league.newsEvents.filter((e) => e.season === league.season),
      { userTid: league.meta.userTid, userCompId: undefined, compOf: (tid) => comps[tid] },
      lastSeasonHonours, shownTrophies, [], shownPromotions,
    );
    return [...timeline].slice(-NEWS_TOP_N).reverse();
  }, [
    league.transfers, league.newsEvents, league.season, league.played,
    league.meta.userTid, league.teams, league.seasonHistory,
    league.cup, league.cupHistory, league.shield, league.shieldHistory, league.international,
    league.promotionPlayoffs,
  ]);

  const teamByTid = useMemo(() => new Map(league.teams.map((t) => [t.tid, t])), [league.teams]);
  const playerByPid = useMemo(() => new Map(league.players.map((p) => [p.pid, p])), [league.players]);
  const headlineNode = (item: FeedItem): React.ReactNode =>
    newsHeadlineNode(item, { teamByTid, playerByPid, competitions: league.competitions });

  const nextMd = nextMatchday(league);
  const lastMd = league.schedule.length > 0
    ? Math.max(...league.schedule.map((g) => g.matchday))
    : null;
  const stage = league.international.stage as PlayableStage;

  return (
    <div className="container-fluid p-3">
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
        <div>
          <h4 className="mb-0">{league.meta.name}</h4>
          <div className="text-muted small">
            {seasonYear(league.season)} ·{" "}
            {league.phase === "offseason"
              ? "Offseason"
              : nextMd !== null
                ? `Matchday ${nextMd}`
                : "Season complete"}{" "}
            · {league.teams.length} clubs across {league.competitions.length} divisions
          </div>
        </div>
        <span className="badge bg-secondary align-self-start">Spectating</span>
      </div>

      {/* Sim controls. Same phase-aware shape as the managed Dashboard's card,
          minus the two things that need a club: the live viewer (there is no
          match of yours to watch) and the sacked-manager gate (a spectator has
          no board and no stint, so it can never fire). */}
      <div className="card mb-3">
        <div className="card-body">
          <h5 className="card-title">Simulation</h5>
          {league.phase === "offseason" ? (
            isIntlStagePending(league.international) ? (
              <>
                <p className="card-text">
                  {intlStageHeadline(
                    stage,
                    qualifyingLeg(league.season) + 1,
                    league.international.confederationCups,
                    league.international.tournament,
                  )}{" "}
                  Follow it on the{" "}
                  <Link to={intlStageLink(stage)}>National Teams</Link> pages. You'll advance to{" "}
                  {seasonYear(league.season + 1)} once it wraps up, or you can skip it and go
                  straight to the offseason.
                </p>
                <div className="d-flex flex-wrap gap-2">
                  <button
                    className="btn btn-primary"
                    disabled={simming}
                    onClick={() => intlStageAction("stage")}
                  >
                    {intlStageButton(
                      stage,
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
                      {intlStageThroughLabel(stage)}
                    </button>
                  )}
                  <button
                    className="btn btn-outline-secondary"
                    disabled={simming}
                    onClick={advanceOffseason}
                  >
                    {intlStageSkipLabel(stage)}
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
                  {seasonYear(league.season)} is complete. Advancing runs player progression,
                  retirements, transfers, free agency and youth intake across every club, and starts{" "}
                  {seasonYear(league.season + 1)}.
                </p>
                <button className="btn btn-success" disabled={simming} onClick={advanceOffseason}>
                  Advance to {seasonYear(league.season + 1)}
                </button>
              </>
            )
          ) : (
            <div className="d-flex align-items-start gap-2 flex-wrap">
              <button
                className="btn btn-primary"
                disabled={simming}
                onClick={() => simAction("game")}
              >
                Sim One Matchday
              </button>
              <button
                className="btn btn-primary"
                disabled={simming}
                onClick={() => simAction("season")}
              >
                Sim to End of Season
              </button>
              {nextMd !== null && lastMd !== null && (
                <SimTargetForm
                  current={nextMd}
                  last={lastMd}
                  disabled={simming}
                  onSim={(matchday) => simAction({ matchday })}
                />
              )}
            </div>
          )}
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-body">
          <h5 className="card-title">Jump ahead</h5>
          <JumpSeasonsForm
            season={league.season}
            disabled={simming}
            spectating
            onJump={(seasons) => jumpSeasonsAction(seasons)}
          />
        </div>
      </div>

      <div className="row g-3">
        <div className="col-lg-6">
          <div className="card h-100">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
                <h5 className="card-title mb-0">Table</h5>
                <select
                  className="form-select form-select-sm"
                  style={{ width: "auto" }}
                  value={competition?.id ?? ""}
                  aria-label="Competition"
                  onChange={(e) => setCompId(Number(e.target.value))}
                >
                  {league.competitions.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              {standings.length === 0 ? (
                <p className="text-muted mb-0">No games played yet.</p>
              ) : (
                <table className="table table-sm mb-2">
                  <thead>
                    <tr>
                      <th></th><th>Club</th><th className="text-end">P</th>
                      <th className="text-end">GD</th><th className="text-end">Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.slice(0, STANDINGS_TOP_N).map((r, i) => (
                      <tr key={r.tid}>
                        <td className="text-muted">{i + 1}</td>
                        <td><ClubLink tid={r.tid} crest /></td>
                        <td className="text-end">{r.played}</td>
                        <td className="text-end">{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
                        <td className="text-end fw-semibold">{r.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <Link to="/standings" className="btn btn-sm btn-outline-secondary">
                Full standings
              </Link>
            </div>
          </div>
        </div>

        <div className="col-lg-6">
          <div className="card h-100">
            <div className="card-body">
              <h5 className="card-title">Around the world</h5>
              {headlines.length === 0 ? (
                <p className="text-muted mb-3">Nothing has happened yet this season.</p>
              ) : (
                <ul className="list-unstyled small mb-3">
                  {headlines.map((item, i) => (
                    <li key={i} className="mb-2">{headlineNode(item)}</li>
                  ))}
                </ul>
              )}
              <div className="d-flex flex-wrap gap-2">
                <button className="btn btn-sm btn-outline-secondary" onClick={() => navigate("/news")}>
                  News feed
                </button>
                <button className="btn btn-sm btn-outline-secondary" onClick={() => navigate("/power-rankings")}>
                  Power rankings
                </button>
                <button className="btn btn-sm btn-outline-secondary" onClick={() => navigate("/leaders")}>
                  Stat leaders
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
