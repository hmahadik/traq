# Traq - Activity Tracker v2

## Purpose

### Vaguely

> ... automatically tracking computer usage for daily standups, weekly accomplishments calls, random audits, being able to go back in time and see how I got something working because I forgot to document everything, etc. - point is being able to capture as much as reasonably possible and having an easy way to find and use relevant parts of it helps in many ways (some you don't even know until you start using it and accumulate a decent amount of data, like seeing trends, etc.)

### Core Use Cases

#### 1. Daily Standups - "What did I do yesterday?"

Screenshots alone tell you: *"I was in VS Code and Chrome."*

With Traq's extended data sources:
- "Committed 3 fixes to auth-service (PR #142)"
- "Ran 12 test commands, 4 deployments"
- "Modified 8 files in `/src/auth/`"
- "Researched OAuth on Stack Overflow, reviewed 3 GitHub PRs"

**Much more standup-ready.**

#### 2. Weekly Accomplishments - "What did I ship this week?"

Screenshots: *"Here are 500 images of me typing."*

With data sources:
- "47 commits across 3 repos, +2,100/-800 lines"
- "Deployed 6 times to staging"
- "Touched 120 files, mostly `.ts` and `.go`"
- "Top domains: GitHub (45 visits), Jira (23), AWS Console (12)"

**Concrete metrics, not vibes.**

#### 3. Random Audits - "Prove you were working"

Screenshots: *"Here's me looking at code."*

With data sources:
- Git commits with timestamps = undeniable proof of contributions
- Shell history shows actual work (builds, tests, deploys)
- File modifications = deliverables being produced
- Browser history shows research, code reviews, documentation

**Evidence, not just presence.**

#### 4. Going Back in Time - "How did I fix that bug last month?"

This is where it gets powerful. Find the moment by combining:
- **Git**: The commit that fixed it
- **Shell**: Commands run around that time (`npm test`, `docker restart`)
- **Files**: Which files were modified together
- **Screenshots**: Visual context of the debugging session

**The full picture, reconstructed.**

#### 5. Capturing Data for Trends - "Where does my time actually go?"

Over weeks and months, patterns emerge:
- Most productive hours (commit frequency by time of day)
- Context-switching patterns (app transitions per hour)
- Research vs. coding ratios (browser vs. editor time)
- Project focus distribution (which repos get attention)

**Insights you didn't know you needed.**

---

### The Vision: Unified Timeline

The goal is a single timeline where everything correlates:

```
9:15 AM  [Git]        Committed "fix auth bug" to main
9:20 AM  [Shell]      npm test (passed)
9:25 AM  [Files]      Modified auth.ts, config.json
9:30 AM  [Screenshot] VS Code - auth.ts line 142
9:35 AM  [Browser]    Stack Overflow: "JWT refresh token best practices"
9:40 AM  [Git]        Committed "add token refresh logic"
```

Screenshots capture what was on screen. Data sources capture what was actually happening.

---

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

---

## Implementation Status

See [TRAQ_SPEC.md](./TRAQ_SPEC.md) for the full 250-feature roadmap.

### Core Features (P0) - Mostly Complete
- [x] Screenshot capture with configurable intervals
- [x] Perceptual duplicate detection (dHash)
- [x] Window focus tracking (app name + title)
- [x] Session-based organization with AFK detection
- [x] SQLite database with migrations
- [x] Timeline view with calendar heatmap
- [x] Dark/light theme support
- [x] System tray with background operation
- [x] Linux support (X11)
- [ ] Bundled AI model (using external APIs for now)
- [ ] macOS support (partial)
- [ ] Windows support (partial)

### Essential Features (P1) - In Progress
- [x] Extended data sources (shell, git, files, browser)
- [x] Advanced analytics (hourly charts, heatmaps, categories)
- [x] Report generation with natural language dates
- [x] Session detail view with screenshot gallery
- [x] Keyboard navigation (j/k, arrows)
- [ ] Full filtering by tags/time/app

### Recent Additions
- **Issue Reporting** (Jan 2026) - In-app bug reporting with Slack webhook support
- **App Name Mapping** (Jan 2026) - Friendly display names for 150+ apps
- **Timeline v3 Grid** (Jan 2026) - Hour-based grid with app columns and AI summaries
- **Categorization Rules** (Jan 2026) - Classify apps as Focus/Meetings/Comms/Other

### Roadmap Highlights
- [ ] Global search across all history
- [ ] Bundled local AI model (offline inference)
- [ ] Screenshot OCR search
- [ ] Custom categories and tags
- [ ] Data retention policies

---

## Documentation

- [TRAQ_SPEC.md](./TRAQ_SPEC.md) - Full product specification
- [UI_BACKLOG.md](./UI_BACKLOG.md) - Current UI/UX issues and priorities
- [CLAUDE.md](./CLAUDE.md) - Development context and architecture
- [docs/guide/](./docs/guide/) - User guide

## License

MIT License
