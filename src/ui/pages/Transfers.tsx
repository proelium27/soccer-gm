import { useState } from "react";
import { useLeague } from "../context/LeagueContext.js";
import type { LeagueStore } from "../../core/leagueState.js";
import { transferWindowState } from "../../core/transfers/window.js";
import { recommendedTransfers } from "../../core/transfers/recommendations.js";
import {
  currentNegotiations,
  type TransferNegotiation,
} from "../../core/transfers/negotiation.js";
import { WINTER_WINDOW_OPEN_MATCHDAY } from "../../core/calendar.js";
import { currency, formatWeeklyWage } from "../format.js";

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
  disabled: boolean;
  onOffer: (pid: number, amount: number) => void;
  onAcceptCounter: (pid: number) => void;
}

function NegotiationControls({
  pid, negotiation, suggested, budget, disabled, onOffer, onAcceptCounter,
}: NegotiationControlsProps) {
  const [draft, setDraft] = useState("");

  if (negotiation?.status === "accepted") {
    return <span className="text-success">Transfer agreed</span>;
  }
  if (negotiation?.status === "collapsed") {
    return <span className="text-danger">Talks ended for this window</span>;
  }

  const lastOffer = negotiation?.offers.at(-1);
  const draftValue = draft === "" ? suggested : Number(draft);
  const offerValid =
    Number.isFinite(draftValue) && draftValue > 0 && draftValue <= budget;

  return (
    <div className="d-flex flex-column gap-1">
      {negotiation && (
        <small className="text-muted">
          Your offer: {currency.format(lastOffer ?? 0)}
          {negotiation.counter !== null && (
            <> &middot; Counter: <strong>{currency.format(negotiation.counter)}</strong></>
          )}
        </small>
      )}
      <div className="d-flex gap-1 align-items-center">
        <input
          type="number"
          className="form-control form-control-sm offer-input"
          min={0}
          step={100_000}
          value={draft === "" ? suggested : draft}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button
          className="btn btn-sm btn-primary"
          disabled={disabled || !offerValid}
          onClick={() => onOffer(pid, draftValue)}
        >
          Offer
        </button>
        {negotiation?.counter != null && (
          <button
            className="btn btn-sm btn-success text-nowrap"
            disabled={disabled || negotiation.counter > budget}
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

  if (!league) {
    return <p className="p-3">Loading...</p>;
  }

  const userTeam = league.teams.find((t) => t.tid === league.meta.userTid);
  if (!userTeam) {
    return <p className="p-3">Team not found.</p>;
  }

  const ws = transferWindowState(league);
  const playerMap = new Map(league.players.map((p) => [p.pid, p]));
  const teamName = (tid: number) =>
    league.teams.find((t) => t.tid === tid)?.name ?? "Unknown";

  const targets = recommendedTransfers(league);
  const negotiations = currentNegotiations(league);
  const negotiationByPid = new Map(negotiations.map((n) => [n.pid, n]));

  // Talks that outlived the recommended list (e.g. the budget shrank after a
  // signing) still need controls somewhere.
  const listedPids = new Set(targets.map((t) => t.player.pid));
  const orphaned = negotiations.filter(
    (n) => !listedPids.has(n.pid) && n.status !== "accepted",
  );

  const windowTransfers = league.transfers.filter(
    (t) => ws.open && t.season === league.season && t.window === ws.window,
  );

  return (
    <div className="container-fluid p-3">
      <h4>Transfers</h4>
      {windowBanner(league)}

      <p>
        Budget: <strong>{currency.format(userTeam.budget)}</strong>
        {" "}&middot; Scout valuations tighten with scouting spend (set on the Dashboard).
      </p>

      {ws.open && (
        <div className="card mb-3">
          <div className="card-body">
            <h5 className="card-title">Recommended Transfers</h5>
            <p className="card-text text-muted">
              Players near your team&apos;s level, within budget. The scout
              valuation is your baseline for offers — the selling club&apos;s
              real price may differ.
            </p>
            {targets.length === 0 ? (
              <p className="mb-0">No suitable targets found.</p>
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
                      <td>{p.name}</td>
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
                          disabled={simming}
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
                      <td>{p.name} ({p.pos}, {teamName(n.sellerTid)})</td>
                      <td>
                        <NegotiationControls
                          pid={n.pid}
                          negotiation={n}
                          suggested={n.counter ?? n.offers.at(-1) ?? 0}
                          budget={userTeam.budget}
                          disabled={simming}
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
                    {p?.name ?? `Player ${t.pid}`} — {teamName(t.fromTid)} →{" "}
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
