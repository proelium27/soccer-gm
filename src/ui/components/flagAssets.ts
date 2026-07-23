import { flagCodeFor } from "../../core/players/flags.js";

// Shared flag-art lookup. SVGs live in src/ui/assets/flags/ named by ISO code
// (e.g. fr.svg, gb-eng.svg) and are loaded through the bundler so each flag is
// an isolated image (avoids clip-path id collisions and the missing-emoji
// fallback where nationalities showed as bare "ES"/"DK" letters). Both the
// player <Flag> and the country-level <CountryFlag> resolve through here so
// every flag in the app is the same art.
const flagModules = import.meta.glob("../assets/flags/*.svg", {
  eager: true,
  import: "default",
}) as Record<string, string>;

const FLAG_BY_CODE: Record<string, string> = {};
for (const path in flagModules) {
  const match = path.match(/([a-z-]+)\.svg$/);
  if (match) FLAG_BY_CODE[match[1]] = flagModules[path];
}

/**
 * Flag image URL for a country or nationality string (e.g. "England", "Spain",
 * "Brazil"), or undefined if there's no art for it. Countries and nationalities
 * share the same name→code map (`flagCodeFor`).
 */
export function flagUrlFor(name: string): string | undefined {
  const code = flagCodeFor(name);
  return code ? FLAG_BY_CODE[code] : undefined;
}
