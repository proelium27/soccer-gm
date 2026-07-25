import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLeague } from "../../context/LeagueContext.js";
import { nationRecords } from "../../../core/international/index.js";
import { NationalTeamsLayout, NationName, useHasInternational, IntlEmpty } from "./shared.js";

const PLAYER_LIMIT = 50;

function TeamLeaders() {
  const { league } = useLeague();
  const records = useMemo(() => nationRecords(league?.international.history ?? []), [league?.international.history]);
  if (records.length === 0) return <p className="text-muted">No tournament has been completed yet.</p>;
  return (
    <table className="table table-sm">
      <thead>
        <tr>
          <th>Nation</th>
          <th className="text-end">Titles</th>
          <th className="text-end">Finals</th>
          <th className="text-end">Semis</th>
          <th className="text-end">Tournaments</th>
        </tr>
      </thead>
      <tbody>
        {records.map((r) => (
          <tr key={r.nation}>
            <td><NationName nation={r.nation} /></td>
            <td className="text-end fw-bold">{r.titles || ""}</td>
            <td className="text-end">{r.finals || ""}</td>
            <td className="text-end">{r.semis || ""}</td>
            <td className="text-end">{r.tournaments}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PlayerLeaders() {
  const { league } = useLeague();
  const [country, setCountry] = useState("");

  const capped = useMemo(
    () => (league?.players ?? []).filter((p) => p.intl && (p.intl.caps > 0 || p.intl.tournaments > 0)),
    [league?.players],
  );
  const countries = useMemo(
    () => [...new Set(capped.map((p) => p.nationality))].sort((a, b) => a.localeCompare(b)),
    [capped],
  );

  const rows = useMemo(() => {
    const filtered = country ? capped.filter((p) => p.nationality === country) : capped;
    return [...filtered]
      .sort((a, b) =>
        (b.intl!.goals - a.intl!.goals) ||
        (b.intl!.caps - a.intl!.caps) ||
        (b.intl!.assists - a.intl!.assists) ||
        a.name.localeCompare(b.name),
      )
      .slice(0, PLAYER_LIMIT);
  }, [capped, country]);

  if (capped.length === 0) return <p className="text-muted">No player has been capped yet.</p>;

  return (
    <>
      <select
        className="form-select form-select-sm w-auto mb-3"
        value={country}
        onChange={(e) => setCountry(e.target.value)}
      >
        <option value="">All countries</option>
        {countries.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <table className="table table-sm">
        <thead>
          <tr>
            <th>Player</th>
            <th>Nation</th>
            <th className="text-end">Caps</th>
            <th className="text-end">Goals</th>
            <th className="text-end">Assists</th>
            <th className="text-end">Tournaments</th>
            <th className="text-end">Titles</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.pid}>
              <td><Link to={`/player/${p.pid}`}>{p.name}</Link></td>
              <td><NationName nation={p.nationality} /></td>
              <td className="text-end">{p.intl!.caps}</td>
              <td className="text-end fw-bold">{p.intl!.goals}</td>
              <td className="text-end">{p.intl!.assists}</td>
              <td className="text-end">{p.intl!.tournaments}</td>
              <td className="text-end">{p.intl!.titles || ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export function NTStatLeaders() {
  const hasIntl = useHasInternational();
  const [tab, setTab] = useState<"players" | "teams">("players");
  if (!hasIntl) return <IntlEmpty />;

  return (
    <NationalTeamsLayout title="Stat Leaders">
      <div className="btn-group btn-group-sm mb-3" role="group">
        <button
          className={`btn btn-outline-primary${tab === "players" ? " active" : ""}`}
          onClick={() => setTab("players")}
        >
          Players
        </button>
        <button
          className={`btn btn-outline-primary${tab === "teams" ? " active" : ""}`}
          onClick={() => setTab("teams")}
        >
          National teams
        </button>
      </div>
      {tab === "players" ? <PlayerLeaders /> : <TeamLeaders />}
    </NationalTeamsLayout>
  );
}
