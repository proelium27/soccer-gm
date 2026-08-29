import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { copyFileSync } from "node:fs";
import { cpus } from "node:os";
import { fileURLToPath } from "node:url";
import CostAwareSequencer from "./test/helpers/shardSequencer.js";

/**
 * How many test workers to run locally.
 *
 * Vitest defaults to roughly one worker per core, and on this suite that is
 * measurably too many. The work is full-world multi-season sims, which are
 * heavy and sustained, and the machines running them are fanless laptops that
 * throttle under exactly that load. Measured on an 8-core MacBook Air:
 *
 *   6 workers, 6 heavy files  -> 2025s wall, and the SUM of per-test times came
 *                               to 8476s against ~1038s for the same files
 *                               measured uncontended: an ~8x inflation.
 *   3 workers, 3 heavy files  -> 988s, against ~506s uncontended.
 *
 * i.e. past a fairly low worker count this suite scales *negatively* -- adding
 * workers makes the whole run slower, not just sub-linear. Independently, the
 * two-machine runner measured capping workers as worth 1.96x on the full suite
 * (1117s -> 570s), which is the same effect from the other direction.
 *
 * Note the mechanism is NOT simply running out of RAM, which was the first
 * guess: peak resident size is ~445MB per worker, so even nine of them fit
 * comfortably. It is memory bandwidth and thermal throttling, and it gets worse
 * the longer the machine has been working -- the same three files that take
 * ~506s on a cool machine took 988s after six hours of back-to-back sims. That
 * is the same effect test/helpers/shardPartition.ts warns about when it says a
 * file "measured 234s and 557s an hour apart", one level up.
 *
 * So: half the cores, which is deliberately conservative rather than tuned. The
 * exact optimum is machine- and temperature-dependent and could not be pinned
 * down through that much thermal drift, so this does not pretend to. Override
 * with VITEST_MAX_WORKERS when you know better for your machine.
 *
 * **CI is deliberately left alone.** Its runners are core-poor already (vitest's
 * default is 1-3 workers there), they are not the thermally-limited laptops this
 * is about, and CI is what gates merges -- so there is no upside to touching it
 * and a real downside if this guess is wrong for that hardware.
 */
const localMaxWorkers = (): number | undefined => {
  const override = process.env.VITEST_MAX_WORKERS;
  if (override) {
    const n = Number(override);
    if (!Number.isInteger(n) || n < 1) {
      throw new Error(`VITEST_MAX_WORKERS must be a positive integer, got "${override}"`);
    }
    return n;
  }
  if (process.env.CI) return undefined; // vitest's own default
  return Math.max(1, Math.floor(cpus().length / 2));
};

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

/**
 * GitHub Pages base path.
 *
 * A project page is served from `https://<user>.github.io/<repo>/`, so every
 * asset URL has to carry that prefix — a bundle built with the default "/" base
 * asks github.io for /assets/index-xxx.js and gets the user's *other* sites'
 * 404 page. The workflow passes the repo name in, so a fork or a rename needs
 * no edit here; the fallback is what a local `npm run build:pages` uses.
 *
 * Set PAGES_BASE=/ if the deploy ever gets a custom domain (a CNAME file puts
 * the site at the domain root, where a repo-name prefix would 404 instead).
 *
 * The fallback has to track the repo's *current* name, and it is worth knowing
 * why that matters beyond local builds: this value is baked into every asset
 * URL, so a deployed bundle describes where the site was when it was built.
 * Renaming the repo therefore breaks the live site until it is rebuilt — the
 * page loads and every asset 404s. It happened: soccer-gm became
 * world-soccer-sim hours after the first deploy. The workflow reads the name at
 * build time, so a redeploy is the whole fix; see docs/github-pages.md.
 */
const pagesBase = () => {
  const raw = process.env.PAGES_BASE ?? "/world-soccer-sim/";
  // Vite resolves asset URLs by string concatenation, so a missing trailing
  // slash silently yields /world-soccer-simassets/index.js.
  return raw.endsWith("/") ? raw : `${raw}/`;
};

/**
 * GitHub Pages surgery: an SPA fallback and the pre-React links.
 *
 * Pages is a static file host with no rewrite rules, so a deep link like
 * /world-soccer-sim/manual has no file behind it. The one hook it does offer is
 * 404.html: it serves that document for any path it can't resolve, and the
 * browser renders it with the requested URL still in the address bar — so a
 * byte-identical copy of index.html boots the app on the right route. (The
 * response carries a 404 status. That is invisible to a player, and search
 * engines are pointed at worldsoccersim.org by the canonical tag anyway.)
 *
 * The links in the pre-React placeholder are the other half. They are absolute
 * ("/leagues"), which resolves against the *domain* root rather than the repo
 * subpath — the identical bug the CrazyGames build hits with its iframe, and
 * the same one publicAsset() exists to prevent for files in public/. A click in
 * the window before React mounts would land on github.io/leagues.
 */
function githubPagesHtml(base: string): Plugin {
  return {
    name: "github-pages",
    transformIndexHtml(html) {
      return html.replace(
        /href="\/(leagues|manual|changelog)"/g,
        (_m, path: string) => `href="${base}${path}"`,
      );
    },
    // writeBundle rather than generateBundle: index.html is emitted by Vite's
    // own html plugin, so it only exists on disk once the write is done.
    writeBundle(options) {
      const dir = options.dir ?? "dist";
      copyFileSync(`${dir}/index.html`, `${dir}/404.html`);
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: EMBEDDED.has(mode) ? "./" : mode === "pages" ? pagesBase() : "/",
  plugins: [
    react(),
    ...(mode === "crazygames" ? [crazyGamesHtml()] : []),
    ...(mode === "pages" ? [githubPagesHtml(pagesBase())] : []),
  ],
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
    // CI fans the suite out over several runners with `--shard`. Vitest's own
    // split is by file *count* and ignores what a file costs, which leaves one
    // shard running for half an hour while another finishes in 40 seconds —
    // see test/helpers/shardPartition.ts for the measurements. This weights
    // the split instead. It changes which runner runs a file, never which
    // files run.
    sequence: { sequencer: CostAwareSequencer },
    // See localMaxWorkers above for the measurements. minWorkers moves with it
    // because vitest's default minWorkers sits at the core count, and capping
    // only maxWorkers below that is a contradiction it rejects outright
    // ("options.minThreads and options.maxThreads must not conflict") -- zero
    // tests run and the process exits 1.
    ...(() => {
      const max = localMaxWorkers();
      return max === undefined ? {} : { minWorkers: 1, maxWorkers: max };
    })(),
  },
}));
