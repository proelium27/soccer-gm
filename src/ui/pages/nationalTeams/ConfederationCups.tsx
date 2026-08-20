import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLeague } from "../../context/LeagueContext.js";
import { seasonYear } from "../../format.js";
import type {
  IntlConfederationCup, IntlTournamentSummary,
} from "../../../core/international/index.js";
import { tournamentGoals } from "../../../core/international/index.js";
import { PlayerRefLink } from "../../components/PlayerRefLink.js";
import { INTL_CYCLE_YEARS } from "../../../core/constants.js";
import {
  NationalTeamsLayout, NationName, GroupCards, liveGroupRows, KnockoutColumns, SeasonSelect,
  useHasInternational, IntlEmpty, type StandingRow, type KnockoutResultView,
} from "./shared.js";

/**
 * The confederation cups — the Euro, Copa América, AFCON and any other
 * confederation big enough to hold one.
 *
 * One page for all of them rather than a tab each: they are played in the same
 * offseason and finish on the same day, so the interesting view is the whole
 * summer at once. Each cup gets a section, in the fixed order the spec table
 * defines, and a year picker browses past editions.
 */

function ChampionBanner({ champion }: { champion: string }) {
  return (
    <div className="cup-champion-banner mb-3">
      <span className="cup-champion-label">Winners</span> <NationName nation={champion} />
    </div>
  );
}

/**
 * One cup, live or archived, normalized to the same shape first so
 * both render through one component. `advancing` and `koRounds` vary by
 * tournament — a confederation with five nations plays a single table into a
 * final, one with twenty-five plays four groups into a quarter-final.
 */
function Championship({
  name,
  champion,
  groups,
  advancing,
  knockout,
  scorers,
  goldenBoot,
}: {
  name: string;
  champion: string | null;
  groups: StandingRow[][];
  advancing: number;
  knockout: KnockoutResultView[];
  scorers?: { pid: number; goals: number; nationality?: string }[];
  goldenBoot?: IntlTournamentSummary["topScorer"];
}) {
  const koRounds = new Set(knockout.map((k) => k.round)).size;
  return (
    <div className="mb-4">
      <h5 className="mb-2">{name}</h5>
      {champion && <ChampionBanner champion={champion} />}
      {groups.length > 0 && (
        <>
          <h6 className="mt-3">{groups.length === 1 ? "Group table" : "Group stage"}</h6>
          <GroupCards groups={groups} advancing={advancing} />
        </>
      )}
      <h6>Knockout</h6>
      <KnockoutColumns results={knockout} totalRounds={koRounds || undefined} />
      {scorers && scorers.length > 0 && (
        <>
          <h6>Leading scorers</h6>
          <table className="table table-sm w-auto mb-3">
            <tbody>
              {scorers.map((s) => (
                <tr key={s.pid}>
                  <td><PlayerRefLink pid={s.pid} fallback="(retired)" /></td>
                  <td>{s.nationality && <NationName nation={s.nationality} />}</td>
                  <td className="text-end fw-bold">{s.goals}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {goldenBoot && (
        <p className="small">
          <span className="text-muted">Golden Boot: </span>
          <Link to={`/player/${goldenBoot.pid}`}>{goldenBoot.name ?? `#${goldenBoot.pid}`}</Link>{" "}
          (<NationName nation={goldenBoot.nation} />, {goldenBoot.goals} goals)
        </p>
      )}
    </div>
  );
}

function LiveChampionship({ tournament }: { tournament: IntlConfederationCup }) {
  const { league } = useLeague();
  const nations = tournament.nations;

  const scorers = useMemo(() => {
    const goals = tournamentGoals(tournament);
    const byPid = new Map((league?.players ?? []).map((p) => [p.pid, p]));
    const retiredByPid = new Map((league?.retiredPlayers ?? []).map((a) => [a.pid, a]));
    return [...goals.entries()]
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1] || a[0] - b[0])
      .slice(0, 5)
      .map(([pid, n]) => ({
        pid,
        goals: n,
        nationality: byPid.get(pid)?.nationality ?? retiredByPid.get(pid)?.nationality,
      }));
  }, [tournament, league?.players, league?.retiredPlayers]);

  return (
    <Championship
      name={tournament.name}
      champion={tournament.championNid !== null ? nations[tournament.championNid] : null}
      groups={tournament.groups.map((g) => liveGroupRows(g, nations))}
      advancing={tournament.qualifyPerGroup}
      knockout={tournament.ties.map((t) => ({
        round: t.round,
        home: nations[t.home],
        away: nations[t.away],
        homeGoals: t.homeGoals,
        awayGoals: t.awayGoals,
        winner: nations[t.winner],
        pens: t.wentToPens ? { home: t.homePens, away: t.awayPens } : null,
        extraTime: t.wentToExtraTime,
      }))}
      scorers={scorers}
    />
  );
}

function ArchivedChampionship({ summary }: { summary: IntlTournamentSummary }) {
  return (
    <Championship
      name={summary.name}
      champion={summary.champion}
      groups={summary.groups.map((g) => g.rows)}
      // Every supported shape advances two from each group (see format.ts), and
      // an archived summary keeps tables rather than the format that produced
      // them, so this is a constant here rather than a stored field.
      advancing={2}
      knockout={summary.knockout.map((k) => ({
        round: k.round,
        home: k.home,
        away: k.away,
        homeGoals: k.homeGoals,
        awayGoals: k.awayGoals,
        winner: k.winner,
        pens: k.pens,
        extraTime: k.extraTime,
      }))}
      goldenBoot={summary.topScorer}
    />
  );
}

export function NTConfederationCups() {
  const { league } = useLeague();
  const hasIntl = useHasInternational();
  const live = league?.international.confederationCups ?? [];
  const history = league?.international.confederationCupHistory ?? [];

  const seasons = useMemo(() => {
    const set = new Set<number>();
    for (const t of live) set.add(t.season);
    for (const h of history) set.add(h.season);
    return [...set].sort((a, b) => b - a);
  }, [live, history]);

  const [season, setSeason] = useState<number | null>(null);
  const selected = season ?? seasons[0] ?? null;

  if (!hasIntl || !league) return <IntlEmpty />;

  const liveThisSeason = live.filter((t) => t.season === selected);
  const archivedThisSeason = history.filter((h) => h.season === selected);
  // The live copies are the fuller record (they keep box scores, so they can
  // show leading scorers), so a cup present in both is shown live.
  const archivedOnly = archivedThisSeason.filter(
    (h) => !liveThisSeason.some((t) => t.confederation === h.confederation),
  );

  return (
    <NationalTeamsLayout title="Confederation Cups">
      <SeasonSelect
        seasons={seasons}
        value={selected ?? 0}
        onChange={setSeason}
        labelFor={(s) => `${seasonYear(s)}`}
      />
      {liveThisSeason.length === 0 && archivedOnly.length === 0 ? (
        <p className="text-muted">
          No confederation cup has been played yet. They come round every{" "}
          {INTL_CYCLE_YEARS} seasons, two years either side of the World Cup, and a
          confederation needs enough nations with real player pools to hold one.
        </p>
      ) : (
        <>
          {liveThisSeason.map((t) => <LiveChampionship key={t.confederation} tournament={t} />)}
          {archivedOnly.map((h) => (
            <ArchivedChampionship key={h.confederation ?? h.name} summary={h} />
          ))}
        </>
      )}
    </NationalTeamsLayout>
  );
}
