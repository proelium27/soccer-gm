import { useState } from "react";
import { Link } from "react-router-dom";
import { useLeague } from "../context/LeagueContext.js";
import { computeStandings } from "../../core/standings.js";
import { seasonRevenue, wageBill } from "../../core/finance/budget.js";
import { tierOf } from "../../core/competitions.js";
import { CompetitionSelect } from "../components/CompetitionSelect.js";
import { SCOUTING_SPEND_MAX } from "../../core/constants.js";
import { currency, formatWeeklyWage, ordinal, seasonYear } from "../format.js";
import { Flag } from "../components/Flag.js";
import { PlayerRatingsTooltip } from "../components/PlayerRatingsTooltip.js";
import { ClubCrest } from "../components/ClubCrest.js";

export function Finance() {
  const { league, setScoutingSpendAction, simming } = useLeague();
  // Slider position while dragging; persisted (and clamped) only on release
  // so we don't write to IndexedDB on every drag tick.
  const [scoutingDraft, setScoutingDraft] = useState<number | null>(null);
  const [compFilterOverride, setCompFilterOverride] = useState<number | "all" | null>(null);

  if (!league) {
    return <p className="p-3">Loading...</p>;
  }

  const userTeam = league.teams.find((t) => t.tid === league.meta.userTid);
  if (!userTeam) {
    return <p className="p-3">Team not found.</p>;
  }

  const compFilter = compFilterOverride ?? userTeam.compId;

  const commitScoutingDraft = async () => {
    if (scoutingDraft === null) return;
    await setScoutingSpendAction(scoutingDraft);
    setScoutingDraft(null);
  };

  const playerMap = new Map(league.players.map((p) => [p.pid, p]));
  const salaryMap = new Map(league.players.map((p) => [p.pid, p.contract.salary]));
  const teamName = (tid: number) =>
    league.teams.find((t) => t.tid === tid)?.name ?? "Unknown";

  const divisionTeamIds = league.teams
    .filter((t) => t.compId === userTeam.compId)
    .map((t) => t.tid);
  const standings = computeStandings(
    divisionTeamIds,
    league.played.filter((m) => divisionTeamIds.includes(m.home)),
  );
  const rank = standings.findIndex((r) => r.tid === league.meta.userTid) + 1;

  // Mirror of the offseason cash flow in runOffseason: season-end settlement
  // (prize by rank + hype revenue − scouting) followed by the new season's
  // start charge (base allocation in, wages out). During the regular season
  // the rank (and thus prize tier) is provisional; in the offseason it's
  // final. The wage line is an estimate either way — the actual charge uses
  // the new season's finalized roster (after retirements, expiries, youth).
  const revenue = seasonRevenue(rank, userTeam.hype, tierOf(league.competitions, userTeam.compId));
  const wages = wageBill([...userTeam.roster, ...userTeam.academyRoster], salaryMap);
  const net = revenue.total - wages - userTeam.scoutingSpend;
  const seasonOver = league.phase === "offseason";

  const rosterPlayers = userTeam.roster
    .map((pid) => playerMap.get(pid))
    .filter((p) => p !== undefined)
    .sort((a, b) => b.contract.salary - a.contract.salary);

  const userTransfers = league.transfers
    .filter(
      (t) =>
        t.fromTid === league.meta.userTid || t.toTid === league.meta.userTid,
    )
    .slice()
    .reverse();
  const spent = userTransfers
    .filter((t) => t.toTid === league.meta.userTid)
    .reduce((sum, t) => sum + t.fee, 0);
  const received = userTransfers
    .filter((t) => t.fromTid === league.meta.userTid)
    .reduce((sum, t) => sum + t.fee, 0);

  const clubRows = league.teams
    .filter((t) => compFilter === "all" || t.compId === compFilter)
    .map((t) => ({ team: t, wages: wageBill([...t.roster, ...t.academyRoster], salaryMap) }))
    .sort((a, b) => b.team.budget - a.team.budget);

  return (
    <div className="container-fluid p-3">
      <h4>Finance</h4>

      {/* Overview + scouting control */}
      <div className="card mb-3">
        <div className="card-body">
          <h5 className="card-title">{userTeam.name}</h5>
          <p className="card-text mb-2">
            Budget: <strong>{currency.format(userTeam.budget)}</strong> &middot;{" "}
            Season wage bill: <strong>{currency.format(wages)}</strong>{" "}
            ({formatWeeklyWage(wages)}, paid up front each season) &middot;{" "}
            Hype: {Math.round(userTeam.hype)}/100
          </p>
          <label className="form-label mb-1" htmlFor="finance-scouting-spend">
            Scouting spend this season:{" "}
            {currency.format(scoutingDraft ?? userTeam.scoutingSpend)}
          </label>
          <input
            id="finance-scouting-spend"
            type="range"
            className="form-range"
            min={0}
            max={SCOUTING_SPEND_MAX}
            step={100_000}
            value={scoutingDraft ?? userTeam.scoutingSpend}
            disabled={simming}
            onChange={(e) => setScoutingDraft(Number(e.target.value))}
            onPointerUp={commitScoutingDraft}
            onBlur={commitScoutingDraft}
          />
          <p className="card-text text-muted mb-0">
            Deducted at season end. Two effects. First, every value you see on a transfer
            target — Recommended Transfers, negotiation offers, offers for your own players — is
            a perceived value, not the true one: noisy (&plusmn;35%) at $0 spend, nearly exact
            (&plusmn;5%) at the $20M max. Second, potential (POT) is shown as an estimate band
            rather than an exact number: more scouting narrows the band and reveals a player's
            true ceiling sooner. Players on your senior roster also sharpen on their own over
            2&ndash;3 seasons; prospects, free agents, and rival clubs' players stay fogged until
            you scout or sign them. Defaults to $5M each season; push it toward the max before a
            window where you plan to buy or sell, then pull it back down once you're done.
          </p>
        </div>
      </div>

      {/* Season settlement projection */}
      <div className="card mb-3">
        <div className="card-body">
          <h5 className="card-title">
            {seasonOver ? "Offseason Cash Flow" : "Projected Offseason Cash Flow"}
          </h5>
          <p className="card-text text-muted">
            {seasonOver ? (
              <>
                Final position: {ordinal(rank)}. Applied to your budget when
                you advance to {seasonYear(league.season + 1)}; the wage charge is
                estimated from your current squad.
              </>
            ) : (
              <>
                Based on your current league position ({ordinal(rank)}) and
                hype; prize money is decided by final position. Next
                season&apos;s wages are estimated from your current squad and
                charged up front when the season starts.
              </>
            )}
          </p>
          <table className="table table-sm w-auto align-middle mb-0">
            <tbody>
              <tr>
                <td>Prize money ({ordinal(rank)})</td>
                <td className="text-end">
                  {currency.format(revenue.successPayout)}
                </td>
              </tr>
              <tr>
                <td>Hype revenue</td>
                <td className="text-end">
                  {currency.format(revenue.hypeRevenue)}
                </td>
              </tr>
              <tr>
                <td>Scouting spend</td>
                <td className="text-end text-danger">
                  &minus;{currency.format(userTeam.scoutingSpend)}
                </td>
              </tr>
              <tr>
                <td>Next season&apos;s base allocation</td>
                <td className="text-end">{currency.format(revenue.base)}</td>
              </tr>
              <tr>
                <td>Next season&apos;s wage bill (est.)</td>
                <td className="text-end text-danger">
                  &minus;{currency.format(wages)}
                </td>
              </tr>
              <tr className="fw-bold">
                <td>Net change</td>
                <td className="text-end">
                  {net < 0 ? <>&minus;{currency.format(-net)}</> : `+${currency.format(net)}`}
                </td>
              </tr>
              <tr className="fw-bold">
                <td>Budget at season start (est.)</td>
                <td className="text-end">
                  {currency.format(userTeam.budget + net)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Wage bill */}
      <div className="card mb-3">
        <div className="card-body">
          <h5 className="card-title">Wage Bill</h5>
          <table className="table table-striped table-sm align-middle mb-0">
            <thead>
              <tr>
                <th>Name</th>
                <th>Pos</th>
                <th className="text-end">Age</th>
                <th className="text-end">Ovr</th>
                <th className="text-end">Expires</th>
                <th className="text-end">Wage</th>
                <th className="text-end">Season salary</th>
              </tr>
            </thead>
            <tbody>
              {rosterPlayers.map((p) => (
                <tr key={p.pid}>
                  <td>
                    <PlayerRatingsTooltip player={p}>
                      <Link to={`/player/${p.pid}`}>{p.name}</Link>
                    </PlayerRatingsTooltip>{" "}
                    <Flag nationality={p.nationality} />
                  </td>
                  <td>{p.pos}</td>
                  <td className="text-end">{league.season - p.born}</td>
                  <td className="text-end">{p.ovr}</td>
                  <td className="text-end">{seasonYear(p.contract.expiresSeason)}</td>
                  <td className="text-end">{formatWeeklyWage(p.contract.salary)}</td>
                  <td className="text-end">{currency.format(p.contract.salary)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="fw-bold">
                <td colSpan={5}>Total ({rosterPlayers.length} players)</td>
                <td className="text-end">{formatWeeklyWage(wages)}</td>
                <td className="text-end">{currency.format(wages)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Transfer history */}
      <div className="card mb-3">
        <div className="card-body">
          <h5 className="card-title">Transfer History</h5>
          {userTransfers.length === 0 ? (
            <p className="mb-0">No transfers yet.</p>
          ) : (
            <>
              <p className="card-text">
                All-time: <strong>{currency.format(spent)}</strong> spent
                {received > 0 && (
                  <> &middot; <strong>{currency.format(received)}</strong> received</>
                )}
              </p>
              <table className="table table-striped table-sm align-middle mb-0">
                <thead>
                  <tr>
                    <th className="text-end">Season</th>
                    <th>Window</th>
                    <th>Player</th>
                    <th></th>
                    <th>Club</th>
                    <th className="text-end">Fee</th>
                  </tr>
                </thead>
                <tbody>
                  {userTransfers.map((t, i) => {
                    const p = playerMap.get(t.pid);
                    const bought = t.toTid === league.meta.userTid;
                    return (
                      <tr key={i}>
                        <td className="text-end">{seasonYear(t.season)}</td>
                        <td>{t.window === "summer" ? "Summer" : "Winter"}</td>
                        <td>
                          {p ? <Link to={`/player/${p.pid}`}>{p.name}</Link> : `Player ${t.pid}`}{" "}
                          {p && <Flag nationality={p.nationality} />}
                        </td>
                        <td>
                          {bought ? (
                            <span className="text-success">Bought</span>
                          ) : (
                            <span className="text-danger">Sold</span>
                          )}
                        </td>
                        <td>{teamName(bought ? t.fromTid : t.toTid)}</td>
                        <td className="text-end">{currency.format(t.fee)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>

      {/* League finances */}
      <div className="card mb-3">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h5 className="card-title mb-0">League Finances</h5>
            <CompetitionSelect
              competitions={league.competitions}
              value={compFilter}
              onChange={setCompFilterOverride}
              allOption
              style={{ width: "auto" }}
            />
          </div>
          <table className="table table-striped table-sm align-middle mb-0">
            <thead>
              <tr>
                <th>Club</th>
                <th className="text-end">Budget</th>
                <th className="text-end">Hype</th>
                <th className="text-end">Wage bill</th>
                <th className="text-end">Squad</th>
              </tr>
            </thead>
            <tbody>
              {clubRows.map(({ team, wages: clubWages }) => (
                <tr
                  key={team.tid}
                  className={
                    team.tid === league.meta.userTid ? "team-highlight" : undefined
                  }
                >
                  <td>
                    <span className="d-inline-flex align-items-center gap-1">
                      <ClubCrest tid={team.tid} colors={team.colors} />
                      {team.name}
                    </span>
                  </td>
                  <td className="text-end">{currency.format(team.budget)}</td>
                  <td className="text-end">{Math.round(team.hype)}</td>
                  <td className="text-end">{currency.format(clubWages)}</td>
                  <td className="text-end">{team.roster.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
