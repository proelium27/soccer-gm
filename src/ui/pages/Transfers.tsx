import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useLeague } from "../context/LeagueContext.js";
import { HelpHint, PotHelp } from "../components/HelpHint.js";
import type { LeagueStore } from "../../core/leagueState.js";
import { transferWindowState } from "../../core/transfers/window.js";
import {
  recommendedTransfers,
  searchWorldPlayers,
  PLAYER_SEARCH_LIMIT,
} from "../../core/transfers/recommendations.js";
import {
  acquisitionWageCharge,
  currentNegotiations,
  isFreeAgentTid,
  type TransferNegotiation,
} from "../../core/transfers/negotiation.js";
import { WINTER_WINDOW_OPEN_MATCHDAY } from "../../core/calendar.js";
import { clubDisplayName, currency, formatWeeklyWage, talksCollapsedMessage } from "../format.js";
import { Flag } from "../components/Flag.js";
import { OfferAmountInput } from "../components/OfferAmountInput.js";
import { PlayerRatingsTooltip } from "../components/PlayerRatingsTooltip.js";
import { PotDisplay } from "../components/PotDisplay.js";
import { SortableTh, useTableSort, sortRows } from "../components/SortableTable.js";
import { ROSTER_CAP } from "../../core/constants.js";
import { POSITIONS } from "../../core/players/types.js";

// "recommended" is the initial, unsorted order (best-fit targets first); the
// other keys map to clickable columns.
type TargetSortKey = "recommended" | "name" | "pos" | "age" | "ovr" | "pot" | "club" | "wage" | "value";

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

interface SearchFilters extends TransferFilters {
  name: string;
}

const EMPTY_SEARCH: SearchFilters = { ...EMPTY_FILTERS, name: "" };

