import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

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

export function SportNameProvider({ children }: { children: ReactNode }) {
  const [choice, setChoice] = useState<SportChoice | null>(() => readStored());

  const term = displayTerm(choice ?? "soccer");
  const brand = `World ${term} Simulator`;

  // Keep the browser tab title in sync with the chosen brand.
  useEffect(() => {
    document.title = brand;
  }, [brand]);

  function choose(c: SportChoice) {
    localStorage.setItem(STORAGE_KEY, c);
    setChoice(c);
  }

  const value: SportNameValue = { choice, term, brand, choose };

  return (
    <SportNameContext.Provider value={value}>
      {children}
      {choice === null && <SportNamePrompt onChoose={choose} />}
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
        <h1 className="sport-name-title">Do you call it soccer or football?</h1>
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
