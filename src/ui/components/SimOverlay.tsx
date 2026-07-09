import { useEffect, useRef, useState } from "react";
import type { StoredTeam } from "../../core/teams/clubs.js";
import type { SimProgress } from "../useSimWorker.js";

interface SimOverlayProps {
  open: boolean;
  teams: StoredTeam[];
  queue: SimProgress[];
  done: boolean;
  onComplete: () => void;
}

function teamLabel(teams: StoredTeam[], tid: number): string {
  const t = teams.find((team) => team.tid === tid);
  return t?.abbrev ?? t?.name ?? `#${tid}`;
}

export function SimOverlay({ open, teams, queue, done, onComplete }: SimOverlayProps) {
  const [mdIndex, setMdIndex] = useState(0);
  const [gameCount, setGameCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) {
      setMdIndex(0);
      setGameCount(0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (timerRef.current) clearTimeout(timerRef.current);

    const currentMd = queue[mdIndex];
    const totalMatchdays = queue[0]?.totalMatchdays ?? 1;
    const perGameMs = Math.max(
      15,
      Math.min(180, Math.round(3500 / (totalMatchdays * 10))),
    );
    const matchdayPauseMs = Math.min(450, perGameMs * 4);

    if (!currentMd) {
      // Queue exhausted: wait for more matchdays, or finish if the worker is done.
      if (done) {
        timerRef.current = setTimeout(onComplete, 300);
      }
      return;
    }

    if (gameCount < currentMd.results.length) {
      timerRef.current = setTimeout(() => setGameCount((c) => c + 1), perGameMs);
    } else {
      timerRef.current = setTimeout(() => {
        setMdIndex((i) => i + 1);
        setGameCount(0);
      }, matchdayPauseMs);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [open, queue, mdIndex, gameCount, done, onComplete]);

  if (!open) return null;

  const currentMd = queue[mdIndex];
  const revealedResults = currentMd ? currentMd.results.slice(0, gameCount) : [];
  const totalMatchdays = queue[0]?.totalMatchdays ?? 0;
  const progressPct =
    totalMatchdays > 0
      ? Math.min(
          100,
          Math.round(
            ((mdIndex +
              (currentMd ? gameCount / Math.max(1, currentMd.results.length) : 0)) /
              totalMatchdays) *
              100,
          ),
        )
      : 0;

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
          <div className="sim-overlay-results">
            {revealedResults.length === 0 && (
              <div className="text-muted small">Kicking off...</div>
            )}
            {revealedResults.map((r, i) => (
              <div key={`${r.home}-${r.away}-${i}`} className="sim-overlay-row">
                <span className="sim-overlay-team">{teamLabel(teams, r.home)}</span>
                <span className="sim-overlay-score">
                  {r.homeGoals} &ndash; {r.awayGoals}
                </span>
                <span className="sim-overlay-team">{teamLabel(teams, r.away)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
