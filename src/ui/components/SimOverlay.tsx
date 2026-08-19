import { useEffect, useRef, useState } from "react";
import type { StoredTeam } from "../../core/teams/clubs.js";
import type { SimProgress } from "../useSimWorker.js";
import type { PlayedMatch } from "../../core/standings.js";
import type { CupTie } from "../../core/cup/types.js";
import { cupRoundName } from "../../core/cup/cup.js";
import { CUP_NAME } from "../../core/constants.js";

interface SimOverlayProps {
  open: boolean;
  teams: StoredTeam[];
  queue: SimProgress[];
  done: boolean;
  userTid: number;
  onComplete: () => void;
}

function teamLabel(teams: StoredTeam[], tid: number): string {
  const t = teams.find((team) => team.tid === tid);
  return t?.abbrev ?? t?.name ?? `#${tid}`;
}

function userGame(md: SimProgress | undefined, userTid: number): PlayedMatch | undefined {
  return md?.results.find((r) => r.home === userTid || r.away === userTid);
}

// One card in the ticker: the user's league match, the user's cup tie, or — when
// a cup round is played on a matchday the user's club isn't in — a compact
// marker so the tournament is still visible in the animation.
export type TickerItem =
  | { kind: "league"; game: PlayedMatch }
  | { kind: "cup"; tie: CupTie; label: string; sub: string }
  | { kind: "cup-marker"; label: string; sub: string; matchday: number };

/**
 * What the ticker shows for one simmed matchday. Exported for tests: the
 * user-country pick below is exactly the sort of thing that looks right in
 * review and is wrong in play (it shipped showing every manager England's cup).
 */
export function tickerItemsFor(md: SimProgress, userTid: number): TickerItem[] {
  const items: TickerItem[] = [];
  const league = userGame(md, userTid);
  if (league) items.push({ kind: "league", game: league });

  const userTie = md.cupTies.find((t) => t.home === userTid || t.away === userTid);
  if (userTie) {
    items.push({ kind: "cup", tie: userTie, label: CUP_NAME, sub: cupRoundName(userTie.round) });
  } else if (md.cupTies.length > 0) {
    const t = md.cupTies[0];
    items.push({
      kind: "cup-marker", label: CUP_NAME, sub: cupRoundName(t.round), matchday: t.matchday,
    });
  }

  // Domestic cups carry their own name and round label, because a round index
  // alone means different things in different cups (and in different countries'
  // cups, which may be at different stages on the same matchday).
  const domestic = md.domesticTies ?? [];
  const userDomestic = domestic.find((d) => d.tie.home === userTid || d.tie.away === userTid);
  if (userDomestic) {
    items.push({
      kind: "cup", tie: userDomestic.tie, label: userDomestic.cupName, sub: userDomestic.roundName,
    });
  } else {
    // His club isn't playing a tie today (out of the cup, or given a bye), so
    // show his OWN country's cup as the marker. Taking the first tie instead
    // showed a German save "English Cup", since the ties arrive in
    // competition-table order and England leads it.
    const d = domestic.find((x) => x.isUserCountry);
    if (d) {
      items.push({
        kind: "cup-marker", label: d.cupName, sub: d.roundName, matchday: d.tie.matchday,
      });
    }
  }
  return items;
}

