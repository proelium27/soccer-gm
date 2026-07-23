import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useLeague } from "../context/LeagueContext.js";
import { HelpHint, PotHelp } from "../components/HelpHint.js";
import { POSITIONS } from "../../core/players/types.js";
import type { Player } from "../../core/players/types.js";
import { resolveXI } from "../../core/lineup/resolveXI.js";
import { teamSlots, teamFormation, FORMATION_IDS, type FormationId } from "../../core/lineup/formations.js";
import { computeTeamRating } from "../../core/teams/teamRating.js";
import { canExtend } from "../../core/contracts.js";
import { keepsDepthFloor, faTransferLocked } from "../../core/freeAgency.js";
import { wouldRefuseExtension } from "../../core/ai/breakoutRefusal.js";
import { tierOf } from "../../core/competitions.js";
import { RatingDelta, previousRatings } from "../components/RatingDelta.js";
import { formatWeeklyWage, seasonYear } from "../format.js";
import { PlayerRatingsTooltip } from "../components/PlayerRatingsTooltip.js";
import { PotDisplay } from "../components/PotDisplay.js";
import { PitchField } from "../components/PitchField.js";
import { ExtendControl } from "../components/ExtendControl.js";
import { Flag } from "../components/Flag.js";
import { InjuryBadge } from "../components/InjuryBadge.js";
import { ROSTER_CAP } from "../../core/constants.js";

const DRAG_MIME = "application/x-soccer-gm-pid";

export function sortByPosThenOvr(players: Player[]): Player[] {
  const posOrder = new Map(POSITIONS.map((pos, i) => [pos, i]));
  return [...players].sort((a, b) => {
    const posA = posOrder.get(a.pos) ?? 99;
    const posB = posOrder.get(b.pos) ?? 99;
    if (posA !== posB) return posA - posB;
    return b.ovr - a.ovr;
  });
}

interface RosterTableProps {
  players: Player[];
  season: number;
  hasStats: boolean;
  onRelease: (pid: number) => void;
  onExtend: (pid: number, lengthSeasons: number) => void;
  releasablePids: Set<number>;
  refusingPids: Set<number>;
  transferListedPids: Set<number>;
  onToggleTransferListed: (pid: number, listed: boolean) => void;
  /** Bench-only: pids flagged for more minutes, and the toggle. Omitted on the XI table. */
  moreMinutesPids?: Set<number>;
  onToggleMoreMinutes?: (pid: number, enabled: boolean) => void;
  dragOverPid: number | null;
  setDragOverPid: (pid: number | null) => void;
  onSwap: (draggedPid: number, targetPid: number) => void;
  selectedPid: number | null;
  onTapToMove: (pid: number) => void;
}

