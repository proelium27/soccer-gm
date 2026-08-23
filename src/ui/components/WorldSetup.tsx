import { useRef, useState } from "react";
import type { LeagueSpec, Competition } from "../../core/competitions.js";
import {
  worldLeagueSpecs, worldTuningWarnings, suggestedBudgetScale,
  buildCompetitions, competitionTeamCount, worldCompetitions,
  competitionStrengthOffset, competitionBudgetScale,
} from "../../core/competitions.js";
import { NUM_TEAMS } from "../../core/constants.js";
import { MIN_DIVISION_TEAMS, MAX_DIVISION_TEAMS } from "../../core/calendar.js";
import {
  parseRosterFile, retargetRosterFile, type NamedRosterFile,
} from "../../core/teams/rosterFile.js";

/**
 * One row of the world editor. Kept as its own shape rather than a bare
 * LeagueSpec[] because the screen has to remember a shipped league the player
 * has switched *off* — it still needs to be listed so it can be switched back
 * on, and it must not reach the generated world while it's off.
 */
export interface WorldEntry {
  /**
   * Stable across edits, and used as the list key. It cannot be the country
   * name: that IS the text being edited, so keying on it remounts the input on
   * every keystroke and the field loses focus after one character.
   */
  id: string;
  spec: LeagueSpec;
  included: boolean;
  /** A league the game ships. Its clubs and nationalities already exist. */
  shipped: boolean;
  /** Keep money in step with strength. See the note by the money slider. */
  linkMoney: boolean;
  /**
   * Roster files loaded for THIS league only, in load order. Their competitions
   * are retargeted onto this league's divisions at build time, so a file written
   * for any world at all can be dropped into a league the player just invented.
   * Added leagues only — a shipped country is dressed through the world-wide
   * Import Custom League flow instead.
   */
  rosterSources?: NamedRosterFile[];
}

export function defaultWorldEntries(): WorldEntry[] {
  return worldLeagueSpecs().map((spec) => ({
    id: `shipped:${spec.country}`, spec, included: true, shipped: true, linkMoney: true,
  }));
}

/** Monotonic within a session; only ever used as a React key. */
let nextAddedId = 0;

/** The leagues that will actually be built, in order. */
export function includedSpecs(entries: WorldEntry[]): LeagueSpec[] {
  return entries.filter((e) => e.included).map((e) => e.spec);
}

/**
 * Every per-league roster file, retargeted onto the division names its league
 * will actually have in the world being built, ready to be folded together and
 * applied like any other roster import.
 *
 * Retargeting has to happen here rather than at pick time because a league's
 * division names follow its country name, and the player can still rename it
 * after loading the file.
 */
export function leagueRosterFiles(
  entries: WorldEntry[],
  competitions: Competition[],
): { files: NamedRosterFile[]; warnings: string[] } {
  const files: NamedRosterFile[] = [];
  const warnings: string[] = [];

  for (const entry of entries) {
    if (!entry.included || !entry.rosterSources?.length) continue;
    const divisions = competitions
      .filter((c) => c.country === entry.spec.country)
      .sort((a, b) => a.tier - b.tier)
      .map((c) => c.name);
    if (divisions.length === 0) continue;

    for (const source of entry.rosterSources) {
      const { file, warnings: w } = retargetRosterFile(source.file, divisions);
      files.push({ name: `${source.name} (${entry.spec.country})`, file });
      warnings.push(...w);
    }
  }
  return { files, warnings };
}

/**
 * Division sizes on offer. Even only, because the fixture generator pairs clubs
 * off each round and an odd field leaves one unpaired; capped because a division
 * of n clubs plays 2(n-1) matchdays and the season is a fixed grid.
 */
/**
 * The engine stores league strength as a HANDICAP (`strengthOffset`), where 0 is
 * level with the strongest leagues and higher is weaker. That reads backwards on
 * a slider labelled "Strength", so the control shows it flipped: the number the
 * player moves counts UP toward stronger, and only this pair of functions knows
 * about the flip.
 *
 * Deliberately a display concern rather than a change to the field. The offset's
 * direction is baked into COUNTRY_STRENGTH_OFFSET, the ladder audits and a lot
 * of documented reasoning; inverting it in the engine would be a large, risky
 * rename that buys the player nothing this doesn't.
 */
