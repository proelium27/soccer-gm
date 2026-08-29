import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLeague } from "../../context/LeagueContext.js";
import type { Player } from "../../../core/players/types.js";
import { FORMATIONS, FORMATION_IDS, type FormationId } from "../../../core/lineup/formations.js";
import { resolveXI } from "../../../core/lineup/resolveXI.js";
import { swapStarters } from "../../../core/lineup/swapStarters.js";
import { editableSquad, displaySquad } from "../../../core/international/index.js";
import { INTL_SQUAD_SIZE, INTL_MIN_KEEPERS } from "../../../core/constants.js";
import { layoutSlots } from "../../pitchLayout.js";
import { getRatingColor } from "../../utils/ratingColor.js";
import { InjuryBadge } from "../../components/InjuryBadge.js";
import { PlayerRatingsTooltip } from "../../components/PlayerRatingsTooltip.js";
import { sortByPosThenOvr } from "../Roster.js";
import { NationalTeamsLayout, NationName } from "./shared.js";

const DRAG_MIME = "application/x-soccer-gm-pid";

/** Surname only, so a chip fits on the pitch. Same trick the award XI uses. */
function shortName(name: string): string {
  const parts = name.split(" ");
  return parts.length > 1 ? parts[parts.length - 1] : name;
}

/**
 * Pick your country's squad and your eleven.
 *
 * The eleven is stored and validated exactly as a club lineup is — `starters`
 * on the squad, `resolveXI` at match time, `isValidStarters` at the action
 * layer — so a national XI behaves the same as a club one, including falling
 * back to the auto-pick when a chosen player retires or gets hurt mid-cycle.
 *
 * Editing is only offered while a campaign is actually pending, because that is
 * the only time a change can reach a match: `editableSquad` follows the staged
 * campaign, and between campaigns the page shows the last squad read-only
 * rather than letting the user arrange an eleven that will never be fielded.
 */
