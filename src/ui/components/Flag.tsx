import { flagCodeFor } from "../../core/players/flags.js";

// Flag art lives in src/ui/assets/flags/ named by ISO code (e.g. fr.svg,
// gb-eng.svg). Loaded through the bundler so each flag is an isolated image —
// avoids the clip-path id collisions inlining many SVGs would cause, and
// dodges the missing-flag-emoji problem where nationalities showed as bare
// "ES"/"DK" letters on platforms without emoji flags.
const flagModules = import.meta.glob("../assets/flags/*.svg", {
  eager: true,
  import: "default",
}) as Record<string, string>;

const FLAG_BY_CODE: Record<string, string> = {};
for (const path in flagModules) {
  const match = path.match(/([a-z-]+)\.svg$/);
  if (match) FLAG_BY_CODE[match[1]] = flagModules[path];
}

export function Flag({ nationality, size = 13 }: { nationality: string; size?: number }) {
  const code = flagCodeFor(nationality);
  const src = code ? FLAG_BY_CODE[code] : undefined;
  if (!src) {
    // Unknown nationality: keep the label available without a broken image.
    return (
      <span className="player-flag player-flag-fallback" title={nationality} aria-label={nationality} />
    );
  }
  return (
    <img
      className="player-flag"
      src={src}
      alt=""
      title={nationality}
      aria-label={nationality}
      style={{ height: size, width: "auto" }}
    />
  );
}
