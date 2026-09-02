import type { Competition } from "../../core/competitions.js";
import { competitionAbbrev } from "../../core/competitions.js";
import { CountryFlag } from "./CountryFlag.js";

interface DivisionBadgeProps {
  /** The save's competition table, to resolve `compId` against. */
  competitions: Competition[];
  /** Which division the club plays in. */
  compId: number;
  /**
   * The club's position within that division, when the surface has one to
   * show. Power Rankings does; a squad list does not, and reads "D1" alone.
   */
  rank?: number;
}

/**
 * A club's division, as its country's flag plus the tier.
 *
 * Extracted from Power Rankings when the national-team squad lists wanted the
 * same marker, rather than copied: it is a small piece of markup, but it is one
 * whose two halves (the flag and the D1/D2 colour) have to agree about which
 * competition they describe, and two copies drift.
 *
 * Resolves the competition itself rather than taking one, so a caller holding
 * only a tid does not have to repeat the lookup. Unlike `competitionOf` it
 * returns null instead of throwing on a compId the save doesn't know — this is
 * display, and a badge is not worth blanking a page over. Same reasoning as
 * `ClubLink` degrading an unknown tid to plain text.
 */
export function DivisionBadge({ competitions, compId, rank }: DivisionBadgeProps) {
  const comp = competitions.find((c) => c.id === compId);
  if (!comp) return null;
  return (
    <span
      className={
        // One modifier per tier, so a deeper pyramid reads as a gradient
        // rather than collapsing everything below the top flight into one
        // colour. Anything past the deepest styled tier reuses its class.
        `division-badge division-badge--d${Math.min(comp.tier, 3)}`
      }
      title={comp.name}
    >
      <CountryFlag country={comp.country} fallback={competitionAbbrev(comp)} size={11} />
      <span>D{comp.tier}{rank !== undefined && <> #{rank}</>}</span>
    </span>
  );
}