export function SimOverlay({ open, teams, queue, done, userTid, onComplete }: SimOverlayProps) {
  const [mdIndex, setMdIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) setMdIndex(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (timerRef.current) clearTimeout(timerRef.current);

    const currentMd = queue[mdIndex];
    const totalMatchdays = queue[0]?.totalMatchdays ?? 1;
    const perMatchdayMs = Math.max(60, Math.min(300, Math.round(4000 / totalMatchdays)));

    if (!currentMd) {
      // Queue exhausted: wait for more matchdays, or finish if the worker is done.
      if (done) {
        timerRef.current = setTimeout(onComplete, 300);
      }
      return;
    }

    timerRef.current = setTimeout(() => setMdIndex((i) => i + 1), perMatchdayMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [open, queue, mdIndex, done, onComplete]);

  useEffect(() => {
    tickerRef.current?.scrollTo({ left: tickerRef.current.scrollWidth, behavior: "smooth" });
  }, [mdIndex]);

  if (!open) return null;

  const currentMd = queue[mdIndex];
  const revealedMatchdays = queue.slice(0, currentMd ? mdIndex + 1 : mdIndex);
  const revealedItems = revealedMatchdays.flatMap((md) => tickerItemsFor(md, userTid));
  const totalMatchdays = queue[0]?.totalMatchdays ?? 0;
  const progressPct =
    totalMatchdays > 0 ? Math.min(100, Math.round((mdIndex / totalMatchdays) * 100)) : 0;

  return (
    <div className="sim-overlay">
      <div className="sim-overlay-panel card">
        <div className="card-body">
          <h5 className="card-title mb-1">Simulating</h5>
          <div className="text-muted small mb-3">
            {currentMd
              ? `Matchday ${currentMd.matchday} (${mdIndex + 1} of ${totalMatchdays})`
              : "Finishing up..."}
          </div>
          <div className="progress mb-3" style={{ height: 6 }}>
            <div
              className="progress-bar"
              role="progressbar"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="sim-overlay-ticker" ref={tickerRef}>
            {revealedItems.length === 0 && (
              <div className="text-muted small">Kicking off...</div>
            )}
            {revealedItems.map((item) => {
              if (item.kind === "league") {
                const g = item.game;
                const userIsHome = g.home === userTid;
                const userGoals = userIsHome ? g.homeGoals : g.awayGoals;
                const oppGoals = userIsHome ? g.awayGoals : g.homeGoals;
                const oppTid = userIsHome ? g.away : g.home;
                const outcome =
                  userGoals > oppGoals ? "win" : userGoals < oppGoals ? "loss" : "draw";
                return (
                  <div
                    key={`l-${g.matchday}-${g.home}-${g.away}`}
                    className={`sim-ticker-card sim-ticker-${outcome}`}
                  >
                    <div className="sim-ticker-row">
                      <span className="sim-ticker-team">{teamLabel(teams, userTid)}</span>
                      <span className="sim-ticker-score">{userGoals}</span>
                    </div>
                    <div className="sim-ticker-row">
                      <span className="sim-ticker-team">{teamLabel(teams, oppTid)}</span>
                      <span className="sim-ticker-score">{oppGoals}</span>
                    </div>
                  </div>
                );
              }

              if (item.kind === "cup-marker") {
                return (
                  <div
                    key={`cm-${item.label}-${item.matchday}`}
                    className="sim-ticker-card sim-ticker-cup sim-ticker-cup-marker"
                  >
                    <div className="sim-ticker-cup-label">{item.label}</div>
                    <div className="sim-ticker-cup-sub">{item.sub}</div>
                  </div>
                );
              }

              const t = item.tie;
              const won = t.winner === userTid;
              const oppTid = t.home === userTid ? t.away : t.home;
              const note = t.wentToPens
                ? `Pens ${t.homePens}–${t.awayPens}`
                : t.wentToExtraTime
                  ? "AET"
                  : null;
              return (
                <div
                  key={`c-${item.label}-${t.matchday}-${t.home}-${t.away}`}
                  className={`sim-ticker-card sim-ticker-cup sim-ticker-cup-${won ? "win" : "loss"}`}
                >
                  <div className="sim-ticker-cup-label">{item.label}</div>
                  <div className="sim-ticker-cup-sub">{item.sub}</div>
                  <div className="sim-ticker-row">
                    <span className="sim-ticker-team">{teamLabel(teams, t.home)}</span>
                    <span className="sim-ticker-score">{t.homeGoals}</span>
                  </div>
                  <div className="sim-ticker-row">
                    <span className="sim-ticker-team">{teamLabel(teams, t.away)}</span>
                    <span className="sim-ticker-score">{t.awayGoals}</span>
                  </div>
                  {note && <div className="sim-ticker-cup-note">{note}</div>}
                  <span className="visually-hidden">
                    {won ? "won" : "lost"} vs {teamLabel(teams, oppTid)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
