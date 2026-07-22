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
  // Wrapper anchors a CSS-only hover tooltip naming the country. aria-label
  // carries the name for screen readers (the tooltip is a visual mouse aid,
  // and the wrapper stays non-focusable so flags don't add keyboard tab stops).
  return (
    <span className="player-flag-wrap" aria-label={nationality}>
      {src ? (
        <img className="player-flag" src={src} alt="" style={{ height: size, width: "auto" }} />
      ) : (
        // Unknown nationality: neutral swatch instead of a broken image.
        <span className="player-flag player-flag-fallback" />
      )}
      <span className="player-flag-tip" role="tooltip">
        {nationality}
      </span>
    </span>
  );
}
