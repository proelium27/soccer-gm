import { useLeague } from "../context/LeagueContext.js";
import { ClubLink } from "./ClubLink.js";
import { PlayerRefLink } from "./PlayerRefLink.js";
import { currency, seasonYear } from "../format.js";
import { bonusLabel } from "./ClauseEditor.js";
import type { TransferClause } from "../../core/transfers/clauses.js";
import { clausesOwedTo, clausesOwedBy, clausesForPlayer } from "../../core/transfers/clauses.js";

/**
 * What a single clause says, in a sentence.
 *
 * A sell-on is stated as a share of *profit* rather than of the fee, because
 * that is what it is and the difference is the whole reason a resale at a loss
 * pays nothing.
 */
function describe(clause: TransferClause, owed: boolean): string {
  if (clause.kind === "sellOn") {
    const share = `${Math.round(clause.share * 100)}%`;
    return owed
      ? `${share} of any profit they make selling him on`
      : `${share} of any profit you make selling him on`;
  }
  return `${currency.format(clause.amount)} if ${bonusLabel(clause.trigger, clause.threshold)}`;
}

function ClauseTable({ clauses, owed }: { clauses: TransferClause[]; owed: boolean }) {
  return (
    <table className="table table-sm mb-0">
      <thead>
        <tr>
          <th>Player</th>
          <th>{owed ? "Owed by" : "Owed to"}</th>
          <th>Terms</th>
          <th className="text-end">Expires</th>
        </tr>
      </thead>
      <tbody>
        {clauses.map((c, i) => (
          <tr key={`${c.pid}-${c.kind}-${c.kind === "bonus" ? c.trigger : "sellOn"}-${i}`}>
            <td><PlayerRefLink pid={c.pid} /></td>
            <td><ClubLink tid={owed ? c.obligorTid : c.beneficiaryTid} /></td>
            <td>{describe(c, owed)}</td>
            <td className="text-end">{seasonYear(c.expires)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Contingent money still hanging over the club, in both directions.
 *
 * Only ever shows what is *outstanding*: a clause is deleted the instant it
 * settles, expires, or its player leaves the club that owed it, so an empty
 * table means there is genuinely nothing left rather than nothing recorded.
 * The card hides itself entirely when both sides are empty, which is most
 * saves most of the time.
 */
export function ClauseLedger() {
  const { league } = useLeague();
  if (!league) return null;
  const userTid = league.meta.userTid;
  const owedToUs = clausesOwedTo(league, userTid);
  const owedByUs = clausesOwedBy(league, userTid);
  if (owedToUs.length === 0 && owedByUs.length === 0) return null;

  return (
    <div className="card mb-3">
      <div className="card-body">
        <h5 className="card-title">Transfer Add-ons</h5>
        <p className="card-text text-muted small">
          Sell-on shares and bonuses still outstanding. They drop off this list as soon as they
          pay out, run out of time, or the player leaves the club that owes them.
        </p>
        {owedToUs.length > 0 && (
          <div className="mb-3">
            <h6>You're owed</h6>
            <ClauseTable clauses={owedToUs} owed />
          </div>
        )}
        {owedByUs.length > 0 && (
          <div>
            <h6>You owe</h6>
            <ClauseTable clauses={owedByUs} owed={false} />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The add-ons riding on one player, for his own page.
 *
 * Renders nothing at all when he carries none, which is the overwhelmingly
 * common case — a note saying "no add-ons" would be on every player in the
 * world. Shows clauses in both directions: one his club owes, and one his club
 * is owed by whoever bought him.
 */
export function PlayerClauseNote({ pid }: { pid: number }) {
  const { league } = useLeague();
  if (!league) return null;
  const clauses = clausesForPlayer(league, pid);
  if (clauses.length === 0) return null;
  const userTid = league.meta.userTid;

  return (
    <ul className="list-unstyled small mb-2">
      {clauses.map((c, i) => {
        const weOwe = c.obligorTid === userTid;
        const weAreOwed = c.beneficiaryTid === userTid;
        return (
          <li key={`${c.kind}-${i}`} className="text-muted">
            {weOwe ? "You owe " : weAreOwed ? "You're owed " : ""}
            {!weOwe && !weAreOwed && (
              <>
                <ClubLink tid={c.obligorTid} /> owes <ClubLink tid={c.beneficiaryTid} />{" "}
              </>
            )}
            {weOwe && <><ClubLink tid={c.beneficiaryTid} />: </>}
            {weAreOwed && <>by <ClubLink tid={c.obligorTid} />: </>}
            {describe(c, weAreOwed)} (until {seasonYear(c.expires)}).
          </li>
        );
      })}
    </ul>
  );
}
