#!/usr/bin/env bash
# Build the CrazyGames bundle for the developer portal upload form.
#
# Run with `npm run package:crazygames`. Output: the dist-crazygames/ folder.
#
# **Do not zip it.** The portal's upload zone rejects archives outright ("Archive
# files are not supported, please drag and drop the files directly in the upload
# zone"), so what you drag in is the folder's *contents* — index.html, the two
# icons, and the assets/ directory. Dragging the dist-crazygames folder itself
# buries index.html one level down, which the form then rejects for not
# containing one.
#
# Their limits, for reference when this starts to grow: 50 MB initial download,
# 250 MB total, 1500 files. The script prints them at the end so a regression
# shows up here rather than in review.
set -euo pipefail

cd "$(dirname "$0")/.."

OUT=dist-crazygames

npm run build:crazygames

# public/ is copied wholesale by Vite, and most of it exists only to serve
# worldsoccersim.org: robots/sitemap/llms are instructions to crawlers that
# cannot reach an iframed game, and og-image is the link-preview card. Dead
# weight in the bundle, and og-image is 140 kB of it.
rm -f "$OUT/robots.txt" "$OUT/sitemap.xml" "$OUT/llms.txt" "$OUT/og-image.png"

# A build that still carries AdSense, or that lost the SDK, fails review. Both
# are cheap to check and expensive to miss, so check them every time.
if grep -qr "googlesyndication" "$OUT"; then
  echo "FAIL: the bundle still references googlesyndication (AdSense)." >&2
  exit 1
fi
if ! grep -q "sdk.crazygames.com" "$OUT/index.html"; then
  echo "FAIL: index.html is missing the CrazyGames SDK script tag." >&2
  exit 1
fi
if grep -qr "posthog.com\|i.posthog" "$OUT" 2>/dev/null; then
  echo "FAIL: the bundle still references PostHog." >&2
  exit 1
fi

# The HTML transform strips `crossorigin` from the entry tags (see
# vite.config.ts). That is only safe while there are no modulepreload tags: a
# preload and a script that disagree about CORS mode fetch the same file twice.
if grep -q "modulepreload" "$OUT/index.html"; then
  echo "FAIL: index.html now has modulepreload tags. The crossorigin strip in" >&2
  echo "      vite.config.ts must cover them too, or the entry chunk is fetched" >&2
  echo "      twice. See the comment there." >&2
  exit 1
fi
if grep -q "crossorigin" "$OUT/index.html"; then
  echo "FAIL: crossorigin survived in index.html; the strip in vite.config.ts" >&2
  echo "      no longer matches what Vite emits." >&2
  exit 1
fi

echo
echo "$OUT  $(du -sh "$OUT" | cut -f1), $(find "$OUT" -type f | wc -l | tr -d ' ') files"
echo "Limits: 50 MB initial download / 250 MB total / 1500 files."
echo
echo "To upload: open $OUT, select all four entries (index.html, favicon.png,"
echo "apple-touch-icon.png, assets/) and drag them into the portal's upload zone."
echo "Do not zip, and do not drag the $OUT folder itself."