function RosterTable({
  players,
  season,
  hasStats,
  onRelease,
  onExtend,
  releasablePids,
  refusingPids,
  transferListedPids,
  onToggleTransferListed,
  moreMinutesPids,
  onToggleMoreMinutes,
  dragOverPid,
  setDragOverPid,
  onSwap,
  selectedPid,
  onTapToMove,
}: RosterTableProps) {
  return (
    <table className="table table-striped table-sm">
      <thead>
        <tr>
          <th></th>
          <th>Name</th>
          <th>Pos</th>
          <th className="text-end">Age</th>
          <th className="text-end">Ovr</th>
          <th className="text-end">Pot <PotHelp /></th>
          <th className="text-end">Wage</th>
          <th className="text-end">Contract</th>
          {hasStats && (
            <>
              <th className="text-end">Apps</th>
              <th className="text-end">Min</th>
              <th className="text-end">G</th>
              <th className="text-end">A</th>
              <th className="text-end">Sh</th>
              <th className="text-end">Sv</th>
              <th className="text-end">GA</th>
              <th className="text-end">xGA</th>
              <th className="text-end">Tkl</th>
              <th className="text-end">Int</th>
              <th className="text-end">Rtg</th>
            </>
          )}
          <th></th>
        </tr>
      </thead>
      <tbody>
        {players.map((p) => {
          const ss = p.stats.find((s) => s.season === season);
          const prev = previousRatings(p);
          return (
            <tr
              key={p.pid}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(DRAG_MIME, String(p.pid));
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDragOverPid(p.pid);
              }}
              onDragLeave={() => setDragOverPid(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverPid(null);
                const raw = e.dataTransfer.getData(DRAG_MIME);
                if (!raw) return;
                onSwap(Number(raw), p.pid);
              }}
              onDragEnd={() => setDragOverPid(null)}
              className={
                dragOverPid === p.pid || selectedPid === p.pid ? "table-active" : undefined
              }
              style={{ cursor: "grab" }}
            >
              <td>
                <button
                  type="button"
                  className={
                    "drag-handle-btn" + (selectedPid === p.pid ? " drag-handle-btn--selected" : "")
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    onTapToMove(p.pid);
                  }}
                  aria-label={selectedPid === p.pid ? "Cancel move" : "Move player"}
                  title={
                    selectedPid === p.pid
                      ? "Cancel move"
                      : "Drag to swap, or tap to pick up and tap another player's handle to swap"
                  }
                >
                  &#8942;&#8942;
                </button>
              </td>
              <td>
                <PlayerRatingsTooltip player={p}>
                  <Link to={`/player/${p.pid}`}>{p.name}</Link>
                </PlayerRatingsTooltip>{" "}
                <Flag nationality={p.nationality} />
                <InjuryBadge player={p} />
              </td>
              <td>{p.pos}</td>
              <td className="text-end">{season - p.born}</td>
              <td className="text-end">
                <RatingDelta value={p.ovr} previous={prev?.ovr ?? null} />
              </td>
              <td className="text-end">
                <PotDisplay player={p} />
              </td>
              <td className="text-end">{formatWeeklyWage(p.contract.salary)}</td>
              <td className="text-end">
                {p.contract.expiresSeason <= season ? (
                  <span
                    className="badge bg-warning text-dark"
                    title="His deal runs out this season. Extend him before the offseason or he leaves on a free."
                  >
                    Final year
                  </span>
                ) : (
                  `Through ${seasonYear(p.contract.expiresSeason)}`
                )}
              </td>
              {hasStats && (
                <>
                  <td className="text-end">{ss?.appearances ?? 0}</td>
                  <td className="text-end">{ss?.minutesPlayed ?? 0}</td>
                  <td className="text-end">{ss?.goals ?? 0}</td>
                  <td className="text-end">{ss?.assists ?? 0}</td>
                  <td className="text-end">{ss?.shots ?? 0}</td>
                  <td className="text-end">{ss?.saves ?? 0}</td>
                  <td className="text-end">{p.pos === "GK" ? ss?.goalsAgainst ?? 0 : ""}</td>
                  <td className="text-end">{p.pos === "GK" && ss ? ss.xga.toFixed(2) : ""}</td>
                  <td className="text-end">{ss?.tackles ?? 0}</td>
                  <td className="text-end">{ss?.interceptions ?? 0}</td>
                  <td className="text-end">{ss ? ss.avgRating.toFixed(2) : ""}</td>
                </>
              )}
              <td className="text-end">
                <div className="d-inline-flex gap-1">
                  {canExtend(p, season) && (
                    refusingPids.has(p.pid) ? (
                      <span
                        className="text-muted small fst-italic text-nowrap"
                        title="He's holding out for a move to Division 1 and won't sign a new deal here."
                      >
                        Wants a move to Division 1
                      </span>
                    ) : (
                      <ExtendControl player={p} season={season} onExtend={onExtend} />
                    )
                  )}
                  {faTransferLocked(p, season) ? (
                    <span
                      className="text-muted small fst-italic text-nowrap"
                      title={`You signed him from free agency, so he can't be sold until next season (${seasonYear(p.faSignedSeason! + 1)}).`}
                    >
                      Can't sell yet (just signed)
                    </span>
                  ) : (
                    <button
                      className={
                        "btn btn-sm text-nowrap " +
                        (transferListedPids.has(p.pid) ? "btn-warning" : "btn-outline-warning")
                      }
                      onClick={() => onToggleTransferListed(p.pid, !transferListedPids.has(p.pid))}
                      title="Listing signals AI clubs you're willing to sell, making an offer more likely."
                    >
                      {transferListedPids.has(p.pid) ? "Listed" : "List for Transfer"}
                    </button>
                  )}
                  {onToggleMoreMinutes && p.pos !== "GK" && (
                    <button
                      className={
                        "btn btn-sm text-nowrap " +
                        (moreMinutesPids?.has(p.pid) ? "btn-success" : "btn-outline-success")
                      }
                      onClick={() => onToggleMoreMinutes(p.pid, !moreMinutesPids?.has(p.pid))}
                      title="He'll be favored for substitutions, so he gets on the pitch more often."
                    >
                      {moreMinutesPids?.has(p.pid) ? "Getting minutes" : "More minutes"}
                    </button>
                  )}
                  <button
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => onRelease(p.pid)}
                    disabled={!releasablePids.has(p.pid)}
                    title={releasablePids.has(p.pid)
                      ? undefined
                      : `Can't release: squad would be too thin at ${p.pos}`}
                  >
                    Release
                  </button>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function Roster() {
  const {
    league, releasePlayerAction, extendContractAction, setTransferListedAction, setMoreMinutesAction,
    setLineupAction, setFormationAction,
  } = useLeague();
  const [dragOverPid, setDragOverPid] = useState<number | null>(null);
  const [dragOverSlotIndex, setDragOverSlotIndex] = useState<number | null>(null);
  const [showDepthChart, setShowDepthChart] = useState(false);
  const [selectedPid, setSelectedPid] = useState<number | null>(null);

  const refusingPids = useMemo(() => {
    if (!league) return new Set<number>();
    const userTeam = league.teams.find((t) => t.tid === league.meta.userTid);
    if (!userTeam || tierOf(league.competitions, userTeam.compId) !== 2) return new Set<number>();
    return new Set(
      league.players
        .filter(
          (p) =>
            userTeam.roster.includes(p.pid) &&
            canExtend(p, league.season) &&
            wouldRefuseExtension(p, userTeam, league.competitions),
        )
        .map((p) => p.pid),
    );
  }, [league]);

  // Everything here scales with the whole world's player pool (the roster
  // filter) or runs the lineup engine, and none of it depends on the drag /
  // selection state above. Dragging fires `setDragOverPid` on every dragover
  // event, so leaving this in the render body meant re-filtering ~6000 players,
  // re-resolving the XI, recomputing the team rating and re-running the
  // depth-floor check for every pixel of a drag. Keyed on `league`, which is a
  // fresh object only when the league is actually committed.
  const derived = useMemo(() => {
    const userTeam = league?.teams.find((t) => t.tid === league.meta.userTid);
    if (!league || !userTeam) return null;
    const rosterPids = new Set(userTeam.roster);
    const players: Player[] = league.players.filter((p) => rosterPids.has(p.pid));
    const slots = teamSlots(userTeam);
    const xi = resolveXI(players, slots, userTeam.starters);
    const starterPids = xi.map((p) => p.pid);
    const starterPidSet = new Set(starterPids);
    const bench = sortByPosThenOvr(players.filter((p) => !starterPidSet.has(p.pid)));
    const teamRating = computeTeamRating(players, userTeam.starters, slots);
    const playerMap = new Map(players.map((p) => [p.pid, p]));
    const releasablePids = new Set(
      players.filter((p) => keepsDepthFloor(userTeam, playerMap, p.pid)).map((p) => p.pid),
    );
    return {
      players, slots, xi, starterPids, starterPidSet, bench, teamRating,
      playerMap, releasablePids,
    };
  }, [league]);

  if (!league) {
    return <p className="p-3">Loading...</p>;
  }

  const userTeam = league.teams.find((t) => t.tid === league.meta.userTid);
  if (!userTeam || !derived) {
    return <p className="p-3">Team not found.</p>;
  }

  const {
    players, slots, xi, starterPids, starterPidSet, bench, teamRating,
    playerMap, releasablePids,
  } = derived;

  const formation = teamFormation(userTeam);

  const hasStats = league.played.length > 0;

  const transferListedPids = new Set(userTeam.transferListed);
  const moreMinutesPids = new Set(userTeam.moreMinutes);

  function handleSwap(draggedPid: number, targetPid: number) {
    if (draggedPid === targetPid) return;
    const draggedIsStarter = starterPidSet.has(draggedPid);
    const targetIsStarter = starterPidSet.has(targetPid);
    if (draggedIsStarter === targetIsStarter) return; // dropped within the same list; nothing to swap
    const dragged = playerMap.get(draggedPid);
    const target = playerMap.get(targetPid);
    if (!dragged || !target) return;
    // Keepers only swap with keepers: an outfielder in the GK slot (or a GK
    // outfield) would corrupt the composite rollup, which buckets by position.
    if ((dragged.pos === "GK") !== (target.pos === "GK")) return;
    const newStarters = starterPids.map((pid) => {
      if (pid === targetPid) return draggedPid;
      if (pid === draggedPid) return targetPid;
      return pid;
    });
    void setLineupAction(newStarters);
  }

  function handleDropOnSlot(slotIndex: number, draggedPid: number) {
    const targetPid = starterPids[slotIndex];
    handleSwap(draggedPid, targetPid);
  }

  // Tap-to-swap fallback for touch devices, where native HTML5 drag-and-drop
  // never fires: tap a player's handle to pick them up, tap another handle to
  // complete the swap (or tap the same handle again to cancel).
  function handleTapToMove(pid: number) {
    if (selectedPid === null) {
      setSelectedPid(pid);
    } else if (selectedPid === pid) {
      setSelectedPid(null);
    } else {
      handleSwap(selectedPid, pid);
      setSelectedPid(null);
    }
  }

  return (
    <div className="container-fluid p-3">
      <h4>
        {userTeam.name} Roster{" "}
        <small className={players.length >= ROSTER_CAP ? "text-danger" : "text-muted"}>
          ({players.length}/{ROSTER_CAP})
        </small>{" "}
        <small className="text-muted">
          &middot; {teamRating.ovr} OVR / {teamRating.pot} POT
        </small>
        <HelpHint>
          Your squad. Pick your formation, then drag players between the pitch and the bench to set
          your Starting XI (or, on touch devices, tap a player's &#8942;&#8942; handle to pick him
          up, then tap another player's handle to swap). Click a player to extend or release him.
          Team OVR/POT and your bench update as you go. The cap is {ROSTER_CAP} players.
        </HelpHint>
      </h4>
      {players.length === 0 ? (
        <p>No players on roster.</p>
      ) : (
        <>
          {(() => {
            const expiring = players.filter((p) => p.contract.expiresSeason <= league.season);
            if (expiring.length === 0) return null;
            const one = expiring.length === 1;
            return (
              <div className="alert alert-warning py-2 px-3 small mb-2">
                {one ? (
                  <><strong>{expiring[0].name}</strong> is in the final year of his deal.</>
                ) : (
                  <><strong>{expiring.length} players</strong> are in the final year of their deals.</>
                )}{" "}
                Extend {one ? "him" : "them"} before the offseason, or {one ? "he'll" : "they'll"} leave on a
                free with nothing coming back. Click a player to extend.
              </div>
            );
          })()}
          <p className="text-muted small mb-1">
            Drag a bench player onto a pitch slot to swap him into the Starting XI, or tap a
            player's &#8942;&#8942; handle to pick him up, then tap another player's handle to
            swap.
          </p>
          {selectedPid !== null && (
            <div className="alert alert-info py-1 px-2 small d-flex justify-content-between align-items-center mb-2">
              <span>
                Moving <strong>{playerMap.get(selectedPid)?.name ?? "player"}</strong>. Tap
                another player's &#8942;&#8942; handle to swap, or tap it again to cancel.
              </span>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setSelectedPid(null)}
              >
                Cancel
              </button>
            </div>
          )}
          <div className="d-flex align-items-center gap-3 mt-3 mb-1 flex-wrap">
            <h6 className="mb-0">Starting XI</h6>
            <div className="d-flex align-items-center gap-2">
              <label htmlFor="formation-select" className="form-label mb-0 small text-muted">
                Formation
              </label>
              <select
                id="formation-select"
                className="form-select form-select-sm"
                style={{ width: "auto" }}
                value={formation}
                onChange={(e) => void setFormationAction(e.target.value as FormationId)}
              >
                {FORMATION_IDS.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-muted small mb-2">
            Changing formation resets your Starting XI to the auto-picked best fit for the new shape.
          </p>
          <div className="form-check form-switch mb-2">
            <input
              className="form-check-input"
              type="checkbox"
              role="switch"
              id="depth-chart-toggle"
              checked={showDepthChart}
              onChange={(e) => setShowDepthChart(e.target.checked)}
            />
            <label className="form-check-label" htmlFor="depth-chart-toggle">
              Depth Chart
            </label>
          </div>
          <PitchField
            starters={xi}
            slots={slots}
            formation={formation}
            bench={bench}
            showDepthChart={showDepthChart}
            season={league.season}
            releasablePids={releasablePids}
            refusingPids={refusingPids}
            transferListedPids={transferListedPids}
            onRelease={releasePlayerAction}
            onExtend={extendContractAction}
            onToggleTransferListed={setTransferListedAction}
            dragOverSlotIndex={dragOverSlotIndex}
            setDragOverSlotIndex={setDragOverSlotIndex}
            onDropOnSlot={handleDropOnSlot}
            selectedPid={selectedPid}
            onTapToMove={handleTapToMove}
          />
          <RosterTable
            players={xi}
            season={league.season}
            hasStats={hasStats}
            onRelease={releasePlayerAction}
            onExtend={extendContractAction}
            releasablePids={releasablePids}
            refusingPids={refusingPids}
            transferListedPids={transferListedPids}
            onToggleTransferListed={setTransferListedAction}
            dragOverPid={dragOverPid}
            setDragOverPid={setDragOverPid}
            onSwap={handleSwap}
            selectedPid={selectedPid}
            onTapToMove={handleTapToMove}
          />
          <h6 className="mt-4">Bench</h6>
          {bench.length === 0 ? (
            <p>No other players.</p>
          ) : (
            <RosterTable
              players={bench}
              season={league.season}
              hasStats={hasStats}
              onRelease={releasePlayerAction}
              onExtend={extendContractAction}
              releasablePids={releasablePids}
              refusingPids={refusingPids}
              transferListedPids={transferListedPids}
              onToggleTransferListed={setTransferListedAction}
              moreMinutesPids={moreMinutesPids}
              onToggleMoreMinutes={setMoreMinutesAction}
              dragOverPid={dragOverPid}
              setDragOverPid={setDragOverPid}
              onSwap={handleSwap}
              selectedPid={selectedPid}
              onTapToMove={handleTapToMove}
            />
          )}
        </>
      )}
    </div>
  );
}
