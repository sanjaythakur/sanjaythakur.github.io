#!/bin/sh
# Render one 1200×630 Open Graph PNG per listed post into public/media/og/.
# Build-time only (SPEC §11): nothing here is served. Needs Google Chrome and python3.
# Usage: sh tools/og/render.sh
set -eu
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
CHROME=${CHROME:-"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"}
PORT=${PORT:-8765}
OUT="$ROOT/public/media/og"
mkdir -p "$OUT"

python3 -m http.server "$PORT" -d "$ROOT" >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
sleep 1

SLUGS=$(grep -o '"file": *"posts/[^"]*\.html"' "$ROOT/public/blogData.js" | sed 's/.*posts\/\(.*\)\.html"/\1/')
for slug in $SLUGS; do
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --window-size=1200,630 --virtual-time-budget=4000 \
    --screenshot="$OUT/$slug.png" \
    "http://localhost:$PORT/tools/og/card.html?slug=$slug" >/dev/null 2>&1
  echo "rendered media/og/$slug.png"
done
