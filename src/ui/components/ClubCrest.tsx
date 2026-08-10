import { createContext, useContext, useMemo, type ReactNode } from "react";

// Crest art only exists for a subset of clubs (see src/ui/assets/crests/) —
// every other club falls back to the existing two-color swatch pair, keyed
// by tid since a club's name/abbrev can be changed via the Customize Teams
// editor but tid never does.
const crestModules = import.meta.glob("../assets/crests/*.png", {
  eager: true,
  import: "default",
}) as Record<string, string>;

const CREST_BY_TID: Record<number, string> = {};
for (const path in crestModules) {
  const match = path.match(/(\d+)\.png$/);
  if (match) CREST_BY_TID[Number(match[1])] = crestModules[path];
}

/**
 * Tids whose built-in crest art must not be drawn, because an imported roster
 * file replaced that slot's club with a real one and the art belongs to the
 * fictional club it displaced. Those clubs show their colors instead, which the
 * roster file supplies.
 *
 * A context rather than a prop because ClubCrest is rendered from fourteen
 * places, most of which hold only a tid and would have to thread a flag they
 * don't otherwise care about — and any one of them forgetting to would show a
 * wrong badge on that surface only, which is precisely the kind of bug that
 * hides. The decision is a property of the league, so it belongs alongside it,
 * once.
 */
const SuppressedCrests = createContext<ReadonlySet<number>>(new Set());

/** Suppress built-in crest art for `tids` within this subtree. */
export function CrestArtProvider({
  tids,
  children,
}: {
  tids: readonly number[];
  children: ReactNode;
}) {
  // Keyed on the tids themselves, so a league whose imported set never changes
  // doesn't hand every crest on the page a new Set on each render.
  const key = tids.join(",");
  const value = useMemo(() => new Set(tids), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return <SuppressedCrests.Provider value={value}>{children}</SuppressedCrests.Provider>;
}

export interface ClubCrestProps {
  tid: number;
  colors: [string, string];
  size?: number;
  className?: string;
}

export function ClubCrest({ tid, colors, size = 20, className }: ClubCrestProps) {
  const suppressed = useContext(SuppressedCrests);
  const src = suppressed.has(tid) ? undefined : CREST_BY_TID[tid];
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={`club-crest${className ? ` ${className}` : ""}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className={`club-crest-fallback${className ? ` ${className}` : ""}`}
      style={{ width: size, height: size }}
    >
      <span style={{ backgroundColor: colors[0] }} />
      <span style={{ backgroundColor: colors[1] }} />
    </span>
  );
}
