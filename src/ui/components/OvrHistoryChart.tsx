import { useState, type MouseEvent } from "react";
import type { Player } from "../../core/players/types.js";
import type { LeagueStore } from "../../core/leagueState.js";
import { ClubCrest } from "./ClubCrest.js";
import { seasonYear, currency } from "../format.js";

// SVG coordinate space. The chart is rendered at width:100% / height:auto, so
// these are just the aspect ratio + the units every position is computed in.
const W = 720;
const H = 260;
const M = { top: 18, right: 16, bottom: 26, left: 40 };
const PLOT_W = W - M.left - M.right;
const PLOT_H = H - M.top - M.bottom;

const ACADEMY_COLOR = "var(--sg-user)"; // blue
const SENIOR_COLOR = "var(--sg-loss)"; // red

/** Round `v` down/up to the nearest `step`. */
function floorTo(v: number, step: number) {
  return Math.floor(v / step) * step;
}
function ceilTo(v: number, step: number) {
  return Math.ceil(v / step) * step;
}

/**
 * A player's career OVR plotted against season (Transfermarkt-style area
 * chart). Seasons the player spent in the user's youth academy are drawn in
 * blue, senior-squad seasons in red; club crests mark transfers. Everything is
 * derived from `player.hist` (per-season OVR + academy flag) and
 * `league.transfers` — no stored chart state. `teamTidForSeason` resolves which
 * club the player was on in a given past season (for the hover tooltip).
 */
