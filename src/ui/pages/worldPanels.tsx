/**
 * Dashboard panels about the world rather than about your club.
 *
 * They live here rather than in the dashboard that renders them for the reason
 * `managerPanels.tsx` exists: a dashboard is a layout, and the things it lays
 * out are worth reading on their own. Nothing in here touches `meta.userTid`,
 * so they are equally at home on a managed dashboard if they are ever wanted
 * there.
 */
import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { LeagueStore } from "../../core/leagueState.js";
import type { CupState } from "../../core/cup/types.js";
import type { IntlTournament } from "../../core/international/types.js";
import { ClubLink } from "../components/ClubLink.js";
import { MiniBracket, type MiniBracketTie } from "../components/MiniBracket.js";
import { computePowerRankingSnapshot } from "../../core/teams/powerRanking.js";
import { koRoundsOf, cupRoundName, isCupComplete } from "../../core/cup/cup.js";
import { leaguePhaseTable } from "../../core/cup/leaguePhase.js";
import { koRoundName, NationName } from "./nationalTeams/shared.js";
import { isTournamentSeason, isConfederationCupSeason } from "../../core/constants.js";

/** How many clubs the power-ranking panel lists before pointing at the full board. */
const POWER_TOP_N = 10;
/** How many league-phase rows to show while a cup is still in that stage. */
const LEAGUE_PHASE_TOP_N = 4;

