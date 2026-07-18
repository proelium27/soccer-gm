import { useState, type ReactNode } from "react";
import { useParams, Link } from "react-router-dom";
import { useLeague } from "../context/LeagueContext.js";
import { SKILL_KEYS } from "../../core/players/types.js";
import type { CompletedTransfer } from "../../core/transfers/negotiation.js";
import { SKILL_LABELS } from "../components/PlayerRatingsTooltip.js";
import { PotDisplay } from "../components/PotDisplay.js";
import { potentialFog } from "../../core/scouting/potentialFog.js";
import { getRatingColor } from "../utils/ratingColor.js";
import { Flag } from "../components/Flag.js";
import { GoldenBootIcon } from "../components/GoldenBootIcon.js";
import { competitionOf } from "../../core/competitions.js";
import { worldHasCup } from "../../core/cup/cup.js";
import { cupStatsBySeasonForPlayer } from "../../core/cup/cupStats.js";
import { currency, formatWeeklyWage, seasonYear } from "../format.js";

/** One career-honor badge, e.g. "3x Golden Boot" — omits the count for a single win. */
function AwardPill({ label, seasons, icon }: { label: string; seasons: number[]; icon?: ReactNode }) {
  if (seasons.length === 0) return null;
  const years = [...seasons].sort((a, b) => a - b).map(seasonYear);
  return (
    <span className="award-pill" title={years.join(", ")}>
      {icon}
      {years.length > 1 && <span className="award-pill-count">{years.length}x</span>}
      {label}
    </span>
  );
}

/**
 * Best-effort reconstruction of which team a player was on during a past
 * season. There's no per-season roster snapshot anywhere in the game, so
 * this walks the player's CompletedTransfer history (sorted chronologically):
 * the team he belonged to at the end of `season` is whichever transfer's
 * toTid most recently took effect at or before that season, or — if no
 * transfer has happened yet by that season — the fromTid of his earliest
 * transfer (he must have started there), or his present-day team if he's
 * never been transferred at all.
 */
function teamForSeason(
  transfers: CompletedTransfer[],
  season: number,
  currentTid: number,
): number {
  const sorted = [...transfers].sort((a, b) =>
    a.season !== b.season ? a.season - b.season : (a.window === "summer" ? 0 : 1) - (b.window === "summer" ? 0 : 1),
  );
  let owner: number | null = sorted.length > 0 ? sorted[0].fromTid : currentTid;
  for (const t of sorted) {
    if (t.season > season) break;
    owner = t.toTid;
  }
  return owner ?? currentTid;
}

