import { useMemo, useState } from "react";
import { useLeague } from "../context/LeagueContext.js";
import { currency } from "../format.js";
import type { BonusTrigger, ProposedClause } from "../../core/transfers/clauses.js";
import {
  clauseCashDiscount, clausesAreValid, clauseSuggestions,
} from "../../core/transfers/clauses.js";
import {
  SELL_ON_MAX_SHARE, SELL_ON_CLAUSE_SEASONS,
  BONUS_CLAUSE_SEASONS, BONUS_MAX_TOTAL_FRACTION,
  BONUS_APPEARANCE_THRESHOLD, BONUS_GOAL_THRESHOLD,
} from "../../core/constants.js";

/**
 * Player-facing wording for one bonus.
 *
 * The two counting triggers take their number from the clause rather than from
 * a constant, because the whole point is that it differs per player: this
 * signing is offered 18 games and that one 31. The constants survive only as a
 * fallback for a clause that somehow carries no threshold.
 */
export function bonusLabel(trigger: BonusTrigger, threshold?: number): string {
  switch (trigger) {
    case "appearances":
      return `he plays ${threshold ?? BONUS_APPEARANCE_THRESHOLD} league games in a season`;
    case "goals":
      return `he scores ${threshold ?? BONUS_GOAL_THRESHOLD} league goals in a season`;
    case "continental":
      return "they qualify for Europe";
    case "promotion":
      return "they win promotion";
  }
}

const SHARE_STEPS = [0, 0.1, 0.2, 0.3, 0.4].filter((s) => s <= SELL_ON_MAX_SHARE);

/**
 * The add-ons panel shared by both sides of the market: the user demands these
 * when selling and offers them when buying, and either way the *other* club
 * prices them the same way (see clauseCashDiscount).
 *
 * The panel leads with what the trade actually costs, because that is the one
 * thing about clauses that is easy to misread: an add-on is not extra money on
 * top of the fee. The other club's total budget for the deal is fixed, so every
 * pound of contingency comes straight off the cash — which the "cash becomes"
 * line spells out before you commit to it.
 *
 * `obligorTid` is whoever will owe the money, i.e. always the buying club.
 */
