import { flagFor } from "../../core/players/flags.js";

export function Flag({ nationality }: { nationality: string }) {
  return (
    <span className="player-flag" title={nationality} aria-label={nationality}>
      {flagFor(nationality)}
    </span>
  );
}
