#!/bin/bash

# Activity Tracker Installation Script
# Creates systemd user service and data directory structure

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get absolute path to project directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DATA_DIR="$HOME/activity-tracker-data"
SYSTEMD_DIR="$HOME/.config/systemd/user"
SERVICE_FILE="$SYSTEMD_DIR/activity-tracker.service"

echo -e "${GREEN}Installing Activity Tracker...${NC}"

# Create systemd user directory if it doesn't exist
echo "Creating systemd user directory..."
mkdir -p "$SYSTEMD_DIR"

# Create data directory structure
echo "Creating data directory structure..."
mkdir -p "$DATA_DIR"/{screenshots,logs}

# Create systemd service file
echo "Creating systemd service file..."
cat > "$SERVICE_FILE" << EOF
[Unit]
Description=Activity Tracker Screenshot Daemon
After=graphical-session.target

[Service]
Type=simple
ExecStart=$PROJECT_DIR/venv/bin/python -m tracker.daemon
WorkingDirectory=$PROJECT_DIR
Environment=PYTHONPATH=$PROJECT_DIR
Environment=DISPLAY=:0
Environment=XDG_RUNTIME_DIR=%i
Restart=always
RestartSec=10
StandardOutput=append:$DATA_DIR/logs/daemon.log
StandardError=append:$DATA_DIR/logs/daemon.log

[Install]
WantedBy=default.target
EOF

echo -e "${GREEN}Installation complete!${NC}"
echo
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Enable the service to start automatically on login:"
echo "   systemctl --user enable activity-tracker"
echo
echo "2. Start the service now:"
echo "   systemctl --user start activity-tracker"
echo
echo "3. Check service status:"
echo "   systemctl --user status activity-tracker"
echo
echo "4. View logs:"
echo "   journalctl --user -u activity-tracker -f"
echo "   or: tail -f $DATA_DIR/logs/daemon.log"
echo
echo -e "${YELLOW}Data will be stored in:${NC} $DATA_DIR"
echo -e "${YELLOW}Service file created at:${NC} $SERVICE_FILE"