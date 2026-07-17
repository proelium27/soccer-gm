import { useState } from "react";
import { contractTerms } from "../../core/contracts.js";
import { EXTENSION_LENGTH_USER_MIN, EXTENSION_LENGTH_USER_MAX } from "../../core/constants.js";
import type { Player } from "../../core/players/types.js";
import { formatWeeklyWage } from "../format.js";

const LENGTH_OPTIONS = Array.from(
  { length: EXTENSION_LENGTH_USER_MAX - EXTENSION_LENGTH_USER_MIN + 1 },
  (_, i) => EXTENSION_LENGTH_USER_MIN + i,
);

export interface ExtendControlProps {
  player: Player;
  season: number;
  onExtend: (pid: number, lengthSeasons: number) => void;
}

/** Lets the user pick a 1-4 season extension length instead of the age-based default. */
export function ExtendControl({ player, season, onExtend }: ExtendControlProps) {
  const defaultLength = contractTerms(player, season).lengthSeasons;
  const [length, setLength] = useState(defaultLength);
  const terms = contractTerms(player, season, length);

  return (
    <div className="d-inline-flex gap-1 align-items-center">
      <select
        className="form-select form-select-sm w-auto"
        value={length}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setLength(Number(e.target.value))}
        aria-label="Extension length"
      >
        {LENGTH_OPTIONS.map((yrs) => (
          <option key={yrs} value={yrs}>
            {yrs}y
          </option>
        ))}
      </select>
      <button
        className="btn btn-sm btn-outline-success text-nowrap"
        onClick={(e) => {
          e.stopPropagation();
          onExtend(player.pid, length);
        }}
      >
        Extend &middot; {formatWeeklyWage(terms.salary)}
      </button>
    </div>
  );
}
