import type { Player } from "../../core/players/types.js";

export interface LoanListButtonProps {
  player: Player;
  listed: boolean;
  /** False when loaning him out would drop the squad below the depth floor at his position. */
  keepsDepthFloor: boolean;
  /** Listings are only accepted while a transfer window is open, same as the Loans page. */
  windowOpen: boolean;
  onToggle: (pid: number, listed: boolean) => void;
}

/**
 * Roster-side shortcut for the Loans page's "List for Loan": lists the player
 * for the default 1 season, or withdraws an existing listing. The duration
 * picker stays on the Loans page — this is the one-click version of the same
 * action, so both surfaces share this button rather than growing their own
 * copies of the same gates.
 */
export function LoanListButton({
  player, listed, keepsDepthFloor, windowOpen, onToggle,
}: LoanListButtonProps) {
  const blocked = !listed && (!windowOpen || !keepsDepthFloor);
  const title = !listed && !windowOpen
    ? "Loans can only be listed while a transfer window is open."
    : !listed && !keepsDepthFloor
      ? `Can't loan him out: squad would be too thin at ${player.pos}`
      : listed
        ? "He's listed for a 1 season loan. Change the duration or see offers on the Loans page."
        : "Lists him for a 1 season loan so AI clubs can make an offer. Pick a longer loan on the Loans page.";

  return (
    <button
      className={"btn btn-sm text-nowrap " + (listed ? "btn-info" : "btn-outline-info")}
      onClick={() => onToggle(player.pid, !listed)}
      disabled={blocked}
      title={title}
    >
      {listed ? "Listed for Loan" : "List for Loan"}
    </button>
  );
}
