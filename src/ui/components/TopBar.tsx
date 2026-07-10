import { useRef } from "react";
import { useLeague } from "../context/LeagueContext.js";

export function TopBar() {
  const { league, simAction, simming, exportJSON, importJSON } = useLeague();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isOffseason = league?.phase === "offseason";
  const simDisabled = simming || isOffseason || !league;

  // Derive current matchday from remaining schedule
  let statusText = "";
  if (league) {
    statusText = `Season ${league.season}`;
    if (league.phase === "offseason") {
      statusText += " — Offseason";
    } else if (league.schedule.length > 0) {
      const currentMatchday = Math.min(...league.schedule.map((g) => g.matchday));
      statusText += ` — Matchday ${currentMatchday}`;
    } else {
      statusText += " — Offseason";
    }
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      await importJSON(file);
      // Reset so the same file can be re-imported
      e.target.value = "";
    }
  }

  return (
    <nav className="navbar navbar-dark bg-dark px-3">
      <span className="navbar-brand mb-0 h1 d-flex align-items-center gap-2">
        <img src="/favicon.png" alt="" width="32" height="32" className="rounded" />
        Soccer GM
      </span>

      <span className="text-light">{statusText}</span>

      <div className="d-flex align-items-center gap-2">
        <div className="dropdown">
          <button
            className="btn btn-outline-light btn-sm dropdown-toggle"
            type="button"
            data-bs-toggle="dropdown"
            aria-expanded="false"
            disabled={simDisabled}
          >
            {simming ? "Simming..." : "Sim"}
          </button>
          <ul className="dropdown-menu dropdown-menu-end">
            <li>
              <button className="dropdown-item" onClick={() => simAction("game")} disabled={simDisabled}>
                Sim One Game
              </button>
            </li>
            <li>
              <button className="dropdown-item" onClick={() => simAction("month")} disabled={simDisabled}>
                Sim to End of Month
              </button>
            </li>
            <li>
              <button className="dropdown-item" onClick={() => simAction("deadline")} disabled={simDisabled}>
                Sim to Transfer Deadline
              </button>
            </li>
            <li>
              <button className="dropdown-item" onClick={() => simAction("season")} disabled={simDisabled}>
                Sim to End of Season
              </button>
            </li>
          </ul>
        </div>

        <button className="btn btn-outline-light btn-sm" onClick={exportJSON} disabled={!league}>
          Export
        </button>

        <button className="btn btn-outline-light btn-sm" onClick={handleImportClick}>
          Import
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="d-none"
          onChange={handleFileChange}
        />
      </div>
    </nav>
  );
}
