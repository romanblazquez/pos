#!/usr/bin/env bash
# Retail OS — icon build pipeline.
#
# Usage:
#   1. Drop your master PNG (1024×1024, transparent bg) at:
#        config/assets/icons/source/shell-master.png
#   2. Run: bash tools/scripts/build-icons.sh
#
# Outputs:
#   config/assets/icons/build/icon.iconset/  — all macOS iconset sizes
#   config/assets/icons/build/icon.png       — 512×512 main PNG
#   config/assets/icons/build/mac.icns       — compiled macOS bundle
#   config/assets/icons/shell-dock.png       — 512×512 dock icon
#   config/assets/icons/shell-window.png     — 32×32 window titlebar icon
#
# Requirements: macOS with Xcode CLI tools (sips + iconutil).
# On Linux: install imagemagick and replace sips with `convert`.

set -euo pipefail

SRC="config/assets/icons/source/shell-master.png"
ICONSET="config/assets/icons/build/icon.iconset"
BUILD="config/assets/icons/build"

if [ ! -f "$SRC" ]; then
  echo "❌  Source icon not found: $SRC"
  echo "    Drop a 1024×1024 PNG there and re-run."
  exit 1
fi

echo "📐  Generating iconset from $SRC…"
mkdir -p "$ICONSET"

sizes=(16 32 128 256 512)
for size in "${sizes[@]}"; do
  sips -z $size $size "$SRC" --out "$ICONSET/icon_${size}x${size}.png"          > /dev/null
  double=$((size * 2))
  sips -z $double $double "$SRC" --out "$ICONSET/icon_${size}x${size}@2x.png"   > /dev/null
  echo "  ✔ ${size}×${size} + @2x"
done

echo "🖼   Building mac.icns…"
iconutil -c icns "$ICONSET" -o "$BUILD/mac.icns"

echo "📋  Copying convenience assets…"
sips -z 512 512 "$SRC" --out "$BUILD/icon.png"                                   > /dev/null
cp "$BUILD/icon.png"                    "config/assets/icons/shell-dock.png"
sips -z 32 32  "$SRC" --out            "config/assets/icons/shell-window.png"   > /dev/null

echo "✅  Icons built:"
ls -lh config/assets/icons/shell-*.png "$BUILD/mac.icns"
