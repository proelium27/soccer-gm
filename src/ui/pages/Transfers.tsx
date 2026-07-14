import { useMemo, useState } from "react";
import { useLeague } from "../context/LeagueContext.js";
import type { LeagueStore } from "../../core/leagueState.js";
import { transferWindowState } from "../../core/transfers/window.js";
import { recommendedTransfers } from "../../core/transfers/recommendations.js";
import {
  acquisitionWageCharge,
  currentNegotiations,
  type TransferNegotiation,
} from "../../core/transfers/negotiation.js";
import { WINTER_WINDOW_OPEN_MATCHDAY } from "../../core/calendar.js";
import { currency, formatWeeklyWage } from "../format.js";
import { Flag } from "../components/Flag.js";
import { OfferAmountInput } from "../components/OfferAmountInput.js";
import { PlayerRatingsTooltip } from "../components/PlayerRatingsTooltip.js";
import { ROSTER_CAP } from "../../core/constants.js";
import { POSITIONS } from "../../core/players/types.js";

interface TransferFilters {
  position: string;
  minOvr: string;
  minPot: string;
  maxAge: string;
  maxValue: string;
}

const EMPTY_FILTERS: TransferFilters = {
  position: "",
  minOvr: "",
  minPot: "",
  maxAge: "",
  maxValue: "",
};

function windowBanner(league: LeagueStore): React.ReactNode {
  const ws = transferWindowState(league);
  if (ws.open) {
    const label = ws.window === "summer" ? "Summer" : "Winter";
    const until =
      league.phase === "offseason"
        ? `open through matchday ${ws.closesAfterMatchday} of next season`
        : `closes after matchday ${ws.closesAfterMatchday}`;
    return (
      <div className="alert alert-success mb-3">
        <strong>{label} transfer window is open</strong> — {until}.
      </div>
    );
  }
  return (
    <div className="alert alert-secondary mb-3">
      <strong>Transfer window closed.</strong> The winter window opens once
      matchday {WINTER_WINDOW_OPEN_MATCHDAY - 1} is played and closes after the
      deadline; the summer window runs through the offseason and August.
    </div>
  );
}

interface NegotiationControlsProps {
  pid: number;
  negotiation: TransferNegotiation | undefined;
  suggested: number;
  budget: number;
  /** Season wages charged on top of the fee for a mid-season buy. */
  wageCharge: number;
  disabled: boolean;
  onOffer: (pid: number, amount: number) => void;
  onAcceptCounter: (pid: number) => void;
}

function NegotiationControls({
  pid, negotiation, suggested, budget, wageCharge, disabled, onOffer, onAcceptCounter,
}: NegotiationControlsProps) {
  const [draft, setDraft] = useState(() => String(suggested));

  if (negotiation?.status === "accepted") {
    return <span className="text-success">Transfer agreed</span>;
  }
  if (negotiation?.status === "collapsed") {
    return <span className="text-danger">Talks ended for this window</span>;
  }

  const lastOffer = negotiation?.offers.at(-1);
  // A repeat offer at or below the best one so far ends talks for the window,
  // so refuse to send one instead of letting a stray re-click collapse them.
  const bestOffer =
    negotiation && negotiation.offers.length > 0 ? Math.max(...negotiation.offers) : null;
  const draftValue = Number(draft);
  const notImproving = bestOffer !== null && draftValue <= bestOffer;
  const offerValid =
    draft !== "" && Number.isFinite(draftValue) && draftValue > 0
    && draftValue + wageCharge <= budget && !notImproving;

  // Quick-pick amounts anchored to whatever the next valid bid must clear.
  const floor = negotiation?.counter ?? bestOffer ?? suggested;
  const quickAmounts = [floor, Math.round(floor * 1.1), Math.round(floor * 1.25)]
    .filter((amt) => amt + wageCharge <= budget);

  return (
    <div className="d-flex flex-column gap-1">
      {negotiation && (
        <small className="text-muted">
          Your offer: {currency.format(lastOffer ?? 0)}
          {negotiation.counter !== null && (
            <> &middot; Counter: <strong>{currency.format(negotiation.counter)}</strong></>
          )}
          {notImproving && <> &middot; bid more than your last offer</>}
        </small>
      )}
      <div className="d-flex gap-1 align-items-center">
        <OfferAmountInput
          value={draft}
          onChange={setDraft}
          quickAmounts={quickAmounts}
          disabled={disabled}
        />
        <button
          className="btn btn-sm btn-primary"
          disabled={disabled || !offerValid}
          title={notImproving ? "Must improve on your previous offer" : undefined}
          onClick={() => onOffer(pid, draftValue)}
        >
          Offer
        </button>
        {negotiation?.counter != null && (
          <button
            className="btn btn-sm btn-success text-nowrap"
            disabled={disabled || negotiation.counter + wageCharge > budget}
            onClick={() => onAcceptCounter(pid)}
          >
            Accept {currency.format(negotiation.counter)}
          </button>
        )}
      </div>
    </div>
  );
}

