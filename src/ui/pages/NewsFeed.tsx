import { useMemo, useState } from "react";
import { useLeague } from "../context/LeagueContext.js";
import type { StoredTeam } from "../../core/leagueState.js";
import type { CompletedTransfer } from "../../core/transfers/negotiation.js";
import { currency, seasonYear } from "../format.js";
import { Flag } from "../components/Flag.js";

type ClubFilter = "all" | "user";

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

  // Newest first, then apply the club/season filters.
  const feed = [...league.transfers].reverse().filter((t) => {
    if (clubFilter === "user" && t.fromTid !== userTid && t.toTid !== userTid) return false;
    if (seasonFilter !== "all" && t.season !== seasonFilter) return false;
    return true;
  });

  // Seasons present, newest first, for the dropdown.
  const seasons = [...new Set(league.transfers.map((t) => t.season))].sort((a, b) => b - a);

  // Group the filtered feed by season, preserving the newest-first order.
  const bySeason: { season: number; transfers: CompletedTransfer[] }[] = [];
  for (const t of feed) {
    const last = bySeason[bySeason.length - 1];
    if (last && last.season === t.season) last.transfers.push(t);
    else bySeason.push({ season: t.season, transfers: [t] });
  }

  const teamCell = (tid: number) => {
    const team: StoredTeam | undefined = teamMap.get(tid);
    return (
      <span className="d-inline-flex align-items-center gap-1">
        <span className="color-swatch" style={{ backgroundColor: team?.colors[0] }} />
        {team?.name ?? `Team ${tid}`}
      </span>
    );
  };

  return (
    <div className="container-fluid p-3">
      <h4>News Feed</h4>
      <p className="text-muted">
        Every completed transfer across the league — including deals between rival clubs — newest first.
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

      {feed.length === 0 ? (
        <p className="text-muted">
          {league.transfers.length === 0
            ? "No transfers have been completed yet."
            : "No transfers match the current filters."}
        </p>
      ) : (
        bySeason.map(({ season, transfers }) => (
          <div className="card mb-3" key={season}>
            <div className="card-body">
              <h5 className="card-title">
                {seasonYear(season)}{" "}
                <span className="text-muted small">
                  ({transfers.length} {transfers.length === 1 ? "deal" : "deals"})
                </span>
              </h5>
              <div className="table-responsive">
                <table className="table table-striped table-sm mb-0 align-middle">
                  <thead>
                    <tr>
                      <th>Window</th>
                      <th>Player</th>
                      <th>From</th>
                      <th aria-label="to" />
                      <th>To</th>
                      <th className="text-end">Fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transfers.map((t, i) => {
                      const p = playerMap.get(t.pid);
                      const involvesUser = t.fromTid === userTid || t.toTid === userTid;
                      return (
                        <tr key={`${t.pid}-${t.season}-${t.window}-${i}`}
                            className={involvesUser ? "team-highlight" : undefined}>
                          <td className="text-muted small text-capitalize">{t.window}</td>
                          <td>
                            {p?.name ?? `Player ${t.pid}`}{" "}
                            {p && <Flag nationality={p.nationality} />}
                            {p && <span className="text-muted small"> ({p.pos})</span>}
                          </td>
                          <td>{teamCell(t.fromTid)}</td>
                          <td className="text-muted">→</td>
                          <td>{teamCell(t.toTid)}</td>
                          <td className="text-end stat-num">{currency.format(t.fee)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
