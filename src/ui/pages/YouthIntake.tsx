import { useState } from "react";
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
import {
  ACADEMY_ROSTER_CAP, YOUTH_TRIAL_SIGN_LIMIT, SCOUTING_REGION_MAX,
} from "../../core/constants.js";
import { PICKABLE_NATIONALITIES } from "../components/NationalityEditor.js";

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

      <ScoutingRegions />

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

/**
 * "Send your scouts here": up to SCOUTING_REGION_MAX countries the academy
 * goes looking in, which supply most of next summer's trial group between them.
 *
 * Deliberately says what it does NOT do — the scouts find you different
 * players, not better ones — because a control sitting next to a quality bonus
 * invites exactly that reading, and a player who believed it would be tuning
 * something that cannot move. What it genuinely changes is who can cap them,
 * which is the reason to care.
 */
function ScoutingRegions() {
  const { league, setScoutingRegionsAction, simming } = useLeague();
  const [open, setOpen] = useState(false);
  if (!league) return null;

  const team = league.teams.find((t) => t.tid === league.meta.userTid);
  const picked = team?.scoutingRegions ?? [];
  const full = picked.length >= SCOUTING_REGION_MAX;

  const drop = (c: string) => setScoutingRegionsAction(picked.filter((x) => x !== c));
  const add = (c: string) => {
    if (!c || full || picked.includes(c)) return;
    setScoutingRegionsAction([...picked, c]);
  };

  return (
    <div className="card mb-3">
      <div className="card-body py-2">
        <div className="d-flex flex-wrap align-items-center gap-2">
          <strong className="me-1">Send your scouts to</strong>
          {picked.length === 0 ? (
            <span className="text-muted">
              nowhere in particular. Your academy looks close to home.
            </span>
          ) : (
            picked.map((c) => (
              <span key={c} className="badge text-bg-secondary d-inline-flex align-items-center gap-1">
                <Flag nationality={c} /> {c}
                <button
                  type="button"
                  className="btn-close btn-close-white ms-1"
                  style={{ fontSize: "0.6em" }}
                  aria-label={`Stop scouting ${c}`}
                  disabled={simming}
                  onClick={() => void drop(c)}
                />
              </span>
            ))
          )}
          {!full && (
            <select
              className="form-select form-select-sm w-auto"
              value=""
              disabled={simming}
              onChange={(e) => void add(e.target.value)}
              aria-label="Add a country to scout"
            >
              <option value="">Add a country...</option>
              {PICKABLE_NATIONALITIES.filter((c) => !picked.includes(c)).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
          <button
            type="button"
            className="btn btn-sm btn-link text-decoration-none ms-auto"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Hide" : "What does this do?"}
          </button>
        </div>
        {open && (
          <p className="text-muted small mb-0 mt-2" style={{ maxWidth: "48rem" }}>
            Pick up to {SCOUTING_REGION_MAX} countries and they'll turn up most of next summer's
            trial group between them, with the rest still coming from around your own league. It
            takes effect at your next intake, not this one. Your scouts find you{" "}
            <em>different</em> players, not better ones: where a kid is from decides his name and
            which country can pick him, never how good he is. That last part is the point, though,
            if you fancy stocking a national team with players you brought through yourself.
          </p>
        )}
      </div>
    </div>
  );
}