/** Parse a text field into a numeric filter value (""/invalid → no constraint). */
function numFilter(s: string): number | null {
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** One recommended-transfer row (player + who's selling + scout value). */
type TargetRow = ReturnType<typeof recommendedTransfers>[number];

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
        <strong>{label} transfer window is open</strong>. {until}.
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
    return <span className="text-success">Transferred</span>;
  }
  if (negotiation?.status === "collapsed") {
    return <span className="text-danger">{talksCollapsedMessage(pid)}</span>;
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
  const [search, setSearch] = useState<SearchFilters>(EMPTY_SEARCH);
  const { sort, toggle } = useTableSort<TargetSortKey>("recommended", "desc");

  const hasFilters =
    filters.position !== "" || filters.minOvr !== "" || filters.minPot !== ""
    || filters.maxAge !== "" || filters.maxValue !== "";

  const hasSearch =
    search.name.trim() !== "" || search.position !== "" || search.minOvr !== ""
    || search.minPot !== "" || search.maxAge !== "" || search.maxValue !== "";

  // Filters feed into the search itself (not a post-hoc row filter), so
  // changing one re-runs the candidate scan and surfaces genuinely new
  // targets — e.g. picking "FB" brings up a fresh list of full-backs. The
  // full-league scan is memoized so unrelated renders (typing an offer) don't
  // redo it; it re-runs only when the league, refresh, or a filter changes.
  const targets = useMemo(() => {
    if (!league) return [];
    return recommendedTransfers(league, refreshNonce, {
      position: filters.position || undefined,
      minOvr: numFilter(filters.minOvr),
      minPot: numFilter(filters.minPot),
      maxAge: numFilter(filters.maxAge),
      maxValue: numFilter(filters.maxValue),
    });
  }, [league, refreshNonce, filters]);

  // Free-form world search: scans every club, so it's memoized to stay off the
  // path of unrelated renders (typing an offer amount). Empty until the user
  // sets a name or filter (see searchWorldPlayers).
  const searchResults = useMemo(() => {
    if (!league) return [];
    return searchWorldPlayers(league, {
      name: search.name,
      position: search.position || undefined,
      minOvr: numFilter(search.minOvr),
      minPot: numFilter(search.minPot),
      maxAge: numFilter(search.maxAge),
      maxValue: numFilter(search.maxValue),
    });
  }, [league, search]);

  // Players bought earlier *this visit*. A completed buy moves the player onto
  // your roster, so he drops out of the recommended scan and his row would just
  // vanish. We keep it pinned at the same index (with a "Transferred" badge)
  // instead. Local state, not the persisted negotiation, so the row is gone the
  // next time you open the page — exactly once, right after the buy.
  const [pinnedBuys, setPinnedBuys] = useState<{ row: TargetRow; index: number }[]>([]);
  // Snapshot of the rows shown last render, so when a buy drops a player out of
  // the fresh scan we can recover his row and its position from before.
  const prevTargetsRef = useRef<TargetRow[]>([]);

  useEffect(() => {
    const negs = league ? currentNegotiations(league) : [];
    const pinnedPids = new Set(pinnedBuys.map((b) => b.row.player.pid));
    const additions = negs.flatMap((n) => {
      if (n.status !== "accepted" || pinnedPids.has(n.pid)) return [];
      const idx = prevTargetsRef.current.findIndex((t) => t.player.pid === n.pid);
      return idx >= 0 ? [{ row: prevTargetsRef.current[idx], index: idx }] : [];
    });
    prevTargetsRef.current = targets;
    if (additions.length > 0) setPinnedBuys((prev) => [...prev, ...additions]);
  }, [league, targets, pinnedBuys]);

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
    clubDisplayName(tid, (id) => league.teams.find((t) => t.tid === id)?.name);

  const negotiations = currentNegotiations(league);
  const negotiationByPid = new Map(negotiations.map((n) => [n.pid, n]));

  // Talks that outlived the recommended list (e.g. the budget shrank after a
  // signing, or the current filters exclude the player) still need controls
  // somewhere. A player currently shown in the search results already has
  // controls there, so he doesn't also need an "Other Negotiations" row.
  const listedPids = new Set([
    ...targets.map((t) => t.player.pid),
    ...searchResults.filter((r) => r.forSale).map((r) => r.player.pid),
  ]);
  const orphaned = negotiations.filter(
    (n) => !listedPids.has(n.pid) && n.status !== "accepted",
  );

  // Splice players bought this visit back into the list at their original row,
  // so the row appears to stay put and flip to "Transferred" rather than jump
  // to the top or disappear. (See `pinnedBuys` above for the once-per-visit
  // lifetime.)
  const pinnedPids = new Set(pinnedBuys.map((b) => b.row.player.pid));
  const baseTargets = targets.filter((t) => !pinnedPids.has(t.player.pid));
  for (const { row, index } of [...pinnedBuys].sort((a, b) => a.index - b.index)) {
    baseTargets.splice(Math.min(index, baseTargets.length), 0, row);
  }
  // Apply the chosen column sort on top. The default "recommended" key has no
  // accessor, so sortRows leaves the pinned best-fit order (and bought-row
  // positions) untouched; any other key sorts the whole list, pinned buys included.
  const displayTargets = sortRows(baseTargets, sort, {
    name: (r) => r.player.name,
    pos: (r) => r.player.pos,
    age: (r) => league.season - r.player.born,
    ovr: (r) => r.player.ovr,
    pot: (r) => r.player.potential,
    club: (r) => teamName(r.sellerTid),
    wage: (r) => r.player.contract.salary,
    value: (r) => r.scoutedValue,
  });

  const windowTransfers = league.transfers.filter(
    (t) =>
      ws.open && t.season === ws.season && t.window === ws.window &&
      // Routine AI free-agent churn is recorded for history but not shown as
      // window activity; the user's own free signings still show.
      (!isFreeAgentTid(t.fromTid) || t.toTid === league.meta.userTid),
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
            {displayTargets.length === 0 ? (
              <p className="mb-0">
                {hasFilters
                  ? "No available targets match these filters. Try widening them or hit Refresh."
                  : "No suitable targets found."}
              </p>
            ) : (
              <table className="table table-striped table-sm align-middle">
                <thead>
                  <tr>
                    <SortableTh sortKey="name" sort={sort} onSort={toggle} defaultDir="asc">Name</SortableTh>
                    <SortableTh sortKey="pos" sort={sort} onSort={toggle} defaultDir="asc">Pos</SortableTh>
                    <SortableTh sortKey="age" sort={sort} onSort={toggle} className="text-end" defaultDir="asc">Age</SortableTh>
                    <SortableTh sortKey="ovr" sort={sort} onSort={toggle} className="text-end">Ovr</SortableTh>
                    <SortableTh sortKey="pot" sort={sort} onSort={toggle} className="text-end">Pot <PotHelp /></SortableTh>
                    <SortableTh sortKey="club" sort={sort} onSort={toggle} defaultDir="asc">Club</SortableTh>
                    <SortableTh sortKey="wage" sort={sort} onSort={toggle} className="text-end">Wage</SortableTh>
                    <SortableTh sortKey="value" sort={sort} onSort={toggle} className="text-end">
                      Scout value
                      <HelpHint>
                        Our scouts' estimate of this player's transfer value. It's an estimate, not
                        the exact asking price. More scouting spend makes it more accurate (it can be
                        off by up to &plusmn;35% at &pound;0 spend, down to about &plusmn;5% at the max).
                      </HelpHint>
                    </SortableTh>
                    <th>Offer</th>
                  </tr>
                </thead>
                <tbody>
                  {displayTargets.map(({ player: p, sellerTid, scoutedValue }) => (
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
                      <td className="text-end"><PotDisplay player={p} /></td>
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

      {ws.open && (
        <div className="card mb-3">
          <div className="card-body">
            <h5 className="card-title">Search all players</h5>
            <p className="card-text text-muted">
              Look up any player in the world by name or filters and bid on him
              directly — not just the recommended shortlist. A club won&apos;t part
              with a player it needs for depth, and the very best players at
              successful clubs simply aren&apos;t for sale at any price.
            </p>
            <div className="d-flex flex-wrap gap-2 align-items-end mb-3">
              <div>
                <label className="form-label small mb-0" htmlFor="ps-name">Name</label>
                <input
                  id="ps-name"
                  type="text"
                  className="form-control form-control-sm"
                  style={{ width: "12rem" }}
                  placeholder="Search by name"
                  value={search.name}
                  onChange={(e) => setSearch((s) => ({ ...s, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="form-label small mb-0" htmlFor="ps-pos">Position</label>
                <select
                  id="ps-pos"
                  className="form-select form-select-sm"
                  value={search.position}
                  onChange={(e) => setSearch((s) => ({ ...s, position: e.target.value }))}
                >
                  <option value="">All</option>
                  {POSITIONS.map((pos) => (
                    <option key={pos} value={pos}>{pos}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label small mb-0" htmlFor="ps-min-ovr">Min Ovr</label>
                <input
                  id="ps-min-ovr"
                  type="number"
                  className="form-control form-control-sm"
                  style={{ width: "5.5rem" }}
                  value={search.minOvr}
                  onChange={(e) => setSearch((s) => ({ ...s, minOvr: e.target.value }))}
                />
              </div>
              <div>
                <label className="form-label small mb-0" htmlFor="ps-min-pot">Min Pot</label>
                <input
                  id="ps-min-pot"
                  type="number"
                  className="form-control form-control-sm"
                  style={{ width: "5.5rem" }}
                  value={search.minPot}
                  onChange={(e) => setSearch((s) => ({ ...s, minPot: e.target.value }))}
                />
              </div>
              <div>
                <label className="form-label small mb-0" htmlFor="ps-max-age">Max Age</label>
                <input
                  id="ps-max-age"
                  type="number"
                  className="form-control form-control-sm"
                  style={{ width: "5.5rem" }}
                  value={search.maxAge}
                  onChange={(e) => setSearch((s) => ({ ...s, maxAge: e.target.value }))}
                />
              </div>
              <div>
                <label className="form-label small mb-0" htmlFor="ps-max-value">Max Value</label>
                <input
                  id="ps-max-value"
                  type="number"
                  className="form-control form-control-sm"
                  style={{ width: "8rem" }}
                  value={search.maxValue}
                  onChange={(e) => setSearch((s) => ({ ...s, maxValue: e.target.value }))}
                />
              </div>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setSearch(EMPTY_SEARCH)}
              >
                Clear
              </button>
            </div>
            {!hasSearch ? (
              <p className="mb-0 text-muted">
                Enter a name or set a filter to search the whole world.
              </p>
            ) : searchResults.length === 0 ? (
              <p className="mb-0">No players match your search.</p>
            ) : (
              <table className="table table-striped table-sm align-middle">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Pos</th>
                    <th className="text-end">Age</th>
                    <th className="text-end">Ovr</th>
                    <th className="text-end">Pot <PotHelp /></th>
                    <th>Club</th>
                    <th className="text-end">Wage</th>
                    <th className="text-end">Scout value</th>
                    <th>Offer</th>
                  </tr>
                </thead>
                <tbody>
                  {searchResults.map(({ player: p, sellerTid, scoutedValue, forSale, notForSaleReason }) => (
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
                      <td className="text-end"><PotDisplay player={p} /></td>
                      <td>{teamName(sellerTid)}</td>
                      <td className="text-end">{formatWeeklyWage(p.contract.salary)}</td>
                      <td className="text-end">{currency.format(scoutedValue)}</td>
                      <td>
                        {forSale ? (
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
                        ) : (
                          <span className="text-muted small">{notForSaleReason}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {hasSearch && searchResults.length >= PLAYER_SEARCH_LIMIT && (
              <p className="text-muted small mb-0">
                Showing the top {PLAYER_SEARCH_LIMIT} by overall — narrow your
                filters to see more specific targets.
              </p>
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
                        <PlayerRatingsTooltip player={p}>
                          <Link to={`/player/${p.pid}`}>{p.name}</Link>
                        </PlayerRatingsTooltip>{" "}
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
                    {p ? <Link to={`/player/${p.pid}`}>{p.name}</Link> : `Player ${t.pid}`}{" "}
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
