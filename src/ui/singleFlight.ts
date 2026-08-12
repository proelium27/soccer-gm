/**
 * A gate that runs one async action at a time and DROPS anything that arrives
 * while it's busy (rather than queueing it).
 *
 * Written for league creation, which is the one action in the app that can't be
 * made idempotent after the fact: generating a world blocks the main thread for
 * seconds, the browser queues every click landing on the frozen page, and each
 * queued click that reaches the handler writes another save. Dropping is the
 * right policy there — a second "Start League" click means "I'm impatient", not
 * "give me two leagues".
 *
 * Deliberately a plain closure rather than a hook: it holds no React state (the
 * button's disabled flag is separate state that can lag a render behind), so a
 * burst of clicks delivered inside one frame is still gated.
 */
export function createGate() {
  let running = false;
  return {
    /** Whether an action is in flight right now. */
    get busy(): boolean {
      return running;
    },
    /**
     * Run `fn` unless something else is already running, in which case return
     * `undefined` without calling it.
     */
    async run<T>(fn: () => Promise<T>): Promise<T | undefined> {
      if (running) return undefined;
      running = true;
      try {
        return await fn();
      } finally {
        running = false;
      }
    },
  };
}

export type Gate = ReturnType<typeof createGate>;

/**
 * Resolve after the browser has had a chance to paint.
 *
 * Needed before any long synchronous job kicked off from a click: setting the
 * "working on it" state only schedules a render, and the render never reaches
 * the screen if the same task then blocks the thread for three seconds. One
 * animation frame plus a macrotask gets the paint out first, so the button is
 * visibly disabled before everything locks up.
 */
export function yieldToPaint(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => setTimeout(resolve, 0));
    } else {
      setTimeout(resolve, 0);
    }
  });
}
