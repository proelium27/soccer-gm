import type { LeagueSpec } from "../../core/competitions.js";
import {
  worldLeagueSpecs, worldTuningWarnings, suggestedBudgetScale,
} from "../../core/competitions.js";
import { NUM_TEAMS, NUM_TEAMS_D2 } from "../../core/constants.js";

/**
 * One row of the world editor. Kept as its own shape rather than a bare
 * LeagueSpec[] because the screen has to remember a shipped league the player
 * has switched *off* — it still needs to be listed so it can be switched back
 * on, and it must not reach the generated world while it's off.
 */
export interface WorldEntry {
  spec: LeagueSpec;
  included: boolean;
  /** A league the game ships. Its clubs and nationalities already exist. */
  shipped: boolean;
  /** Keep money in step with strength. See the note by the money slider. */
  linkMoney: boolean;
}

export function defaultWorldEntries(): WorldEntry[] {
  return worldLeagueSpecs().map((spec) => ({
    spec, included: true, shipped: true, linkMoney: true,
  }));
}

/** The leagues that will actually be built, in order. */
export function includedSpecs(entries: WorldEntry[]): LeagueSpec[] {
  return entries.filter((e) => e.included).map((e) => e.spec);
}

const CLUBS_PER_COUNTRY = NUM_TEAMS + NUM_TEAMS_D2;

function newLeagueEntry(index: number): WorldEntry {
  const strengthOffset = 8;
  return {
    spec: {
      country: `New Country ${index}`,
      strengthOffset,
      academyOffset: strengthOffset,
      budgetScale: suggestedBudgetScale(strengthOffset),
      cupSlots: 2,
      shieldSlots: 2,
    },
    included: true,
    shipped: false,
    linkMoney: true,
  };
}

interface Props {
  entries: WorldEntry[];
  onChange: (entries: WorldEntry[]) => void;
}

