import { createContext, useContext, useMemo, type ReactNode } from "react";
import { worldCompetitions, countryClubRanges } from "../../core/competitions.js";

// Crest art only exists for a subset of clubs (see src/ui/assets/crests/) —
// every other club falls back to the existing two-color swatch pair.
const crestModules = import.meta.glob("../assets/crests/*.png", {
  eager: true,
  import: "default",
}) as Record<string, string>;

const CREST_FILES: Record<number, string> = {};
for (const path in crestModules) {
  const match = path.match(/(\d+)\.png$/);
  if (match) CREST_FILES[Number(match[1])] = crestModules[path];
}

/**
 * Crest art is ANCHORED TO A COUNTRY, never to a raw tid — the same rule
 * `CLUBS` follows, and for the same reason.
 *
 * The files are named by the tid they were drawn for, and that layout was two
 * divisions of 20 per country: England 0-39, then Spain 40-79. A raw tid
 * lookup therefore breaks the moment the world's tid layout changes, and it
 * did: giving every country a third division inserted 20 slots into each
 * block, which slid England's third division onto Spain's top-flight art and
 * Spain's top flight onto its own second division's. Sliced by country instead,
 * each sheet stays with the country it was drawn for however the pyramid is
 * reshaped, and a country the art does not reach shows colors.
 *
 * Two consequences worth knowing. A country's first `CRESTS_PER_COUNTRY` slots
 * are its top two divisions, so **a third division always shows colors** —
 * there is no art for it and inventing some by reusing another club's is worse
 * than a swatch. And switching a country off in World setup no longer hands its
 * crests to whoever inherits its tids, which the old keying did.
 */
const CREST_COUNTRIES = ["England", "Spain"] as const;
const CRESTS_PER_COUNTRY = 40;

const CREST_BY_TID: Record<number, string> = {};
{
  const ranges = countryClubRanges(worldCompetitions());
  CREST_COUNTRIES.forEach((country, sheet) => {
    const range = ranges.find((r) => r.country === country);
    if (!range) return;
    const base = sheet * CRESTS_PER_COUNTRY;
    for (let i = 0; i < CRESTS_PER_COUNTRY && range.start + i < range.end; i++) {
      const url = CREST_FILES[base + i];
      if (url) CREST_BY_TID[range.start + i] = url;
    }
  });
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

/**
 * Badges the player brought in themselves, as tid -> data URL.
 *
 * A second context beside the suppression set rather than folded into it, for
 * the same reason that one is a context at all: `ClubCrest` is rendered from
 * fourteen places holding nothing but a tid, and any of them forgetting to
 * thread a badge through would leave one surface showing the wrong club's crest
 * — which is precisely the bug that hides.
 *
 * These are loaded from their own IndexedDB store (src/db/crestDb.ts), never
 * from the league, so they cost nothing on a save that has none.
 */
const CustomCrests = createContext<ReadonlyMap<number, string>>(new Map());

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

/**
 * Supply custom club badges within this subtree.
 *
 * Takes the map by reference and does not copy it: it is built once when the
 * league loads and again only when a pack is imported, so a memo here would
 * guard against nothing while a copy would duplicate every image in it.
 */
export function CustomCrestProvider({
  crests,
  children,
}: {
  crests: ReadonlyMap<number, string>;
  children: ReactNode;
}) {
  return <CustomCrests.Provider value={crests}>{children}</CustomCrests.Provider>;
}

export interface ClubCrestProps {
  tid: number;
  colors: [string, string];
  size?: number;
  className?: string;
}

export function ClubCrest({ tid, colors, size = 20, className }: ClubCrestProps) {
  const suppressed = useContext(SuppressedCrests);
  const custom = useContext(CustomCrests);
  /*
   * A badge the player supplied outranks everything, suppression included —
   * suppression exists to stop a real club wearing the fictional badge of the
   * slot it displaced, and a custom badge is the answer to exactly that, so
   * hiding it behind the flag would refuse the one thing the feature is for.
   */
  const src = custom.get(tid) ?? (suppressed.has(tid) ? undefined : CREST_BY_TID[tid]);
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={`club-crest${className ? ` ${className}` : ""}`}
        // `contain` because a custom badge is whatever shape the file was and
        // the box has to stay square — every caller sizes its layout on `size`,
        // so a wide badge stretching the box would shift the row around it. The
        // shipped art is square, so this is a no-op for it.
        style={{ width: size, height: size, objectFit: "contain" }}
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
