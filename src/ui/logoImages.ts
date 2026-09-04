import {
  LOGO_PACK_FORMAT,
  LOGO_PACK_VERSION,
  MAX_LOGO_DATA_URL,
  isLogoPackFormat,
  type LogoPack,
  type LogoPackEntry,
} from "../core/teams/logoPack.js";

/**
 * Turning picture files into a logo pack. The browser half of the feature,
 * kept out of `src/core` because it is nothing but DOM: decoding an image and
 * resizing it are `Image`, `canvas` and `URL.createObjectURL`, none of which
 * exist in the sim's world (or in the headless scripts and audits that import
 * it). `core/teams/logoPack.ts` holds the format and the matching, which are
 * pure and testable; this holds the parts that need a browser.
 *
 * Every image the game accepts comes through `imageToLogoDataUrl`, so the
 * downscale is not something a caller can skip. That matters more than it
 * looks: a folder of real club badges runs to ~110 KB a file (the size of the
 * shipped crest art) and a 626-club world of them is ~69 MB — read into memory,
 * written to disk, and handed to an `<img>` at 20 pixels square. Re-encoding at
 * `CREST_IMAGE_SIZE` costs one canvas per file and turns that into ~3 MB.
 */

/**
 * The square each badge is stored at.
 *
 * Crests render between 16 and 64 CSS pixels across the game, so 160 covers the
 * largest of those on a 2x display with room to spare, and the whole point is
 * that it is a *ceiling* rather than a target — a smaller source is never
 * enlarged, so a 32px favicon someone dropped in stays 32px and stays sharp
 * rather than being blown up into a blur.
 */
export const CREST_IMAGE_SIZE = 160;

/** WebP quality. High, because these are flat-colour badges at small sizes. */
const CREST_IMAGE_QUALITY = 0.9;

/** Extensions the picker will try to decode. SVG included — it is rasterized, never stored. */
export const LOGO_IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif", "avif", "svg"] as const;

/** The `accept` attribute for the picker: packs and pictures in one input. */
export const LOGO_PICKER_ACCEPT =
  [".json", ...LOGO_IMAGE_EXTENSIONS.map((e) => `.${e}`)].join(",");

/** Does this file look like a picture rather than a pack? */
export function isImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return (LOGO_IMAGE_EXTENSIONS as readonly string[]).includes(ext);
}

/**
 * Read a filename as the club it is meant for: `FC Bayern München.png` ->
 * `FC Bayern München`, `liverpool-fc_logo.png` -> `liverpool fc`.
 *
 * Separators become spaces and a trailing "logo"/"crest"/"badge" is dropped,
 * because those are what a downloaded badge is usually called and none of them
 * is ever part of a club's name. The rest is left alone — `normalizeClubName`
 * on the matching side is what folds case, accents and punctuation, so there is
 * no need (and no benefit) in being clever here.
 */
export function clubNameFromFilename(filename: string): string {
  const stem = filename.replace(/\.[^.]+$/, "");
  return stem
    .replace(/[_+]+/g, " ")
    .replace(/-+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*\b(logo|crest|badge)\b\s*$/i, "")
    .trim();
}

/**
 * Decode one picture file and re-encode it as a small square data URL.
 *
 * Uses an `HTMLImageElement` rather than `createImageBitmap` for one reason:
 * SVG. A great many badge packs are SVG, `createImageBitmap` has never handled
 * it consistently across browsers, and an `<img>` has rasterized it since
 * forever. Rasterizing is also what makes accepting SVG *safe* — an SVG is a
 * document that can carry script, and none of it survives being drawn onto a
 * canvas, so what gets stored is always a flat raster.
 *
 * Fitted rather than stretched, on a transparent ground: a badge is rarely
 * square and squashing one to fit is worse than the letterboxing nobody can see
 * through the transparency.
 */
