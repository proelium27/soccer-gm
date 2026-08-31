import type { ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useLeague } from "../context/LeagueContext.js";
import { ClubLink } from "../components/ClubLink.js";
import { usePlayerMap } from "../usePlayerMap.js";
import { computeClubHistory, type ClubIndividualHonour, type ClubSeasonRecord } from "../../core/clubHistory.js";
import { competitionOf, countriesOf } from "../../core/competitions.js";
import { worldHasCup } from "../../core/cup/cup.js";
import { SHIELD_FORMAT } from "../../core/constants.js";
import type { Player } from "../../core/players/types.js";
import { ClubCrest } from "../components/ClubCrest.js";
import { GoldenBootIcon } from "../components/GoldenBootIcon.js";
import { PlayerRefLink } from "../components/PlayerRefLink.js";
import { seasonYear, ordinal } from "../format.js";

/** A small inline trophy mark — no emoji in the UI (icons are hand-drawn SVG). */
function TrophyIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18 3h3v3a4 4 0 0 1-4 4h-.35A6 6 0 0 1 13 13.9V16h2a3 3 0 0 1 3 3v2H6v-2a3 3 0 0 1 3-3h2v-2.1A6 6 0 0 1 7.35 10H7a4 4 0 0 1-4-4V3h3V2h12v1zM6 5H5v1a2 2 0 0 0 1 1.73V5zm13 0h-1v2.73A2 2 0 0 0 19 6V5z" />
    </svg>
  );
}

/** Short label for a club's Continental Cup run in one season, e.g. "Cup Winners". */
function cupRunNote(cupRun: ClubSeasonRecord["cupRun"]): string | null {
  if (!cupRun) return null;
  return `Cup ${cupRun.note}`;
}

function StatCard({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="card h-100">
      <div className="card-body py-2 px-3">
        <div className="text-muted text-uppercase small">{label}</div>
        <div className="fs-4 fw-semibold">{value}</div>
        {sub !== undefined && <div className="text-muted small">{sub}</div>}
      </div>
    </div>
  );
}

/**
 * An honour-winner's name. `player` is the live record when he's still around;
 * `PlayerRefLink` falls back to the retiree archive, so a club's own honours
 * board keeps naming the man who won them after he retires.
 */
function PlayerName({ player, pid }: { player: Player | undefined; pid: number }) {
  if (player) return <Link to={`/player/${player.pid}`}>{player.name}</Link>;
  return <PlayerRefLink pid={pid} fallback={`Player #${pid} (departed)`} />;
}

