import { useMemo, useState } from "react";
import type { Player } from "../../core/players/types.js";
import { useLeague } from "../context/LeagueContext.js";
import { transferWindowState } from "../../core/transfers/window.js";
import {
  inboundOfferCandidates, currentInboundOffers, type InboundOffer,
} from "../../core/transfers/inboundOffers.js";
import { scoutCommentary, type ScoutCommentary } from "../../core/transfers/scoutCommentary.js";
import { deriveLeagueContexts } from "../../core/ai/clubContext.js";
import { WINTER_WINDOW_OPEN_MATCHDAY } from "../../core/calendar.js";
import { currency, formatWeeklyWage, talksCollapsedMessage } from "../format.js";
import { Flag } from "../components/Flag.js";
import { OfferAmountInput } from "../components/OfferAmountInput.js";
import { PlayerRatingsTooltip } from "../components/PlayerRatingsTooltip.js";

function scoutCommentaryText(commentary: ScoutCommentary, playerName: string): string {
  switch (commentary.tone) {
    case "good":
      return `That's a great deal for ${playerName}, take it!`;
    case "bad":
      return `Their evaluation of ${playerName} is clearly different than ours. This isn't worth discussing.`;
    case "counter":
      return `Maybe try to counter at ${currency.format(commentary.suggested)} and see how it goes.`;
  }
}

interface OfferRowProps {
  pid: number;
  buyerTid: number;
  buyerName: string;
  playerName: string;
  offerFee: number;
  negotiation: InboundOffer | undefined;
  disabled: boolean;
  commentary: ScoutCommentary | null;
  onAccept: (pid: number) => void;
  onReject: (pid: number) => void;
  onCounter: (pid: number, amount: number) => void;
}

function OfferRow({
  pid, buyerName, playerName, offerFee, negotiation, disabled, commentary, onAccept, onReject, onCounter,
}: OfferRowProps) {
  const [draft, setDraft] = useState(() => String(Math.round(offerFee * 1.2)));

  if (negotiation?.status === "accepted") {
    return <span className="text-success">Sold to {buyerName}</span>;
  }
  if (negotiation?.status === "rejected") {
    return <span className="text-danger">Rejected</span>;
  }
  if (negotiation?.status === "collapsed") {
    return <span className="text-danger">{talksCollapsedMessage(pid)}</span>;
  }

  const lastAsk = negotiation?.asks.at(-1);
  const bestAsk = negotiation && negotiation.asks.length > 0 ? Math.min(...negotiation.asks) : null;
  const draftValue = Number(draft);
  const notImproving = bestAsk !== null && draftValue >= bestAsk;
  const askValid = draft !== "" && Number.isFinite(draftValue) && draftValue > 0 && !notImproving;

  // Quick-pick asks between the buyer's offer and the ceiling your last ask allows.
  const ceiling = bestAsk ?? Math.round(offerFee * 1.3);
  const quickAmounts = [
    Math.round(offerFee * 1.05),
    Math.round((offerFee + ceiling) / 2),
    Math.round(ceiling * 0.95),
  ].filter((amt) => amt > offerFee && amt < ceiling);

  return (
    <div className="d-flex flex-column gap-1">
      <div>
        <strong>{currency.format(offerFee)}</strong> from {buyerName}
        {lastAsk !== undefined && (
          <small className="text-muted d-block">
            Your ask: {currency.format(lastAsk)}
            {notImproving && <> &middot; ask must be lower than your last ask</>}
          </small>
        )}
        {commentary && (
          <small className="text-muted d-block fst-italic">
            Scout: {scoutCommentaryText(commentary, playerName)}
          </small>
        )}
      </div>
      <div className="d-flex gap-1 align-items-center">
        <button
          className="btn btn-sm btn-success"
          disabled={disabled}
          onClick={() => onAccept(pid)}
        >
          Accept {currency.format(offerFee)}
        </button>
        <OfferAmountInput
          value={draft}
          onChange={setDraft}
          quickAmounts={quickAmounts}
          disabled={disabled}
        />
        <button
          className="btn btn-sm btn-primary"
          disabled={disabled || !askValid}
          title={notImproving ? "Must ask less than your previous ask" : undefined}
          onClick={() => onCounter(pid, draftValue)}
        >
          Counter
        </button>
        <button
          className="btn btn-sm btn-outline-danger"
          disabled={disabled}
          onClick={() => onReject(pid)}
        >
          Reject
        </button>
      </div>
    </div>
  );
}

