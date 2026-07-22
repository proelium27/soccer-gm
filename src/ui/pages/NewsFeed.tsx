import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLeague } from "../context/LeagueContext.js";
import type { StoredTeam } from "../../core/leagueState.js";
import type { NewsEvent, NewsEventType } from "../../core/newsEvents.js";
import { buildSeasonTimeline, type FeedItem } from "../newsFeedTimeline.js";
import { isFreeAgentTid } from "../../core/transfers/negotiation.js";
import { currency, seasonYear } from "../format.js";
import { Flag } from "../components/Flag.js";
import { ClubCrest } from "../components/ClubCrest.js";

type ClubFilter = "all" | "user";

const EVENT_LABEL: Record<NewsEventType, string> = {
  hattrick: "⚽ Hat-trick",
  standoutRating: "⭐ Standout performance",
  goalMilestoneSeason: "🎯 Season milestone",
  goalMilestoneCareer: "🎯 Career milestone",
  generationalTalent: "💎 Generational talent",
};

function eventDetail(e: NewsEvent): string {
  switch (e.type) {
    case "hattrick":
      return `${e.detail} goals`;
    case "standoutRating":
      return `${(e.detail / 10).toFixed(1)} rating`;
    case "goalMilestoneSeason":
      return `${e.detail} goals this season`;
    case "goalMilestoneCareer":
      return `${e.detail} career goals`;
    case "generationalTalent":
      return `once-in-a-generation prospect joins the academy, age ${e.detail}`;
  }
}

