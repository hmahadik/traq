#!/bin/bash
# Traq v2 - Initialization and Development Server Startup Script
# This script installs dependencies and starts the Wails development server

set -e  # Exit on error

echo "=== Traq v2 Initialization ==="
echo ""

# Check for required tools
echo "Checking for required tools..."

if ! command -v go &> /dev/null; then
    echo "ERROR: Go is not installed. Please install Go 1.22+ first."
    echo "Visit: https://golang.org/doc/install"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed. Please install Node.js 18+ first."
    echo "Visit: https://nodejs.org/"
    exit 1
fi

if ! command -v wails &> /dev/null; then
    echo "ERROR: Wails is not installed. Installing Wails CLI..."
    go install github.com/wailsapp/wails/v2/cmd/wails@latest

    # Add GOPATH/bin to PATH if not already there
    if [[ ":$PATH:" != *":$HOME/go/bin:"* ]]; then
        echo "Adding $HOME/go/bin to PATH..."
        export PATH="$PATH:$HOME/go/bin"
        echo 'export PATH="$PATH:$HOME/go/bin"' >> ~/.bashrc
    fi
fi

echo "✓ All required tools are installed"
echo ""

# Install dependencies
echo "Installing dependencies..."

# Install Go dependencies
echo "- Installing Go modules..."
go mod download

# Install frontend dependencies
echo "- Installing frontend dependencies (this may take a few minutes)..."
cd frontend
npm install
cd ..

echo "✓ Dependencies installed"
echo ""

# Generate Wails bindings
echo "Generating Wails bindings..."
wails generate module || true  # Don't fail if bindings already exist
echo "✓ Bindings generated"
echo ""

# Kill existing server instance if running
echo "Checking for existing server instance..."
if pgrep -f "wails dev" > /dev/null; then
    echo "- Killing existing wails dev process..."
    pkill -f "wails dev" || true
    sleep 1  # Give it time to clean up
    echo "✓ Existing server stopped"
else
    echo "✓ No existing server running"
fi
echo ""

# Start development server
echo "=== Starting Wails Development Server ==="
echo ""
echo "The app will open in a new window with hot reload enabled."
echo "Backend changes will require restart, frontend changes will hot reload."
echo ""
echo "Press Ctrl+C to stop the server."
echo ""

# Use webkit2_41 tag for Ubuntu 24.04+ (libwebkit2gtk-4.1)
# For older systems with webkit2gtk-4.0, use: wails dev
wails dev -tags webkit2_41
