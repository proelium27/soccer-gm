import { useState } from "react";
import { Link } from "react-router-dom";
import { useLeague } from "../context/LeagueContext.js";
import { computeStandings } from "../../core/standings.js";
import { transferWindowState } from "../../core/transfers/window.js";
import { SCOUTING_SPEND_MAX } from "../../core/constants.js";
import { currency } from "../format.js";

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function Dashboard() {
  const { league, simAction, offseasonAction, setScoutingSpendAction, simming } = useLeague();
  // Slider position while dragging; persisted (and clamped) only on release
  // so we don't write to IndexedDB on every drag tick.
  const [scoutingDraft, setScoutingDraft] = useState<number | null>(null);

  if (!league) {
    return <p className="p-3">Loading...</p>;
  }

  const userTeam = league.teams.find((t) => t.tid === league.meta.userTid);
  if (!userTeam) {
    return <p className="p-3">Team not found.</p>;
  }

  const commitScoutingDraft = async () => {
    if (scoutingDraft === null) return;
    // Persist first, then drop the draft, so the slider never flashes the
    // stale stored value while the save is in flight.
    await setScoutingSpendAction(scoutingDraft);
    setScoutingDraft(null);
  };

  // Compute standings and find user's row
  const standings = computeStandings(
    league.teams.map((t) => t.tid),
    league.played,
  );
  const userRow = standings.find((r) => r.tid === league.meta.userTid);
  const leaguePosition =
    standings.findIndex((r) => r.tid === league.meta.userTid) + 1;

  // Next match: lowest matchday in schedule, find user's fixture
  let nextMatchInfo: React.ReactNode;
  if (league.schedule.length === 0) {
    nextMatchInfo = <span>Season Complete</span>;
  } else {
    const minMatchday = Math.min(
      ...league.schedule.map((g) => g.matchday),
    );
    const userFixture = league.schedule.find(
      (g) =>
        g.matchday === minMatchday &&
        (g.home === league.meta.userTid || g.away === league.meta.userTid),
    );
    if (userFixture) {
      const isHome = userFixture.home === league.meta.userTid;
      const opponentTid = isHome ? userFixture.away : userFixture.home;
      const opponent = league.teams.find((t) => t.tid === opponentTid);
      nextMatchInfo = (
        <span>
          {isHome ? "vs" : "@"} {opponent?.name ?? "Unknown"} (Matchday{" "}
          {minMatchday})
        </span>
      );
    } else {
      nextMatchInfo = <span>Bye (Matchday {minMatchday})</span>;
    }
  }

  const disableSim = simming || league.phase === "offseason";

  return (
    <div className="container-fluid p-3">
      {/* Team header */}
      <div className="card mb-3">
        <div className="card-body">
          <h4 className="card-title d-flex align-items-center gap-2">
            <span
              className="color-swatch"
              style={{ backgroundColor: userTeam.colors[0] }}
            />
            <span
              className="color-swatch"
              style={{ backgroundColor: userTeam.colors[1] }}
            />
            {userTeam.name}
          </h4>
        </div>
      </div>

      {/* Current record */}
      <div className="card mb-3">
        <div className="card-body">
          <h5 className="card-title">Current Record</h5>
          {userRow && userRow.played > 0 ? (
            <p className="card-text mb-0">
              {userRow.won}W - {userRow.drawn}D - {userRow.lost}L &middot;{" "}
              {userRow.points} pts &middot; {ordinal(leaguePosition)} in league
            </p>
          ) : (
            <p className="card-text mb-0">No matches played yet</p>
          )}
        </div>
      </div>

      {/* Finances */}
      <div className="card mb-3">
        <div className="card-body">
          <h5 className="card-title">Finances</h5>
          <p className="card-text mb-2">
            Budget: {currency.format(userTeam.budget)} &middot; Hype: {Math.round(userTeam.hype)}/100
          </p>
          <p className="card-text mb-2">
            {(() => {
              const ws = transferWindowState(league);
              return ws.open ? (
                <>
                  {ws.window === "summer" ? "Summer" : "Winter"} transfer window{" "}
                  <strong>open</strong> &middot; <Link to="/transfers">Go to Transfers</Link>
                </>
              ) : (
                <>Transfer window closed</>
              );
            })()}
          </p>
          <label className="form-label mb-1" htmlFor="scouting-spend">
            Scouting spend this season: {currency.format(scoutingDraft ?? userTeam.scoutingSpend)}
          </label>
          <input
            id="scouting-spend"
            type="range"
            className="form-range"
            min={0}
            max={SCOUTING_SPEND_MAX}
            step={100_000}
            value={scoutingDraft ?? userTeam.scoutingSpend}
            disabled={simming}
            onChange={(e) => setScoutingDraft(Number(e.target.value))}
            onPointerUp={commitScoutingDraft}
            onBlur={commitScoutingDraft}
          />
        </div>
      </div>

      {/* Next match */}
      <div className="card mb-3">
        <div className="card-body">
          <h5 className="card-title">Next Match</h5>
          <p className="card-text mb-0">{nextMatchInfo}</p>
        </div>
      </div>

      {/* Sim controls */}
      <div className="card">
        <div className="card-body">
          <h5 className="card-title">Simulation</h5>
          <div className="btn-group" role="group">
            <button
              className="btn btn-primary"
              disabled={disableSim}
              onClick={() => simAction("game")}
            >
              Sim One Game
            </button>
            <button
              className="btn btn-primary"
              disabled={disableSim}
              onClick={() => simAction("month")}
            >
              Sim to End of Month
            </button>
            <button
              className="btn btn-primary"
              disabled={disableSim}
              onClick={() => simAction("deadline")}
            >
              Sim to Transfer Deadline
            </button>
            <button
              className="btn btn-primary"
              disabled={disableSim}
              onClick={() => simAction("season")}
            >
              Sim to End of Season
            </button>
          </div>
        </div>
      </div>

      {/* Offseason */}
      {league.phase === "offseason" && (
        <div className="card mt-3">
          <div className="card-body">
            <h5 className="card-title">Offseason</h5>
            <p className="card-text">
              Season {league.season} is complete. Advancing will run player
              progression, retirements, AI free agency, and youth intake, then
              start Season {league.season + 1}.
            </p>
            <button
              className="btn btn-success"
              disabled={simming}
              onClick={() => offseasonAction()}
            >
              Advance to Season {league.season + 1}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
