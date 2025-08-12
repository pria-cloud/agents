#!/bin/bash

# Watch for changes in Claude Code projects and sync to GitHub
# Uses inotify to detect file changes

set -e

# Color codes for output
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

PROJECT_PATH="/home/user/${PROJECT_NAME:-baseline-project}"
CLAUDE_PATH="/home/user/.claude"
SYNC_SCRIPT="/home/user/scripts/sync-to-github.sh"

echo -e "${BLUE}👁️  Starting file watcher for GitHub sync...${NC}"

# Function to handle sync with debouncing
last_sync=0
sync_with_debounce() {
    current_time=$(date +%s)
    time_since_last_sync=$((current_time - last_sync))
    
    # Debounce: Only sync if 30 seconds have passed since last sync
    if [ $time_since_last_sync -gt 30 ]; then
        echo -e "${BLUE}🔄 Changes detected, syncing to GitHub...${NC}"
        export SYNC_MESSAGE="Auto-sync after file changes"
        bash "$SYNC_SCRIPT"
        last_sync=$(date +%s)
    else
        echo -e "${YELLOW}⏳ Sync debounced, waiting...${NC}"
    fi
}

# Check if inotify-tools is installed
if ! command -v inotifywait &> /dev/null; then
    echo -e "${RED}❌ inotify-tools not installed${NC}"
    exit 1
fi

# Watch both project directory and Claude session directory
echo -e "${GREEN}✅ Watching for changes in:${NC}"
echo "   - $PROJECT_PATH"
echo "   - $CLAUDE_PATH"

# Use inotifywait to monitor file changes
inotifywait -m -r -e modify,create,delete,move \
    --exclude '\.git|node_modules|\.next|build|dist' \
    "$PROJECT_PATH" "$CLAUDE_PATH" 2>/dev/null |
while read path action file; do
    echo -e "${BLUE}📝 Change detected: $action $file${NC}"
    sync_with_debounce
done &

WATCHER_PID=$!
echo -e "${GREEN}✅ File watcher started with PID: $WATCHER_PID${NC}"

# Keep the script running
wait $WATCHER_PID