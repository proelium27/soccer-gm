import { useState, type MouseEvent } from "react";
import type { LeagueStore } from "../../core/leagueState.js";
import type { ValueHistoryPoint } from "../../core/finance/valueHistory.js";
import { peakValue } from "../../core/finance/valueHistory.js";
import { ClubCrest } from "./ClubCrest.js";
import { NEUTRAL_COLOR, teamLineColor, readableText } from "./chartColors.js";
import { getRatingColor } from "../utils/ratingColor.js";
import { seasonYear, currency, currencyCompact, transferFeeLabel } from "../format.js";

// SVG coordinate space. The chart is rendered at width:100% / height:auto, so
// these are just the aspect ratio + the units every position is computed in.
const W = 720;
const H = 280;
// Wider left gutter than the OVR chart — "$350M" needs more room than "85".
const M = { top: 26, right: 18, bottom: 26, left: 58 };
const PLOT_W = W - M.left - M.right;
const PLOT_H = H - M.top - M.bottom;

/**
 * How many points to draw between two seasons. The underlying data is one value
 * per season (ratings only move in the offseason), so these are curve samples,
 * not extra measurements — they exist to bend the line instead of kinking it.
 */
const SAMPLES_PER_SEASON = 14;

/** A floor for the y-axis so a worthless player doesn't produce a degenerate domain. */
const MIN_AXIS_TOP = 1_000_000;

function ceilTo(v: number, step: number) {
  return Math.ceil(v / step) * step;
}

/**
 * A "nice" axis step (1 / 2 / 2.5 / 5 × a power of ten) that splits `max` into
 * roughly `targetTicks` intervals, so gridlines land on $10M / $25M / $50M
 * rather than $37.4M.
 */
function niceStep(max: number, targetTicks = 4): number {
  const raw = max / targetTicks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const mult = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return mult * mag;
}

/**
 * Fritsch–Carlson monotone-cubic tangents. Plain Catmull-Rom overshoots around
 * a spike — on a money chart that would draw a value the player never had (and
 * could dip the curve below zero), so the interpolation is constrained to stay
 * within the data it's connecting.
 */
function monotoneTangents(xs: number[], ys: number[]): number[] {
  const n = xs.length;
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(xs[i + 1] - xs[i]);
    slope.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  }
  const m = new Array<number>(n).fill(0);
  m[0] = slope[0];
  m[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (slope[i - 1] * slope[i] <= 0) {
      m[i] = 0; // a local peak or trough — flatten so the curve can't overshoot it
    } else {
      const w1 = 2 * dx[i] + dx[i - 1];
      const w2 = dx[i] + 2 * dx[i - 1];
      m[i] = (w1 + w2) / (w1 / slope[i - 1] + w2 / slope[i]);
    }
  }
  return m;
}

/** Cubic Hermite evaluation on segment `i`, at `t` in [0, 1]. */
function hermite(ys: number[], m: number[], h: number, i: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * ys[i]
    + (t3 - 2 * t2 + t) * h * m[i]
    + (-2 * t3 + 3 * t2) * ys[i + 1]
    + (t3 - t2) * h * m[i + 1];
}

type Sample = { season: number; value: number };

/** Dense samples along the monotone curve through the per-season points. */
function curveSamples(pts: readonly ValueHistoryPoint[]): Sample[] {
  const xs = pts.map((p) => p.season);
  const ys = pts.map((p) => p.value);
  const m = monotoneTangents(xs, ys);
  const out: Sample[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const h = xs[i + 1] - xs[i];
    for (let k = 0; k < SAMPLES_PER_SEASON; k++) {
      const t = k / SAMPLES_PER_SEASON;
      out.push({ season: xs[i] + t * h, value: Math.max(0, hermite(ys, m, h, i, t)) });
    }
  }
  out.push({ season: xs[xs.length - 1], value: ys[ys.length - 1] });
  return out;
}

