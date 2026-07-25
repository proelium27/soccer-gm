/**
 * A player's international career record.
 *
 * Deliberately its own module with no imports: it hangs off `Player`, and the
 * rest of core/international pulls in the lineup and cup layers, which in turn
 * depend on `Player`. Keeping this leaf-level avoids an import cycle between
 * the player model and the international feature that sits on top of it.
 */
export interface IntlCareer {
  /** Appearances for the national team, qualifying and tournament alike. */
  caps: number;
  goals: number;
  assists: number;
  /** Tournaments named in a squad for (not appearances). */
  tournaments: number;
  /** Tournaments won. */
  titles: number;
  /**
   * The same caps/goals/assists broken out per campaign, so a profile can show
   * a season-by-season international record the way it shows league and cup
   * seasons. One line per offseason played: a qualifying offseason adds a
   * "qualifying" line, a tournament offseason a "tournament" line (its four
   * stages all merge into the one line). Empty on saves from before this was
   * tracked — the totals above stay the authoritative career record.
   */
  seasons: IntlSeasonLine[];
}

/**
 * One offseason of international football for one player. `season` is the club
 * season whose offseason played it, matching how every other season-stamped
 * record in the game is labelled.
 */
export interface IntlSeasonLine {
  season: number;
  kind: "qualifying" | "tournament";
  caps: number;
  goals: number;
  assists: number;
}

export function emptyIntlCareer(): IntlCareer {
  return { caps: 0, goals: 0, assists: 0, tournaments: 0, titles: 0, seasons: [] };
}
