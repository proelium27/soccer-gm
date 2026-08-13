import { useState, type MouseEvent } from "react";
import type { LeagueStore } from "../../core/leagueState.js";
import { ClubCrest } from "./ClubCrest.js";
import { NEUTRAL_COLOR, teamLineColor, readableText } from "./chartColors.js";
import { seasonYear, transferFeeLabel } from "../format.js";

// SVG coordinate space. The chart is rendered at width:100% / height:auto, so
// these are just the aspect ratio + the units every position is computed in.
const W = 720;
const H = 260;
const M = { top: 18, right: 16, bottom: 26, left: 40 };
const PLOT_W = W - M.left - M.right;
const PLOT_H = H - M.top - M.bottom;

/** Round `v` down/up to the nearest `step`. */
function floorTo(v: number, step: number) {
  return Math.floor(v / step) * step;
}
function ceilTo(v: number, step: number) {
  return Math.ceil(v / step) * step;
}

/** One plotted season: the rating he carried, and whether it was an academy year. */
export interface OvrHistoryPoint {
  season: number;
  ovr: number;
  academy?: boolean;
}

/**
 * A player's career OVR plotted against season (Transfermarkt-style area
 * chart). The line/area is colored by the club the player was at each season,
 * so it changes color when he transfers; club crests mark transfers. Whether a
 * season was an academy or senior year is surfaced on hover (the tooltip reads
 * "Club (Academy)" vs just "Club"), not by line color. Everything is derived
 * from `points` (per-season OVR + academy flag) and `league.transfers` —
 * `teamTidForSeason` resolves which club the player was on in a given season.
 *
 * Takes loose points rather than a `Player` so a retiree can be charted too:
 * retirement deletes him from the pool, and his archived record keeps a
 * per-season rating line but no `hist` (see core/players/archive.ts).
 */