export function PlayerProfile() {
  const { pid } = useParams<{ pid: string }>();
  const { league } = useLeague();
  const [statsTab, setStatsTab] = useState<"league" | "cup">("league");

  if (!league || pid === undefined) {
    return <p className="p-3">Loading...</p>;
  }

  const targetPid = parseInt(pid, 10);
  const player = league.players.find((p) => p.pid === targetPid);

  if (!player) {
    return (
      <div className="container-fluid p-3">
        <p>Player not found.</p>
        <Link to="/roster">Back to Roster</Link>
      </div>
    );
  }

  const team = league.teams.find((t) => t.roster.includes(player.pid));
  const inAcademy = league.teams.find((t) => t.academyRoster.includes(player.pid));
  const teamByTid = new Map(league.teams.map((t) => [t.tid, t]));
  const teamName = (tid: number) => teamByTid.get(tid)?.name ?? `Team ${tid}`;
  const teamAbbrev = (tid: number) => teamByTid.get(tid)?.abbrev ?? "???";

  const playerTransfers = league.transfers
    .filter((t) => t.pid === player.pid)
    .sort((a, b) => b.season - a.season || (a.window === "summer" ? 1 : 0) - (b.window === "summer" ? 1 : 0));

  // Career awards: scan every completed season's per-competition award entries.
  const potySeasons: number[] = [];
  const goldenBootSeasons: number[] = [];
  const totsSeasons: number[] = [];
  const championSeasons: number[] = [];
  for (const entry of league.seasonHistory) {
    for (const compAwards of Object.values(entry.awards)) {
      if (compAwards.playerOfSeasonPid === player.pid) potySeasons.push(entry.season);
      if (compAwards.goldenBootPid === player.pid) goldenBootSeasons.push(entry.season);
      if (compAwards.teamOfSeason.includes(player.pid)) totsSeasons.push(entry.season);
    }
    const ownerTid = team ? teamForSeason(playerTransfers, entry.season, team.tid) : null;
    if (ownerTid !== null && Object.values(entry.championTidByCompId).includes(ownerTid)) {
      championSeasons.push(entry.season);
    }
  }
  const hasAwards =
    potySeasons.length > 0 || goldenBootSeasons.length > 0 || totsSeasons.length > 0 || championSeasons.length > 0;

  const statsBySeasonDesc = [...player.stats].sort((a, b) => b.season - a.season);
  const histBySeasonDesc = [...player.hist].sort((a, b) => b.season - a.season);
  const cupStatsBySeason = cupStatsBySeasonForPlayer(league.cup, league.cupHistory, player.pid);
  const showCupTab = worldHasCup(league.competitions);
  // Scouting fog also applies to the POT column of the history table, per row
  // and keyed off that row's own season — so a player the user has never
  // scouted stays fogged here too (closing the "read the exact number one tab
  // over" leak), while an owned player's estimate clears with tenure exactly
  // as it does everywhere else.
  const userTeamForFog = league.teams.find((t) => t.tid === league.meta.userTid);
  const scoutObserved = userTeamForFog?.scoutingObserved?.[player.pid] ?? null;
  const scoutSpend = userTeamForFog?.scoutingSpend ?? 0;
  const seasonTeamAbbrev = (season: number) =>
    team ? teamAbbrev(teamForSeason(playerTransfers, season, team.tid)) : null;

  return (
    <div className="container-fluid p-3">
      <Link to={team && team.tid === league.meta.userTid ? "/roster" : "/leaders"} className="text-decoration-none">
        &larr; Back
      </Link>

      <h4 className="mt-2">
        {player.name} <Flag nationality={player.nationality} />{" "}
        <small className="text-muted">
          {player.pos} &middot; Age {league.season - player.born} &middot; {player.heightCm}cm &middot; {player.nationality}
        </small>
      </h4>
      <p className="mb-3">
        {team ? (
          <>
            {teamName(team.tid)} <small className="text-muted">({competitionOf(league.competitions, team.compId).name})</small>
          </>
        ) : inAcademy ? (
          <>{teamName(inAcademy.tid)} Academy</>
        ) : (
          <span className="text-muted">Free agent</span>
        )}
        {" "}&middot; OVR <strong>{player.ovr}</strong> / POT <strong><PotDisplay player={player} /></strong>
        {" "}&middot; Wage {formatWeeklyWage(player.contract.salary)}
        {" "}&middot; Contract through {seasonYear(player.contract.expiresSeason)}
        {player.injury && (
          <>
            {" "}&middot; <span className="text-danger">Injured ({player.injury.type}, {player.injury.gamesRemaining} matches remaining)</span>
          </>
        )}
      </p>

      <div className="row g-3">
        <div className="col-lg-5">
          <div className="card mb-3">
            <div className="card-body">
              <h6 className="card-title">Attributes</h6>
              <div className="row row-cols-2 g-1">
                {SKILL_KEYS.map((key) => (
                  <div key={key} className="col d-flex justify-content-between">
                    <span className="text-muted small">{SKILL_LABELS[key]}</span>
                    <span className="fw-semibold" style={{ color: getRatingColor(player.ratings[key]) }}>
                      {player.ratings[key]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card mb-3">
            <div className="card-body">
              <h6 className="card-title">Awards &amp; Trophies</h6>
              {!hasAwards ? (
                <p className="text-muted mb-0">No individual or team honors yet.</p>
              ) : (
                <div className="award-pills">
                  <AwardPill label="Player of the Season" seasons={potySeasons} />
                  <AwardPill label="Golden Boot" seasons={goldenBootSeasons} icon={<GoldenBootIcon />} />
                  <AwardPill label="Team of the Season" seasons={totsSeasons} />
                  <AwardPill label="League Champion" seasons={championSeasons} icon="🏆" />
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <h6 className="card-title">Transfer History</h6>
              {playerTransfers.length === 0 ? (
                <p className="text-muted mb-0">No transfers on record.</p>
              ) : (
                <table className="table table-sm mb-0">
                  <thead>
                    <tr>
                      <th>Season</th>
                      <th>Window</th>
                      <th>From</th>
                      <th>To</th>
                      <th className="text-end">Fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {playerTransfers.map((t, i) => (
                      <tr key={i}>
                        <td>{seasonYear(t.season)}</td>
                        <td className="text-capitalize">{t.window}</td>
                        <td>{teamName(t.fromTid)}</td>
                        <td>{teamName(t.toTid)}</td>
                        <td className="text-end">{t.fee > 0 ? currency.format(t.fee) : "Free"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        <div className="col-lg-7">
          <div className="card mb-3">
            <div className="card-body">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <h6 className="card-title mb-0">
                  {showCupTab && statsTab === "cup" ? "Continental Cup Stats" : "Season Stats"}
                </h6>
                {showCupTab && (
                  <ul className="nav nav-pills nav-sm">
                    <li className="nav-item">
                      <button
                        type="button"
                        className={`nav-link py-0 px-2${statsTab === "league" ? " active" : ""}`}
                        onClick={() => setStatsTab("league")}
                      >
                        League
                      </button>
                    </li>
                    <li className="nav-item">
                      <button
                        type="button"
                        className={`nav-link py-0 px-2${statsTab === "cup" ? " active" : ""}`}
                        onClick={() => setStatsTab("cup")}
                      >
                        Cup
                      </button>
                    </li>
                  </ul>
                )}
              </div>
              {showCupTab && statsTab === "cup" ? (
                cupStatsBySeason.length === 0 ? (
                  <p className="text-muted mb-0">No Continental Cup matches yet.</p>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-striped table-sm mb-0">
                      <thead>
                        <tr>
                          <th>Season</th>
                          <th className="text-end">Apps</th>
                          <th className="text-end">Min</th>
                          <th className="text-end">G</th>
                          <th className="text-end">A</th>
                          <th className="text-end">Sh</th>
                          <th className="text-end">SoT</th>
                          <th className="text-end">Sv</th>
                          <th className="text-end">GA</th>
                          <th className="text-end">Tkl</th>
                          <th className="text-end">Int</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cupStatsBySeason.map((s) => (
                          <tr key={s.season}>
                            <td>{seasonYear(s.season)}</td>
                            <td className="text-end">{s.appearances}</td>
                            <td className="text-end">{s.minutesPlayed}</td>
                            <td className="text-end">{s.goals}</td>
                            <td className="text-end">{s.assists}</td>
                            <td className="text-end">{s.shots}</td>
                            <td className="text-end">{s.shotsOnTarget}</td>
                            <td className="text-end">{s.saves}</td>
                            <td className="text-end">{player.pos === "GK" ? s.goalsAgainst : ""}</td>
                            <td className="text-end">{s.tackles}</td>
                            <td className="text-end">{s.interceptions}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : statsBySeasonDesc.length === 0 ? (
                <p className="text-muted mb-0">No matches played yet.</p>
              ) : (
                <div className="table-responsive">
                  <table className="table table-striped table-sm mb-0">
                    <thead>
                      <tr>
                        <th>Season</th>
                        <th className="text-end">Apps</th>
                        <th className="text-end">Min</th>
                        <th className="text-end">G</th>
                        <th className="text-end">A</th>
                        <th className="text-end">Sh</th>
                        <th className="text-end">SoT</th>
                        <th className="text-end">xG</th>
                        <th className="text-end">Sv</th>
                        <th className="text-end">GA</th>
                        <th className="text-end">xGA</th>
                        <th className="text-end">Tkl</th>
                        <th className="text-end">Int</th>
                        <th className="text-end">Rtg</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statsBySeasonDesc.map((s) => (
                        <tr key={s.season}>
                          <td>
                            {seasonYear(s.season)}
                            {seasonTeamAbbrev(s.season) && (
                              <span className="text-muted small"> ({seasonTeamAbbrev(s.season)})</span>
                            )}
                          </td>
                          <td className="text-end">{s.appearances}</td>
                          <td className="text-end">{s.minutesPlayed}</td>
                          <td className="text-end">{s.goals}</td>
                          <td className="text-end">{s.assists}</td>
                          <td className="text-end">{s.shots}</td>
                          <td className="text-end">{s.shotsOnTarget}</td>
                          <td className="text-end">{s.xg.toFixed(2)}</td>
                          <td className="text-end">{s.saves}</td>
                          <td className="text-end">{player.pos === "GK" ? s.goalsAgainst : ""}</td>
                          <td className="text-end">{player.pos === "GK" ? s.xga.toFixed(2) : ""}</td>
                          <td className="text-end">{s.tackles}</td>
                          <td className="text-end">{s.interceptions}</td>
                          <td className="text-end">{s.avgRating.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <h6 className="card-title">OVR / POT / Attribute History</h6>
              {histBySeasonDesc.length === 0 ? (
                <p className="text-muted mb-0">No history recorded yet.</p>
              ) : (
                <div className="table-responsive">
                  <table className="table table-striped table-sm mb-0">
                    <thead>
                      <tr>
                        <th>Season</th>
                        <th className="text-end">Ovr</th>
                        <th className="text-end">Pot</th>
                        {SKILL_KEYS.map((key) => (
                          <th key={key} className="text-end" title={SKILL_LABELS[key]}>
                            {SKILL_LABELS[key].split(" ").map((w) => w[0]).join("")}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {histBySeasonDesc.map((h) => (
                        <tr key={h.season}>
                          <td>
                            {seasonYear(h.season)}
                            {seasonTeamAbbrev(h.season) && (
                              <span className="text-muted small"> ({seasonTeamAbbrev(h.season)})</span>
                            )}
                          </td>
                          <td className="text-end fw-semibold" style={{ color: getRatingColor(h.ovr) }}>{h.ovr}</td>
                          {(() => {
                            const fog = potentialFog(h.potential, player.pid, h.season, scoutObserved, scoutSpend);
                            const colorAt = fog.known ? h.potential : Math.round((fog.low + fog.high) / 2);
                            return (
                              <td className="text-end" style={{ color: getRatingColor(colorAt) }}>
                                {fog.known ? h.potential : `${fog.low}–${fog.high}`}
                              </td>
                            );
                          })()}
                          {SKILL_KEYS.map((key) => (
                            <td key={key} className="text-end" style={{ color: getRatingColor(h.ratings[key]) }}>
                              {h.ratings[key]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-muted small mt-2 mb-0">
                Each row is the player&apos;s ratings as of the end of that season (i.e. what he
                carried into the following one).
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
