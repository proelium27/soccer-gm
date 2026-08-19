/**
 * CrazyGames SDK facade.
 *
 * CrazyGames hosts the game in an iframe on their own domain and requires the
 * SDK for anything past a Basic Launch. This wraps the handful of calls we make
 * so that:
 *
 *   - every other build target (our own site, itch, dev, tests) sees no-ops and
 *     never touches `window.CrazyGames`, which does not exist there;
 *   - a missing or broken SDK can never throw into gameplay. The script is
 *     loaded from `sdk.crazygames.com`, so an adblocker or a network blip is a
 *     perfectly ordinary outcome and must be survivable;
 *   - call ordering is handled in one place. `SDK.init()` is asynchronous and
 *     every other method is unusable until it resolves, so each call is queued
 *     behind the init promise rather than being guarded at the call site.
 *
 * Deliberately minimal: init + loading + gameplay events, which is what Basic
 * Launch needs. No ads and no banners — see docs/crazygames.md for why, and for
 * what integrating them later would involve.
 */

const enabled = import.meta.env.VITE_BUILD_TARGET === "crazygames";

interface CrazyGamesGame {
  loadingStart(): void;
  loadingStop(): void;
  gameplayStart(): void;
  gameplayStop(): void;
}

interface CrazyGamesSdk {
  init(): Promise<void>;
  game: CrazyGamesGame;
}

function sdk(): CrazyGamesSdk | null {
  if (!enabled) return null;
  const cg = (window as unknown as { CrazyGames?: { SDK?: CrazyGamesSdk } }).CrazyGames;
  return cg?.SDK ?? null;
}

/**
 * Resolves once `SDK.init()` has finished, or immediately when there is no SDK
 * to initialize. Never rejects — a failed init leaves the facade inert rather
 * than pushing an unhandled rejection into the page.
 */
let ready: Promise<void> | null = null;

/**
 * Kick off SDK initialization. Safe to call more than once; only the first call
 * does anything.
 *
 * CrazyGames want this done before the game starts, on the loading screen, so
 * `main.tsx` calls it before mounting React.
 */
export function initCrazyGames(): void {
  if (!enabled || ready) return;
  const s = sdk();
  if (!s) {
    ready = Promise.resolve();
    return;
  }
  ready = s.init().catch(() => {
    // An uninitialized SDK stays uninitialized. Every later call runs through
    // `run()`, which re-reads the SDK and no-ops if the calls are unusable.
  });
  loadingStart();
}

/** Queue a call behind init. Silently drops it if the SDK never came up. */
function run(fn: (game: CrazyGamesGame) => void): void {
  if (!enabled || !ready) return;
  void ready.then(() => {
    const s = sdk();
    if (!s) return;
    try {
      fn(s.game);
    } catch {
      // Reporting must never break the game.
    }
  });
}

/** The game has started loading. Paired with {@link loadingStop}. */
export function loadingStart(): void {
  run((game) => game.loadingStart());
}

/** Loading is done and the first screen is up. */
export function loadingStop(): void {
  run((game) => game.loadingStop());
}

/**
 * The player is now playing, as opposed to sitting in a menu. Called when a
 * save is open (see `Layout`), not on the league picker or the manual.
 */
export function gameplayStart(): void {
  run((game) => game.gameplayStart());
}

/** The player has stopped playing — back to the menu, or the save was closed. */
export function gameplayStop(): void {
  run((game) => game.gameplayStop());
}
