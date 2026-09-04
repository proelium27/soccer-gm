import { Fragment, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { usePlayerRefs } from "./PlayerRefLink.js";
import { ClubLink } from "./ClubLink.js";
import { Flag } from "./Flag.js";

/*
 * The furniture every all-time board is built from.
 *
 * Extracted from `pages/Frivolities.tsx` when Club History grew a board of its
 * own (2026-09-03) — deliberately extracted rather than copied, for the reason
 * `NewsHeadline` and `DivisionBadge` were: two pages describing the same kind
 * of ranked list differently reads as a bug, and a second copy is where that
 * starts.
 */

/** A titled card wrapping one list, with an optional line of explanation under the heading. */
export function Panel({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <div className="card h-100">
      <div className="card-body">
        <h6 className="card-title text-muted text-uppercase small mb-1">{title}</h6>
        {note && <p className="text-secondary small mb-2">{note}</p>}
        {children}
      </div>
    </div>
  );
}

export function Empty({ what }: { what: string }) {
  return <p className="text-muted small mb-0">No {what} yet.</p>;
}

/**
 * A club name with its crest, linked to what that club did in the row's season.
 * A club the save can't find reads "Unknown" and isn't linked, which can only
 * happen for a save whose team list has changed under a historical record.
 */
export function ClubCell({ tid, season }: { tid: number | null; season?: number }) {
  if (tid == null) return <span className="text-muted">Unattached</span>;
  /* A row that is about one season links to that season; an all-time board has
     no season to name, so its clubs open at the one being played. The anchor IS
     the flex wrapper rather than sitting inside one, so a board of hundreds of
     rows costs no more elements than it did unlinked. */
  return (
    <ClubLink
      tid={tid}
      season={season}
      crest
      crestSize={20}
      className="d-inline-flex align-items-center gap-1 text-decoration-none"
    />
  );
}

/**
 * A player's name, linked to his profile.
 *
 * A retiree is deleted from the pool, but his archived career record still has
 * a page of its own (`RetiredPlayerProfile`, reached through the same
 * `/player/:pid` route), so these link too — the badge just says which kind of
 * page you're about to get.
 */
export function PlayerCell({ pid, name, nationality, active }: {
  pid: number;
  name: string;
  nationality?: string;
  active?: boolean;
}) {
  // Some rows (the biggest-fees board) carry a pid the save has no record of at
  // all — neither pool nor archive — and their `name` is already a "Player 4821"
  // placeholder. Those stay unlinked; there's no page to send them to. Same for
  // a player known only from an award he won: the name survives, the career
  // doesn't (see core/awardWinners.ts).
  const known = usePlayerRefs()(pid)?.linkable === true;
  return (
    <span className="d-inline-flex align-items-center gap-1">
      {/* Falsy for a player the save no longer knows (see TransferRecord.nationality) —
          the Flag fallback swatch would imply a country we don't actually have. */}
      {nationality ? <Flag nationality={nationality} tip={false} /> : null}
      {known ? <Link to={`/player/${pid}`}>{name}</Link> : <span>{name}</span>}
      {active === false && <span className="badge text-bg-secondary">Retired</span>}
    </span>
  );
}

/**
 * A compact ranked table: rank, a label cell, and one or more value columns.
 *
 * `expand` opts a table into click-to-reveal detail rows, the same interaction
 * Power Rankings uses for rosters. Only one row is open at a time — these
 * details are wide, and several open at once turns the board into a wall.
 *
 * `highlight` marks a row as the user's, drawn with the same wash and leading
 * edge Standings and Power Rankings give his club.
 */
export function RankTable<T>({ rows, headers, render, empty, expand, highlight }: {
  rows: T[];
  headers: string[];
  render: (row: T) => ReactNode[];
  empty: string;
  expand?: (row: T) => ReactNode;
  highlight?: (row: T) => boolean;
}) {
  const [open, setOpen] = useState<number | null>(null);
  if (rows.length === 0) return <Empty what={empty} />;
  return (
    <div className="table-responsive">
      <table className="table table-sm align-middle mb-0">
        <thead>
          <tr>
            <th className="text-muted" style={{ width: "2.5rem" }}>#</th>
            {headers.map((h, i) => (
              <th key={h} className={i === 0 ? "" : "text-end"}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const cells = render(row);
            const isOpen = open === i;
            return (
              <Fragment key={i}>
                <tr
                  onClick={expand ? () => setOpen(isOpen ? null : i) : undefined}
                  style={expand ? { cursor: "pointer" } : undefined}
                  className={[isOpen && "table-active", highlight?.(row) && "team-highlight"]
                    .filter(Boolean).join(" ") || undefined}
                >
                  <td className="text-muted">{i + 1}</td>
                  {cells.map((c, j) => (
                    <td key={j} className={j === 0 ? "" : "text-end"}>{c}</td>
                  ))}
                </tr>
                {isOpen && expand && (
                  <tr className="table-active">
                    <td colSpan={headers.length + 1} className="pt-0">
                      {expand(row)}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
