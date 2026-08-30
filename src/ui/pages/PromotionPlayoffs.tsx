import { useState } from "react";
import { useLeague } from "../context/LeagueContext.js";
import { HelpHint } from "../components/HelpHint.js";
import { ClubCrest } from "../components/ClubCrest.js";
import { ClubLink } from "../components/ClubLink.js";
import { seasonYear, ordinal } from "../format.js";
import type { CupTie } from "../../core/cup/types.js";
import type { PromotionPlayoff } from "../../core/promotionPlayoff.js";
import { PLAYOFF_ROUND_FINAL } from "../../core/promotionPlayoff.js";
import { competitionOf } from "../../core/competitions.js";

/**
 * Every playoff the save holds a record of, newest first.
 *
 * Two sources, for the same reason the Cup page reads `cup` and `cupHistory`:
 * `league.promotionPlayoffs` holds the set decided by the season that has just
 * ended and not yet rolled over, and the offseason then writes those same
 * records onto the season-history entry. A season can only ever appear in one
 * of the two, so this is a concatenation rather than a merge.
 */
function allPlayoffs(
  live: PromotionPlayoff[],
  history: { promotionPlayoffs?: PromotionPlayoff[] }[],
): PromotionPlayoff[] {
  return [...live, ...history.flatMap((h) => h.promotionPlayoffs ?? [])]
    .sort((a, b) => b.season - a.season);
}

