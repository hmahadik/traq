# Troubleshooting

## Linux Issues

### "Window tracking not working"

**Symptoms**: Screenshots capture but window titles are empty or "Unknown".

**Solution**: Install xdotool:

```bash
sudo apt install xdotool  # Debian/Ubuntu
sudo dnf install xdotool  # Fedora
sudo pacman -S xdotool    # Arch
```

Note: Traq requires X11. Wayland is not fully supported.

### "App fails to start" or "Webkit error"

**Symptoms**: App crashes on launch with GTK/WebKit errors.

**Solution**: Install the correct WebKit version:

```bash
# Ubuntu 24.04+ / Debian 13+
sudo apt install libgtk-3-dev libwebkit2gtk-4.1-dev

# Ubuntu 22.04 / Debian 11-12
sudo apt install libgtk-3-dev libwebkit2gtk-4.0-dev
```

If you built from source, rebuild with the correct tag:

```bash
# Ubuntu 24.04+
make build

# Older systems
make build-legacy
```

### "Permission denied" for screenshots

**Symptoms**: Screenshots fail or are blank.

**Possible causes**:

1. Display server permissions
2. Sandboxed environment (Flatpak/Snap)

Try running from terminal to see error messages:

```bash
./traq 2>&1 | grep -i error
```

## macOS Issues

### "Screen recording permission required"

**Solution**: Grant screen recording permission:

1. Open System Preferences > Security & Privacy
2. Go to Privacy tab
3. Select Screen Recording
4. Add Traq to the allowed list
5. Restart Traq

### "Accessibility permission required"

For window tracking, grant accessibility access:

1. Open System Preferences > Security & Privacy
2. Go to Privacy tab
3. Select Accessibility
4. Add Traq to the allowed list

## Windows Issues

### "Screenshots are black"

**Possible causes**:

- Hardware acceleration conflicts
- Display driver issues

**Try**:

1. Update graphics drivers
2. Disable hardware acceleration in Settings (if available)
3. Run as administrator

## Database Issues

### "Database locked" errors

**Cause**: Another instance of Traq may be running.

**Solution**: Close all Traq instances and restart:

```bash
# Linux/macOS
pkill -f traq
./traq
```

### "Database corrupted"

**Solution**: Try recovery:

```bash
cd ~/.local/share/traq
cp data.db data.db.backup
sqlite3 data.db "PRAGMA integrity_check;"
```

If corrupt, you may need to restore from backup or start fresh.

## Performance Issues

### "App is slow / high memory usage"

**Possible causes**:

- Too many screenshots loaded
- Large database

**Solutions**:

1. Reduce capture frequency in Settings
2. Clear old data you don't need
3. Run database optimization (Settings > Storage > Optimize)

### "High CPU usage during capture"

**Cause**: Screenshot compression is CPU-intensive.

**Solutions**:

1. Increase capture interval (e.g., 60s instead of 30s)
2. Use lower quality preset
3. Increase duplicate threshold to skip more similar frames

## Getting Help

If you're still stuck:

1. Check the [GitHub Issues](https://github.com/hmahadik/activity-tracker/issues)
2. Search for similar problems
3. Open a new issue with:
   - OS and version
   - Traq version
   - Error messages
   - Steps to reproduce
