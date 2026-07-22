import { flagUrlFor } from "./flagAssets.js";

export interface CountryFlagProps {
  country: string;
  /** Rendered flag height in px (width auto, true aspect ratio). */
  size?: number;
  className?: string;
}

// Country-level flag (New League picker, Power Rankings badge, …). Resolves to
// the same SVG art as the player <Flag> via the shared flagAssets lookup, so
// every flag in the app matches. Falls back to a plain gray swatch for any
// country without drawn art.
export function CountryFlag({ country, size = 14, className }: CountryFlagProps) {
  const src = flagUrlFor(country);
  if (!src) {
    return (
      <span
        className={`country-flag-fallback${className ? ` ${className}` : ""}`}
        style={{ height: size, width: Math.round(size * 1.5) }}
        aria-hidden
      />
    );
  }
  return (
    <img
      className={`country-flag${className ? ` ${className}` : ""}`}
      src={src}
      alt=""
      style={{ height: size, width: "auto" }}
      aria-hidden
    />
  );
}
