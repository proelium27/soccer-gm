import type { ReactNode } from "react";

/**
 * The panel a page shows when it has nothing to list yet.
 *
 * Every one of these used to be a bare `<p className="text-muted">` sitting
 * directly on the page background. Everything else in the game lives on a
 * bordered surface, so those were the only content in the app floating on raw
 * `--sg-bg`, and a UI audit found that readers consistently took them for a page
 * that had failed to load rather than for a page that is correctly empty. The
 * copy was rarely the problem; the missing container was.
 *
 * Three things make an empty state read as deliberate, and the props are named
 * after them:
 *
 * - `headline` — what this page is, in a few words.
 * - `children` — when it fills up, and what it will hold. The pages that already
 *   said this (Confederation Cups) graded well; the ones that only said
 *   "nothing yet" graded worst.
 * - `action` — somewhere to go now, where one exists. An empty page that is
 *   also a dead end is the worst case.
 */
export function EmptyState({
  headline,
  children,
  action,
}: {
  headline: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <p className="empty-state-headline">{headline}</p>
      {children && <div className="empty-state-body">{children}</div>}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
}
