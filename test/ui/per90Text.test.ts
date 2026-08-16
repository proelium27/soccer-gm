import { describe, it, expect } from "vitest";
import { per90Text } from "../../src/ui/format.js";

describe("per90Text", () => {
  it("shows two decimals for the rates that live below 10", () => {
    // Goals and assists per 90 sit in the 0.2-1.2 band, where the second
    // decimal is the entire difference between players.
    expect(per90Text(10, 900)).toBe("1.00");
    expect(per90Text(14, 3400)).toBe("0.37");
  });

  it("drops to one decimal at 10 and above, where the second is noise", () => {
    // Passes per 90 runs to ~50; "52.37" implies a precision the stat has not
    // got and makes the column hard to scan.
    expect(per90Text(1000, 1800)).toBe("50.0");
    expect(per90Text(200, 1800)).toBe("10.0");
    expect(per90Text(199, 1800)).toBe("9.95");
  });

  it("renders an em dash rather than a division by zero", () => {
    expect(per90Text(0, 0)).toBe("—");
    expect(per90Text(4, 0)).toBe("—");
  });

  it("renders a genuine zero as a zero, not a dash", () => {
    // A player with minutes and no goals really did score at 0.00 per 90; only
    // the unmeasurable case gets the dash.
    expect(per90Text(0, 900)).toBe("0.00");
  });
});
