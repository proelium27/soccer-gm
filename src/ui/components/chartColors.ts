/**
 * Club-colored line/area helpers shared by the career charts (OvrHistoryChart,
 * ValueHistoryChart). Kept out of the components so both draw a club's stint in
 * exactly the same color.
 */

/** Fallback line color for a season with no resolvable club (e.g. a free agent). */
export const NEUTRAL_COLOR = "#9aa0a0";

type Rgb = { r: number; g: number; b: number };

export function parseHex(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** Relative luminance, 0 (black) – 1 (white). */
function lum({ r, g, b }: Rgb) {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}
function toHex({ r, g, b }: Rgb) {
  const f = (x: number) => Math.round(x).toString(16).padStart(2, "0");
  return `#${f(r)}${f(g)}${f(b)}`;
}
function mix(c: Rgb, t: Rgb, amt: number): Rgb {
  return { r: c.r + (t.r - c.r) * amt, g: c.g + (t.g - c.g) * amt, b: c.b + (t.b - c.b) * amt };
}

/**
 * A visible line color for a club: its primary (identity) color, lightened if
 * it's too dark to read against the dark chart surface (keeps the hue but lifts
 * a dark kit like "#c0392b" into view). Only a near-black primary falls back to
 * the secondary, so brightening doesn't wash it into gray.
 */
export function teamLineColor(colors: [string, string]): string {
  const primary = parseHex(colors[0]);
  const secondary = parseHex(colors[1]);
  let base = primary ?? secondary;
  if (!base) return NEUTRAL_COLOR;
  if (lum(base) < 0.12 && secondary && lum(secondary) > 0.2) base = secondary;
  if (lum(base) < 0.42) base = mix(base, { r: 255, g: 255, b: 255 }, 0.5);
  return toHex(base);
}

/** Dark or light text that reads against `hex`. */
export function readableText(hex: string): string {
  const rgb = parseHex(hex);
  return rgb && lum(rgb) > 0.6 ? "#14211a" : "#ffffff";
}
