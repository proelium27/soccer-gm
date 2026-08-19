#!/usr/bin/env bash
# Build the CrazyGames bundle and zip it for the developer portal upload form.
#
# Run with `npm run package:crazygames`. Output: soccer-gm-crazygames.zip in the
# repo root, which is the file you drag into the upload form.
#
# Their limits, for reference when this starts to grow: 50 MB initial download,
# 250 MB total, 1500 files. The script prints all three at the end so a
# regression shows up here rather than in review.
set -euo pipefail

cd "$(dirname "$0")/.."

OUT=dist-crazygames
ZIP=soccer-gm-crazygames.zip

npm run build:crazygames

# public/ is copied wholesale by Vite, and most of it exists only to serve
# worldsoccersim.org: robots/sitemap/llms are instructions to crawlers that
# cannot reach an iframed game, and og-image is the link-preview card. Dead
# weight in the bundle, and og-image is 140 kB of it.
rm -f "$OUT/robots.txt" "$OUT/sitemap.xml" "$OUT/llms.txt" "$OUT/og-image.png"

# index.html must sit at the root of the zip, not inside a folder — that is why
# this zips the directory's contents rather than the directory.
rm -f "$ZIP"
(cd "$OUT" && zip -qr "../$ZIP" .)

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

echo
echo "$ZIP  $(du -h "$ZIP" | cut -f1) zipped"
echo "$OUT  $(du -sh "$OUT" | cut -f1) unpacked, $(find "$OUT" -type f | wc -l | tr -d ' ') files"
echo "Limits: 50 MB initial download / 250 MB total / 1500 files."
