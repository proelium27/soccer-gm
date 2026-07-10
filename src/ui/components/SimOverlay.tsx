import { useEffect, useRef, useState } from "react";
import type { StoredTeam } from "../../core/teams/clubs.js";
import type { SimProgress } from "../useSimWorker.js";
import type { PlayedMatch } from "../../core/standings.js";

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
  const revealedGames = revealedMatchdays
    .map((md) => userGame(md, userTid))
    .filter((g): g is PlayedMatch => g != null);
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
            {revealedGames.length === 0 && (
              <div className="text-muted small">Kicking off...</div>
            )}
            {revealedGames.map((g) => {
              const userIsHome = g.home === userTid;
              const userGoals = userIsHome ? g.homeGoals : g.awayGoals;
              const oppGoals = userIsHome ? g.awayGoals : g.homeGoals;
              const oppTid = userIsHome ? g.away : g.home;
              const outcome =
                userGoals > oppGoals ? "win" : userGoals < oppGoals ? "loss" : "draw";
              return (
                <div
                  key={`${g.matchday}-${g.home}-${g.away}`}
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
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
