import { useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useLeague } from "../context/LeagueContext.js";
import { ClubLink } from "../components/ClubLink.js";
import { usePlayerMap } from "../usePlayerMap.js";
import { HelpHint } from "../components/HelpHint.js";
import type { BallonDOrEntry } from "../../core/worldAwards.js";
import type { Player, Position } from "../../core/players/types.js";
import type { LeagueStore } from "../../core/leagueState.js";
import { TOTS_SLOTS } from "../../core/awards.js";
import { TOTS_LAYOUT } from "../pitchLayout.js";
import { getRatingColor } from "../utils/ratingColor.js";
import { PlayerRatingsTooltip } from "../components/PlayerRatingsTooltip.js";
import { Flag } from "../components/Flag.js";
import { GoldenBootIcon } from "../components/GoldenBootIcon.js";
import { CompetitionSelect } from "../components/CompetitionSelect.js";
import { seasonYear } from "../format.js";

const SLOTS = TOTS_SLOTS;
const COORDS = TOTS_LAYOUT;

function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1];
}

/**
 * A winner as this page needs him — live or long retired.
 *
 * An honours board is the surface a retirement hurts most: these entries are
 * keyed by pid and never change, but the player behind them is deleted from the
 * pool a few seasons later, which used to blank the card out entirely. The
 * archive carries his name, position and the rating he played that season, so
 * the board keeps reading the same. `player` is present only while he's still
 * around, and gates the things only a live record can answer (the attribute
 * tooltip, that season's stat line).
 */
interface AwardSubject {
  pid: number;
  name: string;
  nationality: string;
  pos: Position;
  /** The rating he carried that season. */
  ovr: number;
  /** The club he was at that season, if it's on record. */
  tid: number | undefined;
  player: Player | undefined;
}

/** Resolves an award's pid against the live pool first, then the retiree archive. */
function subjectResolver(
  league: LeagueStore,
  playersByPid: Map<number, Player>,
  season: number,
): (pid: number) => AwardSubject | undefined {
  return (pid) => {
    const player = playersByPid.get(pid);
    if (player) {
      return {
        pid,
        name: player.name,
        nationality: player.nationality,
        pos: player.pos,
        // Present-day ovr, which is what these chips have always shown for a
        // living player. A retiree has no present day, so his archived record
        // supplies the rating he played that season at instead.
        ovr: player.ovr,
        tid: player.stats.find((s) => s.season === season)?.tid,
        player,
      };
    }
    const archived = (league.retiredPlayers ?? []).find((a) => a.pid === pid);
    if (!archived) return undefined;
    const line = archived.seasons.find((s) => s.season === season);
    return {
      pid,
      name: archived.name,
      nationality: archived.nationality,
      pos: archived.pos,
      ovr: line?.ovr ?? archived.finalOvr,
      tid: line?.tid,
      player: undefined,
    };
  };
}

function AwardCard({ title, subject, subtitle }: { title: ReactNode; subject: AwardSubject | undefined; subtitle: ReactNode }) {
  return (
    <div className="card h-100">
      <div className="card-body">
        <h6 className="card-title text-muted text-uppercase small d-flex align-items-center gap-1">{title}</h6>
        {subject ? (
          <>
            <div className="d-flex align-items-center gap-2 fs-5 fw-semibold">
              <Flag nationality={subject.nationality} />
              <Link to={`/player/${subject.pid}`}>{subject.name}</Link>
            </div>
            <div className="text-muted small mt-1">{subtitle}</div>
          </>
        ) : (
          <p className="text-muted mb-0">Not enough qualifying players.</p>
        )}
      </div>
    </div>
  );
}

