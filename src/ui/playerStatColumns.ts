import { per90 } from "../core/stats/per90.js";
import { per90Text } from "./format.js";

/**
 * The stat fields a player stat table can read.
 *
 * Deliberately structural rather than a union of `SeasonStats | CupStatLine`:
 * a league season records everything, a cup line records a subset (archived
 * cups fold box scores into a narrower aggregate and then delete them, so the
 * missing fields are gone for good, not merely unwired). Optional fields let
 * one column list serve both, with the caller picking which columns apply.
 */
export interface StatRow {
  appearances: number;
  minutesPlayed: number;
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  saves: number;
  goalsAgainst: number;
  tackles: number;
  interceptions: number;
  ratingSum: number;
  /**
   * Appearances that contributed to `ratingSum`. Cup lines only count
   * appearances with minutes; a league season counts every appearance, so it
   * has no such field and `appearances` is the divisor.
   */
  ratedAppearances?: number;
  xg?: number;
  xga?: number;
  passes?: number;
  passesCompleted?: number;
  crosses?: number;
  foulsCommitted?: number;
  yellowCards?: number;
  redCards?: number;
}

/**
 * How a cell prints, and — the part that matters — whether "per 90" means
 * anything for it.
 *
 * - `plain`: the per-90 denominator itself (apps, minutes). Never converted.
 * - `count`: a whole-number tally. Divided by 90s played in rate mode.
 * - `decimal`: a fractional tally (xG). Same, but two decimals as a total.
 * - `signed`: a difference that is meaningful in both directions, so it keeps
 *   an explicit + or −.
 * - `percent`: already a share of something. A rate of a rate is nonsense, so
 *   it reads identically in both modes.
 * - `rating`: already an average. Same reasoning as `percent`.
 */
export type StatCellKind = "plain" | "count" | "decimal" | "signed" | "percent" | "rating";

export interface StatColumn {
  key: string;
  /** Header text, without the "/90" suffix — `statHeader` adds that. */
  label: string;
  /** Tooltip. Every derived column has one; a column whose label is its own explanation doesn't need one. */
  title?: string;
  kind: StatCellKind;
  /** `null` means unmeasurable (an empty denominator) and prints as an em dash. */
  value: (r: StatRow) => number | null;
  /** Print an empty cell rather than "0" — for columns where zero is the unremarkable default (cards). */
  blankZero?: boolean;
}

const pct = (num: number, den: number): number | null => (den > 0 ? num / den : null);

/** Columns every table carries, ahead of the stats themselves. */
const APPS: StatColumn = {
  key: "apps", label: "Apps", kind: "plain", value: (r) => r.appearances,
};
const MINUTES: StatColumn = {
  key: "min", label: "Min", kind: "plain", value: (r) => r.minutesPlayed,
};

/**
 * Average match rating. Reads `ratingSum` rather than a stored `avgRating` so
 * a career row is the minutes-weighted average of the seasons under it, not
 * an average of averages — the same arithmetic for one season and for twenty.
 */
const RATING: StatColumn = {
  key: "rtg", label: "Rtg", title: "Average match rating", kind: "rating",
  value: (r) => pct(r.ratingSum, r.ratedAppearances ?? r.appearances),
};

const ATTACK: StatColumn[] = [
  { key: "g", label: "G", title: "Goals", kind: "count", value: (r) => r.goals },
  { key: "a", label: "A", title: "Assists", kind: "count", value: (r) => r.assists },
  {
    key: "ga", label: "G+A", title: "Goals plus assists", kind: "count",
    value: (r) => r.goals + r.assists,
  },
  { key: "sh", label: "Sh", title: "Shots", kind: "count", value: (r) => r.shots },
  { key: "sot", label: "SoT", title: "Shots on target", kind: "count", value: (r) => r.shotsOnTarget },
  {
    key: "shpct", label: "Sh%", title: "Shot accuracy: shots on target as a share of shots",
    kind: "percent", value: (r) => pct(r.shotsOnTarget, r.shots),
  },
  {
    key: "conv", label: "Conv%", title: "Conversion: goals as a share of shots",
    kind: "percent", value: (r) => pct(r.goals, r.shots),
  },
];

