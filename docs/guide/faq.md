# FAQ

## General

### Is my data sent anywhere?

No. All data stays on your local machine. Traq doesn't connect to external servers unless you explicitly configure cloud AI providers.

### Does Traq work offline?

Yes. Core features work completely offline. AI summaries require either a local Ollama server or cloud API configuration.

### How much storage does Traq use?

Depends on your settings. With default settings (30s interval, medium quality), expect roughly 50MB per 8-hour workday.

### Can I use Traq on multiple monitors?

Currently, Traq captures the primary display. Multi-monitor support is planned.

## Capture

### Why are some screenshots being skipped?

Traq uses perceptual hashing to skip near-identical screenshots. If your screen hasn't changed meaningfully, it won't save a duplicate. You can adjust sensitivity in Settings.

### Can I manually trigger a screenshot?

Yes. Use the "Capture Now" button in the app to take an immediate screenshot.

### How do I pause capture temporarily?

Go to Settings and toggle capture off. Or close the app entirely.

## Sessions

### What triggers a new session?

A new session starts when:

- You return after being AFK for longer than the timeout
- The app starts fresh
- You manually end a session

### Why do I have many short sessions?

Your AFK timeout might be too short. Try increasing it in Settings if you frequently step away briefly.

### Can I merge or split sessions?

Not currently. This is a planned feature.

## AI Summaries

### How do I enable AI summaries?

Go to Settings > AI Configuration and choose:

- **Ollama**: Requires [Ollama](https://ollama.ai) running locally
- **Cloud API**: Requires an API key from Anthropic or OpenAI

### Why are summaries slow?

Local AI (Ollama) depends on your hardware. Cloud APIs are faster but require internet. Consider using a smaller model for faster results.

### Can I regenerate a summary?

Yes. In the session detail view, click "Regenerate Summary".

## Troubleshooting

### Window titles aren't being captured (Linux)

Make sure `xdotool` is installed:

```bash
sudo apt install xdotool
```

### App won't start (Linux)

Check that WebKit dependencies are installed:

```bash
# Ubuntu 24.04+
sudo apt install libwebkit2gtk-4.1-dev

# Older Ubuntu
sudo apt install libwebkit2gtk-4.0-dev
```

### Screenshots are blank or corrupted

This can happen with certain display configurations. Try:

1. Restarting the app
2. Checking display permissions
3. Updating graphics drivers
