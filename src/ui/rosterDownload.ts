/**
 * Where the Import screen sends someone who doesn't have a roster file yet.
 *
 * The game ships 320 fictional clubs on purpose (trademark caution — see
 * `docs/eafc-import.md`), and a roster file carrying real clubs and real
 * players is a local overlay you bring yourself. That leaves a gap: the Import
 * screen tells you to write a file or generate one with an AI, which is a lot
 * to ask of someone who just wants to play a season with real squads.
 *
 * So the file is *linked*, never bundled. It lives on a host outside this
 * repo and the URL is a build-time value, which keeps three things true at
 * once:
 *
 *   1. No real club or player name enters git, `dist/`, or any of the store
 *      uploads. The bundles stay exactly as trademark-clean as they are today.
 *   2. The link can be withdrawn by changing one env value and rebuilding —
 *      no emergency patch to three platforms.
 *   3. It is set per build target, which is what keeps it out of the
 *      CrazyGames bundle. Their rules restrict pointing players off-site (the
 *      same rule that makes `crazyGamesHtml()` in vite.config.ts strip the
 *      canonical/og tags), so `.env.crazygames` deliberately leaves it unset.
 *
 * Unset is the default everywhere, and an unset value renders no link at all
 * rather than a dead button. A build that forgets the variable is missing a
 * feature, which is visible; a build that ships a 404 behind "Download" is
 * a bug report.
 */

const raw = import.meta.env.VITE_ROSTER_DOWNLOAD_URL;

/**
 * The download URL, or null when this build wasn't given one.
 *
 * Only http(s) is accepted. The value is inlined from the environment at build
 * time and lands in an `href`, so a `javascript:` or `data:` URL sitting in a
 * mode file would be a script-injection vector wearing a download button.
 * Anything that isn't a parseable http(s) URL is dropped to null, which fails
 * the same safe way an unset value does.
 */
export const ROSTER_DOWNLOAD_URL: string | null = (() => {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (value === "") return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return parsed.href;
  } catch {
    return null;
  }
})();