export function ClauseEditor({
  pid,
  obligorTid,
  baseFee,
  value,
  onChange,
  disabled,
  direction,
}: {
  pid: number;
  obligorTid: number;
  baseFee: number;
  value: ProposedClause[];
  onChange: (clauses: ProposedClause[]) => void;
  disabled?: boolean;
  /** "selling" = you're keeping the upside; "buying" = you're granting it. */
  direction: "selling" | "buying";
}) {
  const { league } = useLeague();
  const [open, setOpen] = useState(false);
  // Defensive: a non-finite fee would carry NaN through every figure below and
  // render as "NaN" rather than as a disabled control.
  const fee = Number.isFinite(baseFee) && baseFee > 0 ? baseFee : 0;

  const share = value.find((c) => c.kind === "sellOn")?.share ?? 0;
  const bonuses = value.filter((c): c is Extract<ProposedClause, { kind: "bonus" }> => c.kind === "bonus");

  // Walks every squad in the world, so only when something is actually
  // proposed and only when the inputs move.
  const discount = useMemo(
    () => (league ? clauseCashDiscount(league, pid, obligorTid, fee, value) : 0),
    [league, pid, obligorTid, fee, value],
  );
  // What is worth offering for THIS player at THIS club. Walks every squad in
  // the world, so only while the panel is actually open.
  const suggestions = useMemo(
    () => (league && open ? clauseSuggestions(league, pid, obligorTid, fee) : []),
    [league, open, pid, obligorTid, fee],
  );
  const valid = clausesAreValid(value, fee);
  const cash = Math.max(0, fee - discount);

  const setShare = (next: number) => {
    const rest = value.filter((c) => c.kind !== "sellOn");
    onChange(next > 0 ? [{ kind: "sellOn", share: next }, ...rest] : rest);
  };

  const toggleBonus = (trigger: BonusTrigger) => {
    const has = bonuses.some((b) => b.trigger === trigger);
    if (has) {
      onChange(value.filter((c) => !(c.kind === "bonus" && c.trigger === trigger)));
      return;
    }
    // Threshold comes from the suggestion, never a constant: the label promises
    // a number and the clause has to enforce that same one.
    const s = suggestions.find((x) => x.trigger === trigger);
    if (!s) return;
    onChange([...value, { kind: "bonus", trigger, amount: s.amount, threshold: s.threshold }]);
  };

  const setBonusAmount = (trigger: BonusTrigger, amount: number) => {
    onChange(value.map((c) =>
      c.kind === "bonus" && c.trigger === trigger ? { ...c, amount } : c,
    ));
  };

  const count = value.length;

  return (
    <div className="clause-editor">
      <button
        type="button"
        className="btn btn-sm btn-link p-0 text-decoration-none"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
      >
        {open ? "Hide add-ons" : "Add-ons"}
        {count > 0 && <span className="badge text-bg-secondary ms-1">{count}</span>}
      </button>

      {open && (
        <div className="border rounded p-2 mt-1 d-flex flex-column gap-2">
          <div>
            <label className="form-label mb-1 small">
              Sell-on share
              <span className="text-muted ms-1">
                ({direction === "selling" ? "you keep" : "they keep"} this much of the profit if
                {direction === "selling" ? " they" : " you"} sell him on within {SELL_ON_CLAUSE_SEASONS} seasons)
              </span>
            </label>
            <div className="d-flex gap-1 flex-wrap">
              {SHARE_STEPS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`btn btn-sm ${s === share ? "btn-primary" : "btn-outline-secondary"}`}
                  disabled={disabled}
                  onClick={() => setShare(s)}
                >
                  {s === 0 ? "None" : `${Math.round(s * 100)}%`}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="form-label mb-1 small">
              Bonuses
              <span className="text-muted ms-1">
                (paid once, if it happens within {BONUS_CLAUSE_SEASONS} seasons while he's still there)
              </span>
            </div>
            {suggestions.length === 0 && (
              <div className="text-muted small">Nothing worth offering on this one.</div>
            )}
            {suggestions.map(({ trigger, threshold }) => {
              const existing = bonuses.find((b) => b.trigger === trigger);
              return (
                <div key={trigger} className="d-flex align-items-center gap-2 mb-1">
                  <div className="form-check mb-0">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id={`bonus-${pid}-${trigger}`}
                      checked={!!existing}
                      disabled={disabled}
                      onChange={() => toggleBonus(trigger)}
                    />
                    <label className="form-check-label small" htmlFor={`bonus-${pid}-${trigger}`}>
                      If {bonusLabel(trigger, existing?.threshold ?? threshold)}
                    </label>
                  </div>
                  {existing && (
                    <input
                      type="number"
                      className="form-control form-control-sm"
                      style={{ maxWidth: "9rem" }}
                      min={0}
                      step={100_000}
                      value={existing.amount}
                      disabled={disabled}
                      onChange={(e) => setBonusAmount(trigger, Math.round(Number(e.target.value)))}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <div className="small">
            {!valid ? (
              <span className="text-danger">
                Bonuses can't add up to more than {Math.round(BONUS_MAX_TOTAL_FRACTION * 100)}% of the
                fee, and the sell-on can't go above {Math.round(SELL_ON_MAX_SHARE * 100)}%.
              </span>
            ) : count === 0 ? (
              <span className="text-muted">
                Add-ons aren't extra money. Whatever you add here comes off the cash instead.
              </span>
            ) : (
              <span>
                Cash {direction === "selling" ? "you get" : "you pay"} becomes{" "}
                <strong>{currency.format(cash)}</strong>{" "}
                <span className="text-muted">
                  ({currency.format(discount)} of the {currency.format(fee)} moved into add-ons)
                </span>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
