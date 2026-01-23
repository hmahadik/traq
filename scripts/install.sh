#!/bin/bash
# Traq Installation Script
# Installs Traq + Ollama (if needed) + pulls recommended AI model

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

info() { echo -e "${GREEN}==>${NC} $1"; }
warn() { echo -e "${YELLOW}==>${NC} $1"; }
error() { echo -e "${RED}==>${NC} $1"; exit 1; }

# Default settings
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/share/traq}"
BIN_DIR="${BIN_DIR:-$HOME/.local/bin}"
DEFAULT_MODEL="qwen2.5:7b"
SKIP_OLLAMA="${SKIP_OLLAMA:-false}"
SKIP_MODEL="${SKIP_MODEL:-false}"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-ollama) SKIP_OLLAMA=true; shift ;;
        --skip-model) SKIP_MODEL=true; shift ;;
        --model) DEFAULT_MODEL="$2"; shift 2 ;;
        --help)
            echo "Traq Installation Script"
            echo ""
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --skip-ollama    Don't install Ollama (use if already installed)"
            echo "  --skip-model     Don't pull the default AI model"
            echo "  --model NAME     Use a different model (default: qwen2.5:7b)"
            echo "  --help           Show this help message"
            exit 0
            ;;
        *) error "Unknown option: $1" ;;
    esac
done

echo ""
echo "  ████████╗██████╗  █████╗  ██████╗ "
echo "  ╚══██╔══╝██╔══██╗██╔══██╗██╔═══██╗"
echo "     ██║   ██████╔╝███████║██║   ██║"
echo "     ██║   ██╔══██╗██╔══██║██║▄▄ ██║"
echo "     ██║   ██║  ██║██║  ██║╚██████╔╝"
echo "     ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝ ╚══▀▀═╝ "
echo ""
echo "  Privacy-first activity tracker"
echo ""

# Step 1: Create directories
info "Creating directories..."
mkdir -p "$INSTALL_DIR"
mkdir -p "$BIN_DIR"

# Step 2: Find and install the AppImage
APPIMAGE=""
if [ -f "$PROJECT_ROOT/build/bin/traq-x86_64.AppImage" ]; then
    APPIMAGE="$PROJECT_ROOT/build/bin/traq-x86_64.AppImage"
elif [ -f "$SCRIPT_DIR/traq-x86_64.AppImage" ]; then
    APPIMAGE="$SCRIPT_DIR/traq-x86_64.AppImage"
elif [ -f "./traq-x86_64.AppImage" ]; then
    APPIMAGE="./traq-x86_64.AppImage"
fi

if [ -n "$APPIMAGE" ]; then
    info "Installing Traq AppImage..."
    cp "$APPIMAGE" "$INSTALL_DIR/traq.AppImage"
    chmod +x "$INSTALL_DIR/traq.AppImage"

    # Create symlink in bin directory
    ln -sf "$INSTALL_DIR/traq.AppImage" "$BIN_DIR/traq"
    info "Traq installed to $INSTALL_DIR/traq.AppImage"
else
    warn "No AppImage found. Skipping Traq binary installation."
    warn "Run 'make build && ./scripts/build-appimage.sh' first, or download the AppImage."
fi

# Step 3: Check/Install Ollama
if [ "$SKIP_OLLAMA" = "false" ]; then
    if command -v ollama &> /dev/null; then
        info "Ollama already installed: $(which ollama)"
    else
        info "Installing Ollama..."
        curl -fsSL https://ollama.com/install.sh | sh

        # Wait for Ollama service to start
        info "Waiting for Ollama service to start..."
        sleep 3

        # Verify installation
        if command -v ollama &> /dev/null; then
            info "Ollama installed successfully!"
        else
            error "Ollama installation failed. Please install manually: https://ollama.com"
        fi
    fi

    # Ensure Ollama service is running
    if systemctl is-active --quiet ollama 2>/dev/null; then
        info "Ollama service is running"
    else
        info "Starting Ollama service..."
        sudo systemctl start ollama 2>/dev/null || ollama serve &>/dev/null &
        sleep 2
    fi
else
    info "Skipping Ollama installation (--skip-ollama)"
fi

# Step 4: Pull default AI model
if [ "$SKIP_MODEL" = "false" ] && command -v ollama &> /dev/null; then
    if ollama list 2>/dev/null | grep -q "$DEFAULT_MODEL"; then
        info "Model $DEFAULT_MODEL already downloaded"
    else
        info "Pulling AI model: $DEFAULT_MODEL (this may take a few minutes)..."
        ollama pull "$DEFAULT_MODEL"
        info "Model $DEFAULT_MODEL ready!"
    fi
else
    if [ "$SKIP_MODEL" = "true" ]; then
        info "Skipping model download (--skip-model)"
    fi
fi

# Step 5: Create desktop entry
DESKTOP_FILE="$HOME/.local/share/applications/traq.desktop"
if [ -f "$INSTALL_DIR/traq.AppImage" ]; then
    info "Creating desktop entry..."
    mkdir -p "$(dirname "$DESKTOP_FILE")"
    cat > "$DESKTOP_FILE" << EOF
[Desktop Entry]
Name=Traq
Comment=Privacy-first activity tracker
Exec=$INSTALL_DIR/traq.AppImage
Icon=traq
Type=Application
Categories=Utility;Office;
StartupNotify=true
EOF

    # Update desktop database
    update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
fi

# Step 6: Create autostart entry (optional)
read -p "Start Traq automatically on login? [Y/n] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
    AUTOSTART_DIR="$HOME/.config/autostart"
    mkdir -p "$AUTOSTART_DIR"
    cat > "$AUTOSTART_DIR/traq.desktop" << EOF
[Desktop Entry]
Name=Traq
Comment=Privacy-first activity tracker
Exec=$INSTALL_DIR/traq.AppImage --background
Icon=traq
Type=Application
X-GNOME-Autostart-enabled=true
StartupNotify=false
EOF
    info "Autostart enabled"
fi

# Done!
echo ""
info "Installation complete!"
echo ""
echo "  Traq: $INSTALL_DIR/traq.AppImage"
if command -v ollama &> /dev/null; then
    echo "  Ollama: $(which ollama)"
    echo "  AI Model: $DEFAULT_MODEL"
fi
echo ""
echo "  Run 'traq' to start, or find it in your application menu."
echo ""
