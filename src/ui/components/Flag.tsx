import { flagUrlFor } from "./flagAssets.js";

export function Flag({ nationality, size = 13, tip = true }: {
  nationality: string;
  size?: number;
  /**
   * Whether the flag carries its hover tooltip. Pass false where the country
   * name is already spelled out next to the flag: the tooltip would only repeat
   * it, and it costs an absolutely-positioned, shadowed span per flag — which
   * adds up fast on a dense list (the qualifying schedule alone draws hundreds).
   * Without it the flag is purely decorative, so it carries no label either and
   * screen readers just read the adjacent name once.
   */
  tip?: boolean;
}) {
  const src = flagUrlFor(nationality);

  if (!tip) {
    return src ? (
      <img className="player-flag" src={src} alt="" style={{ height: size, width: "auto" }} />
    ) : (
      <span className="player-flag player-flag-fallback" />
    );
  }

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
