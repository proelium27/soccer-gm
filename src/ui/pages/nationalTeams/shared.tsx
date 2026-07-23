import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useLeague } from "../../context/LeagueContext.js";
import { Flag } from "../../components/Flag.js";
import type { IntlGroup } from "../../../core/international/index.js";
import { groupTable } from "../../../core/international/index.js";
import { INTL_TOURNAMENT_NAME } from "../../../core/constants.js";

/** Knockout round names for the three-round international bracket. */
export const KO_ROUND_NAMES = ["Quarter-finals", "Semi-finals", "Final"];

/** The National Teams pages, in sidebar/tab order: [path, label]. */
export const NT_TABS: [string, string][] = [
  ["/national-teams/world-cup", INTL_TOURNAMENT_NAME],
  ["/national-teams/qualifying", "Qualifying"],
  ["/national-teams/schedule", "Schedule"],
  ["/national-teams/power-rankings", "Power Rankings"],
  ["/national-teams/leaders", "Stat Leaders"],
  ["/national-teams/history", "History"],
];

export function NationName({ nation }: { nation: string }) {
  return (
    <span className="text-nowrap">
      <Flag nationality={nation} /> {nation}
    </span>
  );
}

/**
 * Shared chrome for every National Teams page: the section heading plus a pill
 * strip that links the six tabs, then the page's own title and content.
 */
export function NationalTeamsLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="container-fluid p-3">
      <h4>National Teams</h4>
      <ul className="nav nav-pills mb-3 flex-wrap gap-1">
        {NT_TABS.map(([to, label]) => (
          <li className="nav-item" key={to}>
            <NavLink to={to} className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
      <h5 className="mb-3">{title}</h5>
      {children}
    </div>
  );
}

/** A normalized group-standings row, keyed by nation so live and archived tables render the same. */
export interface StandingRow {
  nation: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
}

/** Convert a live (nid-keyed) group into normalized nation-keyed standings. */
export function liveGroupRows(group: IntlGroup, nations: string[]): StandingRow[] {
  return groupTable(group).map((r) => ({
    nation: nations[r.nid],
    played: r.played,
    won: r.won,
    drawn: r.drawn,
    lost: r.lost,
    gf: r.gf,
    ga: r.ga,
    gd: r.gd,
    points: r.points,
  }));
}

/**
 * One group's standings table. `highlight` shades the rows that advanced
 * (qualifiers / top finishers); `compact` drops the W/D/L columns for the denser
 * qualifying view.
 */
export function GroupStandings({
  rows,
  highlight,
  compact,
}: {
  rows: StandingRow[];
  highlight?: (nation: string) => boolean;
  compact?: boolean;
}) {
  return (
    <table className="table table-sm mb-0">
      <thead>
        <tr>
          <th style={{ width: compact ? "50%" : "45%" }}>Nation</th>
          <th className="text-end">P</th>
          {!compact && (
            <>
              <th className="text-end">W</th>
              <th className="text-end">D</th>
              <th className="text-end">L</th>
            </>
          )}
          <th className="text-end">GD</th>
          <th className="text-end">Pts</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.nation} className={highlight?.(r.nation) ? "table-success" : undefined}>
            <td><NationName nation={r.nation} /></td>
            <td className="text-end">{r.played}</td>
            {!compact && (
              <>
                <td className="text-end">{r.won}</td>
                <td className="text-end">{r.drawn}</td>
                <td className="text-end">{r.lost}</td>
              </>
            )}
            <td className="text-end">{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
            <td className="text-end fw-bold">{r.points}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** One knockout result, normalized so live ties and archived results render alike. */
export interface KnockoutResultView {
  round: number;
  home: string;
  away: string;
  homeGoals: number;
  awayGoals: number;
  winner: string;
  pens: { home: number; away: number } | null;
  extraTime?: boolean;
}

/** The knockout bracket as one card-column per round. */
export function KnockoutColumns({ results }: { results: KnockoutResultView[] }) {
  const byRound = new Map<number, KnockoutResultView[]>();
  for (const r of results) {
    const list = byRound.get(r.round);
    if (list) list.push(r);
    else byRound.set(r.round, [r]);
  }
  const rounds = [...byRound.entries()].sort((a, b) => a[0] - b[0]);
  if (rounds.length === 0) return <p className="text-muted">The knockout stage hasn't started yet.</p>;

  return (
    <div className="row g-3 mb-3">
      {rounds.map(([round, ties]) => (
        <div className="col-12 col-md-4" key={round}>
          <div className="card">
            <div className="card-header py-1 small fw-bold">
              {KO_ROUND_NAMES[round] ?? `Round ${round + 1}`}
            </div>
            <ul className="list-group list-group-flush">
              {ties.map((tie, i) => (
                <li className="list-group-item py-2 small" key={i}>
                  <div className={tie.winner === tie.home ? "fw-bold" : undefined}>
                    <NationName nation={tie.home} /> {tie.homeGoals}
                  </div>
                  <div className={tie.winner === tie.away ? "fw-bold" : undefined}>
                    <NationName nation={tie.away} /> {tie.awayGoals}
                  </div>
                  {tie.pens && (
                    <div className="text-muted">{tie.pens.home}-{tie.pens.away} on penalties</div>
                  )}
                  {tie.extraTime && !tie.pens && <div className="text-muted">after extra time</div>}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ))}
    </div>
  );
}

/** A year picker for browsing past editions. `seasons` is newest-first. */
export function SeasonSelect({
  seasons,
  value,
  onChange,
  labelFor,
}: {
  seasons: number[];
  value: number;
  onChange: (season: number) => void;
  labelFor: (season: number) => string;
}) {
  if (seasons.length <= 1) return null;
  return (
    <select
      className="form-select form-select-sm w-auto mb-3"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    >
      {seasons.map((s) => (
        <option key={s} value={s}>{labelFor(s)}</option>
      ))}
    </select>
  );
}

/** The shared "international hasn't started" empty state, used by every tab. */
export function useHasInternational(): boolean {
  const { league } = useLeague();
  if (!league) return false;
  const intl = league.international;
  return (
    intl.tournament !== null ||
    intl.qualifying !== null ||
    intl.history.length > 0 ||
    intl.qualifyingHistory.length > 0 ||
    intl.powerRankings.length > 0
  );
}

export function IntlEmpty() {
  return (
    <NationalTeamsLayout title="Not started yet">
      <p className="text-muted">
        National teams play in the summer, on a two-year cycle. Every odd season's offseason runs
        qualifying, where every nation with enough players plays its confederation group home and
        away for one of 16 places. The season after, those 16 meet in the {INTL_TOURNAMENT_NAME}:
        four groups of four, then quarter-finals, semi-finals and a final.
      </p>
      <p className="text-muted">
        Nobody manages a national team, including you. Squads pick themselves from whoever's good
        enough, so your job is to develop players worth calling up, then watch how they get on. The
        first qualifying campaign runs at the end of season 1.
      </p>
    </NationalTeamsLayout>
  );
}
