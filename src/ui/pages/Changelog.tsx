import { Link } from "react-router-dom";
import { CHANGELOG } from "../../core/changelog.js";

/**
 * Player-facing changelog: a reverse-chronological list of every player-visible
 * change, read straight from the hand-maintained CHANGELOG data (src/core/changelog.ts).
 * Pure display — no game state involved. Sits under Help in the sidebar, next to
 * the Manual.
 */

const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

function formatDate(iso: string): string {
  // Parse as a plain calendar date (avoid timezone drift on a bare YYYY-MM-DD).
  const [y, m, d] = iso.split("-").map(Number);
  return DATE_FMT.format(new Date(y, m - 1, d));
}

export function Changelog() {
  return (
    <div className="container-fluid p-3">
      <h4>Changelog</h4>
      <div style={{ maxWidth: "56rem" }}>
        <p className="text-muted">
          Every notable change to the game, newest first. For a full explanation of how
          anything here works, see the <Link to="/manual">Manual</Link>.
        </p>

        {CHANGELOG.map((entry, i) => (
          <div className="card mb-3" key={`${entry.date}-${i}`}>
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-baseline flex-wrap gap-2 mb-2">
                <h5 className="mb-0">{entry.title}</h5>
                <span className="small text-muted">{formatDate(entry.date)}</span>
              </div>
              <ul className="mb-0">
                {entry.items.map((item, j) => (
                  <li key={j}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