/** Group a flat list of honours by season, newest first. */
function HonourList({
  title,
  icon,
  honours,
  playersByPid,
}: {
  title: string;
  icon?: ReactNode;
  honours: ClubIndividualHonour[];
  playersByPid: Map<number, Player>;
}) {
  return (
    <div className="card h-100">
      <div className="card-body">
        <h6 className="card-title text-muted text-uppercase small d-flex align-items-center gap-1">
          {icon}
          {title} <span className="badge text-bg-secondary ms-1">{honours.length}</span>
        </h6>
        {honours.length === 0 ? (
          <p className="text-muted mb-0 small">None yet.</p>
        ) : (
          <ul className="list-unstyled mb-0 small">
            {honours.map((h, i) => (
              <li key={i} className="d-flex justify-content-between gap-2">
                <PlayerName player={playersByPid.get(h.pid)} pid={h.pid} />
                <span className="text-muted">{seasonYear(h.season)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function ClubHistory() {
  const { league } = useLeague();
  const playersByPid = usePlayerMap(league?.players);
  /**
   * Which club to show, held in the URL rather than in component state.
   *
   * It has to survive being linked to: the club-season page sends you here for
   * the club you were just looking at, and with the choice in state that link
   * could only ever land on your own club. Keeping it in the URL also makes the
   * picker shareable and the back button work through it.
   */
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tidParam = Number(searchParams.get("tid"));

  if (!league) {
    return <p className="p-3">Loading...</p>;
  }

  const userTid = league.meta.userTid;
  // A tid the save doesn't know (a hand-edited URL, or a link from a save that
  // has since changed) falls back to your own club rather than an empty page.
  const tid = league.teams.some((t) => t.tid === tidParam) ? tidParam : userTid;
  const team = league.teams.find((t) => t.tid === tid);
  const currentComp = team ? competitionOf(league.competitions, team.compId) : undefined;

  const history = computeClubHistory(league, tid);

  const countries = countriesOf(league.competitions);
  const hasCup = worldHasCup(league.competitions);
  const hasShield = worldHasCup(league.competitions, SHIELD_FORMAT);

  const titleYears = (seasons: number[]) => seasons.map((s) => seasonYear(s)).join(", ");

  return (
    <div className="container-fluid p-3">
      <div className="d-flex align-items-center gap-2 mb-1">
        <ClubCrest tid={tid} colors={team?.colors ?? ["#888888", "#888888"]} size={32} />
        <h4 className="mb-0"><ClubLink tid={tid} className="text-reset text-decoration-none" /></h4>
      </div>
      <div className="text-muted mb-3">
        {currentComp ? `${currentComp.name} · ${history.seasonsPlayed} season${history.seasonsPlayed === 1 ? "" : "s"} on record` : ""}
      </div>

      <div className="mb-3">
        <select
          className="form-select form-select-sm"
          style={{ width: "auto", display: "inline-block" }}
          value={tid}
          onChange={(e) => setSearchParams({ tid: e.target.value }, { replace: true })}
        >
          {countries.map((country) => (
            <optgroup key={country} label={country}>
              {league.competitions
                .filter((c) => c.country === country)
                .flatMap((c) =>
                  league.teams
                    .filter((t) => t.compId === c.id)
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((t) => (
                      <option key={t.tid} value={t.tid}>
                        {t.name} ({c.name})
                      </option>
                    )),
                )}
            </optgroup>
          ))}
        </select>
      </div>

      {history.seasonsPlayed === 0 ? (
        <p>No season's been completed yet. A club's history shows up once you advance past your first season.</p>
      ) : (
        <>
          <h5 className="d-flex align-items-center gap-2">
            <TrophyIcon /> Trophy Case
          </h5>
          <div className="row g-3 mb-4">
            <div className="col-6 col-md-3">
              <StatCard
                label="League Titles"
                value={history.leagueTitles.length}
                sub={history.leagueTitles.length > 0 ? titleYears(history.leagueTitles) : "—"}
              />
            </div>
            {hasCup && (
              <div className="col-6 col-md-3">
                <StatCard
                  label="Continental Cups"
                  value={history.cupTitles.length}
                  sub={
                    history.cupTitles.length > 0
                      ? titleYears(history.cupTitles)
                      : history.cupFinals.length > 0
                        ? `${history.cupFinals.length} final${history.cupFinals.length === 1 ? "" : "s"} lost`
                        : "—"
                  }
                />
              </div>
            )}
            {hasShield && (
              <div className="col-6 col-md-3">
                <StatCard
                  label="Continental Shields"
                  value={history.shieldTitles.length}
                  sub={
                    history.shieldTitles.length > 0
                      ? titleYears(history.shieldTitles)
                      : history.shieldFinals.length > 0
                        ? `${history.shieldFinals.length} final${history.shieldFinals.length === 1 ? "" : "s"} lost`
                        : "—"
                  }
                />
              </div>
            )}
            <div className="col-6 col-md-3">
              <StatCard
                label="Domestic Cups"
                value={history.domesticCupTitles.length}
                sub={
                  history.domesticCupTitles.length > 0
                    ? titleYears(history.domesticCupTitles)
                    : "—"
                }
              />
            </div>
            {/*
              Shown only once the club has one. Unlike the league and cup cards
              above, a zero here is not an interesting fact about a club — the
              competition is a one-off preseason match most clubs never reach —
              and an always-present "0" would crowd the row for everyone.
            */}
            {history.superCupTitles.length > 0 && (
              <div className="col-6 col-md-3">
                <StatCard
                  label="Champions Cups"
                  value={history.superCupTitles.length}
                  sub={titleYears(history.superCupTitles)}
                />
              </div>
            )}
            {history.trebles.length > 0 && (
              <div className="col-6 col-md-3">
                <StatCard
                  label="Trebles"
                  value={history.trebles.length}
                  sub={titleYears(history.trebles)}
                />
              </div>
            )}
            <div className="col-6 col-md-3">
              <StatCard
                label="2nd-Tier Titles"
                value={history.secondTierTitles.length}
                sub={history.secondTierTitles.length > 0 ? titleYears(history.secondTierTitles) : "—"}
              />
            </div>
            <div className="col-6 col-md-3">
              <StatCard
                label="Promotions"
                value={history.promotions.length}
                sub={history.promotions.length > 0 ? titleYears(history.promotions) : "—"}
              />
            </div>
            <div className="col-6 col-md-3">
              <StatCard
                label="Relegations"
                value={history.relegations.length}
                sub={history.relegations.length > 0 ? titleYears(history.relegations) : "—"}
              />
            </div>
          </div>

          <h5>Individual Honours</h5>
          <div className="row g-3 mb-4">
            <div className="col-md-4">
              <HonourList
                title="Ballon d'Or"
                honours={history.ballonDOrWinners}
                playersByPid={playersByPid}
              />
            </div>
            <div className="col-md-4">
              <HonourList
                title="World Team of the Year"
                honours={history.worldTeamOfYearSelections}
                playersByPid={playersByPid}
              />
            </div>
            <div className="col-md-4">
              <HonourList
                title="Goalkeeper of the Year"
                honours={history.goalkeeperOfYearWinners}
                playersByPid={playersByPid}
              />
            </div>
            <div className="col-md-4">
              <HonourList
                title="Defender of the Year"
                honours={history.defenderOfYearWinners}
                playersByPid={playersByPid}
              />
            </div>
            <div className="col-md-4">
              <HonourList title="Player of the Season" honours={history.playerOfSeason} playersByPid={playersByPid} />
            </div>
            <div className="col-md-4">
              <HonourList
                title="Golden Boot"
                icon={<GoldenBootIcon />}
                honours={history.goldenBoots}
                playersByPid={playersByPid}
              />
            </div>
            <div className="col-md-4">
              <HonourList
                title="Team of the Season"
                honours={history.teamOfSeasonSelections}
                playersByPid={playersByPid}
              />
            </div>
          </div>

          <h5>Franchise Records</h5>
          <div className="row g-3 mb-4">
            <div className="col-6 col-md-3">
              <StatCard
                label="Best Finish"
                value={history.bestFinish ? ordinal(history.bestFinish.position) : "—"}
                sub={history.bestFinish ? `Div ${history.bestFinish.tier} · ${seasonYear(history.bestFinish.season)}` : ""}
              />
            </div>
            <div className="col-6 col-md-3">
              <StatCard
                label="Most Points"
                value={history.mostPoints?.points ?? "—"}
                sub={history.mostPoints ? seasonYear(history.mostPoints.season) : ""}
              />
            </div>
            <div className="col-6 col-md-3">
              <StatCard
                label="Most Wins"
                value={history.mostWins?.won ?? "—"}
                sub={history.mostWins ? seasonYear(history.mostWins.season) : ""}
              />
            </div>
            <div className="col-6 col-md-3">
              <StatCard
                label="All-Time Record"
                value={`${history.totals.won}-${history.totals.drawn}-${history.totals.lost}`}
                sub={`${history.totals.gf}–${history.totals.ga} GF/GA · ${history.totals.played} played`}
              />
            </div>
          </div>

          <h5>Season by Season</h5>
          {/* Thirteen columns don't fit a narrow window, and unwrapped they
              pushed the page itself sideways. Scroll the table instead, the way
              every other wide table here does. */}
          <div className="table-responsive">
          <table className="table table-striped table-sm">
            <thead>
              <tr>
                <th>Season</th>
                <th>Competition</th>
                <th className="text-end">Pos</th>
                <th className="text-end">P</th>
                <th className="text-end">W</th>
                <th className="text-end">D</th>
                <th className="text-end">L</th>
                <th className="text-end">GF</th>
                <th className="text-end">GA</th>
                <th className="text-end">GD</th>
                <th className="text-end">Pts</th>
                <th>Notes</th>
                {/* The chevron's column. Empty rather than labelled: it is an
                    affordance, not data. */}
                <th aria-hidden="true" />
              </tr>
            </thead>
            <tbody>
              {history.seasons.map((s) => {
                const comp = competitionOf(league.competitions, s.compId);
                const notes: string[] = [];
                if (s.champion) notes.push(s.tier === 1 ? "Champions" : "Div 2 Champions");
                if (s.promoted) notes.push("Promoted");
                if (s.relegated) notes.push("Relegated");
                const cupNote = cupRunNote(s.cupRun);
                if (cupNote) notes.push(cupNote);
                if (s.shieldRun) notes.push(`Shield ${s.shieldRun.note}`);
                if (s.domesticCupRun) notes.push(`Domestic cup ${s.domesticCupRun.note.toLowerCase()}`);
                if (s.treble) notes.push("The treble");
                const href = `/club/${tid}/${s.season}`;
                return (
                  <tr
                    key={s.season}
                    className={`season-row${s.champion && s.tier === 1 ? " champion-highlight" : ""}`}
                    /**
                     * The whole row opens that season, but the year stays a real
                     * anchor below — that is what keeps cmd-click, middle-click,
                     * "open in new tab" and keyboard focus working, none of
                     * which a click handler on a <tr> can offer.
                     *
                     * So this handler has to stay out of the anchor's way: a
                     * click that already landed on a link is the link's, and a
                     * click that ends a text selection is the user reading the
                     * table, not asking to leave it.
                     */
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("a")) return;
                      if (window.getSelection()?.toString()) return;
                      navigate(href);
                    }}
                  >
                    {/* The season year is the way into that season on its own:
                        the club is already named at the top of the page, so
                        repeating it in every row would be noise. */}
                    <td><Link to={href}>{seasonYear(s.season)}</Link></td>
                    <td>{comp.name}</td>
                    <td className="text-end">
                      {ordinal(s.position)}
                      <span className="text-muted">/{s.teamsInComp}</span>
                    </td>
                    <td className="text-end">{s.row.played}</td>
                    <td className="text-end">{s.row.won}</td>
                    <td className="text-end">{s.row.drawn}</td>
                    <td className="text-end">{s.row.lost}</td>
                    <td className="text-end">{s.row.gf}</td>
                    <td className="text-end">{s.row.ga}</td>
                    <td className="text-end">{s.row.gd}</td>
                    <td className="text-end">{s.row.points}</td>
                    <td className="small text-muted">{notes.join(" · ")}</td>
                    {/* Hidden from screen readers: the year in the first cell
                        is already a real link saying where this goes, and a
                        second announcement of the same destination is noise. */}
                    <td className="season-row-go" aria-hidden="true">&rsaquo;</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </>
      )}
    </div>
  );
}
