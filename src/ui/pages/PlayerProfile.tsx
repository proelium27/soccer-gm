import { useState, type ReactNode } from "react";
import { useParams, Link } from "react-router-dom";
import { useLeague } from "../context/LeagueContext.js";
import { SKILL_KEYS } from "../../core/players/types.js";
import type { CompletedTransfer } from "../../core/transfers/negotiation.js";
import { isFreeAgentTid } from "../../core/transfers/negotiation.js";
import { SKILL_LABELS } from "../components/PlayerRatingsTooltip.js";
import { PotDisplay } from "../components/PotDisplay.js";
import { PotHelp } from "../components/HelpHint.js";
import { ValueHistoryChart } from "../components/ValueHistoryChart.js";
import { OvrHistoryChart } from "../components/OvrHistoryChart.js";
import { careerValueHistory } from "../../core/finance/valueHistory.js";
import { potentialFog } from "../../core/scouting/potentialFog.js";
import { getRatingColor } from "../utils/ratingColor.js";
import { Flag } from "../components/Flag.js";
import { GoldenBootIcon } from "../components/GoldenBootIcon.js";
import { competitionOf } from "../../core/competitions.js";
import { worldHasCup } from "../../core/cup/cup.js";
import { cupStatsBySeasonForPlayer } from "../../core/cup/cupStats.js";
import { clubDisplayName, formatWeeklyWage, seasonYear, transferFeeLabel } from "../format.js";
import { INTL_TOURNAMENT_NAME } from "../../core/constants.js";
import { PlayerEditModal } from "../components/PlayerEditModal.js";
import { computePlayerHonors } from "../../core/playerHonors.js";
import { RetiredPlayerProfile } from "./RetiredPlayerProfile.js";
import { PositionBadge, PositionStrip } from "../components/PositionBadge.js";

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
 *
 * One wrinkle: if his earliest record is a *free* signing, its fromTid is the
 * free-agent sentinel, which says nothing about where he was before it — a
 * player can spend years on a club's roster without any transfer being logged
 * (generated there, then released). So the sentinel must never become the
 * pre-history owner; those earlier seasons fall back to his present club, the
 * same best guess this made before free signings were recorded at all.
 */
function teamForSeason(
  transfers: CompletedTransfer[],
  season: number,
  currentTid: number,
): number {
  const sorted = [...transfers].sort((a, b) =>
    a.season !== b.season ? a.season - b.season : (a.window === "summer" ? 0 : 1) - (b.window === "summer" ? 0 : 1),
  );
  const earliest = sorted.length > 0 ? sorted[0].fromTid : currentTid;
  let owner = isFreeAgentTid(earliest) ? currentTid : earliest;
  for (const t of sorted) {
    if (t.season > season) break;
    owner = t.toTid;
  }
  return owner;
}

