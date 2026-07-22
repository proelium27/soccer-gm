import { useState } from "react";
import { Link } from "react-router-dom";
import { useLeague } from "../context/LeagueContext.js";
import { SKILL_KEYS, POSITIONS, type Position, type PlayerRatings } from "../../core/players/types.js";
import { NATIONALITIES } from "../../core/players/nationalities.js";
import { SKILL_LABELS } from "../components/PlayerRatingsTooltip.js";
import { TeamIdentityEditor, type EditableTeam } from "../components/TeamIdentityEditor.js";
import type { NewPlayerSpec } from "../../core/godMode.js";
import { SortableTh, useTableSort, sortRows } from "../components/SortableTable.js";

const NATION_NAMES = Object.keys(NATIONALITIES);
const flatRatings = (v: number): PlayerRatings =>
  Object.fromEntries(SKILL_KEYS.map((k) => [k, v])) as PlayerRatings;

type Tab = "create" | "roster" | "finance";

export function GodMode() {
  const league = useLeague().league;
  const [tab, setTab] = useState<Tab>("create");
  if (!league || !league.godMode) return null;

  return (
    <div className="container-fluid py-3" style={{ maxWidth: 900 }}>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="h4 m-0">God Mode</h1>
        <Link to="/roster" className="small">Back to Roster</Link>
      </div>
      <p className="text-secondary small">
        Sandbox tools — edits ignore fees, budgets, roster caps, and depth floors.
      </p>

      <ul className="nav nav-tabs mb-3">
        {(["create", "roster", "finance"] as Tab[]).map((t) => (
          <li key={t} className="nav-item">
            <button className={`nav-link ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
              {t === "create" ? "Create Player" : t === "roster" ? "Roster Builder" : "Club Finances"}
            </button>
          </li>
        ))}
      </ul>

      {tab === "create" && <CreatePlayer />}
      {tab === "roster" && <RosterBuilder />}
      {tab === "finance" && <ClubFinances />}
    </div>
  );
}

// --- Section A: Create Player ---
function CreatePlayer() {
  const { league, createPlayerAction } = useLeague();
  const [name, setName] = useState("New Player");
  const [nationality, setNationality] = useState(NATION_NAMES[0]);
  const [pos, setPos] = useState<Position>("ST");
  const [age, setAge] = useState(20);
  const [heightCm, setHeightCm] = useState(180);
  const [potential, setPotential] = useState(70);
  const [salary, setSalary] = useState(1_000_000);
  const [contractLength, setContractLength] = useState(4);
  const [ratings, setRatings] = useState<PlayerRatings>(flatRatings(50));
  const [tid, setTid] = useState<number | "fa">("fa");
  const [created, setCreated] = useState<string | null>(null);

  if (!league) return null;

  const submit = async () => {
    const spec: NewPlayerSpec = {
      name, nationality, pos, heightCm, age, ratings, potential,
      contract: { salary, expiresSeason: league.season + contractLength },
      tid: tid === "fa" ? null : tid,
    };
    await createPlayerAction(spec);
    setCreated(name);
  };

  return (
    <div>
      <div className="row g-2 mb-3">
        <div className="col-12 col-md-6">
          <label className="form-label form-label-sm">Name</label>
          <input className="form-control form-control-sm" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label form-label-sm">Nationality</label>
          <select className="form-select form-select-sm" value={nationality} onChange={(e) => setNationality(e.target.value)}>
            {NATION_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="col-6 col-md-3">
          <label className="form-label form-label-sm">Position</label>
          <select className="form-select form-select-sm" value={pos} onChange={(e) => setPos(e.target.value as Position)}>
            {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="col-6 col-md-3">
          <label className="form-label form-label-sm">Age</label>
          <input type="number" className="form-control form-control-sm" value={age} onChange={(e) => setAge(Number(e.target.value))} />
        </div>
        <div className="col-6 col-md-3">
          <label className="form-label form-label-sm">Height (cm)</label>
          <input type="number" className="form-control form-control-sm" value={heightCm} onChange={(e) => setHeightCm(Number(e.target.value))} />
        </div>
        <div className="col-6 col-md-3">
          <label className="form-label form-label-sm">Potential</label>
          <input type="number" className="form-control form-control-sm" value={potential} onChange={(e) => setPotential(Number(e.target.value))} />
        </div>
        <div className="col-6 col-md-3">
          <label className="form-label form-label-sm">Season wage (£)</label>
          <input type="number" className="form-control form-control-sm" value={salary} onChange={(e) => setSalary(Number(e.target.value))} />
        </div>
        <div className="col-6 col-md-3">
          <label className="form-label form-label-sm">Contract length (seasons)</label>
          <input type="number" className="form-control form-control-sm" value={contractLength} onChange={(e) => setContractLength(Number(e.target.value))} />
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label form-label-sm">Place on</label>
          <select
            className="form-select form-select-sm"
            value={tid === "fa" ? "fa" : String(tid)}
            onChange={(e) => setTid(e.target.value === "fa" ? "fa" : Number(e.target.value))}
          >
            <option value="fa">Free agent</option>
            {[...league.teams].sort((a, b) => a.name.localeCompare(b.name)).map((t) => (
              <option key={t.tid} value={t.tid}>{t.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="gm-panel-title">Ratings</div>
      <div className="gm-ratings-grid mb-3">
        {SKILL_KEYS.map((key) => (
          <div key={key}>
            <label className="form-label form-label-sm m-0">{SKILL_LABELS[key]}</label>
            <input
              type="number" min={0} max={100} className="form-control form-control-sm"
              value={ratings[key]}
              onChange={(e) => setRatings((r) => ({ ...r, [key]: Number(e.target.value) }))}
            />
          </div>
        ))}
      </div>

      <div className="d-flex align-items-center gap-3">
        <button className="btn btn-sm btn-warning" onClick={submit}>Create Player</button>
        {created && <span className="text-success small">Created {created}.</span>}
      </div>
    </div>
  );
}

// --- Section B: Roster Builder ---
function RosterBuilder() {
  const { league, movePlayerToClubAction, releasePlayerGodModeAction } = useLeague();
  const [tid, setTid] = useState<number | null>(null);
  const [filter, setFilter] = useState("");
  const { sort, toggle } = useTableSort<"default" | "name" | "pos" | "ovr">("default", "desc");
  if (!league) return null;

  const teamsSorted = [...league.teams].sort((a, b) => a.name.localeCompare(b.name));
  const selectedTid = tid ?? league.meta.userTid;
  const club = league.teams.find((t) => t.tid === selectedTid);
  const playerById = new Map(league.players.map((p) => [p.pid, p]));

  const rosterPlayers = sortRows(
    (club?.roster ?? [])
      .map((pid) => playerById.get(pid))
      .filter((p): p is NonNullable<typeof p> => p != null),
    sort,
    { name: (p) => p.name, pos: (p) => p.pos, ovr: (p) => p.ovr },
  );

  const rosteredPids = new Set<number>();
  for (const t of league.teams) {
    for (const pid of t.roster) rosteredPids.add(pid);
    for (const pid of t.academyRoster) rosteredPids.add(pid);
  }

  const addable = league.players
    .filter((p) => !club?.roster.includes(p.pid))
    .filter((p) => filter === "" || p.name.toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => {
      const aFa = rosteredPids.has(a.pid) ? 1 : 0;
      const bFa = rosteredPids.has(b.pid) ? 1 : 0;
      return aFa - bFa || b.ovr - a.ovr;
    })
    .slice(0, 100);

  return (
    <div>
      <div className="mb-3" style={{ maxWidth: 340 }}>
        <label className="form-label form-label-sm">Club</label>
        <select className="form-select form-select-sm" value={selectedTid} onChange={(e) => setTid(Number(e.target.value))}>
          {teamsSorted.map((t) => <option key={t.tid} value={t.tid}>{t.name}</option>)}
        </select>
      </div>

      <table className="table table-sm align-middle">
        <thead><tr>
          <SortableTh sortKey="name" sort={sort} onSort={toggle} defaultDir="asc">Player</SortableTh>
          <SortableTh sortKey="pos" sort={sort} onSort={toggle} defaultDir="asc">Pos</SortableTh>
          <SortableTh sortKey="ovr" sort={sort} onSort={toggle}>OVR</SortableTh>
          <th className="text-end">Actions</th>
        </tr></thead>
        <tbody>
          {rosterPlayers.map((p) => {
            const pid = p.pid;
            return (
              <tr key={pid}>
                <td><Link to={`/player/${pid}`}>{p.name}</Link></td>
                <td>{p.pos}</td>
                <td>{p.ovr}</td>
                <td className="text-end">
                  <select
                    className="form-select form-select-sm d-inline-block me-2" style={{ width: "auto" }}
                    value="" onChange={(e) => movePlayerToClubAction(pid, Number(e.target.value))}
                  >
                    <option value="" disabled>Move to…</option>
                    {teamsSorted.filter((t) => t.tid !== selectedTid).map((t) => (
                      <option key={t.tid} value={t.tid}>{t.name}</option>
                    ))}
                  </select>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => releasePlayerGodModeAction(pid)}>Release</button>
                </td>
              </tr>
            );
          })}
          {club && club.roster.length === 0 && (
            <tr><td colSpan={4} className="text-muted">Empty roster.</td></tr>
          )}
        </tbody>
      </table>

      <div className="gm-panel">
        <div className="gm-panel-title">Add a player to {club?.name}</div>
        <input
          className="form-control form-control-sm mb-2" placeholder="Filter by name…"
          value={filter} onChange={(e) => setFilter(e.target.value)}
        />
        <select
          className="form-select form-select-sm" value=""
          onChange={(e) => movePlayerToClubAction(Number(e.target.value), selectedTid)}
        >
          <option value="" disabled>Select a player to add…</option>
          {addable.map((p) => (
            <option key={p.pid} value={p.pid}>
              {p.name} — {p.pos} {p.ovr}{rosteredPids.has(p.pid) ? "" : " (free agent)"}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

// --- Section C: Club Finances & Identity ---
function ClubFinances() {
  const { league, setClubFinancesAction, customizeTeamsAction } = useLeague();
  const [tid, setTid] = useState<number | null>(null);
  const [budget, setBudget] = useState<number | null>(null);
  const [hype, setHype] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const [savingIdentity, setSavingIdentity] = useState(false);
  if (!league) return null;

  const teamsSorted = [...league.teams].sort((a, b) => a.name.localeCompare(b.name));
  const selectedTid = tid ?? league.meta.userTid;
  const club = league.teams.find((t) => t.tid === selectedTid)!;
  // Fall back to the club's live values until the user edits a field.
  const budgetVal = budget ?? club.budget;
  const hypeVal = hype ?? club.hype;

  const pickClub = (newTid: number) => {
    setTid(newTid);
    setBudget(null);
    setHype(null);
    setSaved(false);
  };

  const saveFinance = async () => {
    await setClubFinancesAction(selectedTid, budgetVal, hypeVal);
    setSaved(true);
  };

  const identityTeams: EditableTeam[] = league.teams.map((t) => ({
    tid: t.tid, compId: t.compId, name: t.name, abbrev: t.abbrev,
    colors: [...t.colors] as [string, string],
  }));

  return (
    <div>
      <div className="mb-3" style={{ maxWidth: 340 }}>
        <label className="form-label form-label-sm">Club</label>
        <select className="form-select form-select-sm" value={selectedTid} onChange={(e) => pickClub(Number(e.target.value))}>
          {teamsSorted.map((t) => <option key={t.tid} value={t.tid}>{t.name}</option>)}
        </select>
      </div>

      <div className="row g-2 mb-2" style={{ maxWidth: 480 }}>
        <div className="col-6">
          <label className="form-label form-label-sm">Budget (£)</label>
          <input type="number" className="form-control form-control-sm" value={budgetVal} onChange={(e) => { setBudget(Number(e.target.value)); setSaved(false); }} />
        </div>
        <div className="col-6">
          <label className="form-label form-label-sm">Hype (0–100)</label>
          <input type="number" min={0} max={100} className="form-control form-control-sm" value={hypeVal} onChange={(e) => { setHype(Number(e.target.value)); setSaved(false); }} />
        </div>
      </div>
      <div className="d-flex align-items-center gap-3 mb-4">
        <button className="btn btn-sm btn-warning" onClick={saveFinance}>Save finances</button>
        {saved && <span className="text-success small">Saved.</span>}
      </div>

      <div className="gm-panel-title">Club Identity (all competitions)</div>
      <TeamIdentityEditor
        initialTeams={identityTeams}
        competitions={league.competitions}
        userTid={league.meta.userTid}
        saveLabel="Save identities"
        savingLabel="Saving…"
        saving={savingIdentity}
        onSave={async (teams) => {
          setSavingIdentity(true);
          try {
            await customizeTeamsAction(league.lid, teams);
          } finally {
            setSavingIdentity(false);
          }
        }}
        onCancel={() => { /* no-op: editor is embedded, nothing to close */ }}
      />
    </div>
  );
}
