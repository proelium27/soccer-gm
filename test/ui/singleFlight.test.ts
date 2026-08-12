import { describe, it, expect } from "vitest";
import { createGate } from "../../src/ui/singleFlight.js";

/**
 * The gate exists because of one real bug: "Start League" generates a world on
 * the main thread for ~3 seconds, the browser queues every click that lands on
 * the frozen page, and each queued click that reached the handler wrote another
 * save. Users ended up with four identical leagues. What matters here is that
 * the extra calls are DROPPED rather than queued behind the first.
 */
describe("createGate", () => {
  it("runs one action and drops the ones that arrive while it's busy", async () => {
    const gate = createGate();
    let runs = 0;
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });

    const action = () =>
      gate.run(async () => {
        runs++;
        await blocked;
        return "done";
      });

    const first = action();
    // Three more clicks land while the first is still in flight, which is what
    // the browser delivers all at once after a blocking task finishes.
    const dropped = await Promise.all([action(), action(), action()]);
    expect(runs).toBe(1);
    expect(dropped).toEqual([undefined, undefined, undefined]);

    release();
    expect(await first).toBe("done");
  });

  it("reopens once the action finishes", async () => {
    const gate = createGate();
    let runs = 0;
    const action = () => gate.run(async () => void runs++);

    await action();
    await action();
    expect(runs).toBe(2);
  });

  it("reopens after a failure, so one error can't wedge the button shut", async () => {
    const gate = createGate();
    await expect(
      gate.run(async () => {
        throw new Error("import failed");
      }),
    ).rejects.toThrow("import failed");
    expect(gate.busy).toBe(false);

    let ran = false;
    await gate.run(async () => void (ran = true));
    expect(ran).toBe(true);
  });
});
