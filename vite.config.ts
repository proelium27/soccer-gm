import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

/**
 * Build targets that are embedded in someone else's page rather than served
 * from our own domain. Both are handed to the host as a folder of files at an
 * unknown path inside an iframe, so both need relative asset paths and
 * hash-based routing (there is no server to answer a history-API deep link).
 */
const EMBEDDED = new Set(["itch", "crazygames"]);

/**
 * CrazyGames-only surgery on index.html.
 *
 * Two things have to change, and both are hard requirements rather than
 * polish:
 *
 *   1. **Google AdSense has to go.** CrazyGames allow ads served through their
 *      own SDK and nothing else, so shipping the AdSense loader would fail
 *      review outright.
 *   2. **The SDK has to be there.** It is loaded from their CDN with a plain
 *      script tag, deliberately not bundled, because they serve the current
 *      version from that URL.
 *
 * The SEO block goes too. Inside an iframe none of it can be read by a crawler,
 * and the canonical/og tags point at worldsoccersim.org — a playable copy of
 * the same game, which is the one kind of outbound reference their rules single
 * out as not allowed.
 *
 * The regions are marked with comments in index.html rather than matched by
 * regex, so editing the head can't silently change what gets stripped: if a
 * marker goes missing the build fails instead of shipping AdSense to review.
 */
function crazyGamesHtml(): Plugin {
  const SDK = '<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>';
  // The opening marker carries its own explanation inside the same comment, so
  // this matches from "<!-- name:start" (no closing "-->" assumed) through to
  // the "name:end -->" that shuts the region.
  const region = (name: string) =>
    new RegExp(`[ \\t]*<!-- ${name}:start[\\s\\S]*?${name}:end -->\\n?`, "g");

  return {
    name: "crazygames-html",
    enforce: "pre",
    transformIndexHtml(html) {
      for (const name of ["strip-when-embedded", "seo-when-hosted"]) {
        if (!region(name).test(html)) {
          throw new Error(
            `index.html is missing the "${name}" marker comments. The CrazyGames ` +
              `build strips those regions (AdSense and the SEO block); without the ` +
              `markers it would ship them to review. Restore the markers or update ` +
              `crazyGamesHtml() in vite.config.ts.`,
          );
        }
        html = html.replace(region(name), "");
      }
      // Vite tags the entry script and stylesheet `crossorigin`, fetching them
      // in CORS mode. On CrazyGames both sit on the *same origin* as the
      // document that loads them, so CORS mode buys nothing, and dropping the
      // attribute costs nothing either.
      //
      // Why bother: a Safari QA pass reported "Missing resource detected" for
      // exactly these two files plus CrazyGames' own SDK, while the game was
      // demonstrably running (it rendered, and saves persisted). The SDK being
      // on that list is what rules out the files actually being missing — it is
      // their file, not one we upload. So this is a checker artifact, and this
      // strip is removing a variable rather than a diagnosed fix. **It is not
      // established that `crossorigin` caused it**, and the tempting theory
      // that it did — CORS-mode requests without `Timing-Allow-Origin` get
      // their Resource Timing entry redacted, which is exactly what a "missing
      // resource" heuristic would trip on — does not actually hold here,
      // because same-origin requests are exempt from that redaction. Don't
      // repeat that reasoning as if it were the cause.
      //
      // Safe to drop only because this build emits no `modulepreload` tags. If
      // Vite ever starts emitting them, strip the attribute from those too:
      // a preload and a script that disagree about CORS mode are two separate
      // fetches of the same file, not one.
      html = html.replace(/ crossorigin(?=[ >])/g, "");

      // The pre-React placeholder links to /leagues, /manual and /changelog.
      // React replaces it on mount, but a click landing in that window would
      // navigate the iframe to crazygames.com/leagues and strand the player on
      // a 404. This build is hash-routed, so point them at the hash instead.
      html = html.replace(/href="\/(leagues|manual|changelog)"/g, 'href="#/$1"');
      return html.replace("</head>", `  ${SDK}\n</head>`);
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: EMBEDDED.has(mode) ? "./" : "/",
  plugins: [react(), ...(mode === "crazygames" ? [crazyGamesHtml()] : [])],
  resolve: {
    alias:
      mode === "crazygames"
        ? // No analytics in the CrazyGames bundle — see src/ui/vendor/posthogNoop.ts.
          { "posthog-js": fileURLToPath(new URL("./src/ui/vendor/posthogNoop.ts", import.meta.url)) }
        : {},
  },
  root: ".",
  build: { outDir: mode === "crazygames" ? "dist-crazygames" : "dist" },
  test: {
    exclude: [".claude/**", "node_modules/**"],
  },
}));
