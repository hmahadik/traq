# Traq - Activity Tracker v2

A desktop application that automatically captures screenshots at regular intervals, tracks window focus, and provides timeline visualization and analytics. Built with Go, Wails, and React/TypeScript.

## Features

- **Screenshot Capture**: Automatic capture at configurable intervals
- **Perceptual Duplicate Detection**: Uses dhash algorithm to skip near-identical screenshots
- **Window Context Tracking**: Records active window title and application name
- **Session-Based Tracking**: Groups activity into sessions with AFK detection
- **Timeline View**: Interactive calendar heatmap with session breakdown
- **Analytics Dashboard**: Charts showing activity patterns and app usage
- **Report Generation**: Natural language time ranges with multiple export formats
- **Native Desktop App**: Cross-platform via Wails (Linux, macOS, Windows)

## Tech Stack

- **Backend**: Go 1.21+
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **Desktop**: Wails v2
- **Database**: SQLite
- **UI Components**: Radix UI, Lucide icons, Recharts

## Prerequisites

### Linux (Ubuntu/Debian)

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
```

### X11 Tools (for window tracking)

```bash
sudo apt install xdotool
```

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd traq

# Install dependencies
make install-deps

# Build the application
make build

# Run the binary
./build/bin/traq
```

## Development

```bash
# Run in development mode with hot reload
make dev

# Run Go tests
make test

# Run frontend tests
make test-frontend

# Generate bindings after changing Go methods
make bindings
```

### URL Routing

The app uses **hash-based routing** (e.g., `/#/session/37` instead of `/session/37`). This is required for Wails compatibility - browser history routing doesn't work reliably in Wails dev mode due to IPC initialization issues with direct URL access to non-root paths.

## Build Notes

### Ubuntu 24.04+ (webkit2gtk-4.1)

Ubuntu 24.04 and newer ship with `libwebkit2gtk-4.1` instead of `4.0`. The Makefile handles this automatically:

```bash
make build      # Uses -tags webkit2_41
make dev        # Uses -tags webkit2_41
```

### Older Systems (webkit2gtk-4.0)

For systems with the older webkit2gtk-4.0:

```bash
make build-legacy
make dev-legacy
```

## Project Structure

```
traq/
├── main.go                 # Application entry point
├── app.go                  # App struct with Wails bindings
├── internal/
│   ├── config/             # Configuration management
│   ├── inference/          # AI/ML inference (planned)
│   ├── platform/           # Platform-specific code
│   ├── service/            # Business logic services
│   ├── storage/            # SQLite database layer
│   └── tracker/            # Screenshot capture daemon
├── frontend/
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom React hooks
│   │   └── lib/            # Utilities
│   └── wailsjs/            # Generated Go bindings
├── build/
│   └── bin/                # Compiled binaries
├── Makefile                # Build commands
└── wails.json              # Wails configuration
```

## Data Storage

Data is stored in `~/.local/share/traq/` (Linux):

```
~/.local/share/traq/
├── data.db                 # SQLite database
└── screenshots/
    └── YYYY/MM/DD/         # Organized by date
        └── *.webp          # Screenshot files
```

## Configuration

Configuration is stored in the database and managed through the Settings page in the app.

**Default Settings:**
- Capture interval: 30 seconds
- Image format: WebP (80% quality)
- AFK timeout: 3 minutes

## License

MIT License
