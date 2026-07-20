import { useState } from "react";
import { Link } from "react-router-dom";

/**
 * One-time, dismissible announcement strip pinned to the very top of every
 * screen (rendered above the router so it shows on the Leagues picker too, not
 * just inside the app chrome). It points at the Changelog for the details.
 *
 * Bump ANNOUNCEMENT_ID when there's a new thing to announce — changing the id
 * makes the banner reappear for everyone (even people who dismissed the last
 * one), since the "dismissed" flag is stored per-id in localStorage.
 */
const ANNOUNCEMENT_ID = "2026-07-20-godmode-import";
const STORAGE_KEY = `soccer-gm:announce:${ANNOUNCEMENT_ID}`;

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    // Private-mode / storage-disabled browsers: just show it every load.
    return false;
  }
}

export function AnnouncementBanner() {
  const [dismissed, setDismissed] = useState(wasDismissed);

  if (dismissed) return null;

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Ignore — worst case the banner shows again next load.
    }
    setDismissed(true);
  }

  return (
    <div className="announcement-banner" role="status">
      <span className="announcement-banner-text">
        <strong>New:</strong> God Mode sandbox editing and importing real teams &amp; players are here.{" "}
        <Link to="/changelog" className="announcement-banner-link" onClick={dismiss}>
          See what&apos;s new
        </Link>
      </span>
      <button
        type="button"
        className="announcement-banner-close"
        aria-label="Dismiss announcement"
        onClick={dismiss}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
          <path
            d="M1 1L13 13M13 1L1 13"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
