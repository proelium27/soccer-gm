import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLeague } from "../context/LeagueContext.js";
import { useSportName } from "../sportName.js";
import { seasonYear } from "../format.js";
import { buildImportPromptText } from "../../core/teams/rosterAiPrompt.js";
import { Dropdown } from "./Dropdown.js";
import { SimTargetForm } from "./SimTargetForm.js";
import { LOGO_URL } from "../publicAsset.js";

interface TopBarProps {
  /** Toggle the mobile navigation drawer (rendered as a hamburger, mobile only). */
  onToggleNav: () => void;
}

export function TopBar({ onToggleNav }: TopBarProps) {
  const { league, simAction, simLiveAction, simming, exportJSON, importJSON, switchLeagueAction, setGodModeAction } = useLeague();
  const { brand } = useSportName();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const [promptCopied, setPromptCopied] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // The sidebar pins itself directly beneath this bar (see `.sidebar` in
  // styles.css), which needs the bar's real height rather than a guess: it runs
  // 52px on a phone and 59px on a desktop, and moves again with the user's font
  // size or a browser zoom. Measured here — the bar is the only thing that
  // knows — and republished on resize, since a stale value shows up as a strip
  // of page background between the bar and the pinned column.
  const barRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const bar = barRef.current;
    if (!bar || typeof ResizeObserver === "undefined") return;
    const publish = () => {
      document.documentElement.style.setProperty("--sg-topbar-h", `${bar.offsetHeight}px`);
    };
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(bar);
    return () => {
      ro.disconnect();
      // Back to the stylesheet's fallback, so a page rendered without this bar
      // (the manual's standalone shell) isn't left reading a stale height.
      document.documentElement.style.removeProperty("--sg-topbar-h");
    };
  }, []);

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

  // Derive the matchday bounds from the remaining schedule: the one the club is
  // standing on, and the last one of the season (the "sim to matchday" range).
  const hasSchedule = !!league && league.phase !== "offseason" && league.schedule.length > 0;
  const currentMatchday = hasSchedule
    ? Math.min(...league!.schedule.map((g) => g.matchday))
    : null;
  const lastMatchday = hasSchedule
    ? Math.max(...league!.schedule.map((g) => g.matchday))
    : null;

  let statusText = "";
  if (league) {
    statusText = `${seasonYear(league.season)}`;
    statusText += currentMatchday === null ? " — Offseason" : ` — Matchday ${currentMatchday}`;
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset so the same file can be re-imported
    e.target.value = "";
    if (!file) return;
    setImportError(null);
    try {
      await importJSON(file);
    } catch (err) {
      // A rejected import used to surface nowhere but the browser console, so a
      // bad file read as "the button does nothing".
      setImportError(err instanceof Error ? err.message : String(err));
      // The banner renders under the (sticky) top bar, so on a page scrolled
      // down it would appear off-screen and still read as nothing happening.
      window.scrollTo({ top: 0 });
    }
  }

  return (
    <>
    <nav ref={barRef} className="navbar navbar-dark app-topbar px-2 px-md-3">
      <button
        className="btn btn-sm mobile-nav-toggle d-md-none"
        type="button"
        aria-label="Open navigation menu"
        onClick={onToggleNav}
      >
        <span aria-hidden="true" className="mobile-nav-toggle-icon" />
      </button>

      <span className="navbar-brand mb-0 h1 d-flex align-items-center gap-2">
        <img src={LOGO_URL} alt="" width="32" height="32" className="rounded" />
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
          {/*
            Same matchday as "Sim One Game", watched rather than skipped. Sits
            here as well as on the Dashboard because this dropdown is the sim
            control that's reachable from every page.
          */}
          <li>
            <button className="dropdown-item" onClick={() => simLiveAction()} disabled={simDisabled}>
              Watch Next Game
            </button>
          </li>
          <li>
            <button className="dropdown-item" onClick={() => simAction("season")} disabled={simDisabled}>
              Sim to End of Season
            </button>
          </li>
          {currentMatchday !== null && lastMatchday !== null && (
            <>
              <li><hr className="dropdown-divider" /></li>
              <li>
                <SimTargetForm
                  compact
                  current={currentMatchday}
                  last={lastMatchday}
                  disabled={simDisabled}
                  onSim={(matchday) => simAction({ matchday })}
                />
              </li>
            </>
          )}
        </Dropdown>

        {/* Wide windows: the save controls sit inline. The threshold is xl
            (1200px), not md, because the inline row needs ~1020px alongside the
            brand and season label — below that it wrapped onto a second line,
            costing ~20px of height and truncating the season to "2026 — Match…".
            Found in a 914x514 CrazyGames embed, but it was equally broken in any
            narrow browser window. */}
        <div className="d-none d-xl-flex align-items-center gap-2">
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
            {promptCopied ? "Copied!" : "Copy AI Prompt to Customize"}
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

        {/* Narrower than xl: the same controls collapse into an overflow menu. */}
        <Dropdown
          className="d-xl-none"
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
              {promptCopied ? "Copied AI Prompt!" : "Copy AI Prompt to Customize"}
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

    {importError && (
      <div className="alert alert-danger rounded-0 mb-0 py-2 px-3 d-flex align-items-start gap-3" role="alert">
        <div className="flex-grow-1">
          <div>Couldn't import that file.</div>
          <div className="small">{importError}</div>
        </div>
        <button
          type="button"
          className="btn-close"
          aria-label="Dismiss"
          onClick={() => setImportError(null)}
        />
      </div>
    )}
    </>
  );
}