export async function imageToLogoDataUrl(file: Blob): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) {
      // An SVG with no intrinsic size decodes to 0x0 in some browsers. There is
      // nothing to scale against, so say so rather than writing a blank badge.
      throw new Error("that picture has no size the browser could read");
    }
    // Never upscale: a source smaller than the box is stored at its own size.
    const scale = Math.min(CREST_IMAGE_SIZE / w, CREST_IMAGE_SIZE / h, 1);
    const outW = Math.max(1, Math.round(w * scale));
    const outH = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("this browser wouldn't give the game a canvas to draw on");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, outW, outH);

    // toDataURL falls back to PNG when it doesn't know the type asked for, which
    // is exactly the behaviour wanted on a browser without WebP encoding — the
    // result is bigger but correct, and the sniff below is only so the caller
    // isn't told it got WebP when it didn't.
    const webp = canvas.toDataURL("image/webp", CREST_IMAGE_QUALITY);
    const out = webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/png");
    if (out.length > MAX_LOGO_DATA_URL) {
      throw new Error(
        `it came out ${Math.round(out.length / 1024)} KB even after shrinking, which is too big to store`,
      );
    }
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("the browser couldn't read that as a picture"));
    img.src = src;
  });
}

export interface LoadedLogoFiles {
  /** One pack per file the picker understood: a parsed `.json`, or the pictures folded into one. */
  packs: { name: string; pack: LogoPack }[];
  /** One message per file that failed, naming it. */
  errors: string[];
}

/**
 * Read whatever the user picked.
 *
 * Pictures and packs go through one input on purpose. A `.json` pack is the
 * shareable form — one file carrying a whole league's badges — but the thing a
 * person actually *has* is a folder of PNGs, and making them convert it first
 * would put a build step in front of the feature. So the picker takes both and
 * the pictures are folded into a single pack named after however many there
 * were, which is then indistinguishable from one somebody sent them.
 *
 * A file that won't read takes only itself out, the same rule the roster picker
 * follows: re-picking nineteen good badges to fix a twentieth is exactly the
 * tedium worth removing.
 */
export async function loadLogoFiles(files: File[]): Promise<LoadedLogoFiles> {
  const packs: { name: string; pack: LogoPack }[] = [];
  const errors: string[] = [];
  const images: LogoPackEntry[] = [];

  for (const file of files) {
    try {
      if (isImageFile(file)) {
        const match = clubNameFromFilename(file.name);
        if (!match) {
          throw new Error("its name doesn't say which club it's for");
        }
        images.push({ match, image: await imageToLogoDataUrl(file) });
      } else {
        packs.push({ name: file.name, pack: await parsePackFile(file) });
      }
    } catch (err) {
      errors.push(`${file.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (images.length > 0) {
    packs.push({
      name: `${images.length} ${images.length === 1 ? "picture" : "pictures"}`,
      pack: { format: LOGO_PACK_FORMAT, formatVersion: LOGO_PACK_VERSION, logos: images },
    });
  }
  return { packs, errors };
}

/**
 * Parse a picked `.json` as a logo pack, with the one error message worth
 * spelling out: a roster file and a logo pack are both JSON files loaded from
 * screens a step apart, so picking the wrong one is the mistake to expect.
 */
async function parsePackFile(file: File): Promise<LogoPack> {
  const { readLeagueFileText } = await import("../db/exportImport.js");
  const { parseLogoPack } = await import("../core/teams/logoPack.js");
  const text = await readLeagueFileText(file);
  let format: unknown;
  try {
    format = (JSON.parse(text) as Record<string, unknown>).format;
  } catch {
    // Leave it to parseLogoPack, which says "not valid JSON" properly.
  }
  if (format !== undefined && !isLogoPackFormat(format)) {
    throw new Error(
      `that's a ${JSON.stringify(format)} file, not a logo pack. `
      + `Roster files go in the roster picker above.`,
    );
  }
  return parseLogoPack(text);
}
