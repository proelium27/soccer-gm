import { useMemo, useState } from "react";
import { useLeague } from "../../context/LeagueContext.js";
import { seasonYear } from "../../format.js";
import { NationalTeamsLayout, NationName, SeasonSelect, useHasInternational, IntlEmpty } from "./shared.js";

/** Rank change vs the previous snapshot: up (green), down (red), steady, or new. */
function Movement({ delta, isNew }: { delta: number; isNew: boolean }) {
  if (isNew) return <span className="text-muted small">new</span>;
  if (delta > 0) return <span className="text-success small">+{delta}</span>;
  if (delta < 0) return <span className="text-danger small">{delta}</span>;
  return <span className="text-muted small">-</span>;
}

export function NTPowerRankings() {
  const { league } = useLeague();
  const hasIntl = useHasInternational();
  const snapshots = league?.international.powerRankings ?? [];

  const seasons = useMemo(
    () => snapshots.map((s) => s.season).sort((a, b) => b - a),
    [snapshots],
  );
  const [season, setSeason] = useState<number | null>(null);
  const selected = season ?? seasons[0] ?? null;

  if (!hasIntl) return <IntlEmpty />;

  const idx = snapshots.findIndex((s) => s.season === selected);
  const snapshot = idx >= 0 ? snapshots[idx] : null;
  const previous = idx > 0 ? snapshots[idx - 1] : null;
  const prevRank = new Map((previous?.ranks ?? []).map((r, i) => [r.nation, i + 1]));

  return (
    <NationalTeamsLayout title="Power Rankings">
      {snapshot === null ? (
        <p className="text-muted">No rankings yet. They're taken each time a campaign is drawn.</p>
      ) : (
        <>
          <p className="text-muted small">
            Every eligible nation, ranked by its best-available-squad rating at the end of the
            season. Movement is against the previous ranking.
          </p>
          <SeasonSelect
            seasons={seasons}
            value={selected ?? 0}
            onChange={setSeason}
            labelFor={(s) => `Rankings ${seasonYear(s)}`}
          />
          <table className="table table-sm w-auto">
            <thead>
              <tr>
                <th className="text-end">#</th>
                <th>Nation</th>
                <th className="text-end">Rating</th>
                <th className="text-end">Move</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.ranks.map((r, i) => {
                const before = prevRank.get(r.nation);
                return (
                  <tr key={r.nation}>
                    <td className="text-end text-muted">{i + 1}</td>
                    <td><NationName nation={r.nation} /></td>
                    <td className="text-end fw-bold">{r.rating.toFixed(1)}</td>
                    <td className="text-end">
                      <Movement delta={before ? before - (i + 1) : 0} isNew={!before} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </NationalTeamsLayout>
  );
}
