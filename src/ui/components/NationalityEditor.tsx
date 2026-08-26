import { useMemo, useState } from "react";
import {
  NATIONALITIES, OTHER_NATIONS, UNLISTED_NATIONALITIES,
  REST_OF_WORLD, nationalityShares, restOfWorldPreview,
  type NationalityWeights,
} from "../../core/players/nationalities.js";
import { Flag } from "./Flag.js";

/**
 * Every nation a league can be told to produce: the ones the game ships names
 * and flag art for. Anything outside this list would generate players with
 * synthesized nonsense names and an empty flag, so it is not offered — and
 * sanitizeNationalityWeights drops it on the way in besides, for tables that
 * arrive from a hand-edited roster file rather than from this control.
 */
const PICKABLE = [
  ...new Set([
    ...Object.keys(NATIONALITIES),
    ...Object.keys(OTHER_NATIONS),
    ...Object.keys(UNLISTED_NATIONALITIES),
  ]),
].sort((a, b) => a.localeCompare(b));

/**
 * The table a league starts with when nobody has touched it: everything in the
 * rest-of-world bucket, which is exactly what an added league did before this
 * control existed.
 *
 * Deliberately not a friendlier-looking invented default. The old behaviour was
 * not wrong so much as *invisible* — an added league quietly generated England's
 * distribution — and starting here with the preview on screen turns that from a
 * surprise into a number the player can see and change.
 */
export const DEFAULT_ADDED_LEAGUE_NATIONALITIES: NationalityWeights = { [REST_OF_WORLD]: 100 };

function pct(n: number): string {
  return n >= 10 ? n.toFixed(0) : n.toFixed(1);
}

export function NationalityEditor({
  value,
  onChange,
}: {
  value: NationalityWeights | undefined;
  onChange: (next: NationalityWeights) => void;
}) {
  const table = value ?? DEFAULT_ADDED_LEAGUE_NATIONALITIES;
  const [adding, setAdding] = useState(false);

  // Realized shares, not the raw numbers. A table is normalized to whatever it
  // happens to total, so a breakdown copied from a real source (they routinely
  // over-sum) yields a smaller domestic share than it states — showing the
  // resolved percentage beside the typed weight is what makes that visible.
  const shares = useMemo(() => new Map(nationalityShares(table)), [table]);
  const preview = useMemo(() => restOfWorldPreview(table, 4), [table]);

  const named = Object.keys(table).filter((c) => c !== REST_OF_WORLD);
  const restWeight = table[REST_OF_WORLD];
  const available = PICKABLE.filter((c) => !(c in table));

  // Every row at zero leaves nothing to draw against, and the league would fall
  // back to England's distribution — the silent surprise this control exists to
  // remove. It can't be prevented (a row has to be clearable to be retyped), so
  // it is said out loud instead.
  const empty = Object.values(table).every((w) => !(w > 0));

  function setWeight(nation: string, raw: string) {
    const n = Number(raw);
    onChange({ ...table, [nation]: Number.isFinite(n) && n >= 0 ? n : 0 });
  }

  function remove(nation: string) {
    const next = { ...table };
    delete next[nation];
    // Never hand back an empty table: with nothing left the draw has no weight
    // to roll against, and the league would fall back to England's distribution
    // — the very thing this control exists to stop happening silently.
    onChange(Object.keys(next).length > 0 ? next : DEFAULT_ADDED_LEAGUE_NATIONALITIES);
  }

  function add(nation: string) {
    setAdding(false);
    if (!nation || nation in table) return;
    onChange({ ...table, [nation]: 10 });
  }

  return (
    <div className="mt-3 pt-2 border-top">
      <label className="form-label small mb-1">Nationalities</label>
      <p className="text-muted mb-2" style={{ fontSize: "0.75rem" }}>
        Who this league produces — its starting squads, and every youth intake for the
        rest of the save. The numbers are relative, so use percentages, squad counts or
        anything else you like; the share beside each one is what you'll actually get.
      </p>

      <table className="table table-sm align-middle mb-1">
        <tbody>
          {named.map((nation) => (
            <tr key={nation}>
              <td className="ps-0" style={{ width: "50%" }}>
                <Flag nationality={nation} tip={false} /> {nation}
              </td>
              <td style={{ width: "6rem" }}>
                <input
                  type="number"
                  min={0}
                  className="form-control form-control-sm"
                  aria-label={`${nation} weight`}
                  value={table[nation]}
                  onChange={(e) => setWeight(nation, e.target.value)}
                />
              </td>
              <td className="text-muted text-end" style={{ width: "4rem" }}>
                {pct(shares.get(nation) ?? 0)}%
              </td>
              <td className="text-end pe-0" style={{ width: "2rem" }}>
                <button
                  type="button"
                  className="btn btn-link btn-sm p-0 text-muted"
                  aria-label={`Remove ${nation}`}
                  onClick={() => remove(nation)}
                >
                  ×
                </button>
              </td>
            </tr>
          ))}

          {restWeight !== undefined && (
            <tr>
              <td className="ps-0">
                Rest of the world
                {preview.length > 0 && (
                  <div className="text-muted" style={{ fontSize: "0.7rem" }}>
                    mostly {preview.map(([c, p]) => `${c} ${pct(p)}%`).join(", ")}
                  </div>
                )}
              </td>
              <td>
                <input
                  type="number"
                  min={0}
                  className="form-control form-control-sm"
                  aria-label="Rest of the world weight"
                  value={restWeight}
                  onChange={(e) => setWeight(REST_OF_WORLD, e.target.value)}
                />
              </td>
              <td className="text-muted text-end">{pct(shares.get(REST_OF_WORLD) ?? 0)}%</td>
              <td className="text-end pe-0">
                <button
                  type="button"
                  className="btn btn-link btn-sm p-0 text-muted"
                  aria-label="Remove rest of the world"
                  onClick={() => remove(REST_OF_WORLD)}
                >
                  ×
                </button>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {empty && (
        <p className="text-warning mb-2" style={{ fontSize: "0.75rem" }}>
          Every row is at zero, so there's nothing for this league to draw from. Leave it
          like this and it falls back to English players. Give at least one row a number.
        </p>
      )}

      {adding ? (
        <select
          className="form-select form-select-sm"
          aria-label="Add a nationality"
          defaultValue=""
          autoFocus
          onChange={(e) => add(e.target.value)}
          onBlur={() => setAdding(false)}
        >
          <option value="" disabled>Pick a nation…</option>
          {restWeight === undefined && (
            <option value={REST_OF_WORLD}>Rest of the world</option>
          )}
          {available.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      ) : (
        <button
          type="button"
          className="btn btn-link btn-sm p-0"
          onClick={() => setAdding(true)}
        >
          + Add a nationality
        </button>
      )}
    </div>
  );
}
