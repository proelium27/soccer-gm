import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLeague } from "../context/LeagueContext.js";
import { HelpHint, PotHelp } from "../components/HelpHint.js";
import { transferWindowState } from "../../core/transfers/window.js";
import { loanOfferCandidates } from "../../core/loans.js";
import { WINTER_WINDOW_OPEN_MATCHDAY } from "../../core/calendar.js";
import { LOAN_MAX_SEASONS } from "../../core/constants.js";
import { currency, formatWeeklyWage } from "../format.js";
import { Flag } from "../components/Flag.js";
import { PlayerRatingsTooltip } from "../components/PlayerRatingsTooltip.js";
import { PotDisplay } from "../components/PotDisplay.js";

const SEASON_OPTIONS = Array.from({ length: LOAN_MAX_SEASONS }, (_, i) => (i + 1) as 1 | 2 | 3);

export function Loans() {
  const {
    league, listPlayerForLoanAction, unlistPlayerForLoanAction,
    acceptLoanOfferAction, rejectLoanOfferAction, simming,
  } = useLeague();
  const [draftSeasons, setDraftSeasons] = useState<Record<number, 1 | 2 | 3>>({});

  const offers = useMemo(() => (league ? loanOfferCandidates(league) : []), [league]);

  if (!league) {
    return <p className="p-3">Loading...</p>;
  }

  const userTeam = league.teams.find((t) => t.tid === league.meta.userTid);
  if (!userTeam) {
    return <p className="p-3">Team not found.</p>;
  }

  const ws = transferWindowState(league);
  const teamName = (tid: number) => league.teams.find((t) => t.tid === tid)?.name ?? "Unknown";
  const playerName = (pid: number) => league.players.find((p) => p.pid === pid);

  const listedPids = new Set(league.loanListings.map((l) => l.pid));
  const eligible = userTeam.roster
    .map((pid) => league.players.find((p) => p.pid === pid))
    .filter((p): p is NonNullable<typeof p> => p != null && !listedPids.has(p.pid));

  const outOnLoan = league.activeLoans.filter((l) => l.parentTid === userTeam.tid);

  return (
    <div className="container-fluid p-3">
      <h4>
        Loans
        <HelpHint>
          Send a player to another club for 1–3 seasons to get him minutes he isn't getting with
          you — and minutes drive development. List a player, then accept or reject the flat-fee
          loan offers that come in; he returns automatically when the loan ends.
        </HelpHint>
      </h4>

      {!ws.open ? (
        <div className="alert alert-secondary mb-3">
          <strong>Transfer window closed.</strong> Loans can only be listed or
          offered during an open window. The winter window opens once
          matchday {WINTER_WINDOW_OPEN_MATCHDAY - 1} is played; the summer
          window runs through the offseason and August.
        </div>
      ) : (
        <p>
          Sending a player on loan gets him minutes elsewhere when he can&apos;t
          get them at your club &mdash; the loanee club pays a flat fee up front
          and covers his wages for the loan&apos;s length, and he returns to your
          roster automatically once it ends.
        </p>
      )}

      <div className="card mb-3">
        <div className="card-body">
          <h5 className="card-title">Incoming Loan Offers</h5>
          {offers.length === 0 ? (
            <p className="text-muted mb-0">No offers on your listed players right now.</p>
          ) : (
            <table className="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Pos</th>
                  <th className="text-end">Ovr</th>
                  <th className="text-end">Pot <PotHelp /></th>
                  <th>Club</th>
                  <th className="text-end">Seasons</th>
                  <th className="text-end">Fee</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {offers.map((c) => (
                  <tr key={c.player.pid}>
                    <td>
                      <PlayerRatingsTooltip player={c.player}>
                        <Link to={`/player/${c.player.pid}`}>{c.player.name}</Link>
                      </PlayerRatingsTooltip>{" "}
                      <Flag nationality={c.player.nationality} />
                    </td>
                    <td>{c.player.pos}</td>
                    <td className="text-end">{c.player.ovr}</td>
                    <td className="text-end"><PotDisplay player={c.player} /></td>
                    <td>{teamName(c.buyerTid)}</td>
                    <td className="text-end">{c.seasons}</td>
                    <td className="text-end">{currency.format(c.fee)}</td>
                    <td className="text-end">
                      <button
                        className="btn btn-sm btn-success me-1"
                        disabled={simming}
                        onClick={() => acceptLoanOfferAction(c.player.pid)}
                      >
                        Accept
                      </button>
                      <button
                        className="btn btn-sm btn-outline-danger"
                        disabled={simming}
                        onClick={() => rejectLoanOfferAction(c.player.pid)}
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-body">
          <h5 className="card-title">Your Loan Listings</h5>
          {league.loanListings.length === 0 ? (
            <p className="text-muted mb-0">No players currently listed for loan.</p>
          ) : (
            <table className="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th>Name</th>
                  <th className="text-end">Seasons</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {league.loanListings.map((listing) => {
                  const p = playerName(listing.pid);
                  return (
                    <tr key={listing.pid}>
                      <td>{p ? p.name : `Player ${listing.pid}`}</td>
                      <td className="text-end">{listing.seasons}</td>
                      <td className="text-end">
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          disabled={simming}
                          onClick={() => unlistPlayerForLoanAction(listing.pid)}
                        >
                          Unlist
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-body">
          <h5 className="card-title">List a Player for Loan</h5>
          {eligible.length === 0 ? (
            <p className="text-muted mb-0">Nothing eligible to list right now.</p>
          ) : (
            <table className="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Pos</th>
                  <th className="text-end">Age</th>
                  <th className="text-end">Ovr</th>
                  <th className="text-end">Pot <PotHelp /></th>
                  <th className="text-end">Wage</th>
                  <th>Duration</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {eligible.map((p) => (
                  <tr key={p.pid}>
                    <td>
                      <PlayerRatingsTooltip player={p}>{p.name}</PlayerRatingsTooltip>{" "}
                      <Flag nationality={p.nationality} />
                    </td>
                    <td>{p.pos}</td>
                    <td className="text-end">{league.season - p.born}</td>
                    <td className="text-end">{p.ovr}</td>
                    <td className="text-end"><PotDisplay player={p} /></td>
                    <td className="text-end">{formatWeeklyWage(p.contract.salary)}</td>
                    <td>
                      <select
                        className="form-select form-select-sm"
                        style={{ width: "auto" }}
                        value={draftSeasons[p.pid] ?? 1}
                        onChange={(e) =>
                          setDraftSeasons((d) => ({ ...d, [p.pid]: Number(e.target.value) as 1 | 2 | 3 }))
                        }
                      >
                        {SEASON_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s} season{s > 1 ? "s" : ""}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="text-end">
                      <button
                        className="btn btn-sm btn-primary"
                        disabled={simming || !ws.open}
                        onClick={() => listPlayerForLoanAction(p.pid, draftSeasons[p.pid] ?? 1)}
                      >
                        List for Loan
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <h5 className="card-title">Players Out on Loan</h5>
          {outOnLoan.length === 0 ? (
            <p className="text-muted mb-0">None of your players are currently out on loan.</p>
          ) : (
            <table className="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Loanee Club</th>
                  <th className="text-end">Returns</th>
                </tr>
              </thead>
              <tbody>
                {outOnLoan.map((l) => {
                  const p = playerName(l.pid);
                  return (
                    <tr key={l.pid}>
                      <td>{p ? p.name : `Player ${l.pid}`}</td>
                      <td>{teamName(l.loaneeTid)}</td>
                      <td className="text-end">Season {l.returnSeason}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