const STRENGTH_SCALE_MAX = 20;

export function strengthDial(offset: number): number {
  return STRENGTH_SCALE_MAX - offset;
}

export function strengthOffsetFromDial(dial: number): number {
  return STRENGTH_SCALE_MAX - dial;
}

const DIVISION_SIZES = Array.from(
  { length: (MAX_DIVISION_TEAMS - MIN_DIVISION_TEAMS) / 2 + 1 },
  (_, i) => MIN_DIVISION_TEAMS + i * 2,
);

function newLeagueEntry(index: number): WorldEntry {
  const strengthOffset = 8;
  return {
    id: `added:${nextAddedId++}`,
    spec: {
      // academyOffset is deliberately left unset: it falls back to strength, so
      // an added league holds its level for the life of the save exactly like
      // the shipped eight do. The field still exists on Competition and the
      // engine still reads it — there is simply no control for it, because a
      // second 0-20 slider made you do arithmetic against the first one to work
      // out which way the league was pointing.
      country: `New Country ${index}`,
      strengthOffset,
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
  const clubs = buildCompetitions(specs).reduce((n, c) => n + competitionTeamCount(c), 0);

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
            <li key={entry.id} className="border-top py-2">
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
                    min={0}
                    max={STRENGTH_SCALE_MAX}
                    step={1}
                    value={strengthDial(entry.spec.strengthOffset ?? 0)}
                    display={String(strengthDial(entry.spec.strengthOffset ?? 0))}
                    onChange={(v) => updateSpec(i, { strengthOffset: strengthOffsetFromDial(v) })}
                  />
                  <Slider
                    label="Money"
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

                  {/*
                    Sits directly under the two sliders it calibrates rather than
                    at the foot of the card: the numbers only mean anything
                    against the leagues already in the game, and a reference you
                    have to scroll away to find is one you don't use.
                  */}
                  <ShippedLeagueTable />

                  <div className="row g-2 mb-2">
                    <div className="col">
                      <label className="form-label small mb-1">Divisions</label>
                      <select
                        className="form-select form-select-sm"
                        value={entry.spec.divisions ?? 2}
                        onChange={(e) => updateSpec(i, {
                          divisions: Number(e.target.value) === 1 ? 1 : 2,
                        })}
                      >
                        <option value={2}>Two, with promotion</option>
                        <option value={1}>One, no promotion</option>
                      </select>
                    </div>
                    <div className="col">
                      <label className="form-label small mb-1">Clubs per division</label>
                      <select
                        className="form-select form-select-sm"
                        value={entry.spec.d1Teams ?? NUM_TEAMS}
                        onChange={(e) => {
                          // One control sets both divisions. The underlying
                          // fields are separate, so splitting them later is a UI
                          // change rather than a data one.
                          const n = Number(e.target.value);
                          updateSpec(i, { d1Teams: n, d2Teams: n });
                        }}
                      >
                        {DIVISION_SIZES.map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </div>
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
                  {/*
                    The only explanation the controls need. The division and
                    continental rows say what they do in their own labels and
                    options, so a paragraph restating them was just noise.
                  */}
                  <div className="text-muted mt-2" style={{ fontSize: "0.75rem" }}>
                    <p className="mb-0">
                      <strong>Strength</strong> is how good its squads are: higher is stronger, and
                      20 is level with England, Spain, Italy and Germany. <strong>Money</strong> is
                      what its clubs earn and can bank, against 1 for the richest leagues.
                    </p>
                  </div>

                  <RosterPicker
                    entry={entry}
                    onChange={(rosterSources) => update(i, { rosterSources })}
                  />
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

/**
 * Load roster files for one added league. Scoped deliberately: the file's own
 * competition names are ignored and its competitions are mapped onto THIS
 * league's divisions in order, so a file written for any world can dress a
 * league that did not exist when it was authored.
 */
function RosterPicker({
  entry,
  onChange,
}: {
  entry: WorldEntry;
  onChange: (sources: NamedRosterFile[] | undefined) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const sources = entry.rosterSources ?? [];

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (picked.length === 0) return;

    const loaded: NamedRosterFile[] = [];
    const failed: string[] = [];
    for (const file of picked) {
      try {
        loaded.push({ name: file.name, file: parseRosterFile(await file.text()) });
      } catch (err) {
        // Named rather than swallowed: a batch of files where one is the wrong
        // shape should still load the rest, and say which one didn't.
        failed.push(`${file.name} (${err instanceof Error ? err.message : "unreadable"})`);
      }
    }
    setError(failed.length > 0 ? `Couldn't read ${failed.join(", ")}` : null);
    if (loaded.length > 0) onChange([...sources, ...loaded]);
  }

  const clubs = sources.reduce(
    (n, s) => n + s.file.competitions.reduce((m, c) => m + c.clubs.length, 0),
    0,
  );

  return (
    <div className="mt-3 pt-2 border-top">
      <div className="d-flex align-items-baseline justify-content-between gap-2">
        <label className="form-label small mb-1">Clubs and squads</label>
        {sources.length > 0 && (
          <button
            type="button"
            className="btn btn-link btn-sm p-0"
            onClick={() => { onChange(undefined); setError(null); }}
          >
            Clear
          </button>
        )}
      </div>

      {sources.length === 0 ? (
        <p className="text-muted mb-2" style={{ fontSize: "0.75rem" }}>
          Leave this alone and the league gets invented clubs. Or load a roster file to
          use your own, and its first competition fills the top division. You can also
          name and colour every club by hand instead: tick <strong>Name the clubs
          yourself</strong> further down this page.
        </p>
      ) : (
        <p className="text-muted mb-2" style={{ fontSize: "0.75rem" }}>
          {sources.map((s) => s.name).join(", ")} — {clubs} {clubs === 1 ? "club" : "clubs"}.
        </p>
      )}

      <button
        type="button"
        className="btn btn-outline-secondary btn-sm"
        onClick={() => inputRef.current?.click()}
      >
        {sources.length > 0 ? "Add another file" : "Import roster"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        multiple
        className="d-none"
        onChange={handleFiles}
      />

      {error && <div className="small text-danger mt-1">{error}</div>}
    </div>
  );
}

/**
 * Where the leagues already in the game sit, so the sliders have a baseline to
 * read against rather than being bare numbers.
 *
 * Derived from the shipped competitions through the same accessors the engine
 * uses, so it cannot drift from the values it is describing.
 */
function ShippedLeagueTable() {
  const rows = worldCompetitions()
    .filter((c) => c.tier === 1)
    .map((c) => ({
      country: c.country,
      strength: strengthDial(competitionStrengthOffset(c)),
      money: competitionBudgetScale(c),
    }));

  return (
    <details className="mb-2">
      <summary className="small text-muted" style={{ cursor: "pointer" }}>
        Where the leagues already in the game sit
      </summary>
      <div className="table-responsive mt-2">
        <table className="table table-sm mb-1" style={{ fontSize: "0.8rem" }}>
          <thead>
            <tr>
              <th scope="col">League</th>
              <th scope="col" className="text-end">Strength</th>
              <th scope="col" className="text-end">Money</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.country}>
                <td>{r.country}</td>
                <td className="text-end">{r.strength}</td>
                <td className="text-end">{r.money.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-muted mb-0" style={{ fontSize: "0.75rem" }}>
        Strength 20 is the top of the game. Each point below costs a league about
        1 OVR across its squads, so a league at 10 has a champion around the
        quality of a mid-table English club. Money is against 1.00 for the
        richest leagues.
      </p>
    </details>
  );
}

function clampInt(raw: string, min: number, max: number): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

interface SliderProps {
  label: string;
  /** Optional: the world editor collects its explanations below the controls instead. */
  hint?: string;
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
      {hint && <div className="text-muted" style={{ fontSize: "0.75rem" }}>{hint}</div>}
    </div>
  );
}