export function WorldSetup({ entries, onChange }: Props) {
  const specs = includedSpecs(entries);
  const warnings = worldTuningWarnings(specs);
  const clubs = specs.length * CLUBS_PER_COUNTRY;

  function update(index: number, next: Partial<WorldEntry>) {
    onChange(entries.map((e, i) => (i === index ? { ...e, ...next } : e)));
  }

  function updateSpec(index: number, next: Partial<LeagueSpec>) {
    const entry = entries[index];
    const spec = { ...entry.spec, ...next };
    // Money follows strength unless the player has deliberately unlinked it —
    // the pairing is what keeps the ladder from inverting over a long save.
    if (entry.linkMoney && next.strengthOffset !== undefined) {
      spec.budgetScale = suggestedBudgetScale(next.strengthOffset);
    }
    update(index, { spec });
  }

  return (
    <div className="card mb-3">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-1">
          <h5 className="mb-0">World setup</h5>
          <span className="text-muted small">
            {specs.length} {specs.length === 1 ? "league" : "leagues"}, {clubs} clubs
          </span>
        </div>
        <p className="text-muted small mb-3">
          Pick which countries your world has, or add your own. This is fixed once the
          save is created, so it's worth getting right now.
        </p>

        <ul className="list-unstyled mb-3">
          {entries.map((entry, i) => (
            <li key={`${entry.spec.country}-${i}`} className="border-top py-2">
              <div className="d-flex align-items-center gap-2">
                <input
                  type="checkbox"
                  className="form-check-input mt-0"
                  checked={entry.included}
                  id={`league-on-${i}`}
                  onChange={(e) => update(i, { included: e.target.checked })}
                />
                {entry.shipped ? (
                  <label htmlFor={`league-on-${i}`} className="flex-grow-1 mb-0">
                    {entry.spec.country}
                  </label>
                ) : (
                  <input
                    type="text"
                    className="form-control form-control-sm flex-grow-1"
                    value={entry.spec.country}
                    aria-label="Country name"
                    onChange={(e) => updateSpec(i, { country: e.target.value })}
                  />
                )}
                {!entry.shipped && (
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => onChange(entries.filter((_, j) => j !== i))}
                  >
                    Remove
                  </button>
                )}
              </div>

              {!entry.shipped && entry.included && (
                <div className="mt-2 ps-4">
                  <Slider
                    label="Strength"
                    hint="How good this league's squads are to begin with. 0 is on a level with the strongest leagues in the game; higher is weaker."
                    min={0}
                    max={20}
                    step={1}
                    value={entry.spec.strengthOffset ?? 0}
                    display={String(entry.spec.strengthOffset ?? 0)}
                    onChange={(v) => updateSpec(i, { strengthOffset: v })}
                  />
                  <Slider
                    label="Academies"
                    hint="What its clubs keep producing. Set this stronger than Strength and the league rises over the years; set it weaker and the league fades."
                    min={0}
                    max={20}
                    step={1}
                    value={entry.spec.academyOffset ?? 0}
                    display={academyLabel(entry.spec)}
                    onChange={(v) => updateSpec(i, { academyOffset: v })}
                  />
                  <Slider
                    label="Money"
                    hint="What its clubs earn and can bank, against the richest leagues at 1."
                    min={0.2}
                    max={1.2}
                    step={0.05}
                    value={entry.spec.budgetScale ?? 1}
                    display={(entry.spec.budgetScale ?? 1).toFixed(2)}
                    onChange={(v) => updateSpec(i, { budgetScale: v })}
                  />
                  <div className="form-check small mb-2">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id={`link-money-${i}`}
                      checked={entry.linkMoney}
                      onChange={(e) => {
                        const linkMoney = e.target.checked;
                        const spec = linkMoney
                          ? {
                            ...entry.spec,
                            budgetScale: suggestedBudgetScale(entry.spec.strengthOffset ?? 0),
                          }
                          : entry.spec;
                        update(i, { linkMoney, spec });
                      }}
                    />
                    <label className="form-check-label text-muted" htmlFor={`link-money-${i}`}>
                      Keep money in step with strength
                    </label>
                  </div>
                  <div className="row g-2">
                    <div className="col">
                      <label className="form-label small mb-1">Continental Cup places</label>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        min={0}
                        max={8}
                        value={entry.spec.cupSlots ?? 2}
                        onChange={(e) => updateSpec(i, { cupSlots: clampInt(e.target.value, 0, 8) })}
                      />
                    </div>
                    <div className="col">
                      <label className="form-label small mb-1">Continental Shield places</label>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        min={0}
                        max={8}
                        value={entry.spec.shieldSlots ?? 2}
                        onChange={(e) => updateSpec(i, { shieldSlots: clampInt(e.target.value, 0, 8) })}
                      />
                    </div>
                  </div>
                  <p className="text-muted small mt-2 mb-0">
                    The Shield starts where the Cup stops, so this league sends its top{" "}
                    {entry.spec.cupSlots ?? 2} to the Cup and the next{" "}
                    {entry.spec.shieldSlots ?? 2} to the Shield.
                  </p>
                </div>
              )}
            </li>
          ))}
        </ul>

        <button
          type="button"
          className="btn btn-outline-primary btn-sm"
          onClick={() => onChange([...entries, newLeagueEntry(entries.filter((e) => !e.shipped).length + 1)])}
        >
          Add a league
        </button>

        {warnings.length > 0 && (
          <div className="alert alert-warning py-2 mt-3 mb-0 small" role="alert">
            {warnings.map((w) => (
              <div key={w}>{w}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Says which way an academy setting will push the league, in words. */
function academyLabel(spec: LeagueSpec): string {
  const strength = spec.strengthOffset ?? 0;
  const academy = spec.academyOffset ?? strength;
  if (academy < strength) return `${academy} — rising`;
  if (academy > strength) return `${academy} — fading`;
  return `${academy} — steady`;
}

function clampInt(raw: string, min: number, max: number): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

interface SliderProps {
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  value: number;
  display: string;
  onChange: (value: number) => void;
}

function Slider({ label, hint, min, max, step, value, display, onChange }: SliderProps) {
  return (
    <div className="mb-2">
      <div className="d-flex justify-content-between align-items-baseline">
        <label className="form-label small mb-0">{label}</label>
        <span className="small text-muted">{display}</span>
      </div>
      <input
        type="range"
        className="form-range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="text-muted" style={{ fontSize: "0.75rem" }}>{hint}</div>
    </div>
  );
}
