#!/bin/bash
# Build AppImage for Traq
# This script is meant to be run after `wails build` on Linux

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$PROJECT_ROOT/build"
BIN_DIR="$BUILD_DIR/bin"
APPDIR="$BUILD_DIR/AppDir"

# Check that the binary exists
if [ ! -f "$BIN_DIR/traq" ]; then
    echo "Error: $BIN_DIR/traq not found. Run 'wails build' first."
    exit 1
fi

echo "==> Creating AppImage for Traq..."

# Clean up old AppDir
rm -rf "$APPDIR"

# Create AppDir structure
mkdir -p "$APPDIR/usr/bin"
mkdir -p "$APPDIR/usr/share/applications"
mkdir -p "$APPDIR/usr/share/icons/hicolor/256x256/apps"
mkdir -p "$APPDIR/usr/share/icons/hicolor/128x128/apps"
mkdir -p "$APPDIR/usr/share/icons/hicolor/64x64/apps"
mkdir -p "$APPDIR/usr/share/icons/hicolor/48x48/apps"
mkdir -p "$APPDIR/usr/share/icons/hicolor/32x32/apps"
mkdir -p "$APPDIR/usr/share/icons/hicolor/16x16/apps"

# Copy binary
cp "$BIN_DIR/traq" "$APPDIR/usr/bin/traq"
chmod +x "$APPDIR/usr/bin/traq"

# Copy desktop file
cp "$BUILD_DIR/linux/traq.desktop" "$APPDIR/usr/share/applications/traq.desktop"
cp "$BUILD_DIR/linux/traq.desktop" "$APPDIR/traq.desktop"

# Generate icons from appicon.orig.png (1024x1024)
ICON_SRC="$BUILD_DIR/appicon.orig.png"
if [ ! -f "$ICON_SRC" ]; then
    ICON_SRC="$BUILD_DIR/appicon.png"
fi

echo "==> Generating icons from $ICON_SRC..."

# Use ImageMagick if available, otherwise use the existing icon
if command -v convert &> /dev/null; then
    convert "$ICON_SRC" -resize 256x256 "$APPDIR/usr/share/icons/hicolor/256x256/apps/traq.png"
    convert "$ICON_SRC" -resize 128x128 "$APPDIR/usr/share/icons/hicolor/128x128/apps/traq.png"
    convert "$ICON_SRC" -resize 64x64 "$APPDIR/usr/share/icons/hicolor/64x64/apps/traq.png"
    convert "$ICON_SRC" -resize 48x48 "$APPDIR/usr/share/icons/hicolor/48x48/apps/traq.png"
    convert "$ICON_SRC" -resize 32x32 "$APPDIR/usr/share/icons/hicolor/32x32/apps/traq.png"
    convert "$ICON_SRC" -resize 16x16 "$APPDIR/usr/share/icons/hicolor/16x16/apps/traq.png"
else
    echo "Warning: ImageMagick not found, using source icon for all sizes"
    for size in 256 128 64 48 32 16; do
        cp "$ICON_SRC" "$APPDIR/usr/share/icons/hicolor/${size}x${size}/apps/traq.png"
    done
fi

# Copy main icon for AppImage
cp "$APPDIR/usr/share/icons/hicolor/256x256/apps/traq.png" "$APPDIR/traq.png"

# Download linuxdeploy if not present
LINUXDEPLOY="$BUILD_DIR/linuxdeploy-x86_64.AppImage"
if [ ! -f "$LINUXDEPLOY" ]; then
    echo "==> Downloading linuxdeploy..."
    curl -L -o "$LINUXDEPLOY" "https://github.com/linuxdeploy/linuxdeploy/releases/download/continuous/linuxdeploy-x86_64.AppImage"
    chmod +x "$LINUXDEPLOY"
fi

# Download linuxdeploy GTK plugin if not present
GTK_PLUGIN="$BUILD_DIR/linuxdeploy-plugin-gtk.sh"
if [ ! -f "$GTK_PLUGIN" ]; then
    echo "==> Downloading linuxdeploy GTK plugin..."
    curl -L -o "$GTK_PLUGIN" "https://raw.githubusercontent.com/linuxdeploy/linuxdeploy-plugin-gtk/master/linuxdeploy-plugin-gtk.sh"
    chmod +x "$GTK_PLUGIN"
fi

# Download appimagetool if not present
APPIMAGETOOL="$BUILD_DIR/appimagetool-x86_64.AppImage"
if [ ! -f "$APPIMAGETOOL" ]; then
    echo "==> Downloading appimagetool..."
    curl -L -o "$APPIMAGETOOL" "https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-x86_64.AppImage"
    chmod +x "$APPIMAGETOOL"
fi

# Create AppRun script
cat > "$APPDIR/AppRun" << 'EOF'
#!/bin/bash
SELF=$(readlink -f "$0")
HERE=${SELF%/*}
export PATH="${HERE}/usr/bin:${PATH}"
exec "${HERE}/usr/bin/traq" "$@"
EOF
chmod +x "$APPDIR/AppRun"

echo "==> Building AppImage..."

# Build the AppImage
# Note: We're not bundling GTK/WebKit dependencies since they're system libraries
# The AppImage will use system WebKit2GTK (required dependency anyway)
export ARCH=x86_64
"$APPIMAGETOOL" "$APPDIR" "$BIN_DIR/traq-x86_64.AppImage"

echo "==> AppImage created at $BIN_DIR/traq-x86_64.AppImage"

# Clean up AppDir
rm -rf "$APPDIR"

echo "==> Done!"