export function NTMySquad() {
  const {
    league, setNationalSquadAction, setNationalLineupAction,
    setNationalFormationAction, autoPickNationalXIAction, simming,
  } = useLeague();
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
  const [selectedPid, setSelectedPid] = useState<number | null>(null);

  const byPid = useMemo(
    () => new Map((league?.players ?? []).map((p) => [p.pid, p])),
    [league?.players],
  );
  const clubByPid = useMemo(() => {
    const map = new Map<number, string>();
    for (const t of league?.teams ?? []) {
      for (const pid of t.roster) map.set(pid, t.name);
      for (const pid of t.academyRoster) map.set(pid, `${t.name} (academy)`);
    }
    return map;
  }, [league?.teams]);

  const nation = league?.nationalManager.nation ?? null;

  // Everyone this country could pick from, whether called up or not.
  const pool = useMemo(
    () => (nation && league ? league.players.filter((p) => p.nationality === nation) : []),
    [league, nation],
  );

  // Which squad is on screen, and whether it can be edited. Cheap (a scan of a
  // few arrays), but it feeds the expensive memo below, so it needs a stable
  // identity across the drag re-renders.
  const shown = useMemo(() => {
    if (!league || !nation) return null;
    const editable = editableSquad(league.international, nation);
    const found = editable ?? displaySquad(league.international, nation);
    return found ? { found, locked: editable === null } : null;
  }, [league, nation]);

  /*
    Memoized, and not merely for tidiness: `onDragOver` calls `setDragOverSlot`
    on every dragover event, so anything left in the render body re-runs for
    every pixel of a drag. That would re-resolve the XI (selectXI's pairwise
    assignment plus its improvement loop) and re-sort both tables against the
    whole nation's pool, dozens of times a second. Roster.tsx carries the same
    warning for the same reason.
  */
  const derived = useMemo(() => {
    const squad = shown?.found.squad;
    if (!squad) return null;
    const named = squad.pids
      .map((pid) => byPid.get(pid))
      .filter((p): p is Player => p !== undefined);
    const namedSet = new Set(named.map((p) => p.pid));
    const slots = FORMATIONS[squad.formation];
    const xi = resolveXI(named, slots, squad.starters ?? null);
    const xiSet = new Set(xi.map((p) => p.pid));
    return {
      named,
      slots,
      xi,
      xiPids: xi.map((p) => p.pid),
      xiSet,
      reserves: sortByPosThenOvr(named.filter((p) => !xiSet.has(p.pid))),
      // Your own squad groups by position, the way a team sheet does. The pool
      // of everyone else is sorted by rating instead: it runs to hundreds of
      // players, and by position it opens with every goalkeeper in the country
      // before the first outfielder worth calling up. The question this column
      // answers is "who is the best player I'm not taking".
      uncalled: pool
        .filter((p) => !namedSet.has(p.pid))
        .sort((a, b) => b.ovr - a.ovr || a.pid - b.pid),
      coords: layoutSlots(squad.formation),
      keepers: named.filter((p) => p.pos === "GK").length,
    };
  }, [shown, byPid, pool]);

  if (!league) return <p className="p-3">Loading...</p>;

  if (!nation) {
    return (
      <NationalTeamsLayout title="My Squad">
        <p className="text-muted">
          You don't manage a national team. Countries get in touch over the summer, and
          anything on the table is on the{" "}
          <Link to="/national-teams/federation">Federation</Link> page.
        </p>
      </NationalTeamsLayout>
    );
  }

  if (!shown || !derived) {
    return (
      <NationalTeamsLayout title="My Squad">
        <p className="text-muted">
          <NationName nation={nation} /> haven't named a squad yet. One is picked for you
          the moment a campaign is drawn, at the end of the season, and you can change it
          from here before the first match.
        </p>
      </NationalTeamsLayout>
    );
  }

  const { squad, competition } = shown.found;
  const { locked } = shown;
  const { named, slots, xi, xiPids, xiSet, reserves, uncalled, coords, keepers } = derived;

  function handleSwap(draggedPid: number, targetPid: number) {
    if (locked) return;
    const next = swapStarters(named, slots, xiPids, draggedPid, targetPid);
    if (!next) return;
    void setNationalLineupAction(next);
  }

  // Tap-to-swap for touch devices, where HTML5 drag never fires — the same
  // fallback the club Roster page offers.
  function handleTap(pid: number) {
    if (locked) return;
    if (selectedPid === null) setSelectedPid(pid);
    else if (selectedPid === pid) setSelectedPid(null);
    else {
      handleSwap(selectedPid, pid);
      setSelectedPid(null);
    }
  }

  function callUp(pid: number) {
    if (locked || squad.pids.length >= INTL_SQUAD_SIZE) return;
    void setNationalSquadAction([...squad.pids, pid]);
  }

  function drop(pid: number) {
    if (locked) return;
    void setNationalSquadAction(squad.pids.filter((x) => x !== pid));
  }

  const playerRow = (p: Player, action: "drop" | "call") => (
    <tr
      key={p.pid}
      className={xiSet.has(p.pid) ? "row-selected" : undefined}
      // Squad rows are drag sources and drop targets, which is the only way a
      // reserve reaches the eleven: the pitch chips can only trade places with
      // each other. `swapStarters` already covers bench-to-XI both ways, so this
      // is the same one call the pitch uses.
      draggable={!locked && action === "drop"}
      onDragStart={(e) => e.dataTransfer.setData(DRAG_MIME, String(p.pid))}
      onDragOver={(e) => {
        if (locked || action !== "drop") return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onDrop={(e) => {
        if (locked || action !== "drop") return;
        e.preventDefault();
        const raw = e.dataTransfer.getData(DRAG_MIME);
        if (raw) handleSwap(Number(raw), p.pid);
      }}
    >
      <td>
        {!locked && action === "drop" && (
          <button
            type="button"
            className="pitch-chip-handle me-1"
            aria-label={selectedPid === p.pid ? "Cancel move" : "Move player"}
            title="Drag onto a shirt, or tap this and then another player to swap them"
            onClick={() => handleTap(p.pid)}
          >
            &#8942;&#8942;
          </button>
        )}
        {p.pos}
      </td>
      <td>
        <PlayerRatingsTooltip player={p}>
          <Link to={`/player/${p.pid}`}>{p.name}</Link>
        </PlayerRatingsTooltip>
        {p.injury && <> <InjuryBadge player={p} /></>}
      </td>
      <td className="small text-muted">{clubByPid.get(p.pid) ?? "Free agent"}</td>
      <td className="text-end">{league.season - p.born}</td>
      <td className="text-end fw-semibold" style={{ color: getRatingColor(p.ovr) }}>{p.ovr}</td>
      <td className="text-end">{p.intl?.caps ?? 0}</td>
      <td className="text-end">
        {!locked && (action === "drop" ? (
          <button
            className="btn btn-outline-secondary btn-sm py-0"
            disabled={simming || named.length <= 11 || (p.pos === "GK" && keepers <= INTL_MIN_KEEPERS)}
            title={
              p.pos === "GK" && keepers <= INTL_MIN_KEEPERS
                ? "You have to take a goalkeeper"
                : named.length <= 11
                  ? "You need eleven players"
                  : "Leave him out"
            }
            onClick={() => drop(p.pid)}
          >
            Drop
          </button>
        ) : (
          <button
            className="btn btn-outline-primary btn-sm py-0"
            disabled={simming || squad.pids.length >= INTL_SQUAD_SIZE}
            title={squad.pids.length >= INTL_SQUAD_SIZE ? `Your squad is full at ${INTL_SQUAD_SIZE}` : "Call him up"}
            onClick={() => callUp(p.pid)}
          >
            Call up
          </button>
        ))}
      </td>
    </tr>
  );

  const squadTable = (rows: Player[], action: "drop" | "call") => (
    <table className="table table-sm table-striped mb-0">
      <thead>
        <tr>
          <th>Pos</th>
          <th>Player</th>
          <th>Club</th>
          <th className="text-end">Age</th>
          <th className="text-end">Ovr</th>
          <th className="text-end">Caps</th>
          <th />
        </tr>
      </thead>
      <tbody>{rows.map((p) => playerRow(p, action))}</tbody>
    </table>
  );

  return (
    <NationalTeamsLayout title="My Squad">
      <div className="d-flex flex-wrap align-items-center gap-3 mb-2">
        <h5 className="mb-0"><NationName nation={nation} /></h5>
        <span className="text-muted small">
          {locked ? "Last named for" : "Picking for"} {competition}
        </span>
        {!locked && (
          <>
            <select
              className="form-select form-select-sm w-auto"
              value={squad.formation}
              disabled={simming}
              onChange={(e) => setNationalFormationAction(e.target.value as FormationId)}
            >
              {FORMATION_IDS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <button
              className="btn btn-outline-primary btn-sm"
              disabled={simming}
              onClick={() => autoPickNationalXIAction()}
            >
              Best XI
            </button>
          </>
        )}
        <span className="text-muted small ms-auto">
          {named.length} of {INTL_SQUAD_SIZE} called up
        </span>
      </div>

      {locked ? (
        <p className="text-muted small">
          Nothing to pick for right now. Your squad is named for you when a campaign is
          drawn at the end of a season, and you can change it from here before the first
          match of that summer.
        </p>
      ) : (
        <p className="text-muted small">
          Drag a player onto a shirt to put him there, from the pitch or from your squad list
          below, or tap the handle on two players to swap them. Keepers can only go in goal.
          If anyone you picked can't play on the day,
          injured or retired since you named him, the game picks that whole eleven for you
          rather than field ten, so it's worth looking in again between rounds.
        </p>
      )}

      <div className="pitch-field mb-3">
        <div className="pitch-goal pitch-goal--left" />
        <div className="pitch-goal pitch-goal--right" />
        {xi.map((p, i) => {
          const coord = coords[i];
          if (!coord) return null;
          return (
            <div
              key={p.pid}
              className={
                "pitch-slot" + (dragOverSlot === i ? " pitch-slot--drag-over" : "")
              }
              style={{ left: `${coord.x}%`, top: `${coord.y}%` }}
              onDragOver={(e) => {
                if (locked) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDragOverSlot(i);
              }}
              onDragLeave={() => setDragOverSlot(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverSlot(null);
                const raw = e.dataTransfer.getData(DRAG_MIME);
                if (raw) handleSwap(Number(raw), p.pid);
              }}
            >
              <PlayerRatingsTooltip player={p}>
                <span
                  className={
                    "pitch-chip" +
                    (p.pos === "GK" ? " pitch-chip--gk" : "") +
                    (selectedPid === p.pid ? " pitch-chip--selected" : "")
                  }
                  style={{ borderColor: getRatingColor(p.ovr) }}
                  draggable={!locked}
                  onDragStart={(e) => e.dataTransfer.setData(DRAG_MIME, String(p.pid))}
                >
                  {!locked && (
                    <button
                      type="button"
                      className="pitch-chip-handle"
                      aria-label={selectedPid === p.pid ? "Cancel move" : "Move player"}
                      onClick={(e) => { e.stopPropagation(); handleTap(p.pid); }}
                    >
                      &#8942;&#8942;
                    </button>
                  )}
                  <span className="pitch-chip-name">{shortName(p.name)}</span>
                  <span className="pitch-chip-ovr">{p.ovr}</span>
                </span>
              </PlayerRatingsTooltip>
            </div>
          );
        })}
      </div>

      <div className="row g-3">
        <div className="col-12 col-lg-6">
          <h6>Your squad</h6>
          <div className="table-responsive" style={{ maxHeight: "60vh", overflowY: "auto" }}>
            {squadTable([...xi, ...reserves], "drop")}
          </div>
        </div>
        <div className="col-12 col-lg-6">
          <h6>Everyone else who's eligible</h6>
          {uncalled.length === 0 ? (
            <p className="text-muted small">
              Everyone eligible is already in your squad.
            </p>
          ) : (
            <div className="table-responsive" style={{ maxHeight: "60vh", overflowY: "auto" }}>
              {squadTable(uncalled, "call")}
            </div>
          )}
        </div>
      </div>
    </NationalTeamsLayout>
  );
}
