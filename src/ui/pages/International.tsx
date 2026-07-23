import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLeague } from "../context/LeagueContext.js";
import { Flag } from "../components/Flag.js";
import { seasonYear } from "../format.js";
import type { IntlGroup, IntlTournament, IntlQualifyingCampaign } from "../../core/international/types.js";
import { groupTable } from "../../core/international/groups.js";
import { tournamentGoals } from "../../core/international/tournament.js";
import { INTL_TOURNAMENT_NAME, INTL_QUALIFY_PER_GROUP, isQualifyingSeason } from "../../core/constants.js";

/** Knockout round names for the three-round international bracket. */
const ROUND_NAMES = ["Quarter-finals", "Semi-finals", "Final"];

function NationName({ nation }: { nation: string }) {
  return (
    <span className="text-nowrap">
      <Flag nationality={nation} /> {nation}
    </span>
  );
}

function GroupTable({
  group,
  nations,
  advancing,
}: {
  group: IntlGroup;
  nations: string[];
  advancing: number;
}) {
  const rows = groupTable(group);
  return (
    <table className="table table-sm mb-0">
      <thead>
        <tr>
          <th style={{ width: "45%" }}>Nation</th>
          <th className="text-end">P</th>
          <th className="text-end">W</th>
          <th className="text-end">D</th>
          <th className="text-end">L</th>
          <th className="text-end">GD</th>
          <th className="text-end">Pts</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.nid} className={i < advancing ? "table-success" : undefined}>
            <td><NationName nation={nations[r.nid]} /></td>
            <td className="text-end">{r.played}</td>
            <td className="text-end">{r.won}</td>
            <td className="text-end">{r.drawn}</td>
            <td className="text-end">{r.lost}</td>
            <td className="text-end">{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
            <td className="text-end fw-bold">{r.points}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TournamentView({ tournament }: { tournament: IntlTournament }) {
  const { league } = useLeague();
  const nations = tournament.nations;
  const champion = tournament.championNid !== null ? nations[tournament.championNid] : null;

  // Leading scorers, from the tournament's own box scores.
  const scorers = useMemo(() => {
    const goals = tournamentGoals(tournament);
    const byPid = new Map((league?.players ?? []).map((p) => [p.pid, p]));
    return [...goals.entries()]
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1] || a[0] - b[0])
      .slice(0, 10)
      .map(([pid, n]) => ({ pid, goals: n, player: byPid.get(pid) }));
  }, [tournament, league?.players]);

  const rounds = useMemo(() => {
    const byRound = new Map<number, typeof tournament.ties>();
    for (const tie of tournament.ties) {
      const list = byRound.get(tie.round);
      if (list) list.push(tie);
      else byRound.set(tie.round, [tie]);
    }
    return [...byRound.entries()].sort((a, b) => a[0] - b[0]);
  }, [tournament]);

  return (
    <>
      {champion && (
        <div className="cup-champion-banner mb-3">
          <span className="cup-champion-label">Winners</span>{" "}
          <NationName nation={champion} />
        </div>
      )}

      <h6 className="mt-3">Group stage</h6>
      <div className="row g-3 mb-3">
        {tournament.groups.map((group, i) => (
          <div className="col-12 col-lg-6" key={i}>
            <div className="card">
              <div className="card-header py-1 small fw-bold">Group {String.fromCharCode(65 + i)}</div>
              <GroupTable group={group} nations={nations} advancing={INTL_QUALIFY_PER_GROUP} />
            </div>
          </div>
        ))}
      </div>

      <h6>Knockout</h6>
      <div className="row g-3 mb-3">
        {rounds.map(([round, ties]) => (
          <div className="col-12 col-md-4" key={round}>
            <div className="card">
              <div className="card-header py-1 small fw-bold">{ROUND_NAMES[round] ?? `Round ${round + 1}`}</div>
              <ul className="list-group list-group-flush">
                {ties.map((tie, i) => (
                  <li className="list-group-item py-2 small" key={i}>
                    <div className={tie.winner === tie.home ? "fw-bold" : undefined}>
                      <NationName nation={nations[tie.home]} /> {tie.homeGoals}
                    </div>
                    <div className={tie.winner === tie.away ? "fw-bold" : undefined}>
                      <NationName nation={nations[tie.away]} /> {tie.awayGoals}
                    </div>
                    {tie.wentToPens && (
                      <div className="text-muted">
                        {tie.homePens}-{tie.awayPens} on penalties
                      </div>
                    )}
                    {tie.wentToExtraTime && !tie.wentToPens && (
                      <div className="text-muted">after extra time</div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      {scorers.length > 0 && (
        <>
          <h6>Leading scorers</h6>
          <table className="table table-sm w-auto mb-3">
            <tbody>
              {scorers.map((s) => (
                <tr key={s.pid}>
                  <td>
                    {s.player ? (
                      <Link to={`/player/${s.pid}`}>{s.player.name}</Link>
                    ) : (
                      <span className="text-muted">(retired)</span>
                    )}
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

function QualifyingView({ campaign }: { campaign: IntlQualifyingCampaign }) {
  const qualified = new Set(campaign.qualified);
  const byConfederation = useMemo(() => {
    const map = new Map<string, { group: IntlGroup; index: number }[]>();
    campaign.groups.forEach((group, index) => {
      const key = group.confederation ?? "Other";
      const list = map.get(key);
      if (list) list.push({ group, index });
      else map.set(key, [{ group, index }]);
    });
    return [...map.entries()];
  }, [campaign]);

  return (
    <>
      <h6>Qualified for the next {INTL_TOURNAMENT_NAME}</h6>
      <div className="mb-3 d-flex flex-wrap gap-2">
        {campaign.qualified.map((nation) => (
          <span className="badge text-bg-success" key={nation}>
            <NationName nation={nation} />
          </span>
        ))}
      </div>

      <p className="text-muted small">
        {campaign.nations.length} nations entered. Groups are played home and away, and how many
        places each confederation gets depends on how many genuinely competitive nations it has.
      </p>

      {byConfederation.map(([confederation, groups]) => (
        <div className="mb-3" key={confederation}>
          <h6>{confederation}</h6>
          <div className="row g-3">
            {groups.map(({ group, index }) => (
              <div className="col-12 col-lg-6" key={index}>
                <div className="card">
                  <div className="card-header py-1 small fw-bold">Group {index + 1}</div>
                  <table className="table table-sm mb-0">
                    <thead>
                      <tr>
                        <th style={{ width: "50%" }}>Nation</th>
                        <th className="text-end">P</th>
                        <th className="text-end">GD</th>
                        <th className="text-end">Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupTable(group).map((r) => (
                        <tr
                          key={r.nid}
                          className={qualified.has(campaign.nations[r.nid]) ? "table-success" : undefined}
                        >
                          <td><NationName nation={campaign.nations[r.nid]} /></td>
                          <td className="text-end">{r.played}</td>
                          <td className="text-end">{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
                          <td className="text-end fw-bold">{r.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

export function International() {
  const { league } = useLeague();
  const [tab, setTab] = useState<"tournament" | "qualifying" | "history">("tournament");

  if (!league) return <p className="p-3">Loading...</p>;

  const { tournament, qualifying, history } = league.international;
  const hasAny = tournament !== null || qualifying !== null || history.length > 0;

  if (!hasAny) {
    return (
      <div className="container-fluid p-3">
        <h4>International</h4>
        <p className="text-muted">
          National teams play in the summer, on a two-year cycle. Every odd season&apos;s offseason
          runs qualifying, where every nation with enough players in the world plays its
          confederation group home and away for one of 16 places. The season after that, those 16
          meet in the {INTL_TOURNAMENT_NAME}: four groups of four, then quarter-finals, semi-finals
          and a final.
        </p>
        <p className="text-muted">
          Nobody manages a national team, including you. Squads pick themselves from whoever is
          good enough, so your job is to develop players worth calling up, then watch how they get
          on. The first qualifying campaign runs at the end of season 1.
        </p>
      </div>
    );
  }

  return (
    <div className="container-fluid p-3">
      <h4>International</h4>
      <p className="text-muted small">
        {isQualifyingSeason(league.season)
          ? `Qualifying for the next ${INTL_TOURNAMENT_NAME} is played at the end of this season.`
          : `The ${INTL_TOURNAMENT_NAME} is played at the end of this season.`}
      </p>

      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button
            className={`nav-link${tab === "tournament" ? " active" : ""}`}
            onClick={() => setTab("tournament")}
            disabled={!tournament}
          >
            {tournament ? `${INTL_TOURNAMENT_NAME} ${seasonYear(tournament.season)}` : INTL_TOURNAMENT_NAME}
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link${tab === "qualifying" ? " active" : ""}`}
            onClick={() => setTab("qualifying")}
            disabled={!qualifying}
          >
            {qualifying ? `Qualifying ${seasonYear(qualifying.season)}` : "Qualifying"}
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link${tab === "history" ? " active" : ""}`}
            onClick={() => setTab("history")}
          >
            Past winners
          </button>
        </li>
      </ul>

      {tab === "tournament" && (tournament
        ? <TournamentView tournament={tournament} />
        : <p className="text-muted">No tournament has been played yet.</p>)}

      {tab === "qualifying" && (qualifying
        ? <QualifyingView campaign={qualifying} />
        : <p className="text-muted">No qualifying campaign has been played yet.</p>)}

      {tab === "history" && (
        history.length === 0
          ? <p className="text-muted">No tournament has been completed yet.</p>
          : (
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Season</th>
                  <th>Winners</th>
                  <th>Runners-up</th>
                  <th>Final</th>
                  <th>Top scorer</th>
                </tr>
              </thead>
              <tbody>
                {[...history].reverse().map((h) => (
                  <tr key={h.season}>
                    <td>{seasonYear(h.season)}</td>
                    <td className="fw-bold"><NationName nation={h.champion} /></td>
                    <td><NationName nation={h.runnerUp} /></td>
                    <td>
                      {h.finalScore.champion}-{h.finalScore.runnerUp}
                      {h.finalScore.pens && (
                        <span className="text-muted">
                          {" "}({h.finalScore.pens.champion}-{h.finalScore.pens.runnerUp} pens)
                        </span>
                      )}
                    </td>
                    <td>
                      {h.topScorer
                        ? <><Link to={`/player/${h.topScorer.pid}`}>#{h.topScorer.pid}</Link> ({h.topScorer.goals})</>
                        : <span className="text-muted">-</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
      )}
    </div>
  );
}
