/**
 * EA FC nation names -> soccer-gm nationality keys.
 *
 * Only the disagreements are listed; anything not here passes through
 * unchanged. A nationality the game doesn't know is harmless — Flag.tsx falls
 * back to a blank placeholder rather than erroring, and the name pools are
 * never consulted for an imported player (we supply his name) — so this map
 * exists purely so the common cases get their flag.
 */
export const NATION_ALIASES: Record<string, string> = {
  "korea republic": "South Korea",
  "korea, republic of": "South Korea",
  "south korea": "South Korea",
  "korea dpr": "South Korea",
  "china pr": "China",
  "chinese taipei": "China",
  "côte d'ivoire": "Ivory Coast",
  "cote d'ivoire": "Ivory Coast",
  "ivory coast": "Ivory Coast",
  czechia: "Czech Republic",
  "czech republic": "Czech Republic",
  "cabo verde": "Cape Verde",
  "cape verde islands": "Cape Verde",
  "congo dr": "DR Congo",
  "dr congo": "DR Congo",
  "democratic republic of the congo": "DR Congo",
  "congo the democratic republic of the": "DR Congo",
  türkiye: "Turkey",
  turkiye: "Turkey",
  "united states": "United States",
  usa: "United States",
  "united states of america": "United States",
  "republic of ireland": "Republic of Ireland",
  ireland: "Republic of Ireland",
  "irish republic": "Republic of Ireland",
  "iran islamic republic of": "Iran",
  "islamic republic of iran": "Iran",
  "guinea bissau": "Guinea-Bissau",
  "guinea-bissau": "Guinea-Bissau",
  "burkina faso": "Burkina Faso",
  "costa rica": "Costa Rica",
  "new zealand": "New Zealand",
  "south africa": "South Africa",
};

export function mapNation(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const key = raw.trim().toLowerCase();
  return NATION_ALIASES[key] ?? raw.trim();
}