function TeamOfSeasonField({
  pids,
  subjectOf,
  userTid,
}: {
  pids: (number | null)[];
  subjectOf: (pid: number) => AwardSubject | undefined;
  userTid: number | undefined;
}) {
  return (
    <div className="pitch-field">
      <div className="pitch-goal pitch-goal--left" />
      <div className="pitch-goal pitch-goal--right" />
      {SLOTS.map((_, i) => {
        const pid = pids[i] ?? null;
        const subject = pid !== null ? subjectOf(pid) : undefined;
        const coord = COORDS[i];
        const isUserPlayer =
          subject !== undefined && userTid !== undefined && subject.tid === userTid;
        // The attribute tooltip needs live ratings, which a retiree doesn't
        // keep — his chip is the same chip without the hover.
        const chip = subject && (
          <span
            className={
              "pitch-chip" +
              (subject.pos === "GK" ? " pitch-chip--gk" : "") +
              (isUserPlayer ? " pitch-chip--user" : "")
            }
            style={{ borderColor: getRatingColor(subject.ovr) }}
          >
            <Link to={`/player/${subject.pid}`} className="pitch-chip-name">
              {shortName(subject.name)}
            </Link>
            <span className="pitch-chip-ovr">{subject.ovr}</span>
          </span>
        );
        return (
          <div
            key={i}
            className="pitch-slot"
            style={{ left: `${coord.x}%`, top: `${coord.y}%` }}
          >
            {subject ? (
              subject.player ? (
                <PlayerRatingsTooltip player={subject.player}>{chip}</PlayerRatingsTooltip>
              ) : (
                chip
              )
            ) : (
              <span className="pitch-chip" style={{ opacity: 0.4, cursor: "default" }}>—</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * The Ballon d'Or shortlist: the world's best player and the nine behind him,
 * with the score broken into the parts that made it up — so a win off the back
 * of a cup run or a World Cup reads differently from a pure league season.
 */
function BallonDOrTable({
  ballonDOr,
  subjectOf,
  leagueName,
  season,
}: {
  ballonDOr: BallonDOrEntry[];
  subjectOf: (pid: number) => AwardSubject | undefined;
  leagueName: (tid: number) => string;
  season: number;
}) {
  return (
    <div className="table-responsive">
      <table className="table table-sm table-hover align-middle">
        <thead>
          <tr>
            <th style={{ width: "2.5rem" }}>#</th>
            <th>Player</th>
            <th>Club</th>
            <th className="d-none d-md-table-cell">League</th>
            <th className="text-end">G</th>
            <th className="text-end">A</th>
            <th className="text-end">Rating</th>
            <th className="text-end">Points</th>
            {/* The same total, split into where it came from. */}
            <th className="text-end d-none d-lg-table-cell">From league</th>
            <th className="text-end d-none d-lg-table-cell">From cups</th>
            <th className="text-end d-none d-lg-table-cell">From country</th>
          </tr>
        </thead>
        <tbody>
          {ballonDOr.map((e, i) => {
            const subject = subjectOf(e.pid);
            // Only a live player keeps the season's own stat line; a retiree's
            // per-season rows are dropped when he's archived, so those columns
            // fall back to the same "—" an un-migrated old save shows.
            const stats = subject?.player?.stats.find((s) => s.season === season);
            return (
              <tr key={e.pid}>
                <td className="text-muted">{i + 1}</td>
                <td>
                  <span className="d-inline-flex align-items-center gap-2">
                    {subject && <Flag nationality={subject.nationality} />}
                    <Link to={`/player/${e.pid}`}>{subject?.name ?? `#${e.pid}`}</Link>
                  </span>
                </td>
                <td><ClubLink tid={e.tid} season={season} /></td>
                <td className="d-none d-md-table-cell text-muted">{leagueName(e.tid)}</td>
                <td className="text-end">{stats?.goals ?? "—"}</td>
                <td className="text-end">{stats?.assists ?? "—"}</td>
                <td className="text-end">{stats ? stats.avgRating.toFixed(2) : "—"}</td>
                <td className="text-end fw-semibold">{e.score.toFixed(2)}</td>
                <td className="text-end d-none d-lg-table-cell text-muted">{(e.league + e.title).toFixed(2)}</td>
                <td className="text-end d-none d-lg-table-cell text-muted">{(e.cup + (e.domesticCup ?? 0)).toFixed(2)}</td>
                <td className="text-end d-none d-lg-table-cell text-muted">{e.intl.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function Awards() {
  const { league } = useLeague();
  const playersByPid = usePlayerMap(league?.players);
  const [season, setSeason] = useState<number | null>(null);
  const [scope, setScope] = useState<"world" | "league">("world");
  const [compIdOverride, setCompIdOverride] = useState<number | null>(null);

  if (!league) {
    return <p className="p-3">Loading...</p>;
  }

  if (league.seasonHistory.length === 0) {
    return (
      <div className="container-fluid p-3">
        <h4>Awards</h4>
        <p>No season's been completed yet. Awards show up once you advance past your first season.</p>
      </div>
    );
  }

  const userTeam = league.teams.find((t) => t.tid === league.meta.userTid);
  const compId = compIdOverride ?? userTeam?.compId ?? league.competitions[0].id;

  const seasonOptions = [...league.seasonHistory.map((h) => h.season)].sort((a, b) => b - a);
  const activeSeason = season ?? seasonOptions[0];
  const entry = league.seasonHistory.find((h) => h.season === activeSeason)!;

  // Winners resolve through the retiree archive as well as the live pool, so an
  // old season's honours board doesn't empty out as its winners retire.
  const subjectOf = subjectResolver(league, playersByPid, activeSeason);

  const divisionAwards = entry.awards[compId];
  const potd = divisionAwards.playerOfSeasonPid !== null ? subjectOf(divisionAwards.playerOfSeasonPid) : undefined;
  const goldenBoot = divisionAwards.goldenBootPid !== null ? subjectOf(divisionAwards.goldenBootPid) : undefined;

  const potdStats = potd?.player?.stats.find((s) => s.season === activeSeason);
  const goldenBootStats = goldenBoot?.player?.stats.find((s) => s.season === activeSeason);

  // Clubs are looked up by the competition they were in *that* season, so a
  // since-relegated or since-promoted club is still labelled with the league it
  // actually won its votes in.
  const leagueName = (tid: number) => {
    const cid = entry.compsByTid[tid];
    return cid === undefined ? "" : league.competitions.find((c) => c.id === cid)?.name ?? "";
  };

  // Falls back to empty rather than throwing on a season-history entry written
  // before worldwide awards existed and not yet migrated.
  const world = entry.world ?? { ballonDOr: [], worldTeamOfYear: [] };
  const winner = world.ballonDOr[0];
  const winnerSubject = winner ? subjectOf(winner.pid) : undefined;
  const winnerStats = winnerSubject?.player?.stats.find((s) => s.season === activeSeason);

  return (
    <div className="container-fluid p-3">
      <h4>
        Awards
        <HelpHint>
          End-of-season honours. The world awards judge every league at once — the Ballon d'Or for
          the best player alive and a World Team of the Year — while the league awards pick a Player
          of the Season, a Golden Boot and a Team of the Season inside one competition. Use the
          dropdown to look back at past seasons.
        </HelpHint>
      </h4>
      <div className="mb-3 d-flex gap-2 align-items-center flex-wrap">
        <div className="btn-group" role="group">
          <button
            type="button"
            className={`btn btn-sm ${scope === "world" ? "btn-primary" : "btn-outline-primary"}`}
            onClick={() => setScope("world")}
          >
            World
          </button>
          <button
            type="button"
            className={`btn btn-sm ${scope === "league" ? "btn-primary" : "btn-outline-primary"}`}
            onClick={() => setScope("league")}
          >
            By league
          </button>
        </div>
        <select
          className="form-select form-select-sm"
          style={{ width: "auto", display: "inline-block" }}
          value={activeSeason}
          onChange={(e) => setSeason(Number(e.target.value))}
        >
          {seasonOptions.map((s) => (
            <option key={s} value={s}>{seasonYear(s)}</option>
          ))}
        </select>
        {scope === "league" && (
          <CompetitionSelect
            competitions={league.competitions}
            value={compId}
            onChange={(v) => setCompIdOverride(v === "all" ? null : v)}
          />
        )}
      </div>

      {scope === "world" ? (
        world.ballonDOr.length === 0 ? (
          <p className="text-muted">
            No worldwide awards for this season. Saves from before they existed can only reconstruct
            them for seasons whose players are still around.
          </p>
        ) : (
          <>
            <div className="row g-3 mb-4">
              <div className="col-md-6">
                <AwardCard
                  title="Ballon d'Or"
                  subject={winnerSubject}
                  subtitle={
                    <>
                      <ClubLink tid={winner.tid} season={entry.season} />
                      {winnerStats
                        ? ` · ${winnerStats.goals}G ${winnerStats.assists}A · ${winnerStats.avgRating.toFixed(2)} avg rating`
                        : ""}
                    </>
                  }
                />
              </div>
              <div className="col-md-6">
                <div className="card h-100">
                  <div className="card-body">
                    <h6 className="card-title text-muted text-uppercase small">How he won it</h6>
                    <div className="small">
                      <div className="d-flex justify-content-between">
                        <span>League season{winner.title > 0 ? " (incl. title)" : ""}</span>
                        <span className="fw-semibold">{(winner.league + winner.title).toFixed(2)}</span>
                      </div>
                      {(winner.domesticCup ?? 0) > 0 && (
                        <div className="d-flex justify-content-between">
                          <span>Domestic cup</span>
                          <span className="fw-semibold">{(winner.domesticCup ?? 0).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="d-flex justify-content-between">
                        <span>Continental Cup</span>
                        <span className="fw-semibold">{winner.cup.toFixed(2)}</span>
                      </div>
                      <div className="d-flex justify-content-between">
                        <span>International</span>
                        <span className="fw-semibold">{winner.intl.toFixed(2)}</span>
                      </div>
                      <hr className="my-2" />
                      <div className="d-flex justify-content-between">
                        <span>Total</span>
                        <span className="fw-semibold">{winner.score.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <h5>
              Ballon d'Or shortlist
              <HelpHint>
                Every league is scored on one scale, so a big season in a weaker league doesn't
                outrank a big season in a strong one just because its opponents were easier. Cup and
                international football count too — they're the only places players from different
                leagues actually meet.
              </HelpHint>
            </h5>
            <BallonDOrTable
              ballonDOr={world.ballonDOr}
              subjectOf={subjectOf}
              leagueName={leagueName}
              season={activeSeason}
            />

            <h5 className="mt-4">World Team of the Year</h5>
            <TeamOfSeasonField
              pids={world.worldTeamOfYear}
              subjectOf={subjectOf}
              userTid={league.meta.userTid}
            />
          </>
        )
      ) : (
      <>
      <div className="row g-3 mb-4">
        <div className="col-md-6">
          <AwardCard
            title="Player of the Season"
            subject={potd}
            subtitle={
              potdStats
                ? `${potdStats.goals}G ${potdStats.assists}A · ${potdStats.avgRating.toFixed(2)} avg rating`
                : ""
            }
          />
        </div>
        <div className="col-md-6">
          <AwardCard
            title={<><GoldenBootIcon /> Golden Boot</>}
            subject={goldenBoot}
            subtitle={goldenBootStats ? `${goldenBootStats.goals} goals in ${goldenBootStats.appearances} appearances` : ""}
          />
        </div>
      </div>

      <h5>Team of the Season</h5>
      <TeamOfSeasonField
        pids={divisionAwards.teamOfSeason}
        subjectOf={subjectOf}
        userTid={league.meta.userTid}
      />
      </>
      )}
    </div>
  );
}
