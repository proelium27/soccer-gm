import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ErrorBoundary } from "../../src/ui/components/ErrorBoundary.js";

vi.mock("posthog-js", () => ({
  default: { captureException: () => {} },
}));

/**
 * There's no DOM test environment in this repo, and server rendering doesn't
 * run error boundaries at all (React re-throws to the caller instead of calling
 * `getDerivedStateFromError`). So the catch itself is React's contract, and
 * what's worth pinning here is our half of it: the state derived from a thrown
 * error, and the fallback UI rendered from that state.
 */
describe("ErrorBoundary", () => {
  it("passes children through when nothing throws", () => {
    const html = renderToStaticMarkup(
      createElement(ErrorBoundary, null, createElement("p", null, "all good")),
    );
    expect(html).toContain("all good");
  });

  it("renders the failure, the error text and a way out", () => {
    const error = new Error("kaboom from a page");
    const boundary = new ErrorBoundary({ children: null, what: "the transfers page" });
    boundary.state = {
      ...boundary.state,
      ...ErrorBoundary.getDerivedStateFromError(error),
    };

    const html = renderToStaticMarkup(boundary.render() as React.ReactElement);

    expect(html).toContain("Something broke on the transfers page");
    expect(html).toContain("kaboom from a page");
    // Recovery affordances, so a crash is never a dead end.
    expect(html).toContain("Try again");
    expect(html).toContain("Reload the game");
    // Reassurance that the save is intact (the thing a player worries about).
    expect(html).toContain("Your save isn&#x27;t affected");
  });
});
