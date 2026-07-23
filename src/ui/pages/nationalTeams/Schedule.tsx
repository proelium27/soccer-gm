import { useMemo, useState } from "react";
import { useLeague } from "../../context/LeagueContext.js";
import type { IntlTournament, IntlQualifyingCampaign } from "../../../core/international/index.js";
import { INTL_TOURNAMENT_NAME } from "../../../core/constants.js";
import { NationalTeamsLayout, NationName, KO_ROUND_NAMES, useHasInternational, IntlEmpty } from "./shared.js";

/** One fixture row: a played result shows its scoreline, an unplayed one shows "v". */
function Fixture({ home, away, homeGoals, awayGoals }: {
  home: string; away: string; homeGoals: number; awayGoals: number;
}) {
  const played = homeGoals >= 0;
  return (
    <div className="d-flex align-items-center small py-1 border-bottom">
      <span className="text-end pe-2" style={{ flex: 1 }}><NationName nation={home} /></span>
      <span className="fw-bold" style={{ minWidth: "3rem", textAlign: "center" }}>
        {played ? `${homeGoals}-${awayGoals}` : "v"}
      </span>
      <span className="ps-2" style={{ flex: 1 }}><NationName nation={away} /></span>
    </div>
  );
}

function TournamentSchedule({ tournament }: { tournament: IntlTournament }) {
  const nations = tournament.nations;
  // Stages: 0 = group stage, then one per knockout round.
  const [stage, setStage] = useState(0);

  const koRounds = KO_ROUND_NAMES.length;
  const options = ["Group stage", ...KO_ROUND_NAMES];

  let body;
  if (stage === 0) {
    body = (
      <div className="row g-3">
        {tournament.groups.map((group, i) => (
          <div className="col-12 col-lg-6" key={i}>
            <div className="card">
              <div className="card-header py-1 small fw-bold">Group {String.fromCharCode(65 + i)}</div>
              <div className="card-body py-1">
                {group.matches.map((m, j) => (
                  <Fixture key={j} home={nations[m.home]} away={nations[m.away]} homeGoals={m.homeGoals} awayGoals={m.awayGoals} />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  } else {
    const round = stage - 1;
    const played = tournament.ties.filter((t) => t.round === round);
    if (played.length > 0) {
      body = (
        <div className="card">
          <div className="card-body py-1">
            {played.map((t, j) => (
              <Fixture key={j} home={nations[t.home]} away={nations[t.away]} homeGoals={t.homeGoals} awayGoals={t.awayGoals} />
            ))}
          </div>
        </div>
      );
    } else if (round === 0 && tournament.bracket.length > 0) {
      // Quarter-finals seeded but not yet played: show the known pairings.
      const pairs = [];
      for (let i = 0; i + 1 < tournament.bracket.length; i += 2) {
        pairs.push([tournament.bracket[i], tournament.bracket[i + 1]] as const);
      }
      body = (
        <div className="card">
          <div className="card-body py-1">
            {pairs.map(([h, a], j) => (
              <Fixture key={j} home={nations[h]} away={nations[a]} homeGoals={-1} awayGoals={-1} />
            ))}
          </div>
        </div>
      );
    } else {
      body = <p className="text-muted">To be decided once the previous round is played.</p>;
    }
  }

  return (
    <>
      <select
        className="form-select form-select-sm w-auto mb-3"
        value={stage}
        onChange={(e) => setStage(Number(e.target.value))}
      >
        {options.slice(0, 1 + koRounds).map((label, i) => (
          <option key={i} value={i}>{label}</option>
        ))}
      </select>
      {body}
    </>
  );
}

function QualifyingSchedule({ campaign }: { campaign: IntlQualifyingCampaign }) {
  const nations = campaign.nations;
  const confederations = useMemo(
    () => [...new Set(campaign.groups.map((g) => g.confederation ?? "Other"))],
    [campaign.groups],
  );
  const [conf, setConf] = useState("");

  const shown = campaign.groups
    .map((g, index) => ({ g, index }))
    .filter(({ g }) => !conf || (g.confederation ?? "Other") === conf);

  return (
    <>
      {confederations.length > 1 && (
        <select
          className="form-select form-select-sm w-auto mb-3"
          value={conf}
          onChange={(e) => setConf(e.target.value)}
        >
          <option value="">All confederations</option>
          {confederations.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      )}
      <div className="row g-3">
        {shown.map(({ g, index }) => (
          <div className="col-12 col-lg-6" key={index}>
            <div className="card">
              <div className="card-header py-1 small fw-bold">
                {g.confederation ?? "Group"} &middot; Group {index + 1}
              </div>
              <div className="card-body py-1">
                {g.matches.map((m, j) => (
                  <Fixture key={j} home={nations[m.home]} away={nations[m.away]} homeGoals={m.homeGoals} awayGoals={m.awayGoals} />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export function NTSchedule() {
  const { league } = useLeague();
  const hasIntl = useHasInternational();
  if (!hasIntl || !league) return <IntlEmpty />;

  const { tournament, qualifying, stage } = league.international;
  // Show whichever campaign is live this offseason; between campaigns, fall back
  // to the most recent one so its fixtures stay browsable.
  const showTournament = stage === "groups" || stage === "qf" || stage === "sf" || stage === "final"
    ? true
    : stage === "qualifying"
      ? false
      : tournament !== null;

  return (
    <NationalTeamsLayout title="Schedule">
      {showTournament && tournament ? (
        <>
          <p className="text-muted small">{INTL_TOURNAMENT_NAME} fixtures. Pick a stage to see its matches.</p>
          <TournamentSchedule tournament={tournament} />
        </>
      ) : qualifying ? (
        <>
          <p className="text-muted small">Qualifying fixtures, played home and away within each confederation.</p>
          <QualifyingSchedule campaign={qualifying} />
        </>
      ) : (
        <p className="text-muted">No fixtures to show yet.</p>
      )}
    </NationalTeamsLayout>
  );
}
