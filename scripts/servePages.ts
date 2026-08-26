/**
 * Serves a `npm run build:pages` bundle the way GitHub Pages serves it, so the
 * subpath bugs are visible locally.
 *
 *   npm run build:pages
 *   npx tsx scripts/servePages.ts        # http://localhost:4174/soccer-gm/
 *
 * The two behaviours it reproduces are the two that a plain `python3 -m
 * http.server dist` hides, and they are the whole reason this exists — the same
 * trap `dist-crazygames-harness.html` was written for, where opening the built
 * index.html in a tab passes even when every relative path is wrong:
 *
 *   1. **Everything lives under /<repo>/.** A bundle built with the wrong base
 *      still loads at the root, so serving `dist/` directly proves nothing.
 *   2. **Unknown paths fall back to 404.html, with a 404 status.** That is how
 *      a deep link like /soccer-gm/manual boots the app on Pages, and how it
 *      breaks if the fallback file is ever missing.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";

const dir = process.env.PAGES_DIR ?? "dist";
const port = Number(process.env.PORT ?? 4174);
// Matches the workflow's default. Keep in step with PAGES_BASE in vite.config.ts.
const base = (process.env.PAGES_BASE ?? "/soccer-gm/").replace(/\/*$/, "/");

const TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
  ".xml": "application/xml",
  ".woff2": "font/woff2",
};

createServer(async (req, res) => {
  const path = new URL(req.url ?? "/", "http://localhost").pathname;
  if (!path.startsWith(base)) {
    // Off-site on the real host too: github.io serves the *user's* 404 here,
    // which is exactly what a bundle built with the wrong base would hit.
    res.writeHead(404, { "content-type": "text/plain" }).end(`Not under ${base}`);
    return;
  }
  let rel = path.slice(base.length) || "index.html";
  if (rel.endsWith("/")) rel += "index.html";
  try {
    const body = await readFile(join(dir, rel));
    res.writeHead(200, { "content-type": TYPES[extname(rel)] ?? "application/octet-stream" }).end(body);
  } catch {
    // Pages answers 404 here, not 200, and the app still boots. Keep the status.
    const body = await readFile(join(dir, "404.html")).catch(() => null);
    if (!body) {
      res.writeHead(500, { "content-type": "text/plain" }).end(
        `${dir}/404.html is missing — the SPA fallback was not built. Run: npm run build:pages`,
      );
      return;
    }
    res.writeHead(404, { "content-type": "text/html" }).end(body);
  }
}).listen(port, () => console.log(`serving ${dir} at http://localhost:${port}${base}`));