export function OvrHistoryChart({
  pid,
  name,
  points,
  league,
  teamTidForSeason,
}: {
  pid: number;
  name: string;
  points: readonly OvrHistoryPoint[];
  league: LeagueStore;
  teamTidForSeason: (season: number) => number | null;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const hist = [...points].sort((a, b) => a.season - b.season);

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

  const teamByTid = new Map(league.teams.map((t) => [t.tid, t]));
  const colorForTid = (tid: number | null): string => {
    if (tid === null) return NEUTRAL_COLOR;
    const t = teamByTid.get(tid);
    return t ? teamLineColor(t.colors) : NEUTRAL_COLOR;
  };

  const pts = hist.map((h) => {
    const tid = teamTidForSeason(h.season);
    return { ...h, px: x(h.season), py: y(h.ovr), tid, color: colorForTid(tid) };
  });

  // Color the line by the club the player was at each season. Consecutive
  // same-club seasons form one colored run (an academy year and the same club's
  // later senior years share a tid, so a youth product's stint stays one color
  // — the academy/senior split is a hover-text distinction now, not a color
  // one). A transfer between two seasons splits that segment at its midpoint:
  // the departing club colors the first half, the arriving club the second, so
  // every season's club owns the half-segments next to its point and the line
  // color always matches the point's dot.
  type XY = { px: number; py: number };
  const colorRuns: { color: string; pts: XY[] }[] = [];
  let curColor = pts[0].color;
  let cur: XY[] = [{ px: pts[0].px, py: pts[0].py }];
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].color === curColor) {
      cur.push({ px: pts[i].px, py: pts[i].py });
    } else {
      const mid = { px: (pts[i - 1].px + pts[i].px) / 2, py: (pts[i - 1].py + pts[i].py) / 2 };
      cur.push(mid);
      colorRuns.push({ color: curColor, pts: cur });
      curColor = pts[i].color;
      cur = [mid, { px: pts[i].px, py: pts[i].py }];
    }
  }
  colorRuns.push({ color: curColor, pts: cur });

  const linePath = (p: XY[]) =>
    p.map((pt, i) => `${i === 0 ? "M" : "L"}${pt.px.toFixed(1)},${pt.py.toFixed(1)}`).join(" ");
  const areaPath = (p: XY[]) => {
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
    if (t.pid !== pid || !ovrBySeason.has(t.season)) continue;
    const arr = bySeasonTransfers.get(t.season) ?? [];
    arr.push(t);
    bySeasonTransfers.set(t.season, arr);
  }
  const crestMarks = [...bySeasonTransfers.entries()].flatMap(([season, group]) => {
    const anchorPct = (x(season) / W) * 100;
    const topPct = (y(ovrBySeason.get(season)!) / H) * 100;
    const spread = (group.length - 1) * CREST_STEP_PCT;
    // Center the fan on the season, then slide it back inside the plot bounds.
    let startPct = anchorPct - spread / 2;
    if (startPct < leftBoundPct) startPct = leftBoundPct;
    else if (startPct + spread > rightBoundPct) startPct = Math.max(leftBoundPct, rightBoundPct - spread);
    return group.map((t, i) => {
      const team = teamByTid.get(t.toTid);
      return {
        key: `${t.season}-${t.window}-${t.toTid}-${i}`,
        leftPct: startPct + i * CREST_STEP_PCT,
        topPct,
        tid: t.toTid,
        colors: (team?.colors ?? ["#888", "#ccc"]) as [string, string],
        // transferFeeLabel, not a bare fee test: a loan and a loan return both
        // carry fee 0, so "(free)" read as a mystery free transfer on exactly
        // the moves that weren't one.
        title: `${seasonYear(t.season)} ${t.window} — to ${team?.name ?? `Team ${t.toTid}`} (${transferFeeLabel(t)})`,
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
    const t = hovered.tid === null ? undefined : teamByTid.get(hovered.tid);
    hoverInfo = {
      name: t?.name ?? "Free agent",
      tid: hovered.tid,
      colors: (t?.colors ?? ["#888", "#ccc"]) as [string, string],
    };
  }

  return (
    <div>
      <p className="ovr-chart-caption">Line colored by club — hover for club &amp; OVR.</p>
      <div className="ovr-chart" onMouseMove={handleMove} onMouseLeave={() => setHoverIdx(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img"
          aria-label={`OVR history for ${name}`}>
          <defs>
            {colorRuns.map((run, ri) => (
              <linearGradient key={ri} id={`ovr-fill-${ri}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={run.color} stopOpacity="0.28" />
                <stop offset="100%" stopColor={run.color} stopOpacity="0.02" />
              </linearGradient>
            ))}
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

          {/* Area fills, one per club run */}
          {colorRuns.map((run, ri) => (
            <path key={ri} d={areaPath(run.pts)} fill={`url(#ovr-fill-${ri})`} />
          ))}

          {/* Lines, one per club run */}
          {colorRuns.map((run, ri) => (
            <path key={ri} d={linePath(run.pts)} fill="none" stroke={run.color}
              strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          ))}

          {/* Data points */}
          {pts.map((p) => (
            <circle key={p.season} cx={p.px} cy={p.py} r="2.5" fill={p.color} />
          ))}

          {/* Hover crosshair + highlighted point */}
          {hovered && (
            <g pointerEvents="none">
              <line x1={hovered.px} y1={M.top} x2={hovered.px} y2={H - M.bottom}
                stroke="var(--sg-text-faint)" strokeWidth="1" />
              <circle cx={hovered.px} cy={hovered.py} r="4.5" fill={hovered.color}
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

        {/* Hover tooltip card — anchored left/center/right by where the point
            sits so the card never clips past the chart edges. */}
        {hovered && hoverInfo && (() => {
          const leftRaw = (hovered.px / W) * 100;
          const tx = leftRaw < 30 ? "0" : leftRaw > 70 ? "-100%" : "-50%";
          return (
          <div className="ovr-chart-tip"
            style={{
              left: `${leftRaw}%`,
              top: `${(hovered.py / H) * 100}%`,
              transform: `translate(${tx}, calc(-100% - 14px))`,
            }}>
            {hoverInfo.tid !== null && (
              <ClubCrest tid={hoverInfo.tid} colors={hoverInfo.colors} size={24} />
            )}
            <div className="ovr-chart-tip-body">
              <div className="ovr-chart-tip-name">
                {hoverInfo.name}
                {hovered.academy && <span className="ovr-chart-tip-academy"> (Academy)</span>}
              </div>
              <div className="ovr-chart-tip-sub">{seasonYear(hovered.season)}</div>
            </div>
            <span className="ovr-chart-tip-badge"
              style={{ background: hovered.color, color: readableText(hovered.color) }}>
              OVR {hovered.ovr}
            </span>
          </div>
          );
        })()}
      </div>
    </div>
  );
}
