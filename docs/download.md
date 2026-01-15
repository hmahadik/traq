# Download

## Pre-built Binaries

Download the latest release for your platform:

| Platform | Download |
|----------|----------|
| Linux (x64) | [traq-linux-amd64.AppImage](https://github.com/hmahadik/activity-tracker/releases/latest/download/traq-linux-amd64.AppImage) |
| macOS (Universal) | [traq-macos-universal.zip](https://github.com/hmahadik/activity-tracker/releases/latest/download/traq-macos-universal.zip) |
| Windows (x64) | [traq-windows-amd64-installer.exe](https://github.com/hmahadik/activity-tracker/releases/latest/download/traq-windows-amd64-installer.exe) |

### Linux

```bash
# Download the AppImage
curl -L -o traq https://github.com/hmahadik/activity-tracker/releases/latest/download/traq-linux-amd64.AppImage
chmod +x traq

# Run
./traq
```

### macOS

1. Download and extract the zip file
2. Move `traq.app` to your Applications folder
3. Right-click and select "Open" (first launch only, to bypass Gatekeeper)

### Windows

1. Download the `.exe` file
2. Double-click to run

## Build from Source

### Prerequisites

**Linux (Ubuntu/Debian)**

```bash
# Install Go 1.21+
sudo apt install golang-go

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install nodejs

# Install Wails dependencies
sudo apt install libgtk-3-dev libwebkit2gtk-4.1-dev

# Install Wails CLI
go install github.com/wailsapp/wails/v2/cmd/wails@latest

# For window tracking
sudo apt install xdotool
```

### Build

```bash
# Clone the repository
git clone https://github.com/hmahadik/activity-tracker.git
cd activity-tracker

# Install dependencies
make install-deps

# Build the application
make build

# Run the binary
./build/bin/traq
```

::: tip Ubuntu 24.04+
Ubuntu 24.04 and newer use `webkit2gtk-4.1`. The Makefile handles this automatically with `make build`.

For older systems with `webkit2gtk-4.0`, use `make build-legacy`.
:::