export function OvrHistoryChart({
  player,
  league,
  teamTidForSeason,
}: {
  player: Player;
  league: LeagueStore;
  teamTidForSeason: (season: number) => number | null;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const hist = [...player.hist].sort((a, b) => a.season - b.season);

  if (hist.length < 2) {
    return <p className="text-muted mb-0">Not enough history yet to chart.</p>;
  }

  const minSeason = hist[0].season;
  const maxSeason = hist[hist.length - 1].season;
  const seasonSpan = Math.max(1, maxSeason - minSeason);

  const ovrs = hist.map((h) => h.ovr);
  const domainMin = Math.max(0, floorTo(Math.min(...ovrs) - 4, 5));
  const domainMax = Math.min(99, Math.max(domainMin + 5, ceilTo(Math.max(...ovrs) + 4, 5)));
  const ovrSpan = domainMax - domainMin;

  const x = (season: number) => M.left + ((season - minSeason) / seasonSpan) * PLOT_W;
  const y = (ovr: number) => M.top + ((domainMax - ovr) / ovrSpan) * PLOT_H;

  const pts = hist.map((h) => ({ ...h, px: x(h.season), py: y(h.ovr) }));

  // Academy is a contiguous prefix (a player is never demoted back to the
  // academy once promoted), so a single boundary splits the line into an
  // academy run and a senior run. b = index of the first senior season.
  const b = pts.findIndex((p) => !p.academy);
  const hasAcademy = b !== 0; // b === 0 → all senior; b === -1 → all academy
  const hasSenior = b !== -1;
  const splitIdx = b === -1 ? pts.length - 1 : b === 0 ? 0 : b - 1;

  const academyPts = hasAcademy ? pts.slice(0, splitIdx + 1) : [];
  // Senior run starts at the last academy point so the promotion segment (drawn
  // once, in senior red) connects the two runs without a gap.
  const seniorPts = hasSenior ? pts.slice(hasAcademy ? splitIdx : 0) : [];

  const linePath = (p: typeof pts) =>
    p.map((pt, i) => `${i === 0 ? "M" : "L"}${pt.px.toFixed(1)},${pt.py.toFixed(1)}`).join(" ");
  const areaPath = (p: typeof pts) => {
    if (p.length === 0) return "";
    const base = y(domainMin);
    const top = p.map((pt) => `L${pt.px.toFixed(1)},${pt.py.toFixed(1)}`).join(" ");
    return `M${p[0].px.toFixed(1)},${base.toFixed(1)} ${top} L${p[p.length - 1].px.toFixed(1)},${base.toFixed(1)} Z`;
  };

  // Horizontal gridlines / y-axis ticks at nice OVR values.
  const tickStep = ovrSpan <= 20 ? 5 : 10;
  const yTicks: number[] = [];
  for (let v = domainMin; v <= domainMax; v += tickStep) yTicks.push(v);

  // X-axis labels — thin them out if there are many seasons.
  const labelStep = Math.ceil(hist.length / 8);
  const xTicks = hist.filter((_, i) => i % labelStep === 0 || i === hist.length - 1);

  const teamByTid = new Map(league.teams.map((t) => [t.tid, t]));
  const ovrBySeason = new Map(hist.map((h) => [h.season, h.ovr]));
  // Crests at each transfer, positioned on the line at that season's OVR. All
  // transfers in one season share an anchor (x = season, y = that season's
  // OVR), so multiple moves in a season — a summer + winter deal, or an AI
  // journeyman's churn — would stack on the exact same spot. Group by season
  // and fan them horizontally, centered on the season and clamped to the plot
  // width so a busy season never overflows the chart edges.
  const CREST_STEP_PCT = 3; // horizontal gap between fanned crests, as % of W
  const leftBoundPct = (M.left / W) * 100;
  const rightBoundPct = ((W - M.right) / W) * 100;
  const bySeasonTransfers = new Map<number, typeof league.transfers>();
  for (const t of league.transfers) {
    if (t.pid !== player.pid || !ovrBySeason.has(t.season)) continue;
    const arr = bySeasonTransfers.get(t.season) ?? [];
    arr.push(t);
    bySeasonTransfers.set(t.season, arr);
  }
  const crestMarks = [...bySeasonTransfers.entries()].flatMap(([season, group]) => {
    const anchorPct = (x(season) / W) * 100;
    const topPct = (y(ovrBySeason.get(season)!) / H) * 100;
    const spread = (group.length - 1) * CREST_STEP_PCT;
    // Center the fan on the season, then slide it back inside the plot bounds.
    let start = anchorPct - spread / 2;
    if (start < leftBoundPct) start = leftBoundPct;
    else if (start + spread > rightBoundPct) start = Math.max(leftBoundPct, rightBoundPct - spread);
    return group.map((t, i) => {
      const team = teamByTid.get(t.toTid);
      return {
        key: `${t.season}-${t.window}-${t.toTid}-${i}`,
        leftPct: start + i * CREST_STEP_PCT,
        topPct,
        tid: t.toTid,
        colors: (team?.colors ?? ["#888", "#ccc"]) as [string, string],
        title: `${seasonYear(t.season)} ${t.window} — to ${team?.name ?? `Team ${t.toTid}`}${t.fee > 0 ? ` (${currency.format(t.fee)})` : " (free)"}`,
      };
    });
  });

  // Map the cursor to the nearest season point and snap the tooltip/crosshair
  // to it (we only have one data point per season).
  const handleMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const vbX = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bestD = Infinity;
    pts.forEach((p, i) => {
      const d = Math.abs(p.px - vbX);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    setHoverIdx(best);
  };

  const hovered = hoverIdx === null ? null : pts[hoverIdx];
  let hoverInfo: { name: string; tid: number | null; colors: [string, string] } | null = null;
  if (hovered) {
    const tid = teamTidForSeason(hovered.season);
    const t = tid === null ? undefined : teamByTid.get(tid);
    hoverInfo = {
      name: t?.name ?? (hovered.academy ? "Academy" : "Free agent"),
      tid,
      colors: (t?.colors ?? ["#888", "#ccc"]) as [string, string],
    };
  }

  return (
    <div>
      <div className="ovr-chart-legend">
        <span><i style={{ background: ACADEMY_COLOR }} />Academy</span>
        <span><i style={{ background: SENIOR_COLOR }} />Senior</span>
      </div>
      <div className="ovr-chart" onMouseMove={handleMove} onMouseLeave={() => setHoverIdx(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img"
          aria-label={`OVR history for ${player.name}`}>
          <defs>
            <linearGradient id="ovr-fill-academy" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ACADEMY_COLOR} stopOpacity="0.28" />
              <stop offset="100%" stopColor={ACADEMY_COLOR} stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="ovr-fill-senior" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SENIOR_COLOR} stopOpacity="0.28" />
              <stop offset="100%" stopColor={SENIOR_COLOR} stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Gridlines + y-axis labels */}
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={M.left} y1={y(v)} x2={W - M.right} y2={y(v)}
                stroke="var(--sg-border)" strokeWidth="1" strokeDasharray="3 4" />
              <text x={M.left - 6} y={y(v)} textAnchor="end" dominantBaseline="middle"
                fill="var(--sg-text-faint)" fontSize="11">{v}</text>
            </g>
          ))}

          {/* x-axis labels */}
          {xTicks.map((h) => (
            <text key={h.season} x={x(h.season)} y={H - 8} textAnchor="middle"
              fill="var(--sg-text-faint)" fontSize="11">{seasonYear(h.season)}</text>
          ))}

          {/* Area fills */}
          {hasAcademy && <path d={areaPath(academyPts)} fill="url(#ovr-fill-academy)" />}
          {hasSenior && <path d={areaPath(seniorPts)} fill="url(#ovr-fill-senior)" />}

          {/* Lines */}
          {hasAcademy && (
            <path d={linePath(academyPts)} fill="none" stroke={ACADEMY_COLOR}
              strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          )}
          {hasSenior && (
            <path d={linePath(seniorPts)} fill="none" stroke={SENIOR_COLOR}
              strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          )}

          {/* Data points */}
          {pts.map((p) => (
            <circle key={p.season} cx={p.px} cy={p.py} r="2.5"
              fill={p.academy ? ACADEMY_COLOR : SENIOR_COLOR} />
          ))}

          {/* Hover crosshair + highlighted point */}
          {hovered && (
            <g pointerEvents="none">
              <line x1={hovered.px} y1={M.top} x2={hovered.px} y2={H - M.bottom}
                stroke="var(--sg-text-faint)" strokeWidth="1" />
              <circle cx={hovered.px} cy={hovered.py} r="4.5"
                fill={hovered.academy ? ACADEMY_COLOR : SENIOR_COLOR}
                stroke="var(--sg-surface)" strokeWidth="2" />
            </g>
          )}
        </svg>

        {/* Transfer crests, HTML-overlaid so ClubCrest art scales at a fixed size */}
        {crestMarks.map((c) => (
          <span key={c.key} className="ovr-chart-crest"
            style={{ left: `${c.leftPct}%`, top: `${c.topPct}%` }} title={c.title}>
            <ClubCrest tid={c.tid} colors={c.colors} size={22} />
          </span>
        ))}

        {/* Hover tooltip card */}
        {hovered && hoverInfo && (
          <div className="ovr-chart-tip"
            style={{
              left: `${Math.min(88, Math.max(12, (hovered.px / W) * 100))}%`,
              top: `${(hovered.py / H) * 100}%`,
            }}>
            {hoverInfo.tid !== null && (
              <ClubCrest tid={hoverInfo.tid} colors={hoverInfo.colors} size={24} />
            )}
            <div className="ovr-chart-tip-body">
              <div className="ovr-chart-tip-name">{hoverInfo.name}</div>
              <div className="ovr-chart-tip-sub">
                {seasonYear(hovered.season)}{hovered.academy ? " · Academy" : ""}
              </div>
            </div>
            <span className="ovr-chart-tip-badge"
              style={{ background: hovered.academy ? ACADEMY_COLOR : SENIOR_COLOR }}>
              OVR {hovered.ovr}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
