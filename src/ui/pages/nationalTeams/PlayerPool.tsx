import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLeague } from "../../context/LeagueContext.js";
import type { Player } from "../../../core/players/types.js";
import { editableSquad } from "../../../core/international/index.js";
import { INTL_SQUAD_SIZE, INTL_MIN_KEEPERS } from "../../../core/constants.js";
import { getRatingColor } from "../../utils/ratingColor.js";
import { InjuryBadge } from "../../components/InjuryBadge.js";
import { PositionBadge } from "../../components/PositionBadge.js";
import { PlayerRatingsTooltip } from "../../components/PlayerRatingsTooltip.js";
import { sortByPosThenOvr } from "../Roster.js";
import { NationalTeamsLayout, NationName, useClubIndex, ClubCell } from "./shared.js";

/**
 * How many of the eligible pool to list at once.
 *
 * A country's pool runs to several hundred, sorted by rating, so what you see
 * is what you would plausibly call up. Anyone further down is reached by
 * searching, because nobody scrolls to the three-hundredth best player.
 */
const POOL_SHOWN = 40;

/**
 * Choosing who is in the squad, separate from choosing who plays.
 *
 * Its own page because it is a different job on different data: My Squad is a
 * team sheet of 23, this is a search across every eligible player in the
 * country. Together on one screen the search drowned the team sheet, and the
 * page opened with several thousand table cells for a job that is mostly
 * picking eleven names.
 */
export function NTPlayerPool() {
  const { league, setNationalSquadAction, simming } = useLeague();
  const [filter, setFilter] = useState("");

  const clubByPid = useClubIndex(league?.teams);

  const nation = league?.nationalManager.nation ?? null;
  const found = league && nation ? editableSquad(league.international, nation) : null;

  const { named, pool } = useMemo(() => {
    if (!league || !nation || !found) return { named: [] as Player[], pool: [] as Player[] };
    const namedSet = new Set(found.squad.pids);
    const eligible = league.players.filter((p) => p.nationality === nation);
    return {
      named: sortByPosThenOvr(eligible.filter((p) => namedSet.has(p.pid))),
      pool: eligible
        .filter((p) => !namedSet.has(p.pid))
        .sort((a, b) => b.ovr - a.ovr || a.pid - b.pid),
    };
  }, [league, nation, found]);

  if (!league) return <p className="p-3">Loading...</p>;

  if (!nation) {
    return (
      <NationalTeamsLayout title="Player Pool">
        <p className="text-muted">
          You don't manage a national team. Countries get in touch over the summer, and
          anything on the table is on the{" "}
          <Link to="/national-teams/federation">Federation</Link> page.
        </p>
      </NationalTeamsLayout>
    );
  }

  if (!found) {
    return (
      <NationalTeamsLayout title="Player Pool">
        <p className="text-muted">
          There's no campaign to name a squad for right now. One is drawn at the end of
          each season, and you can change who's in it from here before the first match of
          that summer.
        </p>
      </NationalTeamsLayout>
    );
  }

  const squad = found.squad;
  const keepers = named.filter((p) => p.pos === "GK").length;
  const full = squad.pids.length >= INTL_SQUAD_SIZE;

  const query = filter.trim().toLowerCase();
  const shown = (query
    ? pool.filter((p) => (
      p.name.toLowerCase().includes(query)
      || p.pos.toLowerCase() === query
      || (clubByPid.get(p.pid)?.name ?? "").toLowerCase().includes(query)
    ))
    : pool
  ).slice(0, POOL_SHOWN);

  const row = (p: Player, inSquad: boolean) => (
    <tr key={p.pid}>
      <td><PositionBadge player={p} /></td>
      <td>
        <PlayerRatingsTooltip player={p}>
          <Link to={`/player/${p.pid}`}>{p.name}</Link>
        </PlayerRatingsTooltip>
        {p.injury && <> <InjuryBadge player={p} /></>}
      </td>
      <td className="small text-muted">
        <ClubCell club={clubByPid.get(p.pid)} competitions={league.competitions} />
      </td>
      <td className="text-end">{league.season - p.born}</td>
      <td className="text-end fw-semibold" style={{ color: getRatingColor(p.ovr) }}>{p.ovr}</td>
      <td className="text-end">{p.intl?.caps ?? 0}</td>
      <td className="text-end">
        {inSquad ? (
          <button
            className="btn btn-outline-secondary btn-sm py-0"
            disabled={
              simming
              || named.length <= 11
              || (p.pos === "GK" && keepers <= INTL_MIN_KEEPERS)
            }
            title={
              p.pos === "GK" && keepers <= INTL_MIN_KEEPERS
                ? "You have to take a goalkeeper"
                : named.length <= 11
                  ? "You need eleven players"
                  : "Leave him out"
            }
            onClick={() => setNationalSquadAction(squad.pids.filter((x) => x !== p.pid))}
          >
            Drop
          </button>
        ) : (
          <button
            className="btn btn-outline-primary btn-sm py-0"
            disabled={simming || full}
            title={full ? `Your squad is full at ${INTL_SQUAD_SIZE}` : "Call him up"}
            onClick={() => setNationalSquadAction([...squad.pids, p.pid])}
          >
            Call up
          </button>
        )}
      </td>
    </tr>
  );

  const table = (rows: Player[], inSquad: boolean) => (
    <div className="table-responsive mb-3">
      <table className="table table-sm table-striped align-middle mb-0">
        <thead>
          <tr>
            <th>Pos</th>
            <th>Player</th>
            <th>Club</th>
            <th className="text-end">Age</th>
            <th className="text-end">Ovr</th>
            <th className="text-end">Caps</th>
            <th />
          </tr>
        </thead>
        <tbody>{rows.map((p) => row(p, inSquad))}</tbody>
      </table>
    </div>
  );

  return (
    <NationalTeamsLayout title="Player Pool">
      <div className="d-flex flex-wrap align-items-baseline gap-2 mb-2">
        <h5 className="mb-0"><NationName nation={nation} /></h5>
        <span className="text-muted small">picking for {found.competition}</span>
        <span className="text-muted small ms-auto">
          {named.length} of {INTL_SQUAD_SIZE} called up
          {" · "}
          <Link to="/national-teams/my-squad">Pick your eleven</Link>
        </span>
      </div>
      <p className="text-muted small">
        Anyone born in your country is eligible, whoever they play for. You have to take
        at least one goalkeeper, and a squad of at least eleven.
      </p>

      <h6 className="text-muted text-uppercase small mb-1">Your squad</h6>
      {table(named, true)}

      <h6 className="text-muted text-uppercase small mb-1">
        Everyone else eligible
        <span className="text-muted ms-2 text-lowercase">{pool.length} players</span>
      </h6>
      <input
        type="search"
        className="form-control form-control-sm mb-2"
        style={{ maxWidth: 320 }}
        placeholder="Search by name, club or position"
        aria-label="Search eligible players"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      {shown.length === 0 ? (
        <p className="text-muted small">Nobody eligible by that name.</p>
      ) : (
        <>
          {table(shown, false)}
          {shown.length < pool.length && (
            <p className="text-muted small">
              Showing the best {shown.length} of {pool.length}. Search to find anyone else.
            </p>
          )}
        </>
      )}
    </NationalTeamsLayout>
  );
}
