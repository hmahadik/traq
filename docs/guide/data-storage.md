# Data Storage

All Traq data is stored locally on your machine. Nothing is sent to external servers.

## Storage Location

### Linux

```
~/.local/share/traq/
```

### macOS

```
~/Library/Application Support/traq/
```

### Windows

```
%APPDATA%\traq\
```

## Directory Structure

```
traq/
├── data.db                 # SQLite database
└── screenshots/
    └── YYYY/
        └── MM/
            └── DD/
                ├── 001234.webp
                ├── 001265.webp
                └── ...
```

## Database

The SQLite database (`data.db`) contains:

- **Sessions** - Start/end times, metadata
- **Screenshots** - File paths, timestamps, hashes
- **Window Events** - Application names, window titles
- **Summaries** - AI-generated session descriptions
- **Settings** - Your configuration preferences

## Screenshots

Screenshots are organized by date (YYYY/MM/DD) and saved as WebP files. Each filename is the Unix timestamp of capture.

### Storage Estimates

| Captures/Hour | Quality | Daily Storage |
|---------------|---------|---------------|
| 120 (30s interval) | Medium | ~50 MB |
| 60 (60s interval) | Medium | ~25 MB |
| 30 (2min interval) | Medium | ~12 MB |

## Backup

To back up your Traq data, copy the entire data directory:

```bash
# Linux
cp -r ~/.local/share/traq ~/traq-backup

# Or just the database
cp ~/.local/share/traq/data.db ~/traq-backup.db
```

## Privacy

- All data stays on your machine
- No cloud sync by default
- No telemetry or analytics
- You own your data completely

To delete all data, simply remove the data directory.
