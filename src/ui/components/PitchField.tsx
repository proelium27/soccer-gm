import { useEffect, useState } from "react";
import type { Player, Position } from "../../core/players/types.js";
import { bestFit } from "../../core/lineup/selectXI.js";
import { layoutSlots } from "../pitchLayout.js";
import { getRatingColor } from "../utils/ratingColor.js";
import { PlayerRatingsTooltip } from "./PlayerRatingsTooltip.js";
import { Flag } from "./Flag.js";
import { canExtend, contractTerms } from "../../core/contracts.js";
import { formatWeeklyWage, seasonYear } from "../format.js";
import { previousRatings } from "./RatingDelta.js";

const DRAG_MIME = "application/x-soccer-gm-pid";

function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1];
}

export interface PitchFieldProps {
  starters: Player[];
  slots: Position[];
  bench: Player[];
  showDepthChart: boolean;
  season: number;
  releasablePids: Set<number>;
  refusingPids: Set<number>;
  onRelease: (pid: number) => void;
  onExtend: (pid: number) => void;
  dragOverSlotIndex: number | null;
  setDragOverSlotIndex: (i: number | null) => void;
  onDropOnSlot: (slotIndex: number, draggedPid: number) => void;
}

export function PitchField({
  starters,
  slots,
  bench,
  showDepthChart,
  season,
  releasablePids,
  refusingPids,
  onRelease,
  onExtend,
  dragOverSlotIndex,
  setDragOverSlotIndex,
  onDropOnSlot,
}: PitchFieldProps) {
  const [openPid, setOpenPid] = useState<number | null>(null);
  const coords = layoutSlots(slots);

  useEffect(() => {
    if (openPid === null) return;
    function handleDocClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest(".pitch-chip") && !target.closest(".pitch-chip-actions")) {
        setOpenPid(null);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenPid(null);
    }
    document.addEventListener("mousedown", handleDocClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleDocClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openPid]);

  return (
    <div className="pitch-field">
      <div className="pitch-goal pitch-goal--left" />
      <div className="pitch-goal pitch-goal--right" />
      {starters.map((p, i) => {
        const coord = coords[i];
        const backup = showDepthChart ? bestFit(slots[i], bench) : null;
        const isOpen = openPid === p.pid;
        const prev = previousRatings(p);
        const ovrDelta = prev ? p.ovr - prev.ovr : null;
        const horiz = coord.x < 35 ? "left" : coord.x > 65 ? "right" : "center";
        const vert = coord.y > 65 ? "above" : "below";
        return (
          <div
            key={p.pid}
            className={
              "pitch-slot" +
              ` pitch-slot--h-${horiz} pitch-slot--v-${vert}` +
              (dragOverSlotIndex === i ? " pitch-slot--drag-over" : "") +
              (isOpen ? " pitch-slot--open" : "")
            }
            style={{ left: `${coord.x}%`, top: `${coord.y}%` }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setDragOverSlotIndex(i);
            }}
            onDragLeave={() => setDragOverSlotIndex(null)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOverSlotIndex(null);
              const raw = e.dataTransfer.getData(DRAG_MIME);
              if (!raw) return;
              onDropOnSlot(i, Number(raw));
            }}
          >
            <button
              type="button"
              className={"pitch-chip" + (p.pos === "GK" ? " pitch-chip--gk" : "")}
              style={{ borderColor: getRatingColor(p.ovr) }}
              onClick={() => setOpenPid(isOpen ? null : p.pid)}
            >
              {canExtend(p, season) && (
                <span
                  className="pitch-chip-contract-flag"
                  title="Contract expiring — needs extending"
                >
                  !
                </span>
              )}
              <PlayerRatingsTooltip player={p}>
                <span className="pitch-chip-name">{shortName(p.name)}</span>
              </PlayerRatingsTooltip>
              <span className="pitch-chip-ovr">{p.ovr}</span>
              {ovrDelta !== null && ovrDelta !== 0 && (
                <span
                  className={
                    "pitch-chip-delta " + (ovrDelta > 0 ? "pitch-chip-delta--up" : "pitch-chip-delta--down")
                  }
                  title={`${ovrDelta > 0 ? "Up" : "Down"} ${Math.abs(ovrDelta)} OVR since last season`}
                >
                  {ovrDelta > 0 ? "▲" : "▼"}
                  {Math.abs(ovrDelta)}
                </span>
              )}
            </button>
            {showDepthChart && (
              <div className="pitch-chip-backup">
                {backup ? `${shortName(backup.name)} ${backup.ovr}` : "—"}
              </div>
            )}
            {isOpen && (
              <div className="pitch-chip-actions">
                <div className="pitch-chip-actions-title">
                  {p.name} <Flag nationality={p.nationality} /> &middot; OVR {p.ovr} / POT{" "}
                  {p.potential}
                </div>
                <div className="pitch-chip-actions-meta">
                  {formatWeeklyWage(p.contract.salary)} &middot;{" "}
                  {p.contract.expiresSeason <= season
                    ? "Final year"
                    : `Through ${seasonYear(p.contract.expiresSeason)}`}
                </div>
                <div className="d-flex gap-1 mt-2">
                  {canExtend(p, season) && (
                    refusingPids.has(p.pid) ? (
                      <span
                        className="text-muted small fst-italic text-nowrap"
                        title="He's holding out for a move to Division 1 and won't sign a new deal here."
                      >
                        Wants a move to Division 1
                      </span>
                    ) : (() => {
                      const terms = contractTerms(p, season);
                      return (
                        <button
                          className="btn btn-sm btn-outline-success text-nowrap"
                          onClick={() => {
                            onExtend(p.pid);
                            setOpenPid(null);
                          }}
                        >
                          Extend {terms.lengthSeasons}y &middot; {formatWeeklyWage(terms.salary)}
                        </button>
                      );
                    })()
                  )}
                  <button
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => {
                      onRelease(p.pid);
                      setOpenPid(null);
                    }}
                    disabled={!releasablePids.has(p.pid)}
                    title={
                      releasablePids.has(p.pid)
                        ? undefined
                        : `Can't release: squad would be too thin at ${p.pos}`
                    }
                  >
                    Release
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
