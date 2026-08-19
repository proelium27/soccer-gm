/**
 * Stand-in for `posthog-js`, aliased over the real package in the CrazyGames
 * build (see vite.config.ts).
 *
 * CrazyGames runs the game inside an iframe on their domain, and their rules
 * require a player-facing terms/privacy notice for any game collecting personal
 * data beyond their own SDK events. Rather than bolt a consent notice onto a
 * build that has no analytics dashboard of its own, that build ships with no
 * tracking at all: no PostHog network requests, and none of the library's
 * ~50 kB in the bundle.
 *
 * The surface here is only what the app actually calls. If a new PostHog method
 * is used anywhere in `src/ui`, add it here too — otherwise the CrazyGames
 * build breaks at runtime with a TypeError while every other build is fine,
 * which is exactly the kind of failure that reaches players first.
 */

const noop = () => {};

export default {
  init: noop,
  capture: noop,
  captureException: noop,
};
