#!/bin/bash

# Activity Tracker Uninstallation Script
# Removes systemd user service (preserves data directory)

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

DATA_DIR="$HOME/activity-tracker-data"
SYSTEMD_DIR="$HOME/.config/systemd/user"
SERVICE_FILE="$SYSTEMD_DIR/activity-tracker.service"

echo -e "${YELLOW}Uninstalling Activity Tracker...${NC}"

# Stop and disable the service if it's running
if systemctl --user is-enabled activity-tracker.service >/dev/null 2>&1; then
    echo "Stopping and disabling activity-tracker service..."
    systemctl --user stop activity-tracker.service 2>/dev/null || true
    systemctl --user disable activity-tracker.service 2>/dev/null || true
fi

# Remove the service file
if [[ -f "$SERVICE_FILE" ]]; then
    echo "Removing systemd service file..."
    rm -f "$SERVICE_FILE"
    echo "Service file removed: $SERVICE_FILE"
else
    echo "Service file not found: $SERVICE_FILE"
fi

# Reload systemd daemon to reflect changes
echo "Reloading systemd daemon..."
systemctl --user daemon-reload

echo -e "${GREEN}Uninstallation complete!${NC}"
echo
echo -e "${YELLOW}Note:${NC} Your data has been preserved at: $DATA_DIR"
echo "To completely remove all data, run:"
echo "   rm -rf $DATA_DIR"
echo
echo "To verify the service is removed, run:"
echo "   systemctl --user status activity-tracker"