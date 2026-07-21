import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useLeague } from "../context/LeagueContext.js";
import { HelpHint } from "../components/HelpHint.js";
import { ClubCrest } from "../components/ClubCrest.js";
import { seasonYear } from "../format.js";
import type { CupState, CupTie } from "../../core/cup/types.js";
import {
  matchupsForRound, cupRoundName, cupFinalists, isCupComplete, worldHasCup,
  isSwissCup, koRoundsOf,
} from "../../core/cup/cup.js";
import { leaguePhaseTable } from "../../core/cup/leaguePhase.js";
import { CUP_LP_DIRECT_QF, CUP_LP_PLAYOFF_TEAMS } from "../../core/constants.js";

/** One slot in a bracket column: a finished tie, a known-but-unplayed pairing, or a yet-undecided placeholder. */
type Slot =
  | { kind: "played"; tie: CupTie }
  | { kind: "pending"; home: number; away: number }
  | { kind: "tbd" };

function roundSlots(cup: CupState, round: number): Slot[] {
  const played = cup.ties.filter((t) => t.round === round);
  if (played.length > 0) return played.map((tie) => ({ kind: "played" as const, tie }));
  const pairs = matchupsForRound(cup, round); // known only once the prior round is complete (round 0 always)
  if (pairs.length > 0 && pairs.every(([h, a]) => h >= 0 && a >= 0)) {
    return pairs.map(([home, away]) => ({ kind: "pending" as const, home, away }));
  }
  const tieCount = 2 ** (koRoundsOf(cup) - 1 - round);
  return Array.from({ length: tieCount }, () => ({ kind: "tbd" as const }));
}

/** A preliminary round (Swiss playoff or legacy play-in): its ties if played, else the pending pairings. */
function prelimSlots(round: { teams: number[]; ties: CupTie[] }): Slot[] {
  if (round.ties.length > 0) return round.ties.map((tie) => ({ kind: "played" as const, tie }));
  const slots: Slot[] = [];
  for (let i = 0; i + 1 < round.teams.length; i += 2) {
    slots.push({ kind: "pending", home: round.teams[i], away: round.teams[i + 1] });
  }
  return slots;
}

