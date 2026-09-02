/**
 * Wraps a route that only means anything to a manager.
 *
 * These pages are unlinked on a spectator save — the sidebar drops the whole
 * Team section — so this is only reachable by a typed URL, a bookmark, or a
 * back-navigation from a save that did have a club. Every one of them already
 * degrades safely (they look up `userTid`, find nothing, and early-return
 * "Team not found." or render an empty list), so this is not a crash guard.
 * It is there so the answer reads as the game working rather than broken:
 * "Team not found" describes a bug, and there is no bug here.
 *
 * One wrapper at the route table rather than a branch inside each of the ten
 * pages, so a page added to that section later cannot forget it.
 */
import { Link } from "react-router-dom";
import { useLeague } from "../context/LeagueContext.js";
import { isSpectator } from "../../core/spectator.js";

export function ClubOnly({ children }: { children: React.ReactNode }) {
  const { league } = useLeague();

  if (league && isSpectator(league)) {
    return (
      <div className="container-fluid p-3" style={{ maxWidth: 640 }}>
        <h4>You're spectating</h4>
        <p className="text-muted">
          This save doesn't have a club of your own, so there's no squad to pick, no
          budget to spend and nobody to sign. Every club in the world is run by the AI
          and you're here to watch what they do with it.
        </p>
        <Link to="/dashboard" className="btn btn-secondary">Back to dashboard</Link>
      </div>
    );
  }

  return <>{children}</>;
}
