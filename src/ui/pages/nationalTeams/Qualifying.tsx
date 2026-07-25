import { useMemo, useState } from "react";
import { useLeague } from "../../context/LeagueContext.js";
import { seasonYear } from "../../format.js";
import { INTL_TOURNAMENT_NAME } from "../../../core/constants.js";
import {
  NationalTeamsLayout, NationName, GroupStandings, liveGroupRows, SeasonSelect,
  useHasInternational, IntlEmpty, type StandingRow,
} from "./shared.js";

/** A confederation's groups, already normalized to nation-keyed standings. */
interface ConfGroups {
  confederation: string;
  groups: StandingRow[][];
}

function QualifyingView({
  entered,
  qualified,
  byConfederation,
}: {
  entered: number;
  qualified: string[];
  byConfederation: ConfGroups[];
}) {
  const qualifiedSet = new Set(qualified);
  return (
    <>
      <h6>Qualified for the {INTL_TOURNAMENT_NAME}</h6>
      <div className="mb-3 d-flex flex-wrap gap-2">
        {qualified.length === 0
          ? <span className="text-muted">Qualifying is still being played.</span>
          : qualified.map((nation) => (
              <span className="badge text-bg-success" key={nation}><NationName nation={nation} /></span>
            ))}
      </div>

      <p className="text-muted small">
        {entered} nations entered. Groups are played home and away, and how many places each
        confederation gets depends on how many genuinely competitive nations it has.
      </p>

      {byConfederation.map(({ confederation, groups }) => (
        <div className="mb-3" key={confederation}>
          <h6>{confederation}</h6>
          <div className="row g-3">
            {groups.map((rows, i) => (
              <div className="col-12 col-lg-6" key={i}>
                <div className="card">
                  <div className="card-header py-1 small fw-bold">Group {i + 1}</div>
                  <GroupStandings rows={rows} highlight={(n) => qualifiedSet.has(n)} compact />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

/** Bucket a flat list of {confederation, rows} groups into per-confederation columns. */
function bucketByConfederation(
  groups: { confederation: string | null; rows: StandingRow[] }[],
): ConfGroups[] {
  const map = new Map<string, StandingRow[][]>();
  for (const g of groups) {
    const key = g.confederation ?? "Other";
    const list = map.get(key);
    if (list) list.push(g.rows);
    else map.set(key, [g.rows]);
  }
  return [...map.entries()].map(([confederation, groups]) => ({ confederation, groups }));
}

export function NTQualifying() {
  const { league } = useLeague();
  const hasIntl = useHasInternational();
  const current = league?.international.qualifying ?? null;
  const history = league?.international.qualifyingHistory ?? [];

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

  let body;
  if (showingCurrent && current) {
    body = (
      <QualifyingView
        entered={current.nations.length}
        qualified={current.qualified}
        byConfederation={bucketByConfederation(
          current.groups.map((g) => ({ confederation: g.confederation, rows: liveGroupRows(g, current.nations) })),
        )}
      />
    );
  } else if (archived) {
    body = (
      <QualifyingView
        entered={archived.entered}
        qualified={archived.qualified}
        byConfederation={bucketByConfederation(archived.groups)}
      />
    );
  } else {
    body = <p className="text-muted">No qualifying campaign has been played yet.</p>;
  }

  return (
    <NationalTeamsLayout title="Qualifying">
      <SeasonSelect
        seasons={seasons}
        value={selected ?? 0}
        onChange={setSeason}
        labelFor={(s) => `Qualifying ${seasonYear(s)}`}
      />
      {body}
    </NationalTeamsLayout>
  );
}
