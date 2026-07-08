import { describe, it, expect } from "vitest";
import * as engine from "../src/engine/index.js";

describe("engine public surface", () => {
  it("re-exports the core API", () => {
    expect(typeof engine.mulberry32).toBe("function");
    expect(typeof engine.makeTeam).toBe("function");
    expect(typeof engine.simMatch).toBe("function");
    expect(typeof engine.runScenario).toBe("function");
    expect(engine.PRESETS.equal.attack).toBe(0.5);
    expect(engine.MATCH_SECONDS).toBe(5400);
  });
});
