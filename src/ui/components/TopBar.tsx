import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLeague } from "../context/LeagueContext.js";
import { useSportName } from "../sportName.js";
import { seasonYear } from "../format.js";
import { buildImportPromptText } from "../../core/teams/rosterAiPrompt.js";
import { Dropdown } from "./Dropdown.js";

interface TopBarProps {
  /** Toggle the mobile navigation drawer (rendered as a hamburger, mobile only). */
  onToggleNav: () => void;
}

export function TopBar({ onToggleNav }: TopBarProps) {
  const { league, simAction, simming, exportJSON, importJSON, switchLeagueAction, setGodModeAction } = useLeague();
  const { brand } = useSportName();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const [promptCopied, setPromptCopied] = useState(false);

  function handleSwitchLeague() {
    switchLeagueAction();
    navigate("/leagues");
  }

  async function handleCopyPrompt() {
    if (!league) return;
    const prompt = buildImportPromptText(league);
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      // Clipboard can be blocked (permissions/insecure context); fall back to a download.
      const blob = new Blob([prompt], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "soccer-gm-ai-prompt.txt";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    setPromptCopied(true);
    window.setTimeout(() => setPromptCopied(false), 2000);
  }

  const isOffseason = league?.phase === "offseason";
  const simDisabled = simming || isOffseason || !league;

  // Derive current matchday from remaining schedule
  let statusText = "";
  if (league) {
    statusText = `${seasonYear(league.season)}`;
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
    <nav className="navbar navbar-dark app-topbar px-2 px-md-3">
      <button
        className="btn btn-sm mobile-nav-toggle d-md-none"
        type="button"
        aria-label="Open navigation menu"
        onClick={onToggleNav}
      >
        <span aria-hidden="true" className="mobile-nav-toggle-icon" />
      </button>

      <span className="navbar-brand mb-0 h1 d-flex align-items-center gap-2">
        <img src="/favicon.png" alt="" width="32" height="32" className="rounded" />
        <span className="d-none d-sm-inline">{brand}</span>
      </span>

      <span className="topbar-status text-light">{statusText}</span>

      <div className="d-flex align-items-center gap-2">
        <Dropdown label={simming ? "Simming..." : "Sim"} alignEnd disabled={simDisabled}>
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
        </Dropdown>

        {/* Desktop: the save controls sit inline. */}
        <div className="d-none d-md-flex align-items-center gap-2">
          <button className="btn btn-outline-light btn-sm" onClick={exportJSON} disabled={!league}>
            Export
          </button>
          <button className="btn btn-outline-light btn-sm" onClick={handleImportClick}>
            Import
          </button>
          <button className="btn btn-outline-light btn-sm" onClick={handleSwitchLeague}>
            Switch League
          </button>
          <button
            className="btn btn-outline-light btn-sm"
            onClick={handleCopyPrompt}
            disabled={!league}
            title="Copy a paste-ready prompt that teaches an AI this save's team-import format"
          >
            {promptCopied ? "Copied!" : "Copy AI Prompt"}
          </button>
          <button
            className={`btn btn-sm ${league?.godMode ? "btn-warning" : "btn-outline-light"}`}
            onClick={() => league && setGodModeAction(!league.godMode)}
            disabled={!league}
            title="Toggle God Mode: unlock guardrail-free editing for this save"
          >
            God Mode{league?.godMode ? ": On" : ""}
          </button>
        </div>

        {/* Mobile: the same controls collapse into an overflow menu. */}
        <Dropdown
          className="d-md-none"
          buttonClassName="btn btn-outline-light btn-sm topbar-more-toggle"
          ariaLabel="More actions"
          label={<span aria-hidden="true">•••</span>}
          alignEnd
        >
          <li>
            <button className="dropdown-item" onClick={exportJSON} disabled={!league}>
              Export Save
            </button>
          </li>
          <li>
            <button className="dropdown-item" onClick={handleImportClick}>
              Import Save
            </button>
          </li>
          <li>
            <button className="dropdown-item" onClick={handleSwitchLeague}>
              Switch League
            </button>
          </li>
          <li>
            <button className="dropdown-item" onClick={handleCopyPrompt} disabled={!league}>
              {promptCopied ? "Copied AI Prompt!" : "Copy AI Prompt"}
            </button>
          </li>
          <li>
            <button
              className="dropdown-item"
              onClick={() => league && setGodModeAction(!league.godMode)}
              disabled={!league}
            >
              {league?.godMode ? "Disable God Mode" : "Enable God Mode"}
            </button>
          </li>
        </Dropdown>

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