export function PromotionPlayoffs() {
  const { league } = useLeague();
  const [countrySel, setCountrySel] = useState<string | null>(null);
  const [seasonSel, setSeasonSel] = useState<number | null>(null);

  if (!league) return <p className="p-3">Loading...</p>;

  const playoffs = allPlayoffs(league.promotionPlayoffs ?? [], league.seasonHistory);
  const userTid = league.meta.userTid;
  const userTeam = league.teams.find((t) => t.tid === userTid);
  const userCountry = league.competitions.find((c) => c.id === userTeam?.compId)?.country;

  const intro = (
    <HelpHint>
      In most countries the last promotion place isn&apos;t won in the table, it&apos;s won in a
      playoff. The clubs finishing just below the automatic places go into a four-club bracket:
      two-legged semi-finals, then a one-off final, and the winner goes up. Finishing higher gets
      you the tie against the lowest-placed club and home advantage in the final, and that is all
      it gets you — over two legs you each host once, so a semi-final is as even as it looks.
      It&apos;s played the moment the season ends, before anyone retires or moves on.
    </HelpHint>
  );

  if (playoffs.length === 0) {
    return (
      <div className="container-fluid p-3">
        <h4>Promotion Playoffs{intro}</h4>
        <p className="text-muted">
          Nothing on file yet. The first playoffs are decided at the end of this season.
        </p>
      </div>
    );
  }

  const countries = [...new Set(playoffs.map((p) => p.country))].sort();
  const country = countrySel ?? (userCountry && countries.includes(userCountry) ? userCountry : countries[0]);
  const forCountry = playoffs.filter((p) => p.country === country);
  const playoff = forCountry.find((p) => p.season === seasonSel) ?? forCountry[0];

  const teamColors = (tid: number): [string, string] =>
    league.teams.find((t) => t.tid === tid)?.colors ?? ["#888888", "#888888"];

  const teamCell = (tid: number, won: boolean) => (
    <span className={`cup-team${won ? " cup-team-winner" : ""}${tid === userTid ? " cup-team-user" : ""}`}>
      <ClubCrest tid={tid} colors={teamColors(tid)} size={16} />
      <span className="cup-team-name">
        <ClubLink tid={tid} season={playoff?.season} />
      </span>
    </span>
  );

  const renderTie = (t: CupTie) => {
    const rowClass = (tid: number) =>
      `cup-tie-row ${t.winner === tid ? "cup-tie-row--won" : "cup-tie-row--out"}`;
    return (
      <>
        <div className={rowClass(t.home)}>
          {teamCell(t.home, t.winner === t.home)}
          <span className="cup-tie-score">{t.homeGoals}</span>
        </div>
        <div className={rowClass(t.away)}>
          {teamCell(t.away, t.winner === t.away)}
          <span className="cup-tie-score">{t.awayGoals}</span>
        </div>
        {t.legs && t.legs.length === 2 && (
          // Both legs are stored from this tie's `home` perspective, so they
          // read left-to-right the same way the aggregate above does. The
          // second leg was played at the away club's ground, which finished
          // higher — the English convention, and cosmetic here, since each
          // club hosts once and extra time takes no home bonus.
          <div className="cup-tie-note">
            {`1st leg ${t.legs[0].homeGoals}-${t.legs[0].awayGoals} · 2nd leg ${t.legs[1].homeGoals}-${t.legs[1].awayGoals} away`}
          </div>
        )}
        {(t.wentToExtraTime || t.wentToPens) && (
          <div className="cup-tie-note">
            {t.wentToPens ? `${t.homePens}-${t.awayPens} on pens` : "after extra time"}
          </div>
        )}
      </>
    );
  };

  const semis = playoff.ties.filter((t) => t.round !== PLAYOFF_ROUND_FINAL);
  const decider = playoff.ties.find((t) => t.round === PLAYOFF_ROUND_FINAL);
  const d1 = competitionOf(league.competitions, playoff.d1CompId);
  const d2 = competitionOf(league.competitions, playoff.d2CompId);
  const userEntered = playoff.teams.includes(userTid);

  return (
    <div className="container-fluid p-3">
      <h4>Promotion Playoffs{intro}</h4>

      <div className="mb-3 d-flex gap-2 flex-wrap">
        <select
          className="form-select form-select-sm"
          style={{ width: "auto" }}
          value={country}
          onChange={(e) => { setCountrySel(e.target.value); setSeasonSel(null); }}
        >
          {countries.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          className="form-select form-select-sm"
          style={{ width: "auto" }}
          value={playoff.season}
          onChange={(e) => setSeasonSel(Number(e.target.value))}
        >
          {forCountry.map((p) => (
            <option key={p.season} value={p.season}>{seasonYear(p.season)}</option>
          ))}
        </select>
      </div>

      <div className="mb-2">
        <strong>{d2.name}</strong>{" "}
        <span className="text-muted small">
          the last place in {d1.name} · {playoff.autoSpots} promoted automatically
        </span>
      </div>

      {playoff.winnerTid !== null && (
        <div className="cup-champion-banner mb-3">
          <span className="cup-champion-label">Promoted</span>{" "}
          <ClubCrest tid={playoff.winnerTid} colors={teamColors(playoff.winnerTid)} size={22} />{" "}
          <strong><ClubLink tid={playoff.winnerTid} season={playoff.season} /></strong>{" "}
          <span className="text-muted small">
            from {ordinal(playoff.positions[playoff.teams.indexOf(playoff.winnerTid)])}
          </span>
        </div>
      )}

      {userEntered && (
        <p className="text-muted small mb-3">
          {playoff.winnerTid === userTid
            ? "You went up through the playoffs."
            : "Your club was in this playoff and missed out."}
        </p>
      )}

      <div className="cup-bracket cup-bracket--rounds">
        <div className="cup-round">
          <div className="cup-round-title">
            <span>Semi-finals</span>
            <span className="cup-round-count">{semis.length}</span>
          </div>
          <div className="cup-round-body">
            {semis.map((t, i) => <div className="cup-tie" key={i}>{renderTie(t)}</div>)}
          </div>
        </div>
        {decider && (
          <div className="cup-round">
            <div className="cup-round-title"><span>Final</span></div>
            <div className="cup-round-body">
              <div className="cup-tie cup-tie--final">{renderTie(decider)}</div>
            </div>
          </div>
        )}
      </div>

      <table className="table table-sm table-dark mt-3" style={{ maxWidth: 420 }}>
        <thead>
          <tr><th>Pos</th><th>Club</th></tr>
        </thead>
        <tbody>
          {playoff.teams.map((tid, i) => (
            <tr key={tid} className={tid === userTid ? "team-highlight" : undefined}>
              <td>{playoff.positions[i]}</td>
              <td>
                <ClubCrest tid={tid} colors={teamColors(tid)} size={16} />{" "}
                <ClubLink tid={tid} season={playoff.season} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
