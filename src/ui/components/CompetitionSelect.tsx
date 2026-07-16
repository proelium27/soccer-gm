import type { Competition } from "../../core/competitions.js";
import { countriesOf } from "../../core/competitions.js";

interface Props {
  competitions: Competition[];
  value: number | "all";
  onChange: (value: number | "all") => void;
  /** Adds an "All Competitions" option at the top (Finance's league-wide table filter). */
  allOption?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * A competition picker grouped by country (`<optgroup>` per country, in
 * `worldCompetitions()`'s table order), shared by every page that lets the
 * user pick which of the world's competitions to view (Standings, Awards,
 * Stat Leaders, Finance).
 */
export function CompetitionSelect({ competitions, value, onChange, allOption, className, style }: Props) {
  const countries = countriesOf(competitions);
  return (
    <select
      className={className ?? "form-select form-select-sm"}
      style={style ?? { width: "auto", display: "inline-block" }}
      value={value}
      onChange={(e) => onChange(e.target.value === "all" ? "all" : Number(e.target.value))}
    >
      {allOption && <option value="all">All Competitions</option>}
      {countries.map((country) => (
        <optgroup key={country} label={country}>
          {competitions.filter((c) => c.country === country).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
