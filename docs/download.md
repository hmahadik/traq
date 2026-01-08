# Download

## Pre-built Binaries

Coming soon. For now, build from source.

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
