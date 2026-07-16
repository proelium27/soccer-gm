import { useState } from "react";

export interface EditableTeam {
  tid: number;
  compId: number;
  name: string;
  abbrev: string;
  colors: [string, string];
}

interface Props {
  initialTeams: EditableTeam[];
  competitions: { id: number; name: string }[];
  userTid: number;
  saveLabel: string;
  savingLabel: string;
  saving: boolean;
  onSave: (teams: EditableTeam[]) => void;
  onCancel: () => void;
}

/**
 * Editable list of club identities (name/abbrev/colors), shared by the
 * Customize Teams editor on the Leagues page and the customized-league
 * creation flow on the New League page. Edits to every competition are kept
 * in state at once (so switching which one is shown never loses work) —
 * only the currently selected competition's teams are rendered.
 */
export function TeamIdentityEditor({
  initialTeams,
  competitions,
  userTid,
  saveLabel,
  savingLabel,
  saving,
  onSave,
  onCancel,
}: Props) {
  const [teams, setTeams] = useState(initialTeams);
  const userCompId = initialTeams.find((t) => t.tid === userTid)?.compId ?? competitions[0].id;
  const [activeCompId, setActiveCompId] = useState(userCompId);

  function updateTeam(tid: number, patch: Partial<EditableTeam>) {
    setTeams((ts) => ts.map((t) => (t.tid === tid ? { ...t, ...patch } : t)));
  }

  const valid = teams.every((t) => t.name.trim() !== "" && t.abbrev.trim() !== "");
  const visibleTeams = teams.filter((t) => t.compId === activeCompId);

  return (
    <>
      <select
        className="form-select form-select-sm mb-3"
        style={{ width: "auto" }}
        value={activeCompId}
        onChange={(e) => setActiveCompId(Number(e.target.value))}
      >
        {competitions.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      <div className="list-group mb-3">
        {visibleTeams.map((t) => (
          <div key={t.tid} className="list-group-item d-flex align-items-center gap-2">
            <input
              type="color"
              className="form-control form-control-color"
              title="Primary color"
              value={t.colors[0]}
              onChange={(e) => updateTeam(t.tid, { colors: [e.target.value, t.colors[1]] })}
            />
            <input
              type="color"
              className="form-control form-control-color"
              title="Secondary color"
              value={t.colors[1]}
              onChange={(e) => updateTeam(t.tid, { colors: [t.colors[0], e.target.value] })}
            />
            <input
              type="text"
              className="form-control"
              value={t.name}
              onChange={(e) => updateTeam(t.tid, { name: e.target.value })}
            />
            <input
              type="text"
              className="form-control text-uppercase"
              style={{ width: 80, flex: "0 0 auto" }}
              maxLength={3}
              value={t.abbrev}
              onChange={(e) => updateTeam(t.tid, { abbrev: e.target.value.toUpperCase() })}
            />
            {t.tid === userTid && (
              <span className="badge bg-primary" style={{ flex: "0 0 auto" }}>
                You
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="d-flex gap-2">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!valid || saving}
          onClick={() => onSave(teams)}
        >
          {saving ? savingLabel : saveLabel}
        </button>
        <button
          type="button"
          className="btn btn-outline-secondary"
          disabled={saving}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </>
  );
}