export function IncomingOffers() {
  const {
    league, acceptInboundOfferAction, rejectInboundOfferAction, counterInboundOfferAction, simming,
  } = useLeague();

  const candidates = useMemo(
    () => (league ? inboundOfferCandidates(league) : []),
    [league],
  );

  if (!league) {
    return <p className="p-3">Loading...</p>;
  }

  const userTeam = league.teams.find((t) => t.tid === league.meta.userTid);
  if (!userTeam) {
    return <p className="p-3">Team not found.</p>;
  }

  const ws = transferWindowState(league);
  const teamName = (tid: number) =>
    league.teams.find((t) => t.tid === tid)?.name ?? "Unknown";

  const userCtx = deriveLeagueContexts({
    teams: league.teams, players: league.players, season: league.season, played: league.played,
  }).get(userTeam.tid);

  const commentaryFor = (p: Player, offerFee: number): ScoutCommentary | null =>
    userCtx && ws.open
      ? scoutCommentary(p, offerFee, userCtx, userTeam.scoutingSpend, league.lid, ws.season, ws.window)
      : null;

  const negotiations = currentInboundOffers(league);
  const negotiationByPid = new Map(negotiations.map((n) => [n.pid, n]));

  // Talks that outlived this render's candidate list (e.g. the buyer's
  // valuation shifted) still need a row somewhere, as long as they're open.
  const listedPids = new Set(candidates.map((c) => c.player.pid));
  const orphaned = negotiations.filter(
    (n) => !listedPids.has(n.pid) && n.status === "open",
  );

  // An accepted offer sells the player and drops him off the roster, so he
  // falls out of both `candidates` and `orphaned` with no other confirmation
  // on this page — surface completed sales explicitly instead.
  const soldThisWindow = league.transfers.filter(
    (t) => ws.open && t.season === ws.season && t.window === ws.window && t.fromTid === userTeam.tid,
  );

  return (
    <div className="container-fluid p-3">
      <h4>Incoming Offers</h4>

      {!ws.open ? (
        <div className="alert alert-secondary mb-3">
          <strong>Transfer window closed.</strong> The winter window opens once
          matchday {WINTER_WINDOW_OPEN_MATCHDAY - 1} is played and closes after
          the deadline; the summer window runs through the offseason and August.
        </div>
      ) : (
        <p>
          Other clubs sometimes come in for your players during an open
          window. Accept, counter for more, or reject &mdash; a rejection or a
          walked-away counter ends talks for that player for the rest of this
          window.
          {league.phase === "regular" && (
            <> The buyer covers the player&apos;s season wages on top of any fee.</>
          )}
        </p>
      )}

      {ws.open && candidates.length === 0 && orphaned.length === 0 && (
        <p className="text-muted">No offers for your players right now.</p>
      )}

      {candidates.length > 0 && (
        <table className="table table-striped table-sm align-middle">
          <thead>
            <tr>
              <th>Name</th>
              <th>Pos</th>
              <th className="text-end">Age</th>
              <th className="text-end">Ovr</th>
              <th className="text-end">Pot</th>
              <th className="text-end">Wage</th>
              <th>Offer</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((c) => {
              const p = c.player;
              const negotiation = negotiationByPid.get(p.pid);
              const buyerTid = negotiation?.buyerTid ?? c.buyerTid;
              const offerFee = negotiation?.offers.at(-1) ?? c.openingOffer;
              return (
                <tr key={p.pid}>
                  <td>
                    <PlayerRatingsTooltip player={p}>{p.name}</PlayerRatingsTooltip>{" "}
                    <Flag nationality={p.nationality} />
                  </td>
                  <td>{p.pos}</td>
                  <td className="text-end">{league.season - p.born}</td>
                  <td className="text-end">{p.ovr}</td>
                  <td className="text-end">{p.potential}</td>
                  <td className="text-end">{formatWeeklyWage(p.contract.salary)}</td>
                  <td>
                    <OfferRow
                      pid={p.pid}
                      buyerTid={buyerTid}
                      buyerName={teamName(buyerTid)}
                      playerName={p.name}
                      offerFee={offerFee}
                      negotiation={negotiation}
                      disabled={simming}
                      commentary={commentaryFor(p, offerFee)}
                      onAccept={acceptInboundOfferAction}
                      onReject={rejectInboundOfferAction}
                      onCounter={counterInboundOfferAction}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {orphaned.length > 0 && (
        <div className="card mb-3">
          <div className="card-body">
            <h5 className="card-title">Other Offers</h5>
            <table className="table table-sm align-middle">
              <tbody>
                {orphaned.map((n) => {
                  const p = league.players.find((pl) => pl.pid === n.pid);
                  if (!p) return null;
                  return (
                    <tr key={n.pid}>
                      <td>
                        <PlayerRatingsTooltip player={p}>{p.name}</PlayerRatingsTooltip>{" "}
                        <Flag nationality={p.nationality} /> ({p.pos})
                      </td>
                      <td>
                        <OfferRow
                          pid={n.pid}
                          buyerTid={n.buyerTid}
                          buyerName={teamName(n.buyerTid)}
                          playerName={p.name}
                          offerFee={n.offers.at(-1) ?? 0}
                          negotiation={n}
                          disabled={simming}
                          commentary={commentaryFor(p, n.offers.at(-1) ?? 0)}
                          onAccept={acceptInboundOfferAction}
                          onReject={rejectInboundOfferAction}
                          onCounter={counterInboundOfferAction}
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

      {soldThisWindow.length > 0 && (
        <div className="card mb-3">
          <div className="card-body">
            <h5 className="card-title">Sold This Window</h5>
            <ul className="mb-0">
              {soldThisWindow.map((t, i) => {
                const p = league.players.find((pl) => pl.pid === t.pid);
                return (
                  <li key={i}>
                    {p?.name ?? `Player ${t.pid}`}{" "}
                    {p && <Flag nationality={p.nationality} />} &rarr; {teamName(t.toTid)} for{" "}
                    {currency.format(t.fee)}
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