/**
 * xG and the finishing differential it exists to expose.
 *
 * The sim's xG is deliberately blind to who is shooting (see resolveShot's
 * finishAdj, which moves conversion but never xG), so goals minus xG is a real
 * read on finishing rather than a restatement of the player's rating.
 */
const EXPECTED: StatColumn[] = [
  { key: "xg", label: "xG", title: "Expected goals", kind: "decimal", value: (r) => r.xg ?? null },
  {
    key: "xgdiff", label: "xG+/-",
    title: "Goals minus expected goals: finishing above or below the chances he got",
    kind: "signed", value: (r) => (r.xg === undefined ? null : r.goals - r.xg),
  },
];

const KEEPER: StatColumn[] = [
  { key: "sv", label: "Sv", title: "Saves", kind: "count", value: (r) => r.saves },
  {
    key: "svpct", label: "Sv%", title: "Save percentage: saves as a share of shots on target faced",
    kind: "percent", value: (r) => pct(r.saves, r.saves + r.goalsAgainst),
  },
  { key: "gaa", label: "GA", title: "Goals conceded", kind: "count", value: (r) => r.goalsAgainst },
];

const KEEPER_EXPECTED: StatColumn[] = [
  { key: "xga", label: "xGA", title: "Expected goals against", kind: "decimal", value: (r) => r.xga ?? null },
  {
    key: "gprev", label: "GP",
    title: "Goals prevented: expected goals against minus goals actually conceded",
    kind: "signed", value: (r) => (r.xga === undefined ? null : r.xga - r.goalsAgainst),
  },
];

const DEFENDING: StatColumn[] = [
  { key: "tkl", label: "Tkl", title: "Tackles", kind: "count", value: (r) => r.tackles },
  { key: "int", label: "Int", title: "Interceptions", kind: "count", value: (r) => r.interceptions },
];

const PASSING: StatColumn[] = [
  { key: "pass", label: "Pass", title: "Passes attempted", kind: "count", value: (r) => r.passes ?? null },
  {
    key: "passpct", label: "Pass%", title: "Pass completion",
    kind: "percent",
    value: (r) => (r.passes === undefined ? null : pct(r.passesCompleted ?? 0, r.passes)),
  },
  { key: "cross", label: "Cross", title: "Crosses attempted", kind: "count", value: (r) => r.crosses ?? null },
];

const DISCIPLINE: StatColumn[] = [
  { key: "fls", label: "Fls", title: "Fouls committed", kind: "count", value: (r) => r.foulsCommitted ?? null },
  { key: "yc", label: "YC", title: "Yellow cards", kind: "count", blankZero: true, value: (r) => r.yellowCards ?? null },
  { key: "rc", label: "RC", title: "Red cards", kind: "count", blankZero: true, value: (r) => r.redCards ?? null },
];

/**
 * Which blocks a player's table shows.
 *
 * Keyed off what he has actually recorded rather than his position alone: a
 * player converted to or from goalkeeping mid-career would otherwise either
 * lose every save he ever made or carry five permanently empty keeper columns.
 */
export interface StatColumnScope {
  keeper: boolean;
  attack: boolean;
}

export function statColumnScope(pos: string, rows: StatRow[]): StatColumnScope {
  return {
    keeper: pos === "GK" || rows.some((r) => r.saves > 0 || r.goalsAgainst > 0),
    attack: pos !== "GK" || rows.some((r) => r.shots > 0 || r.goals > 0),
  };
}

/** The league table's columns: everything a `SeasonStats` records. */
export function leagueStatColumns(scope: StatColumnScope): StatColumn[] {
  return [
    APPS, MINUTES,
    ...(scope.attack ? [...ATTACK, ...EXPECTED] : []),
    ...(scope.keeper ? [...KEEPER, ...KEEPER_EXPECTED] : []),
    ...PASSING,
    ...DEFENDING,
    ...DISCIPLINE,
    RATING,
  ];
}

/**
 * The cup table's columns — the same list minus what a cup line doesn't store.
 *
 * Cup lines predate xG, passing and cards, and an archived cup has already
 * discarded the box scores those would come from, so the gap can't be filled
 * retroactively for seasons already played.
 */