/** Everything the hover card shows for one season, beyond the point itself. */
export interface ValueSeasonDetail {
  /** Club he played that season for, or null if none resolves (free agent). */
  tid: number | null;
  /** How the potential should read — the fogged band ("78–82") or an exact number. */
  potentialLabel: string;
  /** Was he in a youth academy that season, rather than the senior squad? */
  academy: boolean;
  /** His age that season — the term that explains most of the curve's shape. */
  age: number;
  goals: number;
  assists: number;
  appearances: number;
  /** Average match rating across that season's appearances (SeasonStats.avgRating). */
  avgRating: number;
  /** True if he made no league appearances that season (so G/A read as a dash, not 0). */
  didNotPlay: boolean;
}

/**
 * A player's career transfer value plotted against season (FotMob-style area
 * chart): value on the y-axis, seasons across the x-axis, the line colored by
 * whichever club he was at, and a club crest at every transfer.
 *
 * **One real data point per season, drawn as a curve.** Ratings only move in
 * the offseason, so a player's value genuinely steps once a year — there is no
 * mid-season measurement to plot. Rather than invent one, the line is a
 * monotone-cubic curve through the season points: the shape between two
 * seasons is interpolation, and only the marked points are data. Hovering
 * always snaps to a season and reports that season's real numbers.
 *
 * Values come from `careerValueHistory` (see the season-offset and
 * held-flat-contract notes there); `detailForSeason` supplies the rest of the
 * hover card so this component stays free of scouting-fog and stats lookups.
 */
