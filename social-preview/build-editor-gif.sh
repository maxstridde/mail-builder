#!/usr/bin/env bash
# build-editor-gif.sh — capture progressive editor stages from the live app and
# assemble them into assets/editor-demo.gif for the README.
#
# Adapted from maxstridde/social_preview (scripts/build-demo-gif.sh): same
# "hold each frame, loop forever" idea, but the frames are real UI screenshots
# captured by capture-editor.mjs instead of static example JPGs.
#
# Steps:
#   1. start `npm run dev` if nothing is serving APP_URL yet
#   2. run the Playwright capture -> screenshots/01..04.png
#   3. pad each frame to a uniform size and stitch the GIF
#
# Requires: ImageMagick 7 (`magick`), Node, and Playwright reachable on the
# machine (globally installed or in the npm/npx cache — auto-detected below).

set -euo pipefail
cd "$(dirname "$0")"

APP_URL="${APP_URL:-http://localhost:5173/mail-builder/}"
OUT="${OUT:-assets/editor-demo.gif}"
FRAME_W=1100
FRAME_H=688          # keeps the 1440x900 capture aspect (scaled down)
DELAY=180            # hundredths of a second per frame
PAD_COLOR="#1D4ED8"  # accent blue, matches the social preview

mkdir -p assets screenshots

# --- locate Playwright ----------------------------------------------------
PLAYWRIGHT_PKG="$(node -e '
  try { console.log(require.resolve("playwright")); }
  catch (e) {
    const { execSync } = require("node:child_process");
    const hits = execSync("find " + require("os").homedir() +
      "/.npm/_npx -maxdepth 4 -name playwright -type d 2>/dev/null || true")
      .toString().trim().split("\n").filter(Boolean);
    if (!hits.length) { console.error("Playwright not found"); process.exit(3); }
    console.log(require("node:path").join(hits[0], "index.js"));
  }
')"
export PLAYWRIGHT_PKG
echo "Using Playwright: $PLAYWRIGHT_PKG"

# --- ensure the dev server is up -----------------------------------------
STARTED_DEV=""
if ! curl -sf -o /dev/null "$APP_URL"; then
  echo "Starting dev server…"
  ( cd .. && npm run dev >/tmp/mail-builder-dev.log 2>&1 & echo $! >/tmp/mail-builder-dev.pid )
  STARTED_DEV=1
  for _ in $(seq 1 30); do
    curl -sf -o /dev/null "$APP_URL" && break
    sleep 0.5
  done
fi

# --- capture frames -------------------------------------------------------
APP_URL="$APP_URL" node capture-editor.mjs

# --- stitch GIF -----------------------------------------------------------
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
i=0
for src in screenshots/*.png; do
  out="$TMP/$(printf '%02d' "$i").png"
  magick "$src" -resize "${FRAME_W}x${FRAME_H}" \
    -background "$PAD_COLOR" -gravity center -extent "${FRAME_W}x${FRAME_H}" \
    "$out"
  i=$((i+1))
done

magick -delay "$DELAY" -loop 0 "$TMP"/*.png -layers Optimize "$OUT"
echo "Wrote $OUT"

# --- clean up the dev server if we started it ----------------------------
if [[ -n "$STARTED_DEV" && -f /tmp/mail-builder-dev.pid ]]; then
  kill "$(cat /tmp/mail-builder-dev.pid)" 2>/dev/null || true
  rm -f /tmp/mail-builder-dev.pid
fi