export function cupStatColumns(scope: StatColumnScope): StatColumn[] {
  return [
    APPS, MINUTES,
    ...(scope.attack ? ATTACK : []),
    ...(scope.keeper ? KEEPER : []),
    ...DEFENDING,
    RATING,
  ];
}

/** Header text for a column, with the "/90" suffix in rate mode where it applies. */
export function statHeader(col: StatColumn, rate: boolean): string {
  const per90able = col.kind === "count" || col.kind === "decimal" || col.kind === "signed";
  return rate && per90able ? `${col.label}/90` : col.label;
}

function signed(value: number, decimals: number): string {
  // A leading "+" is the whole point of the column: "3.20" and "+3.20" read
  // very differently when the neighbouring rows are negative.
  const text = Math.abs(value).toFixed(decimals);
  return value < 0 ? `-${text}` : `+${text}`;
}

/** Cell text for one column of one row. */
export function statCellText(col: StatColumn, row: StatRow, rate: boolean): string {
  const value = col.value(row);
  if (value === null || !Number.isFinite(value)) return "—";
  if (col.blankZero && value === 0) return "";

  switch (col.kind) {
    case "plain":
      return String(Math.round(value));
    case "count":
      return rate ? per90Text(value, row.minutesPlayed) : String(Math.round(value));
    case "decimal":
      return rate ? per90Text(value, row.minutesPlayed) : value.toFixed(2);
    case "signed": {
      if (!rate) return signed(value, 2);
      const per = per90(value, row.minutesPlayed);
      return per === null ? "—" : signed(per, 2);
    }
    case "percent":
      return `${Math.round(value * 100)}%`;
    case "rating":
      return value.toFixed(2);
  }
}

/**
 * One row summing a player's whole career in this competition, for the table's
 * footer.
 *
 * Every column is a pure function of a `StatRow`, so the career figures come
 * out of the same code as a season's — including the ratios, which are then
 * correctly weighted by the seasons' own volumes rather than averaged.
 */
export function sumStatRows(rows: StatRow[]): StatRow {
  const total: StatRow = {
    appearances: 0, minutesPlayed: 0, goals: 0, assists: 0, shots: 0, shotsOnTarget: 0,
    saves: 0, goalsAgainst: 0, tackles: 0, interceptions: 0, ratingSum: 0, ratedAppearances: 0,
    xg: 0, xga: 0, passes: 0, passesCompleted: 0, crosses: 0, foulsCommitted: 0,
    yellowCards: 0, redCards: 0,
  };
  for (const r of rows) {
    total.appearances += r.appearances;
    total.minutesPlayed += r.minutesPlayed;
    total.goals += r.goals;
    total.assists += r.assists;
    total.shots += r.shots;
    total.shotsOnTarget += r.shotsOnTarget;
    total.saves += r.saves;
    total.goalsAgainst += r.goalsAgainst;
    total.tackles += r.tackles;
    total.interceptions += r.interceptions;
    total.ratingSum += r.ratingSum;
    total.ratedAppearances! += r.ratedAppearances ?? r.appearances;
    total.xg! += r.xg ?? 0;
    total.xga! += r.xga ?? 0;
    total.passes! += r.passes ?? 0;
    total.passesCompleted! += r.passesCompleted ?? 0;
    total.crosses! += r.crosses ?? 0;
    total.foulsCommitted! += r.foulsCommitted ?? 0;
    total.yellowCards! += r.yellowCards ?? 0;
    total.redCards! += r.redCards ?? 0;
  }
  // A column is blank for the whole career exactly when it was blank on every
  // row: summing absent fields to 0 would turn "this competition never
  // recorded passes" into a career total of zero passes.
  if (!rows.some((r) => r.xg !== undefined)) total.xg = undefined;
  if (!rows.some((r) => r.xga !== undefined)) total.xga = undefined;
  if (!rows.some((r) => r.passes !== undefined)) total.passes = undefined;
  if (!rows.some((r) => r.crosses !== undefined)) total.crosses = undefined;
  if (!rows.some((r) => r.foulsCommitted !== undefined)) total.foulsCommitted = undefined;
  if (!rows.some((r) => r.yellowCards !== undefined)) total.yellowCards = undefined;
  if (!rows.some((r) => r.redCards !== undefined)) total.redCards = undefined;
  return total;
}
