import { describe, it, expect } from "vitest";
import { transferFeeLabel } from "../../src/ui/format.js";
import type { CompletedTransfer } from "../../src/core/transfers/negotiation.js";

const base = { pid: 1, fromTid: 0, toTid: 1, season: 2026, window: "summer" as const };

describe("transferFeeLabel", () => {
  it("shows the formatted fee for a permanent transfer", () => {
    expect(transferFeeLabel({ ...base, fee: 1_500_000 })).toBe("$1,500,000");
  });

  it("shows 'Free' for a fee-less permanent transfer", () => {
    expect(transferFeeLabel({ ...base, fee: 0 })).toBe("Free");
  });

  it("marks a loan-out fee as a loan", () => {
    expect(transferFeeLabel({ ...base, fee: 11_000_000, loanSeasons: 1 })).toBe("$11,000,000 (loan)");
  });

  it("labels a fee-less loan move as just 'Loan'", () => {
    expect(transferFeeLabel({ ...base, fee: 0, loanSeasons: 2 })).toBe("Loan");
  });

  it("labels a loan return distinctly instead of showing a bare 'Free'", () => {
    expect(transferFeeLabel({ ...base, fee: 0, loanReturn: true })).toBe("Loan return");
  });
});
