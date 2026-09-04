import { describe, expect, it } from "vitest";
import {
  LOGO_PACK_FORMAT,
  LOGO_PACK_VERSION,
  MAX_LOGO_DATA_URL,
  buildLogoPack,
  combineLogoPacks,
  isImageDataUrl,
  normalizeClubName,
  parseLogoPack,
  resolveLogoPack,
  type LogoPack,
  type LogoTargetClub,
} from "../../src/core/teams/logoPack.js";

/** A minimal but genuinely well-formed data URL: a 1x1 transparent PNG. */
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const PNG2 = PNG.replace("iVBORw0", "iVBORw1");

const pack = (logos: { match: string; image: string }[]): LogoPack => ({
  format: LOGO_PACK_FORMAT,
  formatVersion: LOGO_PACK_VERSION,
  logos,
});

const club = (tid: number, name: string, abbrev: string): LogoTargetClub => ({ tid, name, abbrev });

describe("normalizeClubName", () => {
  it("folds case, accents and punctuation so two spellings of one club meet", () => {
    expect(normalizeClubName("Bayern München")).toBe(normalizeClubName("bayern-munchen"));
    expect(normalizeClubName("Real Betis Balompié")).toBe(normalizeClubName("REAL_BETIS_BALOMPIE"));
    expect(normalizeClubName("  Inter   Milan ")).toBe("inter milan");
  });

  it("keeps genuinely different clubs apart", () => {
    expect(normalizeClubName("Manchester United")).not.toBe(normalizeClubName("Manchester City"));
  });
});

describe("resolveLogoPack", () => {
  const clubs = [
    club(0, "Liverpool", "LIV"),
    club(1, "Bayern München", "BAY"),
    club(2, "Real Sociedad", "RSO"),
  ];

  it("matches by name, however the file spelled it", () => {
    const { byTid, unmatched } = resolveLogoPack(clubs, pack([
      { match: "liverpool", image: PNG },
      { match: "Bayern Munchen", image: PNG2 },
    ]));
    expect(byTid.get(0)).toBe(PNG);
    expect(byTid.get(1)).toBe(PNG2);
    expect(unmatched).toEqual([]);
  });

  it("falls back to the abbreviation when no name matches", () => {
    const { byTid } = resolveLogoPack(clubs, pack([{ match: "RSO", image: PNG }]));
    expect(byTid.get(2)).toBe(PNG);
  });

  it("never lets an abbreviation overwrite a badge a full name already placed", () => {
    // The reason the two passes are separate: three letters collide far more
    // readily than a name does, so a name match has to be the stronger claim.
    const shadowed = [club(0, "Liverpool", "LIV"), club(1, "Livingston", "LIV")];
    const { byTid } = resolveLogoPack(shadowed, pack([
      { match: "Liverpool", image: PNG },
      { match: "LIV", image: PNG2 },
    ]));
    expect(byTid.get(0)).toBe(PNG);
    // Livingston was never named, so the abbreviation is free to claim it.
    expect(byTid.get(1)).toBe(PNG2);
  });

  it("reports entries no club here answers to, rather than dropping them silently", () => {
    // The whole failure mode of this feature: a badge that lands nowhere looks
    // exactly like no badge at all, so the count is the only place it surfaces.
    const { byTid, unmatched } = resolveLogoPack(clubs, pack([
      { match: "Boca Juniors", image: PNG },
    ]));
    expect(byTid.size).toBe(0);
    expect(unmatched).toEqual(["Boca Juniors"]);
  });

  it("badges every club of that name when two divisions share one", () => {
    const twins = [club(5, "Athletic", "ATH"), club(90, "Athletic", "ATL")];
    const { byTid } = resolveLogoPack(twins, pack([{ match: "Athletic", image: PNG }]));
    expect([...byTid.keys()].sort((a, b) => a - b)).toEqual([5, 90]);
  });
});

