import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Player, Position } from "../../core/players/types.js";
import type { FormationId } from "../../core/lineup/formations.js";
import { bestFit } from "../../core/lineup/selectXI.js";
import { layoutSlots } from "../pitchLayout.js";
import { useIsMobile } from "../useIsMobile.js";
import { getRatingColor } from "../utils/ratingColor.js";
import { PlayerRatingsTooltip } from "./PlayerRatingsTooltip.js";
import { PotDisplay } from "./PotDisplay.js";
import { Flag } from "./Flag.js";
import { canExtend } from "../../core/contracts.js";
import { formatWeeklyWage, seasonYear } from "../format.js";
import { previousRatings } from "./RatingDelta.js";
import { ExtendControl } from "./ExtendControl.js";

const DRAG_MIME = "application/x-soccer-gm-pid";

function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1];
}

export interface PitchFieldProps {
  starters: Player[];
  slots: Position[];
  formation: FormationId;
  bench: Player[];
  showDepthChart: boolean;
  season: number;
  releasablePids: Set<number>;
  refusingPids: Set<number>;
  transferListedPids: Set<number>;
  onRelease: (pid: number) => void;
  onExtend: (pid: number, lengthSeasons: number) => void;
  onToggleTransferListed: (pid: number, listed: boolean) => void;
  dragOverSlotIndex: number | null;
  setDragOverSlotIndex: (i: number | null) => void;
  onDropOnSlot: (slotIndex: number, draggedPid: number) => void;
  selectedPid: number | null;
  onTapToMove: (pid: number) => void;
}

export function PitchField({
  starters,
  slots,
  formation,
  bench,
  showDepthChart,
  season,
  releasablePids,
  refusingPids,
  transferListedPids,
  onRelease,
  onExtend,
  onToggleTransferListed,
  dragOverSlotIndex,
  setDragOverSlotIndex,
  onDropOnSlot,
  selectedPid,
  onTapToMove,
}: PitchFieldProps) {
  const [openPid, setOpenPid] = useState<number | null>(null);
  const coords = layoutSlots(formation);
  // On phones the pitch is drawn vertically (portrait) so the XI fills the
  // tall screen without chips clipping off the sides. The stored coordinates
  // are horizontal (x = own-goal→attack, y = touchline); rotate them a quarter
  // turn so the GK sits at the bottom and the attack points up.
  const vertical = useIsMobile();

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
    <div className={"pitch-field" + (vertical ? " pitch-field--vertical" : "")}>
      <div className="pitch-goal pitch-goal--left" />
      <div className="pitch-goal pitch-goal--right" />
      {starters.map((p, i) => {
        const coord = coords[i];
        // Visual position: horizontal uses the stored coords directly; vertical
        // rotates them (left ← y, top ← own-goal end at the bottom).
        const visualLeft = vertical ? coord.y : coord.x;
        const visualTop = vertical ? 100 - coord.x : coord.y;
        const backup = showDepthChart ? bestFit(slots[i], bench) : null;
        const isOpen = openPid === p.pid;
        const prev = previousRatings(p);
        const ovrDelta = prev ? p.ovr - prev.ovr : null;
        const horiz = visualLeft < 35 ? "left" : visualLeft > 65 ? "right" : "center";
        const vert = visualTop > 65 ? "above" : "below";
        return (
          <div
            key={p.pid}
            className={
              "pitch-slot" +
              ` pitch-slot--h-${horiz} pitch-slot--v-${vert}` +
              (dragOverSlotIndex === i ? " pitch-slot--drag-over" : "") +
              (isOpen ? " pitch-slot--open" : "")
            }
            style={{ left: `${visualLeft}%`, top: `${visualTop}%` }}
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
            <div
              className={
                "pitch-chip" +
                (p.pos === "GK" ? " pitch-chip--gk" : "") +
                (selectedPid === p.pid ? " pitch-chip--selected" : "")
              }
              style={{ borderColor: getRatingColor(p.ovr) }}
            >
              <button
                type="button"
                className="pitch-chip-handle"
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
              <button
                type="button"
                className="pitch-chip-info"
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
                {transferListedPids.has(p.pid) && (
                  <span className="pitch-chip-listed-flag" title="Listed for transfer">
                    $
                  </span>
                )}
                <span className="pitch-chip-pos">{p.pos}</span>
                <PlayerRatingsTooltip player={p}>
                  <span className="pitch-chip-name">{shortName(p.name)}</span>
                </PlayerRatingsTooltip>
                <span className="pitch-chip-ovr">
                  {p.ovr}/<PotDisplay player={p} />
                </span>
                {ovrDelta !== null && ovrDelta !== 0 && (
                  <span
                    className={
                      "pitch-chip-delta " +
                      (ovrDelta > 0 ? "pitch-chip-delta--up" : "pitch-chip-delta--down")
                    }
                    title={`${ovrDelta > 0 ? "Up" : "Down"} ${Math.abs(ovrDelta)} OVR since last season`}
                  >
                    {ovrDelta > 0 ? "▲" : "▼"}
                    {Math.abs(ovrDelta)}
                  </span>
                )}
              </button>
            </div>
            {showDepthChart && (
              <div className="pitch-chip-backup">
                {backup ? `${shortName(backup.name)} ${backup.ovr}` : "—"}
              </div>
            )}
            {isOpen && (
              <div className="pitch-chip-actions">
                <div className="pitch-chip-actions-title">
                  <Link to={`/player/${p.pid}`}>{p.name}</Link> <Flag nationality={p.nationality} /> &middot; OVR {p.ovr} / POT{" "}
                  <PotDisplay player={p} />
                </div>
                <div className="pitch-chip-actions-meta">
                  {formatWeeklyWage(p.contract.salary)} &middot;{" "}
                  {p.contract.expiresSeason <= season
                    ? "Final year"
                    : `Through ${seasonYear(p.contract.expiresSeason)}`}
                </div>
                <div className="d-flex flex-wrap gap-1 mt-2">
                  {canExtend(p, season) && (
                    refusingPids.has(p.pid) ? (
                      <span
                        className="text-muted small fst-italic text-nowrap"
                        title="He's holding out for a move to Division 1 and won't sign a new deal here."
                      >
                        Wants a move to Division 1
                      </span>
                    ) : (
                      <ExtendControl
                        player={p}
                        season={season}
                        onExtend={(pid, lengthSeasons) => {
                          onExtend(pid, lengthSeasons);
                          setOpenPid(null);
                        }}
                      />
                    )
                  )}
                  <button
                    className={
                      "btn btn-sm text-nowrap " +
                      (transferListedPids.has(p.pid) ? "btn-warning" : "btn-outline-warning")
                    }
                    onClick={() => onToggleTransferListed(p.pid, !transferListedPids.has(p.pid))}
                    title="Listing signals AI clubs you're willing to sell, making an offer more likely."
                  >
                    {transferListedPids.has(p.pid) ? "Listed for Transfer" : "List for Transfer"}
                  </button>
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
