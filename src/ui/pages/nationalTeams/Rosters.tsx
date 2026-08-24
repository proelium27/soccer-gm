import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLeague } from "../../context/LeagueContext.js";
import type { Player } from "../../../core/players/types.js";
import type { NationSquad } from "../../../core/international/index.js";
import { FORMATIONS } from "../../../core/lineup/formations.js";
import { selectXI } from "../../../core/lineup/selectXI.js";
import { getRatingColor } from "../../utils/ratingColor.js";
import { InjuryBadge } from "../../components/InjuryBadge.js";
import { PlayerRatingsTooltip } from "../../components/PlayerRatingsTooltip.js";
import { sortByPosThenOvr } from "../Roster.js";
import { NationalTeamsLayout, NationName, useHasInternational, IntlEmpty, liveCampaign } from "./shared.js";

/**
 * One nation's named squad. Squad members who have since left the world (a
 * qualifying campaign runs across three offseasons, so retirement thins it) are
 * dropped — the match sim drops them too, so this is the squad as it actually
 * stands.
 */
function squadPlayers(squad: NationSquad, byPid: Map<number, Player>): Player[] {
  return squad.pids.map((pid) => byPid.get(pid)).filter((p): p is Player => p !== undefined);
}

function SquadTable({ squad, players, season, clubName }: {
  squad: NationSquad;
  players: Player[];
  season: number;
  clubName: (pid: number) => string;
}) {
  // The eleven this nation would field, so the table separates the starters
  // from the rest of the squad — the same pick the sim makes.
  const xiPids = useMemo(
    () => new Set(selectXI(players, FORMATIONS[squad.formation]).map((p) => p.pid)),
    [players, squad.formation],
  );
  const sorted = useMemo(() => sortByPosThenOvr(players), [players]);

  if (sorted.length === 0) return <p className="text-muted">This squad has no players left in the world.</p>;

  return (
    <table className="table table-sm table-striped">
      <thead>
        <tr>
          <th>Pos</th>
          <th>Player</th>
          <th>Club</th>
          <th className="text-end">Age</th>
          <th className="text-end">Ovr</th>
          <th className="text-end">Caps</th>
          <th className="text-end">Goals</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((p) => (
          <tr key={p.pid} className={xiPids.has(p.pid) ? "row-selected" : undefined}>
            <td>{p.pos}</td>
            <td>
              <PlayerRatingsTooltip player={p}>
                <Link to={`/player/${p.pid}`}>{p.name}</Link>
              </PlayerRatingsTooltip>
              {p.injury && <> <InjuryBadge player={p} /></>}
            </td>
            <td className="small text-muted">{clubName(p.pid)}</td>
            <td className="text-end">{season - p.born}</td>
            <td className="text-end fw-semibold" style={{ color: getRatingColor(p.ovr) }}>{p.ovr}</td>
            <td className="text-end">{p.intl?.caps ?? 0}</td>
            <td className="text-end">{p.intl?.goals ?? 0}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function NTRosters() {
  const { league } = useLeague();
  const hasIntl = useHasInternational();
  const [selected, setSelected] = useState(0);

  const byPid = useMemo(
    () => new Map((league?.players ?? []).map((p) => [p.pid, p])),
    [league?.players],
  );
  const clubByPid = useMemo(() => {
    const map = new Map<number, string>();
    for (const t of league?.teams ?? []) {
      for (const pid of t.roster) map.set(pid, t.name);
      for (const pid of t.academyRoster) map.set(pid, `${t.name} (academy)`);
    }
    return map;
  }, [league?.teams]);

  if (!hasIntl || !league) return <IntlEmpty />;

  // Whichever campaign is live this offseason carries the squads; between
  // campaigns the most recent one stays browsable, same as the Schedule tab.
  const { tournament, qualifying, showing } = liveCampaign(league.international);
  const source = showing === "tournament" ? tournament : showing === "qualifying" ? qualifying : null;

  if (!source || source.squads.length === 0) {
    return (
      <NationalTeamsLayout title="Rosters">
        <p className="text-muted">No squads have been named yet.</p>
      </NationalTeamsLayout>
    );
  }

  const squads = source.squads;
  const squad = squads[Math.min(selected, squads.length - 1)];
  const players = squadPlayers(squad, byPid);
  const isTournamentField = showing === "tournament";

  return (
    <NationalTeamsLayout title="Rosters">
      <p className="text-muted small">
        Every squad named for {isTournamentField ? "this tournament" : "this qualifying campaign"},
        strongest nation first. Squads pick themselves, so each nation takes the best players
        available to it, keeping up to three goalkeepers and preferring fit players over injured
        ones. The rows with a green bar down the left are the eleven that nation would field.
      </p>
      <div className="row g-3">
        <div className="col-12 col-md-4 col-lg-3">
          <div className="list-group" style={{ maxHeight: "70vh", overflowY: "auto" }}>
            {squads.map((s, i) => (
              <button
                type="button"
                key={s.nation}
                className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center py-1${i === selected ? " active" : ""}`}
                onClick={() => setSelected(i)}
              >
                <NationName nation={s.nation} />
                <span className="small">{s.rating.toFixed(1)}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="col-12 col-md-8 col-lg-9">
          <h6 className="mb-2">
            <NationName nation={squad.nation} />{" "}
            <small className="text-muted">
              {squad.formation} &middot; squad rating {squad.rating.toFixed(1)} &middot; {players.length} players
            </small>
          </h6>
          <SquadTable
            squad={squad}
            players={players}
            season={league.season}
            clubName={(pid) => clubByPid.get(pid) ?? "Free agent"}
          />
        </div>
      </div>
    </NationalTeamsLayout>
  );
}