export function ValueHistoryChart({
  pid,
  name,
  points,
  league,
  detailForSeason,
}: {
  pid: number;
  name: string;
  points: readonly ValueHistoryPoint[];
  league: LeagueStore;
  detailForSeason: (season: number) => ValueSeasonDetail;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const hist = [...points].sort((a, b) => a.season - b.season);

  if (hist.length < 2) {
    return <p className="text-muted mb-0">Not enough history yet to chart.</p>;
  }

  const minSeason = hist[0].season;
  const maxSeason = hist[hist.length - 1].season;
  const seasonSpan = Math.max(1, maxSeason - minSeason);

  // Money charts baseline at zero — starting the axis at the player's floor
  // would turn a steady career into a dramatic-looking one.
  const peak = Math.max(...hist.map((p) => p.value), MIN_AXIS_TOP);
  const step = niceStep(peak * 1.12);
  const domainMax = Math.max(step, ceilTo(peak * 1.08, step));

  const x = (season: number) => M.left + ((season - minSeason) / seasonSpan) * PLOT_W;
  const y = (value: number) => M.top + ((domainMax - value) / domainMax) * PLOT_H;

  const teamByTid = new Map(league.teams.map((t) => [t.tid, t]));
  const colorForTid = (tid: number | null): string => {
    if (tid === null) return NEUTRAL_COLOR;
    const t = teamByTid.get(tid);
    return t ? teamLineColor(t.colors) : NEUTRAL_COLOR;
  };

  const detailBySeason = new Map(hist.map((p) => [p.season, detailForSeason(p.season)]));
  const colorBySeason = new Map(
    hist.map((p) => [p.season, colorForTid(detailBySeason.get(p.season)!.tid)]),
  );

  const pts = hist.map((p) => ({
    ...p,
    px: x(p.season),
    py: y(p.value),
    detail: detailBySeason.get(p.season)!,
    color: colorBySeason.get(p.season)!,
  }));

  // Color the curve by the club he was at. A sample belongs to whichever season
  // it's nearest, which puts the color change exactly halfway between two
  // seasons — so each season owns the half-curve on either side of its point
  // and the line always matches its own dot. Consecutive same-club seasons melt
  // into one run (an academy year shares its club's tid, so a youth product's
  // stint stays one color; academy vs senior is a hover-text distinction).
  type XY = { px: number; py: number };
  const samples = curveSamples(hist);
  const colorOfSample = (s: Sample) =>
    colorBySeason.get(Math.round(s.season)) ?? NEUTRAL_COLOR;

  const colorRuns: { color: string; pts: XY[] }[] = [];
  let curColor = colorOfSample(samples[0]);
  let cur: XY[] = [{ px: x(samples[0].season), py: y(samples[0].value) }];
  for (let i = 1; i < samples.length; i++) {
    const xy = { px: x(samples[i].season), py: y(samples[i].value) };
    const c = colorOfSample(samples[i]);
    if (c === curColor) {
      cur.push(xy);
    } else {
      // The boundary sample ends the old run and starts the new one, so the two
      // colored paths meet without a gap.
      cur.push(xy);
      colorRuns.push({ color: curColor, pts: cur });
      curColor = c;
      cur = [xy];
    }
  }
  colorRuns.push({ color: curColor, pts: cur });

  const linePath = (p: XY[]) =>
    p.map((pt, i) => `${i === 0 ? "M" : "L"}${pt.px.toFixed(1)},${pt.py.toFixed(1)}`).join(" ");
  const areaPath = (p: XY[]) => {
    if (p.length === 0) return "";
    const base = y(0);
    const top = p.map((pt) => `L${pt.px.toFixed(1)},${pt.py.toFixed(1)}`).join(" ");
    return `M${p[0].px.toFixed(1)},${base.toFixed(1)} ${top} L${p[p.length - 1].px.toFixed(1)},${base.toFixed(1)} Z`;
  };

  // Horizontal gridlines / y-axis ticks at nice money values. Zero is the area
  // baseline and reads as clutter, so it gets no label.
  const yTicks: number[] = [];
  for (let v = step; v <= domainMax + 1; v += step) yTicks.push(v);

  // X-axis labels — thin them out if there are many seasons.
  const labelStep = Math.ceil(hist.length / 8);
  const xTicks = hist.filter((_, i) => i % labelStep === 0 || i === hist.length - 1);

  const valueBySeason = new Map(hist.map((p) => [p.season, p.value]));
  // Crests at each transfer, positioned on the curve. A transfer is stamped
  // with the season it takes effect (see transferWindowState), so it sits at
  // the point for that season — a winter move lands halfway through it. All
  // transfers in one season would otherwise stack on the same spot, so group
  // by season, fan them horizontally and clamp the fan inside the plot.
  const CREST_STEP_PCT = 3; // horizontal gap between fanned crests, as % of W
  const leftBoundPct = (M.left / W) * 100;
  const rightBoundPct = ((W - M.right) / W) * 100;
  const bySeasonTransfers = new Map<number, typeof league.transfers>();
  for (const t of league.transfers) {
    if (t.pid !== pid || !valueBySeason.has(t.season)) continue;
    const arr = bySeasonTransfers.get(t.season) ?? [];
    arr.push(t);
    bySeasonTransfers.set(t.season, arr);
  }
  const crestMarks = [...bySeasonTransfers.entries()].flatMap(([season, group]) => {
    const anchorPct = (x(season) / W) * 100;
    const topPct = (y(valueBySeason.get(season)!) / H) * 100;
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
  // to it — the curve between seasons is interpolation, so only a season point
  // has real numbers to report.
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
  const hoveredTeam =
    hovered && hovered.detail.tid !== null ? teamByTid.get(hovered.detail.tid) : undefined;

  const current = hist[hist.length - 1];
  const best = peakValue(hist)!; // non-null: the early return guarantees ≥ 2 points

  return (
    <div>
      <div className="value-chart-headline">
        <span className="value-chart-now">{currency.format(current.value)}</span>
        {best.season !== current.season && (
          <span className="value-chart-peak">
            Peak {currency.format(best.value)} in {seasonYear(best.season)}
          </span>
        )}
      </div>
      <p className="value-chart-caption">
        Estimated market value each season, colored by the club he was at. Hover a season for the
        detail.
      </p>
      <div className="value-chart" onMouseMove={handleMove} onMouseLeave={() => setHoverIdx(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img"
          aria-label={`Transfer value history for ${name}`}>
          <defs>
            {colorRuns.map((run, ri) => (
              <linearGradient key={ri} id={`value-fill-${pid}-${ri}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={run.color} stopOpacity="0.32" />
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
                fill="var(--sg-text-faint)" fontSize="11">{currencyCompact.format(v)}</text>
            </g>
          ))}

          {/* x-axis labels */}
          {xTicks.map((p) => (
            <text key={p.season} x={x(p.season)} y={H - 8} textAnchor="middle"
              fill="var(--sg-text-faint)" fontSize="11">{seasonYear(p.season)}</text>
          ))}

          {/* Area fills, one per club run */}
          {colorRuns.map((run, ri) => (
            <path key={ri} d={areaPath(run.pts)} fill={`url(#value-fill-${pid}-${ri})`} />
          ))}

          {/* Lines, one per club run */}
          {colorRuns.map((run, ri) => (
            <path key={ri} d={linePath(run.pts)} fill="none" stroke={run.color}
              strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          ))}

          {/* Data points — the seasons that are actually measured */}
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
          <span key={c.key} className="value-chart-crest"
            style={{ left: `${c.leftPct}%`, top: `${c.topPct}%` }} title={c.title}>
            <ClubCrest tid={c.tid} colors={c.colors} size={22} />
          </span>
        ))}

        {/* Hover card — anchored left/center/right by where the point sits so it
            never clips past the chart edges, and flipped to hang *below* a point
            in the upper half. It sits above by default, which for a peak-value
            season put it outside the plot entirely, on top of the headline and
            the Value/OVR toggle. */}
        {hovered && (() => {
          const leftRaw = (hovered.px / W) * 100;
          const topRaw = (hovered.py / H) * 100;
          const tx = leftRaw < 32 ? "0" : leftRaw > 68 ? "-100%" : "-50%";
          const below = topRaw < 50;
          const d = hovered.detail;
          return (
            <div className="value-chart-tip"
              style={{
                left: `${leftRaw}%`,
                top: `${topRaw}%`,
                transform: `translate(${tx}, ${below ? "16px" : "calc(-100% - 16px)"})`,
              }}>
              <div className="value-chart-tip-head">
                {d.tid !== null && (
                  <ClubCrest tid={d.tid} colors={(hoveredTeam?.colors ?? ["#888", "#ccc"]) as [string, string]} size={24} />
                )}
                <div className="value-chart-tip-club">
                  <div className="value-chart-tip-name">
                    {hoveredTeam?.name ?? "Free agent"}
                    {d.academy && <span className="value-chart-tip-academy"> (Academy)</span>}
                  </div>
                  {/* Age rides alongside the season rather than taking a row of
                      its own: it's the term that drives most of the curve, so
                      it wants to read as part of "when", not as another stat. */}
                  <div className="value-chart-tip-sub">
                    {seasonYear(hovered.season)} &middot; age {d.age}
                  </div>
                </div>
                <span className="value-chart-tip-badge"
                  style={{ background: hovered.color, color: readableText(hovered.color) }}>
                  {currency.format(hovered.value)}
                </span>
              </div>
              <dl className="value-chart-tip-rows">
                <dt>OVR / POT</dt>
                <dd>
                  <span style={{ color: getRatingColor(hovered.ovr) }}>{hovered.ovr}</span>
                  {" / "}
                  <span style={{ color: getRatingColor(hovered.potential) }}>{d.potentialLabel}</span>
                </dd>
                <dt>Goals / assists</dt>
                <dd>{d.didNotPlay ? "—" : `${d.goals} / ${d.assists}`}</dd>
                <dt>Appearances</dt>
                <dd>{d.didNotPlay ? "—" : d.appearances}</dd>
                <dt>Match rating</dt>
                <dd>{d.didNotPlay ? "—" : d.avgRating.toFixed(2)}</dd>
              </dl>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
