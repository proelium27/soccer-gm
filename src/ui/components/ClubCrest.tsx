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

export interface ClubCrestProps {
  tid: number;
  colors: [string, string];
  size?: number;
  className?: string;
}

export function ClubCrest({ tid, colors, size = 20, className }: ClubCrestProps) {
  const src = CREST_BY_TID[tid];
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