export function NewsFeed() {
  const { league } = useLeague();
  const [clubFilter, setClubFilter] = useState<ClubFilter>("all");
  const [seasonFilter, setSeasonFilter] = useState<"all" | number>("all");

  const playerMap = useMemo(
    () => new Map((league?.players ?? []).map((p) => [p.pid, p])),
    [league?.players],
  );
  const teamMap = useMemo(
    () => new Map((league?.teams ?? []).map((t) => [t.tid, t])),
    [league?.teams],
  );

  if (!league) {
    return <p className="p-3">Loading...</p>;
  }

  const userTid = league.meta.userTid;
  const userTeam = teamMap.get(userTid);

  const involvesUser = (item: FeedItem): boolean =>
    item.kind === "transfer"
      ? item.data.fromTid === userTid || item.data.toTid === userTid
      : item.data.tid === userTid;

  const passesFilters = (season: number, item: FeedItem): boolean => {
    if (clubFilter === "user" && !involvesUser(item)) return false;
    if (seasonFilter !== "all" && season !== seasonFilter) return false;
    return true;
  };

  // Seasons present across either feed, newest first, for the dropdown.
  const seasons = [
    ...new Set([
      ...league.transfers.map((t) => t.season),
      ...league.newsEvents.map((e) => e.season),
    ]),
  ].sort((a, b) => b - a);

  const seasonsToShow = seasonFilter === "all" ? seasons : seasons.filter((s) => s === seasonFilter);

  const teamCell = (tid: number) => {
    if (isFreeAgentTid(tid)) {
      return <span className="text-muted">Free agent</span>;
    }
    const team: StoredTeam | undefined = teamMap.get(tid);
    return (
      <span className="d-inline-flex align-items-center gap-1">
        <ClubCrest tid={tid} colors={team?.colors ?? ["#888888", "#888888"]} />
        {team?.name ?? `Team ${tid}`}
      </span>
    );
  };

  const playerCell = (pid: number) => {
    const p = playerMap.get(pid);
    return (
      <>
        {p ? <Link to={`/player/${p.pid}`}>{p.name}</Link> : `Player ${pid}`}{" "}
        {p && <Flag nationality={p.nationality} />}
        {p && <span className="text-muted small"> ({p.pos})</span>}
      </>
    );
  };

  const totalItems = seasonsToShow.reduce((sum, season) => {
    const transfers = league.transfers.filter((t) => t.season === season);
    const events = league.newsEvents.filter((e) => e.season === season);
    return sum + buildSeasonTimeline(transfers, events, league.meta.userTid).filter((item) => passesFilters(season, item)).length;
  }, 0);

  return (
    <div className="container-fluid p-3">
      <h4>News Feed</h4>
      <p className="text-muted">
        The news feed covers every completed transfer across the league, plus player milestones
        and standout performances.
      </p>

      <div className="d-flex flex-wrap gap-2 mb-3">
        <select
          className="form-select w-auto"
          value={clubFilter}
          onChange={(e) => setClubFilter(e.target.value as ClubFilter)}
        >
          <option value="all">All clubs</option>
          <option value="user">Only {userTeam?.name ?? "my club"}</option>
        </select>
        <select
          className="form-select w-auto"
          value={String(seasonFilter)}
          onChange={(e) =>
            setSeasonFilter(e.target.value === "all" ? "all" : Number(e.target.value))
          }
        >
          <option value="all">All seasons</option>
          {seasons.map((s) => (
            <option key={s} value={s}>{seasonYear(s)}</option>
          ))}
        </select>
      </div>

      {totalItems === 0 ? (
        <p className="text-muted">
          {league.transfers.length === 0 && league.newsEvents.length === 0
            ? "Nothing has happened in the league yet."
            : "Nothing matches the current filters."}
        </p>
      ) : (
        [...seasonsToShow].sort((a, b) => b - a).map((season) => {
          const transfers = league.transfers.filter((t) => t.season === season);
          const events = league.newsEvents.filter((e) => e.season === season);
          const timeline = buildSeasonTimeline(transfers, events, league.meta.userTid).filter((item) =>
            passesFilters(season, item),
          );
          if (timeline.length === 0) return null;

          return (
            <div className="card mb-3" key={season}>
              <div className="card-body">
                <h5 className="card-title">
                  {seasonYear(season)}{" "}
                  <span className="text-muted small">
                    ({timeline.length} {timeline.length === 1 ? "item" : "items"})
                  </span>
                </h5>
                <div className="table-responsive">
                  <table className="table table-striped table-sm mb-0 align-middle">
                    <thead>
                      <tr>
                        <th>Event</th>
                        <th>Player</th>
                        <th>Club(s)</th>
                        <th className="text-end">Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {timeline.map((item, i) => {
                        const highlighted = involvesUser(item);
                        if (item.kind === "transfer") {
                          const t = item.data;
                          return (
                            <tr key={`t-${t.pid}-${t.season}-${t.window}-${i}`}
                                className={highlighted ? "team-highlight" : undefined}>
                              <td className="text-muted small text-capitalize">
                                {t.loanReturn
                                  ? "loan return"
                                  : t.loanSeasons
                                    ? `${t.window} window loan (${t.loanSeasons} season${t.loanSeasons > 1 ? "s" : ""})`
                                    : isFreeAgentTid(t.fromTid)
                                      ? `${t.window} window free signing`
                                      : `${t.window} window transfer`}
                              </td>
                              <td>{playerCell(t.pid)}</td>
                              <td>
                                <span className="d-inline-flex align-items-center gap-1">
                                  {teamCell(t.fromTid)} <span className="text-muted">→</span> {teamCell(t.toTid)}
                                </span>
                              </td>
                              <td className="text-end stat-num">{t.loanReturn ? "—" : currency.format(t.fee)}</td>
                            </tr>
                          );
                        }
                        const e = item.data;
                        return (
                          <tr key={`n-${e.pid}-${e.season}-${e.matchday}-${e.type}-${i}`}
                              className={highlighted ? "team-highlight" : undefined}>
                            <td className="small">{EVENT_LABEL[e.type]} (MD {e.matchday})</td>
                            <td>{playerCell(e.pid)}</td>
                            <td>{teamCell(e.tid)}</td>
                            <td className="text-end stat-num">{eventDetail(e)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
