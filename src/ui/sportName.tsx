import { createContext, useContext, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

/**
 * The user's preferred name for the sport. This is a per-device display
 * preference (like the active-league pointer) — it's global to the user, not
 * stored on any league save and not included in exports. On first launch the
 * user is asked once; the choice drives the top-left brand ("World Soccer
 * Simulator" vs "World Football Simulator") and every other brand mention.
 */
export type SportChoice = "soccer" | "football";

const STORAGE_KEY = "soccer-gm:sportName";

/** Read the stored choice, or null if the user hasn't been asked yet. */
function readStored(): SportChoice | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw === "soccer" || raw === "football" ? raw : null;
}

/** Capitalized display term, e.g. "Soccer" / "Football". */
function displayTerm(choice: SportChoice): string {
  return choice === "football" ? "Football" : "Soccer";
}

interface SportNameValue {
  /** The raw stored choice, or null before the user has picked. */
  choice: SportChoice | null;
  /** Capitalized term to render — falls back to "Soccer" before a choice. */
  term: string;
  /** The full brand, e.g. "World Soccer Simulator". */
  brand: string;
  /** Record the user's pick. */
  choose: (c: SportChoice) => void;
}

const SportNameContext = createContext<SportNameValue | null>(null);

/**
 * Pages that are just reading material and open to anyone, save or no save.
 * Someone who landed on the manual from a search result came to read it, so the
 * first thing they see shouldn't be a modal asking them to name the sport — the
 * choice keeps until they actually start a league. (It also means these pages
 * lead with their own heading rather than the prompt's.)
 */
const READING_ONLY = new Set(["/manual", "/changelog"]);

export function SportNameProvider({ children }: { children: ReactNode }) {
  const [choice, setChoice] = useState<SportChoice | null>(() => readStored());
  const { pathname } = useLocation();

  const term = displayTerm(choice ?? "soccer");
  const brand = `World ${term} Simulator`;

  // The tab title used to be set here, but it's route-dependent now (and has to
  // stay in step with the canonical/robots tags), so `useRouteSeo` in seo.ts
  // owns document.title instead. It takes `brand` as an input, so the title
  // still follows the sport-name choice.

  function choose(c: SportChoice) {
    localStorage.setItem(STORAGE_KEY, c);
    setChoice(c);
  }

  const value: SportNameValue = { choice, term, brand, choose };

  return (
    <SportNameContext.Provider value={value}>
      {children}
      {choice === null && !READING_ONLY.has(pathname) && <SportNamePrompt onChoose={choose} />}
    </SportNameContext.Provider>
  );
}

export function useSportName(): SportNameValue {
  const ctx = useContext(SportNameContext);
  if (!ctx) throw new Error("useSportName must be used within a SportNameProvider");
  return ctx;
}

/** First-run modal asking the user what they call the sport. */
function SportNamePrompt({ onChoose }: { onChoose: (c: SportChoice) => void }) {
  return (
    <div className="sport-name-backdrop">
      <div className="sport-name-modal">
        {/* h2, not h1: this is a modal over a page that has its own heading,
            and two h1s muddies what the page is actually about. Styling is on
            the class, so it looks the same. */}
        <h2 className="sport-name-title">Do you call it soccer or football?</h2>
        <p className="sport-name-sub">Your choice sets what this game is called for you.</p>
        <div className="sport-name-choices">
          <button
            type="button"
            className="btn btn-primary btn-lg sport-name-choice"
            onClick={() => onChoose("soccer")}
          >
            Soccer
          </button>
          <button
            type="button"
            className="btn btn-primary btn-lg sport-name-choice"
            onClick={() => onChoose("football")}
          >
            Football
          </button>
        </div>
      </div>
    </div>
  );
}
