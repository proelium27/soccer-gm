import type { ReactNode } from "react";
import { useLeague } from "../../context/LeagueContext.js";
import { Flag } from "../../components/Flag.js";
import type {
  IntlGroup, InternationalState, IntlTournament, IntlQualifyingCampaign,
} from "../../../core/international/index.js";
import { groupTable } from "../../../core/international/index.js";
import { INTL_TOURNAMENT_NAME, INTL_CYCLE_YEARS, INTL_FIELD_SIZE } from "../../../core/constants.js";

/** Knockout round names for the three-round international bracket. */
export const KO_ROUND_NAMES = ["Quarter-finals", "Semi-finals", "Final"];

export function NationName({ nation }: { nation: string }) {
  return (
    <span className="text-nowrap">
      <Flag nationality={nation} /> {nation}
    </span>
  );
}

/**
 * Shared chrome for every National Teams page: the section heading and the
 * page's own title, then its content. Navigation between the tabs is the
 * sidebar's job — the pages carry no link strip of their own.
 */
export function NationalTeamsLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="container-fluid p-3">
      <h4>National Teams</h4>
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

/**
 * Which campaign a "what's happening now" tab should show.
 *
 * While a stage is pending, it's whatever is being played. Otherwise it's the
 * more recent of the two on file — which is *not* simply "the tournament if
 * there is one": once a new cycle's qualifying is drawn, that campaign is newer
 * than the last World Cup and should take over. Qualifying's `season` is the
 * cycle's start, which is still after the previous tournament's, so comparing
 * seasons orders them correctly either way.
 */
export function liveCampaign(intl: InternationalState): {
  tournament: IntlTournament | null;
  qualifying: IntlQualifyingCampaign | null;
  showing: "tournament" | "qualifying" | null;
} {
  const { tournament, qualifying, stage } = intl;
  let showing: "tournament" | "qualifying" | null;
  if (stage === "qualifying") showing = "qualifying";
  else if (stage != null && stage !== "done") showing = "tournament";
  else if (tournament && qualifying) showing = tournament.season >= qualifying.season ? "tournament" : "qualifying";
  else if (tournament) showing = "tournament";
  else if (qualifying) showing = "qualifying";
  else showing = null;

  // Never claim to show a campaign that isn't there.
  if (showing === "tournament" && !tournament) showing = qualifying ? "qualifying" : null;
  if (showing === "qualifying" && !qualifying) showing = tournament ? "tournament" : null;
  return { tournament, qualifying, showing };
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
        National teams play in the summer, on a {INTL_CYCLE_YEARS}-year cycle. The first three
        offseasons of each cycle play one round of qualifying apiece, where every nation with enough
        players works through its confederation group for one of {INTL_FIELD_SIZE} places. The fourth
        offseason, those {INTL_FIELD_SIZE} meet in the {INTL_TOURNAMENT_NAME}: four groups of four,
        then quarter-finals, semi-finals and a final.
      </p>
      <p className="text-muted">
        Nobody manages a national team, including you. Squads pick themselves from whoever's good
        enough, so your job is to develop players worth calling up, then watch how they get on. The
        first round of qualifying runs at the end of season 1.
      </p>
    </NationalTeamsLayout>
  );
}
