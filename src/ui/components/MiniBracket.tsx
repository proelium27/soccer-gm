/**
 * A knockout bracket small enough to sit in a dashboard card.
 *
 * The full bracket on `/cup` is a CSS-grid tree (`gridRow: span 2**round`, with
 * connector styling keyed to slot percentages) and does not shrink — squeezing
 * it into a half-width card would need the geometry rebuilt, not restyled. So
 * this is a different drawing of the same thing: one short block per round, one
 * line per tie, winner in bold.
 *
 * **Played ties only.** The big bracket deliberately emits "to be decided"
 * placeholders for every unreached round, which is right on a page about the
 * competition and wrong in a panel — a card that is three quarters empty from
 * August to March reads as broken. Rounds appear here as they are played.
 *
 * Team-agnostic on purpose: the four brackets in the game are two club
 * competitions (Continental Cup, Continental Shield) and two international ones
 * (the World Cup, the confederation cups), and the only difference between them
 * is whether a side is drawn as a club or as a nation. Callers pass rendered
 * nodes, so this file needs to know about neither.
 */
import type { ReactNode } from "react";

export interface MiniBracketTie {
  /** 0 is the first knockout round played, counting up toward the final. */
  round: number;
  home: ReactNode;
  away: ReactNode;
  homeGoals: number;
  awayGoals: number;
  /** Null for a tie that is level and still to be resolved. */
  winner: "home" | "away" | null;
  pens?: { home: number; away: number } | null;
}

export function MiniBracket({
  ties,
  totalRounds,
  roundName,
  empty,
}: {
  ties: MiniBracketTie[];
  /**
   * The bracket's full depth, which is NOT the number of rounds played so far.
   * Naming a round works backwards from the final, so a bracket showing only
   * its first round has to be told how deep it goes or that round gets called
   * the final.
   */
  totalRounds: number;
  roundName: (round: number, totalRounds: number) => string;
  /** Shown when nothing has been played yet. */
  empty?: ReactNode;
}) {
  const byRound = new Map<number, MiniBracketTie[]>();
  for (const t of ties) {
    const list = byRound.get(t.round);
    if (list) list.push(t);
    else byRound.set(t.round, [t]);
  }
  const rounds = [...byRound.entries()].sort((a, b) => a[0] - b[0]);

  if (rounds.length === 0) {
    return <p className="text-muted small mb-0">{empty ?? "Not started yet."}</p>;
  }

  return (
    <div className="mini-bracket">
      {rounds.map(([round, roundTies]) => (
        <div key={round} className="mb-2">
          <div className="text-muted text-uppercase fw-semibold mini-bracket-round">
            {roundName(round, totalRounds)}
          </div>
          {roundTies.map((t, i) => (
            <div key={i} className="d-flex justify-content-between gap-2 small">
              <span className="text-truncate">
                <span className={t.winner === "home" ? "fw-semibold" : undefined}>{t.home}</span>
                {" v "}
                <span className={t.winner === "away" ? "fw-semibold" : undefined}>{t.away}</span>
              </span>
              <span className="text-nowrap">
                {t.homeGoals}-{t.awayGoals}
                {t.pens && (
                  <span className="text-muted"> ({t.pens.home}-{t.pens.away}p)</span>
                )}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