function Panel({ title, link, linkLabel, children }: {
  title: string;
  link?: string;
  linkLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card h-100">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-baseline gap-2 mb-2">
          <h5 className="card-title mb-0">{title}</h5>
          {link && <Link to={link} className="small">{linkLabel ?? "More"}</Link>}
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * The world's best clubs right now, across every division.
 *
 * World-wide rather than per-competition on purpose: the table panel beside
 * this one is already a league you chose, so ranking within a league here would
 * be the same question twice. This is the one place a spectator can see all 24
 * divisions measured against each other.
 */
export function PowerRankingPanel({ league, highlightTid }: {
  league: LeagueStore;
  /**
   * Shade this club's row, the same `.team-highlight` Standings and the full
   * Power Rankings board use. Passed only by the managed dashboard: a spectator
   * has no club to pick out, and shading nothing is the honest reading.
   */
  highlightTid?: number;
}) {
  // Walks every club in the world building team ratings, so it is memoized on
  // the league object (fresh per commit) rather than recomputed per render.
  const rows = useMemo(
    () => computePowerRankingSnapshot(
      league.teams, league.players, league.played, league.season, 0,
    ).rows.slice(0, POWER_TOP_N),
    [league],
  );

  return (
    <Panel title="Power rankings" link="/power-rankings" linkLabel="Full board">
      <table className="table table-sm mb-0">
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.tid} className={r.tid === highlightTid ? "team-highlight" : undefined}>
              <td className="text-muted" style={{ width: "1.5rem" }}>{i + 1}</td>
              <td><ClubLink tid={r.tid} crest /></td>
              {/* The power score, not OVR. The board is ordered by power (squad
                  strength blended with form), so an OVR column beside it runs
                  76, 75, 74, 77 and reads as an unsorted list — the full page
                  can show both because it has a header and a help note
                  explaining the difference, and this has room for neither. */}
              <td className="text-end text-muted">{Math.round(r.powerScore)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

/** Turn a cup's played knockout ties into bracket lines, drawn as clubs. */
function cupTies(cup: CupState): MiniBracketTie[] {
  return cup.ties.map((t): MiniBracketTie => ({
    round: t.round,
    home: <ClubLink tid={t.home} variant="abbrev" />,
    away: <ClubLink tid={t.away} variant="abbrev" />,
    homeGoals: t.homeGoals,
    awayGoals: t.awayGoals,
    winner: t.winner === t.home ? "home" : t.winner === t.away ? "away" : null,
    pens: t.wentToPens ? { home: t.homePens, away: t.awayPens } : null,
  }));
}

/**
 * One continental competition: its bracket once the knockout starts, and the
 * league-phase leaders before that.
 *
 * The stage split is what makes this worth a panel at all. A cup spends most of
 * the season in its Swiss league phase, and a bracket card that is empty from
 * August to March is a card nobody looks at twice.
 */
export function CupBracketPanel({ cup, title, href }: {
  cup: CupState | null;
  title: string;
  href: string;
}) {
  if (!cup) {
    return (
      <Panel title={title}>
        <p className="text-muted small mb-0">
          Seeded from last season's tables, so it starts next season.
        </p>
      </Panel>
    );
  }

  const ties = cupTies(cup);
  const champion = isCupComplete(cup) && cup.championTid !== null ? cup.championTid : null;

  // Before the knockout, the story is the league-phase table. `leaguePhaseTable`
  // is derived rather than stored, so this is the same table the cup page draws.
  const lp = ties.length === 0 && cup.leaguePhase
    ? leaguePhaseTable(cup.leaguePhase, cup.seeds)
    : null;
  const played = cup.leaguePhase?.matches.filter((m) => m.played).length ?? 0;

  return (
    <Panel title={title} link={href} linkLabel="Full bracket">
      {champion !== null && (
        <p className="small mb-2">
          <ClubLink tid={champion} crest /> <span className="text-muted">win it.</span>
        </p>
      )}
      {lp ? (
        played === 0 ? (
          <p className="text-muted small mb-0">Drawn. The league phase kicks off shortly.</p>
        ) : (
          <>
            <div className="text-muted text-uppercase fw-semibold mini-bracket-round">
              League phase
            </div>
            <table className="table table-sm mb-0">
              <tbody>
                {lp.slice(0, LEAGUE_PHASE_TOP_N).map((r, i) => (
                  <tr key={r.tid}>
                    <td className="text-muted" style={{ width: "1.5rem" }}>{i + 1}</td>
                    <td><ClubLink tid={r.tid} crest /></td>
                    <td className="text-end">{r.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )
      ) : (
        <MiniBracket
          ties={ties}
          totalRounds={koRoundsOf(cup)}
          roundName={cupRoundName}
          empty="The knockout hasn't started yet."
        />
      )}
    </Panel>
  );
}

/** Turn an international tournament's ties into bracket lines, drawn as nations. */
function intlTies(t: IntlTournament): MiniBracketTie[] {
  const nameOf = (nid: number) => t.nations[nid] ?? "?";
  return t.ties.map((tie): MiniBracketTie => ({
    round: tie.round,
    home: <NationName nation={nameOf(tie.home)} />,
    away: <NationName nation={nameOf(tie.away)} />,
    homeGoals: tie.homeGoals,
    awayGoals: tie.awayGoals,
    winner: tie.winner === tie.home ? "home" : tie.winner === tie.away ? "away" : null,
    pens: tie.wentToPens ? { home: tie.homePens, away: tie.awayPens } : null,
  }));
}

/**
 * Bracket depth from the field rather than from the rounds played so far.
 *
 * Naming a round counts backwards from the final, so deriving the depth from
 * what has been played calls the first round of a half-finished tournament its
 * final. `bracket` holds the qualified nations and is empty until the groups
 * finish, which is also exactly when there are no ties to name.
 */
function intlRounds(t: IntlTournament): number {
  return t.bracket.length > 1 ? Math.round(Math.log2(t.bracket.length)) : 1;
}

/**
 * The summer's international football, shown only in the offseasons that have
 * a tournament in them.
 *
 * The cycle is four seasons: a World Cup on `season % 4 === 0`, the
 * confederation championships on `season % 4 === 2`, and qualifying alone on
 * the other two — so this appears every other year, which is the shape of the
 * real calendar rather than a display rule.
 */
export function InternationalBracketPanel({ league }: { league: LeagueStore }) {
  const worldCup = isTournamentSeason(league.season);
  const confederations = isConfederationCupSeason(league.season);
  if (league.phase !== "offseason" || (!worldCup && !confederations)) return null;

  if (worldCup) {
    const t = league.international.tournament;
    return (
      <Panel title="World Cup" link="/national-teams/world-cup" linkLabel="Full bracket">
        {!t ? (
          <p className="text-muted small mb-0">Waiting on the draw.</p>
        ) : (
          <>
            {t.championNid !== null && (
              <p className="small mb-2">
                <NationName nation={t.nations[t.championNid] ?? "?"} />{" "}
                <span className="text-muted">win it.</span>
              </p>
            )}
            <MiniBracket
              ties={intlTies(t)}
              totalRounds={intlRounds(t)}
              roundName={koRoundName}
              empty="The group stage is still being played."
            />
          </>
        )}
      </Panel>
    );
  }

  const cups = league.international.confederationCups ?? [];
  return (
    <Panel title="Confederation cups" link="/national-teams/confederation-cups" linkLabel="All of them">
      {cups.length === 0 ? (
        <p className="text-muted small mb-0">Waiting on the draws.</p>
      ) : (
        <div className="row g-3">
          {cups.map((c) => (
            <div className="col-md-6 col-lg-4" key={c.confederation}>
              <div className="fw-semibold small mb-1">
                {c.name}
                {c.championNid !== null && (
                  <span className="text-muted fw-normal">
                    {" — "}<NationName nation={c.nations[c.championNid] ?? "?"} />
                  </span>
                )}
              </div>
              <MiniBracket
                ties={intlTies(c)}
                totalRounds={intlRounds(c)}
                roundName={koRoundName}
                empty="Groups still being played."
              />
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
