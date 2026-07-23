import { flagUrlFor } from "./flagAssets.js";

export function Flag({ nationality, size = 13 }: { nationality: string; size?: number }) {
  const src = flagUrlFor(nationality);
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
