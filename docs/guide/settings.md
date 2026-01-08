# Settings

Configure Traq's behavior through the Settings page.

## Capture Settings

### Capture Interval

How often screenshots are taken. Range: 10-300 seconds.

- **Lower values** (10-30s): More detail, more storage
- **Higher values** (60-120s): Less storage, may miss short tasks
- **Default**: 30 seconds

### Screenshot Quality

Choose a preset or customize:

| Preset | Quality | Typical Size |
|--------|---------|--------------|
| Low | 60% | ~30KB |
| Medium | 80% | ~50KB |
| High | 95% | ~100KB |

Images are saved in WebP format for efficient storage.

### Duplicate Detection

Threshold for skipping similar screenshots (0-100):

- **Lower values**: More screenshots saved (less aggressive filtering)
- **Higher values**: More duplicates skipped (more aggressive)
- **Default**: 10

This uses perceptual hashing to detect when the screen hasn't meaningfully changed.

## Session Settings

### AFK Timeout

How long before you're considered away from keyboard.

- **Default**: 3 minutes
- When AFK is detected, the current session ends
- A new session starts when you return

### Minimum Session Duration

Sessions shorter than this are discarded.

- **Default**: 1 minute
- Prevents cluttering your timeline with very short sessions

## AI Configuration

Traq can generate natural language summaries of your sessions using AI.

### AI Provider Options

- **Disabled** - No AI summaries
- **Ollama** - Connect to a local Ollama server
- **Cloud API** - Use Anthropic or OpenAI APIs

### Custom API Endpoints

For self-hosted or alternative API endpoints:

1. Enable "Custom Endpoint"
2. Enter your endpoint URL
3. Add your API key

### Model Selection

When using Ollama, select which model to use for summaries. Smaller models are faster but may be less accurate.

## Storage

### Data Location

View where Traq stores data:

```
~/.local/share/traq/
├── data.db          # SQLite database
└── screenshots/     # Image files
```

### Storage Usage

See current storage consumption for:

- Database size
- Screenshots folder size
- Total disk usage

## Theme

- **System** - Follow OS preference
- **Light** - Light mode
- **Dark** - Dark mode
