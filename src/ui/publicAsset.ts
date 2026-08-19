/**
 * URLs for files served straight out of `public/`.
 *
 * These can't be written as plain absolute paths ("/favicon.png"). The embedded
 * builds (itch, CrazyGames) are served from a subpath inside someone else's
 * iframe, so an absolute path resolves against *their* domain and 404s — which
 * is exactly how the top-bar logo broke, silently, in both of them.
 *
 * `import.meta.env.BASE_URL` is whatever `base` the build was configured with:
 * "/" for our own site, "./" for the embedded ones. Anything imported through
 * `src/` (crests, flags) already gets this treatment from Vite automatically;
 * `public/` files are copied verbatim and don't, so they need this.
 */
export const publicAsset = (file: string): string => `${import.meta.env.BASE_URL}${file}`;

/** The club-badge mark shown in the top bar and the no-league shell. */
export const LOGO_URL = publicAsset("favicon.png");
