import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLeague } from "../../context/LeagueContext.js";
import { seasonYear } from "../../format.js";
import type {
  IntlTournament, IntlTournamentSummary,
} from "../../../core/international/index.js";
import { tournamentGoals } from "../../../core/international/index.js";
import { INTL_TOURNAMENT_NAME, INTL_QUALIFY_PER_GROUP } from "../../../core/constants.js";
import {
  NationalTeamsLayout, NationName, GroupStandings, liveGroupRows, KnockoutColumns, SeasonSelect,
  useHasInternational, IntlEmpty, type StandingRow, type KnockoutResultView,
} from "./shared.js";

function ChampionBanner({ champion }: { champion: string }) {
  return (
    <div className="cup-champion-banner mb-3">
      <span className="cup-champion-label">Winners</span> <NationName nation={champion} />
    </div>
  );
}

/** Group cards from already-normalized standings, top INTL_QUALIFY_PER_GROUP shaded. */
function GroupStage({ groups }: { groups: StandingRow[][] }) {
  return (
    <>
      <h6 className="mt-3">Group stage</h6>
      <div className="row g-3 mb-3">
        {groups.map((rows, i) => {
          const advancing = new Set(rows.slice(0, INTL_QUALIFY_PER_GROUP).map((r) => r.nation));
          return (
            <div className="col-12 col-lg-6" key={i}>
              <div className="card">
                <div className="card-header py-1 small fw-bold">Group {String.fromCharCode(65 + i)}</div>
                <GroupStandings rows={rows} highlight={(n) => advancing.has(n)} />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function LiveTournament({ tournament }: { tournament: IntlTournament }) {
  const { league } = useLeague();
  const nations = tournament.nations;
  const champion = tournament.championNid !== null ? nations[tournament.championNid] : null;

  const groups = tournament.groups.map((g) => liveGroupRows(g, nations));
  const knockout: KnockoutResultView[] = tournament.ties.map((t) => ({
    round: t.round,
    home: nations[t.home],
    away: nations[t.away],
    homeGoals: t.homeGoals,
    awayGoals: t.awayGoals,
    winner: nations[t.winner],
    pens: t.wentToPens ? { home: t.homePens, away: t.awayPens } : null,
    extraTime: t.wentToExtraTime,
  }));

  const scorers = useMemo(() => {
    const goals = tournamentGoals(tournament);
    const byPid = new Map((league?.players ?? []).map((p) => [p.pid, p]));
    return [...goals.entries()]
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1] || a[0] - b[0])
      .slice(0, 10)
      .map(([pid, n]) => ({ pid, goals: n, player: byPid.get(pid) }));
  }, [tournament, league?.players]);

  return (
    <>
      {champion && <ChampionBanner champion={champion} />}
      <GroupStage groups={groups} />
      <h6>Knockout</h6>
      <KnockoutColumns results={knockout} />
      {scorers.length > 0 && (
        <>
          <h6>Leading scorers</h6>
          <table className="table table-sm w-auto mb-3">
            <tbody>
              {scorers.map((s) => (
                <tr key={s.pid}>
                  <td>
                    {s.player
                      ? <Link to={`/player/${s.pid}`}>{s.player.name}</Link>
                      : <span className="text-muted">(retired)</span>}
                  </td>
                  <td>{s.player && <NationName nation={s.player.nationality} />}</td>
                  <td className="text-end fw-bold">{s.goals}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}

function ArchivedTournament({ summary }: { summary: IntlTournamentSummary }) {
  const groups = summary.groups.map((g) => g.rows);
  const knockout: KnockoutResultView[] = summary.knockout.map((k) => ({
    round: k.round,
    home: k.home,
    away: k.away,
    homeGoals: k.homeGoals,
    awayGoals: k.awayGoals,
    winner: k.winner,
    pens: k.pens,
    extraTime: k.extraTime,
  }));

  return (
    <>
      <ChampionBanner champion={summary.champion} />
      {groups.length > 0 ? <GroupStage groups={groups} /> : null}
      {knockout.length > 0 && (
        <>
          <h6>Knockout</h6>
          <KnockoutColumns results={knockout} />
        </>
      )}
      {summary.topScorer && (
        <p className="small">
          <span className="text-muted">Golden Boot: </span>
          <Link to={`/player/${summary.topScorer.pid}`}>
            {summary.topScorer.name ?? `#${summary.topScorer.pid}`}
          </Link>{" "}
          (<NationName nation={summary.topScorer.nation} />, {summary.topScorer.goals} goals)
        </p>
      )}
    </>
  );
}

export function NTWorldCup() {
  const { league } = useLeague();
  const hasIntl = useHasInternational();
  const current = league?.international.tournament ?? null;
  const history = league?.international.history ?? [];

  // Newest first: the current (maybe in-progress) tournament, then archived ones.
  const seasons = useMemo(() => {
    const set = new Set<number>();
    if (current) set.add(current.season);
    for (const h of history) set.add(h.season);
    return [...set].sort((a, b) => b - a);
  }, [current, history]);

  const [season, setSeason] = useState<number | null>(null);
  const selected = season ?? seasons[0] ?? null;

  if (!hasIntl || !league) return <IntlEmpty />;

  const showingCurrent = current !== null && selected === current.season;
  const archived = history.find((h) => h.season === selected) ?? null;

  return (
    <NationalTeamsLayout title={INTL_TOURNAMENT_NAME}>
      <SeasonSelect
        seasons={seasons}
        value={selected ?? 0}
        onChange={setSeason}
        labelFor={(s) => `${INTL_TOURNAMENT_NAME} ${seasonYear(s)}`}
      />
      {showingCurrent && current
        ? <LiveTournament tournament={current} />
        : archived
          ? <ArchivedTournament summary={archived} />
          : <p className="text-muted">No tournament has been played yet.</p>}
    </NationalTeamsLayout>
  );
}