export function PlayerProfile() {
  const { pid } = useParams<{ pid: string }>();
  const { league, movePlayerToClubAction, releasePlayerGodModeAction } = useLeague();
  const [statsTab, setStatsTab] = useState<"league" | "cup" | "intl">("league");
  const [careerChart, setCareerChart] = useState<"value" | "ovr">("value");
  const [editing, setEditing] = useState(false);

  if (!league || pid === undefined) {
    return <p className="p-3">Loading...</p>;
  }

  const targetPid = parseInt(pid, 10);
  const player = league.players.find((p) => p.pid === targetPid);

  if (!player) {
    // Retirement deletes a player from the pool, so a link from anywhere
    // historical (all-time lists, an old transfer, a news item) lands here for
    // anyone who has hung up his boots. His archived career is the page to show.
    const archived = (league.retiredPlayers ?? []).find((a) => a.pid === targetPid);
    if (archived) return <RetiredPlayerProfile archived={archived} league={league} />;
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
  const teamName = (tid: number) =>
    clubDisplayName(tid, (id) => teamByTid.get(id)?.name);
  const teamAbbrev = (tid: number) =>
    isFreeAgentTid(tid) ? "FA" : teamByTid.get(tid)?.abbrev ?? "???";

  const playerTransfers = league.transfers
    .filter((t) => t.pid === player.pid)
    .sort((a, b) => b.season - a.season || (a.window === "summer" ? 1 : 0) - (b.window === "summer" ? 1 : 0));

  // Career honours. League titles are credited only for seasons he was actually
  // in the champion's squad — see computePlayerHonors for why that can't come
  // from teamForSeason's transfer-history walk.
  const honors = computePlayerHonors(player, league.seasonHistory);

  const statsBySeasonDesc = [...player.stats].sort((a, b) => b.season - a.season);
  const histBySeasonDesc = [...player.hist].sort((a, b) => b.season - a.season);
  const cupStatsBySeason = cupStatsBySeasonForPlayer(league.cup, league.cupHistory, player.pid);
  const showCupTab = worldHasCup(league.competitions);
  // The national-team tab appears once he's been involved at all. Its per-campaign
  // lines only exist from the season they started being recorded, so a save older
  // than that still shows the career totals with an empty table underneath.
  const intl = player.intl ?? null;
  const showIntlTab = intl !== null && (intl.caps > 0 || intl.tournaments > 0);
  const intlSeasonsDesc = [...(intl?.seasons ?? [])].sort((a, b) => b.season - a.season);
  // Guard against a stale selection: a tab that isn't offered for this player
  // (no cup in the world, never capped) falls back to the league stats.
  const activeStatsTab =
    (statsTab === "cup" && !showCupTab) || (statsTab === "intl" && !showIntlTab) ? "league" : statsTab;
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

  // How a given season's POT should *read* — the same fogged band the history
  // table below shows, evaluated on that season like the table does.
  const potBandLabel = (potential: number, season: number): string => {
    if (league.godMode) return String(potential);
    const fog = potentialFog(potential, player.pid, season, scoutObserved, scoutSpend);
    return fog.known ? String(potential) : `${fog.low}–${fog.high}`;
  };
  // The POT the value chart *prices* off. trueTransferValue pays a premium for
  // an unfulfilled potential gap, so feeding it the true number would turn the
  // dollar figure into an exact read on a hidden one — it gets the fogged
  // band's midpoint instead. The band is taken once, at the current season, so
  // its seeded off-center jitter is a single constant across the career and the
  // value line stays smooth; the hover card still quotes each season's own band.
  const pricedPotential = (potential: number): number => {
    if (league.godMode) return potential;
    const fog = potentialFog(potential, player.pid, league.season, scoutObserved, scoutSpend);
    return fog.known ? potential : Math.round((fog.low + fog.high) / 2);
  };

  const valuePoints = careerValueHistory(player, league.season, (snap) =>
    pricedPotential(snap.potential));
  const statsBySeason = new Map(player.stats.map((s) => [s.season, s]));
  // Two different lookups, because a snapshot's ratings and its academy flag
  // describe different seasons. The ratings stamped at the end of season N are
  // what he carried through N+1; the flag records where he *was* in N. So the
  // POT shown for a played season comes from the snapshot before it, while the
  // academy label comes from the snapshot for that same season — falling back
  // to his live squad for the current one, which has no snapshot yet.
  const histBySeasonPlayed = new Map(player.hist.map((h) => [h.season + 1, h]));
  const academyBySeason = new Map(player.hist.map((h) => [h.season, h.academy]));

  return (
    <div className="container-fluid p-3">
      <Link to={team && team.tid === league.meta.userTid ? "/roster" : "/leaders"} className="text-decoration-none">
        &larr; Back
      </Link>

      <h4 className="mt-2">
        {player.name} <Flag nationality={player.nationality} />{" "}
        <small className="text-muted">
          <PositionBadge player={player} /> &middot; Age {league.season - player.born} &middot; {player.heightCm}cm &middot; {player.nationality}
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

      <PositionStrip player={player} />

      {player.intl && player.intl.caps > 0 && (
        <p className="mb-3 small">
          <span className="text-muted">{player.nationality}:</span>{" "}
          <strong>{player.intl.caps}</strong> caps, <strong>{player.intl.goals}</strong> goals
          {player.intl.tournaments > 0 && <> &middot; {player.intl.tournaments} {player.intl.tournaments === 1 ? "tournament" : "tournaments"}</>}
          {player.intl.titles > 0 && <> &middot; <strong>{player.intl.titles}</strong> {player.intl.titles === 1 ? "title" : "titles"}</>}
        </p>
      )}

      {league.godMode && (
        <div className="gm-panel">
          <div className="gm-panel-title">God Mode</div>
          <div className="d-flex flex-wrap align-items-center gap-2">
            <button className="btn btn-sm btn-warning" onClick={() => setEditing(true)}>Edit Player</button>
            <div className="d-flex align-items-center gap-1">
              <label className="small text-muted m-0">Move to</label>
              <select
                className="form-select form-select-sm"
                style={{ width: "auto" }}
                value=""
                onChange={(e) => {
                  const tid = Number(e.target.value);
                  if (!Number.isNaN(tid)) movePlayerToClubAction(player.pid, tid);
                }}
              >
                <option value="">Select club…</option>
                {[...league.teams]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((t) => (
                    <option key={t.tid} value={t.tid} disabled={team?.tid === t.tid}>
                      {t.name}
                    </option>
                  ))}
              </select>
            </div>
            <button
              className="btn btn-sm btn-outline-danger"
              onClick={() => releasePlayerGodModeAction(player.pid)}
            >
              Release to free agency
            </button>
          </div>
        </div>
      )}

      {editing && <PlayerEditModal player={player} onClose={() => setEditing(false)} />}

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
              {!honors.hasAny ? (
                <p className="text-muted mb-0">No individual or team honors yet.</p>
              ) : (
                <div className="award-pills">
                  <AwardPill label="Ballon d'Or" seasons={honors.ballonDOr} />
                  <AwardPill label="World Team of the Year" seasons={honors.worldTeamOfYear} />
                  <AwardPill label="Player of the Season" seasons={honors.playerOfSeason} />
                  <AwardPill label="Golden Boot" seasons={honors.goldenBoot} icon={<GoldenBootIcon />} />
                  <AwardPill label="Team of the Season" seasons={honors.teamOfSeason} />
                  <AwardPill label="League Champion" seasons={honors.leagueTitles} icon="🏆" />
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
                        <td className="text-end">{transferFeeLabel(t)}</td>
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
                  {activeStatsTab === "cup"
                    ? "Continental Cup Stats"
                    : activeStatsTab === "intl"
                      ? "National Team Stats"
                      : "Season Stats"}
                </h6>
                {(showCupTab || showIntlTab) && (
                  <ul className="nav nav-pills nav-sm">
                    <li className="nav-item">
                      <button
                        type="button"
                        className={`nav-link py-0 px-2${activeStatsTab === "league" ? " active" : ""}`}
                        onClick={() => setStatsTab("league")}
                      >
                        League
                      </button>
                    </li>
                    {showCupTab && (
                      <li className="nav-item">
                        <button
                          type="button"
                          className={`nav-link py-0 px-2${activeStatsTab === "cup" ? " active" : ""}`}
                          onClick={() => setStatsTab("cup")}
                        >
                          Cup
                        </button>
                      </li>
                    )}
                    {showIntlTab && (
                      <li className="nav-item">
                        <button
                          type="button"
                          className={`nav-link py-0 px-2${activeStatsTab === "intl" ? " active" : ""}`}
                          onClick={() => setStatsTab("intl")}
                        >
                          National Team
                        </button>
                      </li>
                    )}
                  </ul>
                )}
              </div>
              {activeStatsTab === "intl" && intl ? (
                <>
                  <p className="small mb-2">
                    <Flag nationality={player.nationality} /> {player.nationality} &middot;{" "}
                    <strong>{intl.caps}</strong> {intl.caps === 1 ? "cap" : "caps"},{" "}
                    <strong>{intl.goals}</strong> {intl.goals === 1 ? "goal" : "goals"},{" "}
                    <strong>{intl.assists}</strong> {intl.assists === 1 ? "assist" : "assists"}
                    {intl.tournaments > 0 && <> &middot; {intl.tournaments} {intl.tournaments === 1 ? "tournament" : "tournaments"}</>}
                    {intl.titles > 0 && <> &middot; <strong>{intl.titles}</strong> {intl.titles === 1 ? "title" : "titles"}</>}
                  </p>
                  {intlSeasonsDesc.length === 0 ? (
                    <p className="text-muted mb-0">
                      No campaign-by-campaign breakdown on record, so the totals above are his whole
                      international career.
                    </p>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-striped table-sm mb-0">
                        <thead>
                          <tr>
                            <th>Season</th>
                            <th>Competition</th>
                            <th className="text-end">Apps</th>
                            <th className="text-end">G</th>
                            <th className="text-end">A</th>
                          </tr>
                        </thead>
                        <tbody>
                          {intlSeasonsDesc.map((s) => (
                            <tr key={`${s.season}-${s.kind}`}>
                              <td>{seasonYear(s.season)}</td>
                              <td>{s.kind === "tournament" ? INTL_TOURNAMENT_NAME : "Qualifying"}</td>
                              <td className="text-end">{s.caps}</td>
                              <td className="text-end">{s.goals}</td>
                              <td className="text-end">{s.assists}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              ) : activeStatsTab === "cup" ? (
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

          <div className="card mb-3">
            <div className="card-body">
              {/* Value and OVR answer different questions about the same
                  career — what he was worth vs how good he was — and the two
                  come apart (an aging star's rating holds while his value
                  falls off the age curve). Both charts already exist, so they
                  share the panel rather than one replacing the other. */}
              <div className="d-flex align-items-center justify-content-between mb-2">
                <h6 className="card-title mb-0">
                  {careerChart === "ovr" ? "OVR History" : "Transfer Value"}
                </h6>
                <ul className="nav nav-pills nav-sm">
                  <li className="nav-item">
                    <button type="button"
                      className={`nav-link py-0 px-2${careerChart === "value" ? " active" : ""}`}
                      onClick={() => setCareerChart("value")}>
                      Value
                    </button>
                  </li>
                  <li className="nav-item">
                    <button type="button"
                      className={`nav-link py-0 px-2${careerChart === "ovr" ? " active" : ""}`}
                      onClick={() => setCareerChart("ovr")}>
                      OVR
                    </button>
                  </li>
                </ul>
              </div>
              {careerChart === "ovr" ? (
                <OvrHistoryChart
                  pid={player.pid}
                  name={player.name}
                  points={player.hist}
                  league={league}
                  teamTidForSeason={(season) => {
                    if (!team) return inAcademy ? inAcademy.tid : null;
                    // teamForSeason never hands back the free-agent sentinel, so
                    // every season resolves to a real club to color by.
                    return teamForSeason(playerTransfers, season, team.tid);
                  }}
                />
              ) : (
              <ValueHistoryChart
                pid={player.pid}
                name={player.name}
                points={valuePoints}
                league={league}
                detailForSeason={(season) => {
                  const stats = statsBySeason.get(season);
                  const snap = histBySeasonPlayed.get(season);
                  const apps = stats?.appearances ?? 0;
                  return {
                    // teamForSeason never hands back the free-agent sentinel, so
                    // every season resolves to a real club to color by. It needs
                    // a present-day club to walk back from, though, which an
                    // unrostered player hasn't got — for him each season falls
                    // back to SeasonStats.tid, the club he was at as of his last
                    // appearance that year. Without it a released veteran's whole
                    // career read "Free agent", including the seasons the very
                    // same card credits him 17 goals for.
                    tid: team
                      ? teamForSeason(playerTransfers, season, team.tid)
                      : inAcademy?.tid
                        ?? (stats && !isFreeAgentTid(stats.tid) ? stats.tid : null),
                    potentialLabel: snap ? potBandLabel(snap.potential, snap.season) : "?",
                    academy: academyBySeason.get(season) ?? inAcademy !== undefined,
                    age: season - player.born,
                    goals: stats?.goals ?? 0,
                    assists: stats?.assists ?? 0,
                    appearances: apps,
                    avgRating: stats?.avgRating ?? 0,
                    didNotPlay: apps === 0,
                  };
                }}
              />
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
                        <th className="text-end">Pot <PotHelp /></th>
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