export function Transfers() {
  const { league, makeOfferAction, acceptCounterAction, simming } = useLeague();
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [filters, setFilters] = useState<TransferFilters>(EMPTY_FILTERS);

  // The full-league candidate scan is too heavy to redo on unrelated renders.
  const allTargets = useMemo(
    () => (league ? recommendedTransfers(league, refreshNonce) : []),
    [league, refreshNonce],
  );

  const targets = useMemo(() => {
    const minOvr = filters.minOvr === "" ? null : Number(filters.minOvr);
    const minPot = filters.minPot === "" ? null : Number(filters.minPot);
    const maxAge = filters.maxAge === "" ? null : Number(filters.maxAge);
    const maxValue = filters.maxValue === "" ? null : Number(filters.maxValue);
    return allTargets.filter(({ player: p, scoutedValue: value }) => {
      if (filters.position && p.pos !== filters.position) return false;
      if (minOvr !== null && Number.isFinite(minOvr) && p.ovr < minOvr) return false;
      if (minPot !== null && Number.isFinite(minPot) && p.potential < minPot) return false;
      if (
        maxAge !== null && Number.isFinite(maxAge)
        && league && league.season - p.born > maxAge
      ) return false;
      if (maxValue !== null && Number.isFinite(maxValue) && value > maxValue) return false;
      return true;
    });
  }, [allTargets, filters, league]);

  if (!league) {
    return <p className="p-3">Loading...</p>;
  }

  const userTeam = league.teams.find((t) => t.tid === league.meta.userTid);
  if (!userTeam) {
    return <p className="p-3">Team not found.</p>;
  }

  const ws = transferWindowState(league);
  const atCap = userTeam.roster.length >= ROSTER_CAP;
  const playerMap = new Map(league.players.map((p) => [p.pid, p]));
  const teamName = (tid: number) =>
    league.teams.find((t) => t.tid === tid)?.name ?? "Unknown";

  const negotiations = currentNegotiations(league);
  const negotiationByPid = new Map(negotiations.map((n) => [n.pid, n]));

  // Talks that outlived the recommended list (e.g. the budget shrank after a
  // signing) still need controls somewhere.
  const listedPids = new Set(allTargets.map((t) => t.player.pid));
  const orphaned = negotiations.filter(
    (n) => !listedPids.has(n.pid) && n.status !== "accepted",
  );

  const windowTransfers = league.transfers.filter(
    (t) => ws.open && t.season === ws.season && t.window === ws.window,
  );

  return (
    <div className="container-fluid p-3">
      <h4>Transfers</h4>
      {windowBanner(league)}

      <p>
        Budget: <strong>{currency.format(userTeam.budget)}</strong>
        {" "}&middot; Scout valuations tighten with scouting spend (set on the Dashboard).
        {" "}&middot; Roster: <strong>{userTeam.roster.length}/{ROSTER_CAP}</strong>
      </p>
      {atCap && (
        <div className="alert alert-warning">
          Your roster is full ({ROSTER_CAP}/{ROSTER_CAP}). Release a player before buying another.
        </div>
      )}

      {ws.open && (
        <div className="card mb-3">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-start">
              <h5 className="card-title">Recommended Transfers</h5>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setRefreshNonce((n) => n + 1)}
              >
                Refresh
              </button>
            </div>
            <p className="card-text text-muted">
              Players near your team&apos;s level, within budget. The scout
              valuation is your baseline for offers — the selling club&apos;s
              real price may differ.
              {league.phase === "regular" && (
                <> Mid-season buys also charge the player&apos;s season wages
                on top of the fee.</>
              )}
            </p>
            {allTargets.length > 0 && (
              <div className="d-flex flex-wrap gap-2 align-items-end mb-3">
                <div>
                  <label className="form-label small mb-0" htmlFor="rt-filter-pos">Position</label>
                  <select
                    id="rt-filter-pos"
                    className="form-select form-select-sm"
                    value={filters.position}
                    onChange={(e) => setFilters((f) => ({ ...f, position: e.target.value }))}
                  >
                    <option value="">All</option>
                    {POSITIONS.map((pos) => (
                      <option key={pos} value={pos}>{pos}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label small mb-0" htmlFor="rt-filter-min-ovr">Min Ovr</label>
                  <input
                    id="rt-filter-min-ovr"
                    type="number"
                    className="form-control form-control-sm"
                    style={{ width: "5.5rem" }}
                    value={filters.minOvr}
                    onChange={(e) => setFilters((f) => ({ ...f, minOvr: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="form-label small mb-0" htmlFor="rt-filter-min-pot">Min Pot</label>
                  <input
                    id="rt-filter-min-pot"
                    type="number"
                    className="form-control form-control-sm"
                    style={{ width: "5.5rem" }}
                    value={filters.minPot}
                    onChange={(e) => setFilters((f) => ({ ...f, minPot: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="form-label small mb-0" htmlFor="rt-filter-max-age">Max Age</label>
                  <input
                    id="rt-filter-max-age"
                    type="number"
                    className="form-control form-control-sm"
                    style={{ width: "5.5rem" }}
                    value={filters.maxAge}
                    onChange={(e) => setFilters((f) => ({ ...f, maxAge: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="form-label small mb-0" htmlFor="rt-filter-max-value">Max Value</label>
                  <input
                    id="rt-filter-max-value"
                    type="number"
                    className="form-control form-control-sm"
                    style={{ width: "8rem" }}
                    value={filters.maxValue}
                    onChange={(e) => setFilters((f) => ({ ...f, maxValue: e.target.value }))}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setFilters(EMPTY_FILTERS)}
                >
                  Clear filters
                </button>
              </div>
            )}
            {targets.length === 0 ? (
              <p className="mb-0">
                {allTargets.length === 0
                  ? "No suitable targets found."
                  : "No targets match the current filters."}
              </p>
            ) : (
              <table className="table table-striped table-sm align-middle">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Pos</th>
                    <th className="text-end">Age</th>
                    <th className="text-end">Ovr</th>
                    <th className="text-end">Pot</th>
                    <th>Club</th>
                    <th className="text-end">Wage</th>
                    <th className="text-end">Scout value</th>
                    <th>Offer</th>
                  </tr>
                </thead>
                <tbody>
                  {targets.map(({ player: p, sellerTid, scoutedValue }) => (
                    <tr key={p.pid}>
                      <td>
                        <PlayerRatingsTooltip player={p}>{p.name}</PlayerRatingsTooltip>{" "}
                        <Flag nationality={p.nationality} />
                      </td>
                      <td>{p.pos}</td>
                      <td className="text-end">{league.season - p.born}</td>
                      <td className="text-end">{p.ovr}</td>
                      <td className="text-end">{p.potential}</td>
                      <td>{teamName(sellerTid)}</td>
                      <td className="text-end">{formatWeeklyWage(p.contract.salary)}</td>
                      <td className="text-end">{currency.format(scoutedValue)}</td>
                      <td>
                        <NegotiationControls
                          pid={p.pid}
                          negotiation={negotiationByPid.get(p.pid)}
                          suggested={scoutedValue}
                          budget={userTeam.budget}
                          wageCharge={acquisitionWageCharge(league, p)}
                          disabled={simming || atCap}
                          onOffer={makeOfferAction}
                          onAcceptCounter={acceptCounterAction}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {orphaned.length > 0 && (
        <div className="card mb-3">
          <div className="card-body">
            <h5 className="card-title">Other Negotiations</h5>
            <table className="table table-sm align-middle">
              <tbody>
                {orphaned.map((n) => {
                  const p = playerMap.get(n.pid);
                  if (!p) return null;
                  return (
                    <tr key={n.pid}>
                      <td>
                        <PlayerRatingsTooltip player={p}>{p.name}</PlayerRatingsTooltip>{" "}
                        <Flag nationality={p.nationality} /> ({p.pos}, {teamName(n.sellerTid)})
                      </td>
                      <td>
                        <NegotiationControls
                          pid={n.pid}
                          negotiation={n}
                          suggested={n.counter ?? n.offers.at(-1) ?? 0}
                          budget={userTeam.budget}
                          wageCharge={acquisitionWageCharge(league, p)}
                          disabled={simming || atCap}
                          onOffer={makeOfferAction}
                          onAcceptCounter={acceptCounterAction}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {windowTransfers.length > 0 && (
        <div className="card mb-3">
          <div className="card-body">
            <h5 className="card-title">Completed This Window</h5>
            <ul className="mb-0">
              {windowTransfers.map((t, i) => {
                const p = playerMap.get(t.pid);
                return (
                  <li key={i}>
                    {p?.name ?? `Player ${t.pid}`}{" "}
                    {p && <Flag nationality={p.nationality} />} — {teamName(t.fromTid)} →{" "}
                    {teamName(t.toTid)} for {currency.format(t.fee)}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
