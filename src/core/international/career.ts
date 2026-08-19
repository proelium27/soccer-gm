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
  /** World Cups named in a squad for (not appearances). */
  tournaments: number;
  /** World Cups won. */
  titles: number;
  /**
   * Continental championships named in a squad for, and won.
   *
   * Deliberately their own counters rather than folded into the two above. Those
   * two have meant "World Cups" since they shipped, and the Frivolities
   * International board and the GOAT formula already rank careers on them — so
   * adding a second, easier trophy to the same number would silently restate
   * every existing all-time record. Optional because saves predating continental
   * football have neither (absent reads as zero everywhere).
   */
  continentalTournaments?: number;
  continentalTitles?: number;
  /**
   * The same caps/goals/assists broken out per campaign, so a profile can show
   * a season-by-season international record the way it shows league and cup
   * seasons. One line per campaign played: a qualifying offseason adds a
   * "qualifying" line, a World Cup offseason a "tournament" line (its four
   * stages all merge into the one line), and the offseason that stages the
   * continental championships adds a "continental" line alongside its
   * qualifying one. Empty on saves from before this was
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
  /**
   * Which campaign this line covers. A continental offseason produces *two*
   * lines for the same season — its qualifying leg and the championship — which
   * is why anything reading these must sum every line for a season rather than
   * taking the first one it finds.
   */
  kind: "qualifying" | "tournament" | "continental";
  caps: number;
  goals: number;
  assists: number;
}

export function emptyIntlCareer(): IntlCareer {
  return {
    caps: 0, goals: 0, assists: 0, tournaments: 0, titles: 0,
    continentalTournaments: 0, continentalTitles: 0, seasons: [],
  };
}
