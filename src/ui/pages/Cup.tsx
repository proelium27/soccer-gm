import { useState } from "react";
import { Link } from "react-router-dom";
import { useLeague } from "../context/LeagueContext.js";
import { HelpHint } from "../components/HelpHint.js";
import { ClubCrest } from "../components/ClubCrest.js";
import { seasonYear } from "../format.js";
import type { CupState, CupTie, CupPlayIn } from "../../core/cup/types.js";
import {
  matchupsForRound, cupRoundName, cupFinalists, isCupComplete, worldHasCup,
} from "../../core/cup/cup.js";
import { CUP_ROUNDS } from "../../core/constants.js";

/** One slot in a bracket column: a finished tie, a known-but-unplayed pairing, or a yet-undecided placeholder. */
type Slot =
  | { kind: "played"; tie: CupTie }
  | { kind: "pending"; home: number; away: number }
  | { kind: "tbd" };

function roundSlots(cup: CupState, round: number): Slot[] {
  const played = cup.ties.filter((t) => t.round === round);
  if (played.length > 0) return played.map((tie) => ({ kind: "played" as const, tie }));
  const pairs = matchupsForRound(cup, round); // known only once the prior round is complete (round 0 always)
  if (pairs.length > 0) return pairs.map(([home, away]) => ({ kind: "pending" as const, home, away }));
  const tieCount = 2 ** (CUP_ROUNDS - 1 - round); // 8, 4, 2, 1
  return Array.from({ length: tieCount }, () => ({ kind: "tbd" as const }));
}

/** The play-in's two ties: completed if played, else the pending pairings from its participants. */
function playInSlots(playIn: CupPlayIn): Slot[] {
  if (playIn.ties.length > 0) return playIn.ties.map((tie) => ({ kind: "played" as const, tie }));
  const slots: Slot[] = [];
  for (let i = 0; i + 1 < playIn.teams.length; i += 2) {
    slots.push({ kind: "pending", home: playIn.teams[i], away: playIn.teams[i + 1] });
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
            The Continental Cup is a 16-team knockout. The top four clubs of each of the four
            strongest top-flight leagues qualify; the champions of the weaker leagues must win a
            preliminary play-in to reach the bracket. It begins next season — qualification is
            decided by this season&apos;s final league tables.
          </p>
        ) : (
          <p className="text-muted">
            The Continental Cup isn&apos;t contested in this league — it needs four top-flight
            leagues to fill its 16-team bracket.
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
  const userInCup = cup?.teams.includes(userTid) ?? false;

  return (
    <div className="container-fluid p-3">
      <h4>
        Continental Cup
        <HelpHint>
          A 16-team knockout played alongside the league, contested by the top four clubs of each
          top-flight league. Rounds fire on set matchdays; the live bracket and past winners are
          shown here. If your club reaches the final, the sim pauses so you can play it.
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

          <div className="cup-bracket">
            {cup.playIn && (
              <div className="cup-round" key="playin">
                <div className="cup-round-title">{cupRoundName(-1)}</div>
                {playInSlots(cup.playIn).map((slot, i) => (
                  <div className="cup-tie" key={i}>{renderTie(slot)}</div>
                ))}
              </div>
            )}
            {Array.from({ length: CUP_ROUNDS }, (_, round) => (
              <div className="cup-round" key={round}>
                <div className="cup-round-title">{cupRoundName(round)}</div>
                {roundSlots(cup, round).map((slot, i) => (
                  <div className="cup-tie" key={i}>{renderTie(slot)}</div>
                ))}
              </div>
            ))}
          </div>

          {!isCupComplete(cup) && (
            <p className="text-muted small mt-3">
              Rounds are played automatically as the season reaches them.{" "}
              <Link to="/schedule">Sim on</Link> to advance the bracket.
            </p>
          )}
        </>
      )}
    </div>
  );
}