describe("combineLogoPacks", () => {
  it("concatenates packs in load order, so a world can be dressed a league at a time", () => {
    const { pack: out, warnings } = combineLogoPacks([
      { name: "england.json", pack: pack([{ match: "Liverpool", image: PNG }]) },
      { name: "spain.json", pack: pack([{ match: "Real Sociedad", image: PNG2 }]) },
    ]);
    expect(out.logos.map((l) => l.match)).toEqual(["Liverpool", "Real Sociedad"]);
    expect(warnings).toEqual([]);
  });

  it("lets the later pack win a club both name, and says so", () => {
    const { pack: out, warnings } = combineLogoPacks([
      { name: "old.json", pack: pack([{ match: "Liverpool", image: PNG }]) },
      { name: "new.json", pack: pack([{ match: "liverpool", image: PNG2 }]) },
    ]);
    expect(out.logos).toHaveLength(1);
    expect(out.logos[0].image).toBe(PNG2);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("new.json");
  });

  it("says nothing about a pack that repeats a club within itself", () => {
    // Not a collision between two of the user's choices, so there is nothing
    // for them to decide — reporting it would be noise.
    const { warnings } = combineLogoPacks([
      { name: "one.json", pack: pack([
        { match: "Liverpool", image: PNG },
        { match: "LIVERPOOL", image: PNG2 },
      ]) },
    ]);
    expect(warnings).toEqual([]);
  });
});

describe("parseLogoPack", () => {
  const valid = JSON.stringify(pack([{ match: "Liverpool", image: PNG }]));

  it("reads a well-formed pack", () => {
    expect(parseLogoPack(valid).logos).toEqual([{ match: "Liverpool", image: PNG }]);
  });

  it("rejects a roster file by name rather than by a missing field", () => {
    expect(() => parseLogoPack(JSON.stringify({ format: "world-soccer-sim-roster" })))
      .toThrow(/format/);
  });

  it("rejects anything that isn't a raster image data URL", () => {
    // These strings go straight into an <img src>. A data: URL can hold an HTML
    // document or an SVG, and an SVG is a document that can carry script.
    for (const image of [
      "https://example.com/liverpool.png",
      "./liverpool.png",
      "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
      "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
    ]) {
      expect(() => parseLogoPack(JSON.stringify(pack([{ match: "X", image }]))))
        .toThrow(/data:image/);
    }
  });

  it("refuses an image too big to store, naming the club", () => {
    const huge = `data:image/png;base64,${"A".repeat(MAX_LOGO_DATA_URL)}`;
    expect(() => parseLogoPack(JSON.stringify(pack([{ match: "Liverpool", image: huge }]))))
      .toThrow(/Liverpool/);
  });

  it("names the offending entry on a malformed field", () => {
    expect(() => parseLogoPack(JSON.stringify({
      format: LOGO_PACK_FORMAT,
      formatVersion: LOGO_PACK_VERSION,
      logos: [{ match: "Liverpool", image: PNG }, { match: "", image: PNG }],
    }))).toThrow(/logos\[1\]/);
  });

  it("refuses a version it doesn't read", () => {
    expect(() => parseLogoPack(JSON.stringify({ ...pack([]), formatVersion: 99 })))
      .toThrow(/version/);
  });
});

describe("buildLogoPack", () => {
  it("round-trips a save's badges back into a file someone else can load", () => {
    const clubs = [club(0, "Liverpool", "LIV"), club(1, "Real Sociedad", "RSO")];
    const built = buildLogoPack(clubs, new Map([[0, PNG], [1, PNG2]]));
    const reparsed = parseLogoPack(JSON.stringify(built));
    const { byTid } = resolveLogoPack(clubs, reparsed);
    expect(byTid.get(0)).toBe(PNG);
    expect(byTid.get(1)).toBe(PNG2);
  });

  it("skips a tid the world no longer has a club for", () => {
    expect(buildLogoPack([club(0, "Liverpool", "LIV")], new Map([[99, PNG]])).logos)
      .toEqual([]);
  });
});

describe("isImageDataUrl", () => {
  it("accepts exactly the raster formats a canvas produces", () => {
    for (const type of ["png", "jpeg", "webp", "gif", "avif"]) {
      expect(isImageDataUrl(`data:image/${type};base64,AAAA`)).toBe(true);
    }
  });

  it("rejects svg, non-images and remote URLs", () => {
    expect(isImageDataUrl("data:image/svg+xml;base64,AAAA")).toBe(false);
    expect(isImageDataUrl("data:text/html;base64,AAAA")).toBe(false);
    expect(isImageDataUrl("https://example.com/a.png")).toBe(false);
    expect(isImageDataUrl("data:image/png,notbase64")).toBe(false);
  });
});
