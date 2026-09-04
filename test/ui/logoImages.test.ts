import { describe, expect, it } from "vitest";
import { clubNameFromFilename, isImageFile, LOGO_PICKER_ACCEPT } from "../../src/ui/logoImages.js";
import { normalizeClubName } from "../../src/core/teams/logoPack.js";

/**
 * The decode-and-shrink half of logoImages needs a canvas and so can only be
 * exercised in a browser (there is no DOM test env in this repo). What is
 * testable here is the part that decides which club a picture is for — which is
 * also the part that goes wrong quietly, since a badge matched to nobody is
 * indistinguishable from no badge at all.
 */

describe("clubNameFromFilename", () => {
  it("reads the plain case", () => {
    expect(clubNameFromFilename("Liverpool.png")).toBe("Liverpool");
  });

  it("turns the separators a downloaded badge arrives with back into spaces", () => {
    for (const name of [
      "real-sociedad.png", "real_sociedad.webp", "real+sociedad.jpg", "Real  Sociedad.png",
    ]) {
      expect(normalizeClubName(clubNameFromFilename(name))).toBe("real sociedad");
    }
  });

  it("drops the trailing word a badge file is usually labelled with", () => {
    for (const suffix of ["logo", "crest", "badge", "LOGO"]) {
      expect(clubNameFromFilename(`Liverpool-${suffix}.png`)).toBe("Liverpool");
    }
  });

  it("keeps a word that only looks like one, mid-name", () => {
    // "Badge" is not a club, but "Logo Rovers" would be if someone invented it,
    // and only the trailing position is safe to strip.
    expect(clubNameFromFilename("Logo Rovers.png")).toBe("Logo Rovers");
  });

  it("leaves accents alone, because the matcher is what folds them", () => {
    expect(clubNameFromFilename("Bayern München.png")).toBe("Bayern München");
  });

  it("gives nothing back for a file with no name of its own", () => {
    expect(clubNameFromFilename(".png")).toBe("");
  });
});

describe("isImageFile", () => {
  const file = (name: string, type = "") => new File([""], name, { type });

  it("takes every extension the picker offers", () => {
    for (const ext of ["png", "jpg", "jpeg", "webp", "gif", "avif", "svg"]) {
      expect(isImageFile(file(`club.${ext}`))).toBe(true);
      expect(LOGO_PICKER_ACCEPT).toContain(`.${ext}`);
    }
  });

  it("trusts the MIME type when the name has no extension", () => {
    expect(isImageFile(file("club", "image/png"))).toBe(true);
  });

  it("leaves a pack file to the pack parser", () => {
    // The picker takes both through one input, so this is the fork.
    expect(isImageFile(file("logos.json", "application/json"))).toBe(false);
    expect(LOGO_PICKER_ACCEPT).toContain(".json");
  });
});
