import { useState } from "react";
import { useLeague } from "../context/LeagueContext.js";
import { HelpHint, PotHelp } from "../components/HelpHint.js";
import { computeStandings, type StandingsRow } from "../../core/standings.js";
import { computeTeamRating } from "../../core/teams/teamRating.js";
import { teamSlots } from "../../core/lineup/formations.js";
import { tierOf } from "../../core/competitions.js";
import { worldHasCup, cupSlotsForCompetition } from "../../core/cup/cup.js";
import { CompetitionSelect } from "../components/CompetitionSelect.js";
import { ClubCrest } from "../components/ClubCrest.js";
import { SortableTh, useTableSort, sortRows } from "../components/SortableTable.js";
import { seasonYear } from "../format.js";

type StandingsSortKey =
  | "pos" | "team" | "p" | "w" | "d" | "l" | "gf" | "ga" | "gd" | "pts" | "ovr" | "pot";

export function Standings() {
  const { league } = useLeague();
  const [season, setSeason] = useState<number | "current">("current");
  const [compIdOverride, setCompIdOverride] = useState<number | null>(null);
  // Default "pos" ascending keeps the natural league-table order (1st on top).
  const { sort, toggle } = useTableSort<StandingsSortKey>("pos", "asc");

  if (!league) {
    return <p className="p-3">Loading...</p>;
  }

  if (league.played.length === 0 && league.seasonHistory.length === 0) {
    return (
      <div className="container-fluid p-3">
        <h4>Standings</h4>
        <p>No matches played yet.</p>
      </div>
    );
  }

  const userTeam = league.teams.find((t) => t.tid === league.meta.userTid);
  const compId = compIdOverride ?? userTeam?.compId ?? league.competitions[0].id;
  const isTier1 = tierOf(league.competitions, compId) === 1;
  // Each tier-1 table's top clubs qualify for the Continental Cup — four for a
  // strong league, two for a weak one. Only mark the zone in worlds that field a
  // cup.
  const comp = league.competitions.find((c) => c.id === compId);
  const showCupZone = isTier1 && !!comp && worldHasCup(league.competitions);
  const cupSlots = comp ? cupSlotsForCompetition(comp) : 0;

  const seasonOptions = [...league.seasonHistory.map((h) => h.season)].sort((a, b) => b - a);

  let standings: StandingsRow[];
  let championTid: number;
  if (season === "current") {
    const teamIds = league.teams.filter((t) => t.compId === compId).map((t) => t.tid);
    standings = computeStandings(teamIds, league.played.filter((m) => {
      const home = league.teams.find((t) => t.tid === m.home);
      return home?.compId === compId;
    }));
    // A "champion" only means something once the season has actually been
    // decided by played matches, not an arbitrary tid=0 tie at kickoff.
    championTid = league.played.length > 0 ? (standings[0]?.tid ?? -1) : -1;
  } else {
    const entry = league.seasonHistory.find((h) => h.season === season)!;
    const compTids = new Set(
      Object.entries(entry.compsByTid)
        .filter(([, c]) => c === compId)
        .map(([tid]) => Number(tid)),
    );
    standings = entry.table.filter((row) => compTids.has(row.tid));
    championTid = entry.championTidByCompId[compId] ?? (standings[0]?.tid ?? -1);
  }

  // True league position (0-based) by tid, captured before any re-sort so the
  // "#" column and cup-qualification shading always reflect real standing, not
  // the current display order.
  const posByTid = new Map(standings.map((row, i) => [row.tid, i]));
  // OVR/POT are only shown (and sortable) for the current season. Precompute
  // once so the sort accessor and the row render share the same numbers.
  const ratingByTid = new Map<number, { ovr: number; pot: number }>();
  if (season === "current") {
    for (const row of standings) {
      const team = league.teams.find((t) => t.tid === row.tid);
      if (team) {
        ratingByTid.set(
          row.tid,
          computeTeamRating(
            league.players.filter((p) => team.roster.includes(p.pid)),
            team.starters,
            teamSlots(team),
          ),
        );
      }
    }
  }
  const displayRows = sortRows(standings, sort, {
    pos: (r) => posByTid.get(r.tid) ?? 0,
    team: (r) => league.teams.find((t) => t.tid === r.tid)?.name ?? `Team ${r.tid}`,
    p: (r) => r.played,
    w: (r) => r.won,
    d: (r) => r.drawn,
    l: (r) => r.lost,
    gf: (r) => r.gf,
    ga: (r) => r.ga,
    gd: (r) => r.gd,
    pts: (r) => r.points,
    ovr: (r) => ratingByTid.get(r.tid)?.ovr ?? -1,
    pot: (r) => ratingByTid.get(r.tid)?.pot ?? -1,
  });

  return (
    <div className="container-fluid p-3">
      <h4>
        Standings
        <HelpHint>The top clubs of each top-flight league qualify for the Continental Cup.</HelpHint>
      </h4>
      <div className="mb-3">
        <select
          className="form-select form-select-sm"
          style={{ width: "auto", display: "inline-block" }}
          value={season}
          onChange={(e) => setSeason(e.target.value === "current" ? "current" : Number(e.target.value))}
        >
          <option value="current">Current Season ({seasonYear(league.season)})</option>
          {seasonOptions.map((s) => (
            <option key={s} value={s}>{seasonYear(s)}</option>
          ))}
        </select>{" "}
        <CompetitionSelect
          competitions={league.competitions}
          value={compId}
          onChange={(v) => setCompIdOverride(v === "all" ? null : v)}
        />
      </div>
      {standings.length === 0 ? (
        <p>No matches played yet.</p>
      ) : (
        <>
        <table className="table table-striped table-sm">
          <thead>
            <tr>
              <SortableTh sortKey="pos" sort={sort} onSort={toggle} className="text-end" defaultDir="asc">#</SortableTh>
              <SortableTh sortKey="team" sort={sort} onSort={toggle} defaultDir="asc">Team</SortableTh>
              <SortableTh sortKey="p" sort={sort} onSort={toggle} className="text-end">P</SortableTh>
              <SortableTh sortKey="w" sort={sort} onSort={toggle} className="text-end">W</SortableTh>
              <SortableTh sortKey="d" sort={sort} onSort={toggle} className="text-end">D</SortableTh>
              <SortableTh sortKey="l" sort={sort} onSort={toggle} className="text-end">L</SortableTh>
              <SortableTh sortKey="gf" sort={sort} onSort={toggle} className="text-end">GF</SortableTh>
              <SortableTh sortKey="ga" sort={sort} onSort={toggle} className="text-end">GA</SortableTh>
              <SortableTh sortKey="gd" sort={sort} onSort={toggle} className="text-end">GD</SortableTh>
              <SortableTh sortKey="pts" sort={sort} onSort={toggle} className="text-end">Pts</SortableTh>
              {season === "current" && <SortableTh sortKey="ovr" sort={sort} onSort={toggle} className="text-end">OVR</SortableTh>}
              {season === "current" && <SortableTh sortKey="pot" sort={sort} onSort={toggle} className="text-end">POT <PotHelp /></SortableTh>}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row) => {
              const pos = posByTid.get(row.tid) ?? 0;
              const team = league.teams.find((t) => t.tid === row.tid);
              const isUser = row.tid === league.meta.userTid;
              const isChampion = row.tid === championTid;
              const isCupSpot = showCupZone && pos < cupSlots;
              const isCupCut = showCupZone && pos === cupSlots - 1;
              const rowClass = [
                isCupSpot && "cup-qualification",
                isCupCut && "cup-qualification-cut",
                isUser && "team-highlight",
                isChampion && "champion-highlight",
              ]
                .filter(Boolean)
                .join(" ") || undefined;
              const rating = ratingByTid.get(row.tid) ?? null;
              return (
                <tr key={row.tid} className={rowClass}>
                  <td className="text-end">{pos + 1}</td>
                  <td>
                    <span className="d-inline-flex align-items-center gap-1">
                      <ClubCrest tid={row.tid} colors={team?.colors ?? ["#888888", "#888888"]} />
                      {team?.name ?? `Team ${row.tid}`}
                      {isChampion && (
                        <span className="text-muted small"> {isTier1 ? "🏆 (Champion)" : "(1st)"}</span>
                      )}
                    </span>
                  </td>
                  <td className="text-end">{row.played}</td>
                  <td className="text-end">{row.won}</td>
                  <td className="text-end">{row.drawn}</td>
                  <td className="text-end">{row.lost}</td>
                  <td className="text-end">{row.gf}</td>
                  <td className="text-end">{row.ga}</td>
                  <td className="text-end">{row.gd}</td>
                  <td className="text-end">{row.points}</td>
                  {season === "current" && <td className="text-end">{rating?.ovr ?? "-"}</td>}
                  {season === "current" && <td className="text-end">{rating?.pot ?? "-"}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
        {showCupZone && (
          <p className="text-muted small mt-1 mb-0">
            <span className="cup-zone-key" /> Top {cupSlots} qualify for the Continental Cup.
          </p>
        )}
        </>
      )}
    </div>
  );
}
