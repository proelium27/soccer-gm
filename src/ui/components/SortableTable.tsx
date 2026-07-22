import { useState, type ReactNode } from "react";

/**
 * Shared click-to-sort table header helper. Any table that renders a list of
 * rows can opt in: hold a {@link SortState} with {@link useTableSort}, feed rows
 * through {@link sortRows} with per-key accessors, and render its headers as
 * {@link SortableTh}. Keeps the sort behavior (toggle direction, active caret)
 * identical across every page instead of each one reinventing it.
 */

export type SortDir = "asc" | "desc";

export interface SortState<K extends string> {
  key: K;
  dir: SortDir;
}

export function useTableSort<K extends string>(initialKey: K, initialDir: SortDir = "desc") {
  const [sort, setSort] = useState<SortState<K>>({ key: initialKey, dir: initialDir });

  /**
   * Click a header: if it's already the active column, flip direction;
   * otherwise switch to it at its natural default direction (desc for numbers,
   * asc for text — the caller passes whichever reads best).
   */
  const toggle = (key: K, defaultDir: SortDir = "desc") =>
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: defaultDir },
    );

  return { sort, toggle, setSort };
}

/**
 * Return a new array sorted by the active column. Number accessors sort
 * numerically, string accessors alphabetically (locale-aware); `desc` reverses
 * the ascending order. Pure — never mutates the input.
 */
export function sortRows<T, K extends string>(
  rows: readonly T[],
  sort: SortState<K>,
  accessors: Partial<Record<K, (row: T) => number | string>>,
): T[] {
  const accessor = accessors[sort.key];
  // No accessor for the active key (e.g. an initial "unsorted" sentinel key)
  // means: leave the caller's natural order untouched.
  if (!accessor) return [...rows];
  const sorted = [...rows].sort((a, b) => {
    const av = accessor(a);
    const bv = accessor(b);
    if (typeof av === "number" && typeof bv === "number") return av - bv;
    return String(av).localeCompare(String(bv));
  });
  return sort.dir === "desc" ? sorted.reverse() : sorted;
}

function Caret({ dir }: { dir: SortDir }) {
  // Inline SVG (no emoji per UI convention); inherits text color via currentColor.
  const d = dir === "asc" ? "M5 8L1.5 3h7z" : "M5 3L1.5 8h7z"; // pointing up (asc) / down (desc)
  return (
    <svg
      width="8"
      height="8"
      viewBox="0 0 10 11"
      aria-hidden="true"
      style={{ marginLeft: "0.3em", verticalAlign: "baseline" }}
    >
      <path d={d} fill="currentColor" />
    </svg>
  );
}

interface SortableThProps<K extends string> {
  sortKey: K;
  sort: SortState<K>;
  onSort: (key: K, defaultDir?: SortDir) => void;
  /** Natural direction when this column first becomes active. Defaults to desc. */
  defaultDir?: SortDir;
  className?: string;
  children: ReactNode;
}

export function SortableTh<K extends string>({
  sortKey,
  sort,
  onSort,
  defaultDir = "desc",
  className,
  children,
}: SortableThProps<K>) {
  const active = sort.key === sortKey;
  return (
    <th
      className={className}
      onClick={() => onSort(sortKey, defaultDir)}
      style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
    >
      {children}
      {active && <Caret dir={sort.dir} />}
    </th>
  );
}
