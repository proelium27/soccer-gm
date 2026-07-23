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
}

export function emptyIntlCareer(): IntlCareer {
  return { caps: 0, goals: 0, assists: 0, tournaments: 0, titles: 0 };
}