export function Cup() {
  const { league } = useLeague();
  const [seasonSel, setSeasonSel] = useState<number | "current">("current");

  if (!league) return <p className="p-3">Loading...</p>;

  const currentCup = league.cup;
  const history = [...league.cupHistory].sort((a, b) => b.season - a.season);
  const hasAny = currentCup !== null || history.length > 0;

  if (!hasAny) {
    return (
      <div className="container-fluid p-3">
        <h4>Continental Cup</h4>
        {worldHasCup(league.competitions) ? (
          <p className="text-muted">
            The Continental Cup is a 20-team competition played alongside the league. The top four
            clubs of each of the four strongest leagues get in, plus the top two from each of the
            weaker leagues. Everyone starts together in a single league phase of six games, then the
            table splits: the top four go straight to the quarter-finals, the next eight fight
            through a playoff round, and the bottom eight are out. It kicks off next season, and who
            gets in is decided by this season&apos;s final league tables.
          </p>
        ) : (
          <p className="text-muted">
            The Continental Cup isn&apos;t contested in this league. It needs enough top-flight
            leagues to fill its 20-club field.
          </p>
        )}
      </div>
    );
  }

  const cup: CupState | undefined =
    seasonSel === "current"
      ? currentCup ?? undefined
      : history.find((h) => h.season === seasonSel);

  const teamName = (tid: number) => league.teams.find((t) => t.tid === tid)?.name ?? `Team ${tid}`;
  const teamColors = (tid: number): [string, string] =>
    league.teams.find((t) => t.tid === tid)?.colors ?? ["#888888", "#888888"];
  const userTid = league.meta.userTid;

  const teamCell = (tid: number, isWinner: boolean) => (
    <span className={`cup-team${isWinner ? " cup-team-winner" : ""}${tid === userTid ? " cup-team-user" : ""}`}>
      <ClubCrest tid={tid} colors={teamColors(tid)} size={16} />
      <span className="cup-team-name">{teamName(tid)}</span>
    </span>
  );

  const renderTie = (slot: Slot) => {
    if (slot.kind === "tbd") return <div className="cup-tie-tbd">To be decided</div>;
    if (slot.kind === "pending") {
      return (
        <>
          <div className="cup-tie-row">{teamCell(slot.home, false)}</div>
          <div className="cup-tie-row">{teamCell(slot.away, false)}</div>
        </>
      );
    }
    return (
      <>
        <div className="cup-tie-row">
          {teamCell(slot.tie.home, slot.tie.winner === slot.tie.home)}
          <span className="cup-tie-score">{slot.tie.homeGoals}</span>
        </div>
        <div className="cup-tie-row">
          {teamCell(slot.tie.away, slot.tie.winner === slot.tie.away)}
          <span className="cup-tie-score">{slot.tie.awayGoals}</span>
        </div>
        {(slot.tie.wentToExtraTime || slot.tie.wentToPens) && (
          <div className="cup-tie-note">
            {slot.tie.wentToPens
              ? `${slot.tie.homePens}–${slot.tie.awayPens} on pens`
              : "after extra time"}
          </div>
        )}
      </>
    );
  };

  const finalists = cup ? cupFinalists(cup) : [];
  const userIsFinalist = finalists.includes(userTid);
  const swiss = cup ? isSwissCup(cup) : false;
  const userInCup = cup
    ? (swiss ? cup.leaguePhase!.teams.includes(userTid) : cup.teams.includes(userTid))
    : false;

  return (
    <div className="container-fluid p-3">
      <h4>
        Continental Cup
        <HelpHint>
          A 20-club competition played alongside the league. It opens with a league phase where
          everyone plays six games in one table; the top four skip to the quarter-finals, the next
          eight play a one-off playoff round, and the bottom eight go out. From there it&apos;s a
          straight knockout. If your club reaches the final, the sim pauses so you can play it.
        </HelpHint>
      </h4>
      <div className="mb-3">
        <select
          className="form-select form-select-sm"
          style={{ width: "auto", display: "inline-block" }}
          value={seasonSel}
          onChange={(e) => setSeasonSel(e.target.value === "current" ? "current" : Number(e.target.value))}
        >
          {currentCup && <option value="current">Current Season ({seasonYear(league.season)})</option>}
          {history.map((h) => (
            <option key={h.season} value={h.season}>{seasonYear(h.season)}</option>
          ))}
        </select>
      </div>

      {!cup ? (
        <p className="text-muted">No cup for this season.</p>
      ) : (
        <>
          {cup.championTid !== null ? (
            <div className="cup-champion-banner mb-3">
              <span className="cup-champion-label">Champions</span>{" "}
              <ClubCrest tid={cup.championTid} colors={teamColors(cup.championTid)} size={22} />{" "}
              <strong>{teamName(cup.championTid)}</strong>
            </div>
          ) : userIsFinalist ? (
            <div className="alert alert-warning py-2 mb-3">
              Your club has reached the final! Sim on to play it.
            </div>
          ) : userInCup ? (
            <p className="text-muted small mb-3">Your club is in this season&apos;s Continental Cup.</p>
          ) : null}

          {swiss && cup.leaguePhase && (
            <LeaguePhaseSection cup={cup} teamCell={teamCell} userTid={userTid} />
          )}

          <div className="cup-bracket">
            {cup.playoff && (
              <div className="cup-round" key="playoff">
                <div className="cup-round-title">{cupRoundName(-1)}</div>
                <div className="cup-round-body">
                  {prelimSlots(cup.playoff).map((slot, i) => (
                    <div className="cup-tie" key={i}>{renderTie(slot)}</div>
                  ))}
                </div>
              </div>
            )}
            {cup.playIn && (
              <div className="cup-round" key="playin">
                <div className="cup-round-title">Play-in Round</div>
                <div className="cup-round-body">
                  {prelimSlots(cup.playIn).map((slot, i) => (
                    <div className="cup-tie" key={i}>{renderTie(slot)}</div>
                  ))}
                </div>
              </div>
            )}
            {Array.from({ length: koRoundsOf(cup) }, (_, round) => (
              <div className="cup-round" key={round}>
                <div className="cup-round-title">{cupRoundName(round, koRoundsOf(cup))}</div>
                <div className="cup-round-body">
                  {roundSlots(cup, round).map((slot, i) => (
                    <div className="cup-tie" key={i}>{renderTie(slot)}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {!isCupComplete(cup) && (
            <p className="text-muted small mt-3">
              Stages are played automatically as the season reaches them.{" "}
              <Link to="/schedule">Sim on</Link> to advance the cup.
            </p>
          )}
        </>
      )}
    </div>
  );
}

/** The Swiss league-phase table, with the qualification cut lines shaded. */
function LeaguePhaseSection({
  cup, teamCell, userTid,
}: {
  cup: CupState;
  teamCell: (tid: number, isWinner: boolean) => ReactNode;
  userTid: number;
}) {
  const table = leaguePhaseTable(cup.leaguePhase!, cup.seeds);
  const played = cup.leaguePhase!.matches.some((m) => m.played);
  const zoneClass = (pos: number): string => {
    if (pos <= CUP_LP_DIRECT_QF) return "cup-lp-direct";
    if (pos <= CUP_LP_DIRECT_QF + CUP_LP_PLAYOFF_TEAMS) return "cup-lp-playoff";
    return "cup-lp-out";
  };
  return (
    <div className="cup-league-phase mb-4">
      <div className="cup-round-title">League Phase</div>
      {!played && (
        <p className="text-muted small mb-2">
          The draw is set. Standings fill in as the six league-phase rounds are played.
        </p>
      )}
      <table className="table table-sm cup-lp-table">
        <thead>
          <tr>
            <th>#</th><th>Club</th>
            <th className="text-end">P</th><th className="text-end">W</th>
            <th className="text-end">D</th><th className="text-end">L</th>
            <th className="text-end">GD</th><th className="text-end">Pts</th>
          </tr>
        </thead>
        <tbody>
          {table.map((r, i) => {
            const pos = i + 1;
            return (
              <tr key={r.tid} className={`${zoneClass(pos)}${r.tid === userTid ? " cup-lp-user" : ""}`}>
                <td>{pos}</td>
                <td>{teamCell(r.tid, false)}</td>
                <td className="text-end">{r.played}</td>
                <td className="text-end">{r.won}</td>
                <td className="text-end">{r.drawn}</td>
                <td className="text-end">{r.lost}</td>
                <td className="text-end">{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
                <td className="text-end fw-bold">{r.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="cup-lp-key small text-muted">
        <span className="cup-lp-key-item"><span className="cup-lp-swatch cup-lp-direct" /> Top {CUP_LP_DIRECT_QF} to the quarter-finals</span>
        <span className="cup-lp-key-item"><span className="cup-lp-swatch cup-lp-playoff" /> Next {CUP_LP_PLAYOFF_TEAMS} to the playoff</span>
        <span className="cup-lp-key-item"><span className="cup-lp-swatch cup-lp-out" /> Rest eliminated</span>
      </div>
    </div>
  );
}
