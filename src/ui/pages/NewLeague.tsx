import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CLUBS } from "../../core/teams/clubs.js";
import { createLeagueState } from "../../core/leagueState.js";
import { mulberry32 } from "../../engine/rng.js";
import { useLeague } from "../context/LeagueContext.js";

export function NewLeague() {
  const [selectedTid, setSelectedTid] = useState<number | null>(null);
  const { setLeague, importJSON } = useLeague();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleStart() {
    if (selectedTid === null) return;
    const rng = mulberry32(Date.now());
    const league = createLeagueState(selectedTid, rng);
    await setLeague(league);
    navigate("/dashboard");
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      await importJSON(file);
      e.target.value = "";
      navigate("/dashboard");
    }
  }

  return (
    <div className="container py-4" style={{ maxWidth: 600 }}>
      <h2 className="mb-3">New League</h2>
      <p className="text-muted">Choose your team to get started.</p>

      <div className="list-group mb-3">
        {CLUBS.map((club, i) => (
          <button
            key={club.abbrev}
            type="button"
            className={`list-group-item list-group-item-action d-flex align-items-center${
              selectedTid === i ? " active" : ""
            }`}
            onClick={() => setSelectedTid(i)}
          >
            <span
              className="color-swatch"
              style={{ background: club.colors[0] }}
            />
            <span
              className="color-swatch"
              style={{ background: club.colors[1] }}
            />
            {club.name}
          </button>
        ))}
      </div>

      <div className="d-flex gap-2">
        <button
          className="btn btn-primary"
          disabled={selectedTid === null}
          onClick={handleStart}
        >
          Start League
        </button>

        <button className="btn btn-outline-secondary" onClick={handleImportClick}>
          Import League
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="d-none"
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}
