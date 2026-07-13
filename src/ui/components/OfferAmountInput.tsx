import { currency } from "../format.js";

/**
 * Quick-pick buttons above a manual number field, so bidding a round number
 * near the suggested/asking price doesn't require typing every digit.
 */
export function OfferAmountInput({
  value,
  onChange,
  quickAmounts,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  quickAmounts: number[];
  disabled?: boolean;
}) {
  const uniqueAmounts = [...new Set(quickAmounts.filter((a) => a > 0))].sort((a, b) => a - b);

  return (
    <div className="d-flex flex-column gap-1">
      {uniqueAmounts.length > 0 && (
        <div className="d-flex gap-1 flex-wrap">
          {uniqueAmounts.map((amt) => (
            <button
              key={amt}
              type="button"
              className="btn btn-outline-secondary btn-sm"
              disabled={disabled}
              onClick={() => onChange(String(amt))}
            >
              {currency.format(amt)}
            </button>
          ))}
        </div>
      )}
      <input
        type="number"
        className="form-control form-control-sm offer-input"
        min={0}
        step={100_000}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
