import { Link, useLocation, useNavigate } from "react-router-dom";

/**
 * Is there a page of our own to go back to?
 *
 * React Router stamps its own index onto the history entry, counting from 0 at
 * whichever page you arrived on. So `idx > 0` means the previous entry is one
 * we pushed — a page inside the game — and going back can't bounce you off the
 * site or onto whatever you were reading before you opened it. A reload, a
 * bookmark or a shared link all land at 0 and take the fallback instead.
 *
 * `location.key` is the server-render/MemoryRouter answer to the same question:
 * it's "default" only on the first entry of a session.
 */
function hasHistory(key: string): boolean {
  if (typeof window === "undefined") return key !== "default";
  const idx = (window.history.state as { idx?: unknown } | null)?.idx;
  if (typeof idx === "number") return idx > 0;
  return key !== "default";
}

/**
 * A "Back" that actually goes back.
 *
 * The detail pages — a player, a club's season, a box score — are reached from
 * a dozen different places (the news feed, standings, transfers, frivolities,
 * an all-time list), so any fixed destination is the wrong one for almost
 * everybody who gets there. This walks the browser's history instead, and the
 * fixed page is only the fallback for someone who arrived with no history to
 * walk: a reload, a bookmark, a link from outside.
 *
 * Rendered as a real anchor pointing at the fallback, so middle-click and
 * open-in-new-tab still do something sensible; the click handler is what turns
 * an ordinary click into a step back.
 */
export function BackLink({
  fallback,
  label = "Back",
  className,
}: {
  /** Where to go when there's nothing to go back to. */
  fallback: string;
  label?: string;
  className?: string;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const cls = className ? `text-decoration-none ${className}` : "text-decoration-none";

  if (!hasHistory(location.key)) {
    return (
      <Link to={fallback} className={cls}>
        &larr; {label}
      </Link>
    );
  }

  return (
    <a
      href={fallback}
      className={cls}
      onClick={(e) => {
        // A modified click (new tab, new window) should keep the browser's own
        // behaviour and follow the fallback href.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        navigate(-1);
      }}
    >
      &larr; {label}
    </a>
  );
}
