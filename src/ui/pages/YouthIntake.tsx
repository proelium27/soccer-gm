import { Link } from "react-router-dom";
import { useLeague } from "../context/LeagueContext.js";
import { PotHelp } from "../components/HelpHint.js";
import type { Player } from "../../core/players/types.js";
import { Flag } from "../components/Flag.js";
import { PlayerRatingsTooltip } from "../components/PlayerRatingsTooltip.js";
import { PotDisplay } from "../components/PotDisplay.js";
import { SortableTh, useTableSort, sortRows } from "../components/SortableTable.js";
import { trialSigningsLeft } from "../../core/freeAgency.js";
import {
  academyFacilitiesBonus, ACADEMY_FACILITIES_MAX,
} from "../../core/players/academyFacilities.js";
import { ACADEMY_ROSTER_CAP, YOUTH_TRIAL_SIGN_LIMIT } from "../../core/constants.js";

type IntakeSortKey = "name" | "pos" | "ovr" | "pot";

/**
 * This year's youth trial group: the players your academy turned up, and the
 * decision about which of them get a contract.
 *
 * Replaces the old Incoming Talent page, which listed every unsigned under-22
 * in the world. That list existed only because AI clubs released ~85% of their
 * own youth intake every year and nothing signed it back, so it was a permanent
 * free supply of other clubs' wonderkids — see AI_PROSPECT_SLOTS. With clubs
 * keeping their own, the leftovers are genuinely leftovers and live on the Free
 * Agents page with everyone else nobody wanted.
 */
export function YouthIntake() {
  const { league, signTrialistAction, releaseTrialistAction, simming } = useLeague();
  const { sort, toggle } = useTableSort<IntakeSortKey>("pot", "desc");

  if (!league) {
    return <p className="p-3">Loading...</p>;
  }

  const userTeam = league.teams.find((t) => t.tid === league.meta.userTid);
  const trialPids = new Set(userTeam?.youthTrialists ?? []);
  const byPid = new Map(league.players.map((p) => [p.pid, p]));
  const trialists: Player[] = [...trialPids]
    .map((pid) => byPid.get(pid))
    .filter((p): p is Player => p != null);

  const left = userTeam ? trialSigningsLeft(userTeam) : 0;
  const academyFull = (userTeam?.academyRoster.length ?? 0) >= ACADEMY_ROSTER_CAP;
  const bonus = userTeam ? academyFacilitiesBonus(userTeam) : 0;

  const shown = sortRows(trialists, sort, {
    name: (p) => p.name,
    pos: (p) => p.pos,
    ovr: (p) => p.ovr,
    pot: (p) => p.potential,
  });

  return (
    <div className="container-fluid p-3">
      <h4>Youth Intake</h4>
      <p className="text-muted" style={{ maxWidth: "48rem" }}>
        Every summer your academy turns up a group of 16-year-olds on trial. You can offer a
        contract to {YOUTH_TRIAL_SIGN_LIMIT} of them; the rest leave and are free for anyone else
        to sign, so passing on one can come back to haunt you. Nobody here is signed until you say
        so, and whoever's left when you start the next season has gone.
      </p>
      <p className="text-muted" style={{ maxWidth: "48rem" }}>
        How good the group is comes down to your academy's standing, how the club's been finishing,
        and two things you control directly: what you spend on scouting, and how much buzz there is
        around the club. Right now that's worth <strong>+{bonus.toFixed(1)}</strong> of a possible
        +{ACADEMY_FACILITIES_MAX.toFixed(1)}. Their ceilings are estimates, same as anywhere else,
        and better scouting narrows them.
      </p>

      {trialists.length === 0 ? (
        <p>
          No trialists right now. Your next group turns up in the offseason. In the meantime, the{" "}
          <Link to="/academy">Academy</Link> page has the prospects you've already signed.
        </p>
      ) : (
        <>
          <div className={left > 0 ? "alert alert-info" : "alert alert-warning"}>
            {left > 0 ? (
              <>
                <strong>{left}</strong> contract{left === 1 ? "" : "s"} left to offer, from{" "}
                {trialists.length} still on trial.
              </>
            ) : academyFull ? (
              <>
                Your academy is full ({ACADEMY_ROSTER_CAP}/{ACADEMY_ROSTER_CAP}), so you can't sign
                anyone else this year. Release someone on the{" "}
                <Link to="/academy">Academy</Link> page to make room.
              </>
            ) : (
              <>
                You've offered all {YOUTH_TRIAL_SIGN_LIMIT} contracts for this intake. Whoever's
                still on trial will leave when the season starts.
              </>
            )}
          </div>

          <table className="table table-striped table-sm">
            <thead>
              <tr>
                <SortableTh sortKey="name" sort={sort} onSort={toggle} defaultDir="asc">Name</SortableTh>
                <SortableTh sortKey="pos" sort={sort} onSort={toggle} defaultDir="asc">Pos</SortableTh>
                <SortableTh sortKey="ovr" sort={sort} onSort={toggle} className="text-end">OVR</SortableTh>
                <SortableTh sortKey="pot" sort={sort} onSort={toggle} className="text-end">POT <PotHelp /></SortableTh>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.pid}>
                  <td>
                    <PlayerRatingsTooltip player={p}>
                      <Link to={`/player/${p.pid}`}>{p.name}</Link>
                    </PlayerRatingsTooltip>{" "}
                    <Flag nationality={p.nationality} />
                  </td>
                  <td>{p.pos}</td>
                  <td className="text-end">{p.ovr}</td>
                  <td className="text-end"><PotDisplay player={p} /></td>
                  <td className="text-end">
                    <div className="d-inline-flex gap-1">
                      <button
                        className="btn btn-sm btn-primary text-nowrap"
                        disabled={simming || left <= 0}
                        title={left <= 0 ? "No contracts left to offer this year" : undefined}
                        onClick={() => signTrialistAction(p.pid)}
                      >
                        Offer contract
                      </button>
                      <button
                        className="btn btn-sm btn-outline-secondary text-nowrap"
                        disabled={simming}
                        onClick={() => releaseTrialistAction(p.pid)}
                      >
                        Release
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
