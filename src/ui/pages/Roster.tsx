import { useState } from "react";
import { useLeague } from "../context/LeagueContext.js";
import { POSITIONS } from "../../core/players/types.js";
import type { Player } from "../../core/players/types.js";
import { resolveXI } from "../../core/lineup/resolveXI.js";
import { FORMATIONS } from "../../core/lineup/formations.js";
import { computeTeamRating } from "../../core/teams/teamRating.js";
import { canExtend, contractTerms } from "../../core/contracts.js";
import { keepsDepthFloor } from "../../core/freeAgency.js";
import { RatingDelta, previousRatings } from "../components/RatingDelta.js";
import { formatWeeklyWage, seasonYear } from "../format.js";
import { PlayerRatingsTooltip } from "../components/PlayerRatingsTooltip.js";
import { PitchField } from "../components/PitchField.js";
import { Flag } from "../components/Flag.js";
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
  onExtend: (pid: number) => void;
  releasablePids: Set<number>;
  dragOverPid: number | null;
  setDragOverPid: (pid: number | null) => void;
  onSwap: (draggedPid: number, targetPid: number) => void;
}

function RosterTable({
  players,
  season,
  hasStats,
  onRelease,
  onExtend,
  releasablePids,
  dragOverPid,
  setDragOverPid,
  onSwap,
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
          <th className="text-end">Pot</th>
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
              className={dragOverPid === p.pid ? "table-active" : undefined}
              style={{ cursor: "grab" }}
              title="Drag to swap with a starter or bench player"
            >
              <td className="text-muted">&#8942;&#8942;</td>
              <td>
                <PlayerRatingsTooltip player={p}>{p.name}</PlayerRatingsTooltip>{" "}
                <Flag nationality={p.nationality} />
              </td>
              <td>{p.pos}</td>
              <td className="text-end">{season - p.born}</td>
              <td className="text-end">
                <RatingDelta value={p.ovr} previous={prev?.ovr ?? null} />
              </td>
              <td className="text-end">
                <RatingDelta value={p.potential} previous={prev?.potential ?? null} />
              </td>
              <td className="text-end">{formatWeeklyWage(p.contract.salary)}</td>
              <td className="text-end">
                {p.contract.expiresSeason <= season
                  ? "Final year"
                  : `Through ${seasonYear(p.contract.expiresSeason)}`}
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
                  {canExtend(p, season) && (() => {
                    const terms = contractTerms(p, season);
                    return (
                      <button
                        className="btn btn-sm btn-outline-success text-nowrap"
                        onClick={() => onExtend(p.pid)}
                      >
                        Extend {terms.lengthSeasons}y &middot; {formatWeeklyWage(terms.salary)}
                      </button>
                    );
                  })()}
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
  const { league, releasePlayerAction, extendContractAction, setLineupAction } = useLeague();
  const [dragOverPid, setDragOverPid] = useState<number | null>(null);
  const [dragOverSlotIndex, setDragOverSlotIndex] = useState<number | null>(null);
  const [showDepthChart, setShowDepthChart] = useState(false);

  if (!league) {
    return <p className="p-3">Loading...</p>;
  }

  const userTeam = league.teams.find((t) => t.tid === league.meta.userTid);
  if (!userTeam) {
    return <p className="p-3">Team not found.</p>;
  }

  const rosterPids = new Set(userTeam.roster);
  const players: Player[] = league.players.filter((p) =>
    rosterPids.has(p.pid),
  );

  const slots = FORMATIONS["4-3-3"];
  const xi = resolveXI(players, slots, userTeam.starters);
  const starterPids = xi.map((p) => p.pid);
  const starterPidSet = new Set(starterPids);
  const bench = sortByPosThenOvr(players.filter((p) => !starterPidSet.has(p.pid)));
  const teamRating = computeTeamRating(players, userTeam.starters);

  const hasStats = league.played.length > 0;

  const playerMap = new Map(players.map((p) => [p.pid, p]));
  const releasablePids = new Set(
    players.filter((p) => keepsDepthFloor(userTeam, playerMap, p.pid)).map((p) => p.pid),
  );

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
      </h4>
      {players.length === 0 ? (
        <p>No players on roster.</p>
      ) : (
        <>
          <p className="text-muted small mb-1">
            Drag a bench player onto a pitch slot to swap them into the Starting XI.
          </p>
          <h6 className="mt-3">Starting XI</h6>
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
            bench={bench}
            showDepthChart={showDepthChart}
            season={league.season}
            releasablePids={releasablePids}
            onRelease={releasePlayerAction}
            onExtend={extendContractAction}
            dragOverSlotIndex={dragOverSlotIndex}
            setDragOverSlotIndex={setDragOverSlotIndex}
            onDropOnSlot={handleDropOnSlot}
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
              dragOverPid={dragOverPid}
              setDragOverPid={setDragOverPid}
              onSwap={handleSwap}
            />
          )}
        </>
      )}
    </div>
  );
}
