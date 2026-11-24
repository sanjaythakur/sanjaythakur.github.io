#!/bin/sh
# Render 1200×630 Open Graph PNGs into public/media/og/: one per listed post,
# plus play.png and play-<slug>.png for the /play/ hub and each game.
# Build-time only (SPEC §11): nothing here is served. Needs Google Chrome and python3.
# Usage: sh tools/og/render.sh          everything
#        sh tools/og/render.sh posts    posts only
#        sh tools/og/render.sh play     /play/ pages only
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

ONLY=${1:-all}
shot() { # $1 = query string, $2 = output name
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --window-size=1200,630 --virtual-time-budget=4000 \
    --screenshot="$OUT/$2.png" \
    "http://localhost:$PORT/tools/og/card.html?$1" >/dev/null 2>&1
  echo "rendered media/og/$2.png"
}

if [ "$ONLY" != play ]; then
SLUGS=$(grep -o '"file": *"posts/[^"]*\.html"' "$ROOT/public/blogData.js" | sed 's/.*posts\/\(.*\)\.html"/\1/')
for slug in $SLUGS; do
  shot "slug=$slug" "$slug"
done
fi

if [ "$ONLY" != posts ]; then
  shot "page=play" "play"
  # Every game in the registry, live or not.
  for slug in $(grep -o 'slug: "[^"]*"' "$ROOT/public/js/play/games.js" | sed 's/slug: "\(.*\)"/\1/'); do
    shot "page=$slug" "play-$slug"
  done
fi
