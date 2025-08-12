#!/bin/bash

# Instance startup script - runs when a new sandbox instance is created
# This is different from the template build startup

set -e

# Color codes for output
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting new sandbox instance...${NC}"

# Get environment variables from E2B metadata
SESSION_ID="${SESSION_ID:-session-default}"
PROJECT_NAME="${PROJECT_NAME:-baseline-project}"
GITHUB_TOKEN="${GITHUB_TOKEN}"
GITHUB_REPOSITORY="${GITHUB_REPOSITORY:-https://github.com/pria-cloud/workspaces}"

echo -e "${BLUE}📦 Instance Configuration:${NC}"
echo "   Session ID: $SESSION_ID"
echo "   Project: $PROJECT_NAME"

# Initialize Claude Code project with GitHub sync
echo -e "${BLUE}🧠 Initializing Claude Code project for this instance...${NC}"

# Run project initialization script with environment
su - user -c "
    export GITHUB_TOKEN='$GITHUB_TOKEN'
    export GITHUB_REPOSITORY='$GITHUB_REPOSITORY'
    export SESSION_ID='$SESSION_ID'
    export PROJECT_NAME='$PROJECT_NAME'
    export PATH='/home/user/.npm-global/bin:\$PATH'
    cd /home/user && /home/user/scripts/init-project.sh
" || {
    echo -e "${YELLOW}⚠️  Project initialization failed, continuing anyway${NC}"
}

# Start GitHub sync watcher if GitHub token is available
if [ -n "$GITHUB_TOKEN" ]; then
    echo -e "${BLUE}🔄 Starting GitHub sync watcher...${NC}"
    su - user -c "
        export GITHUB_TOKEN='$GITHUB_TOKEN'
        export GITHUB_REPOSITORY='$GITHUB_REPOSITORY'
        export SESSION_ID='$SESSION_ID'
        export PROJECT_NAME='$PROJECT_NAME'
        /home/user/scripts/watch-and-sync.sh > /tmp/github-sync.log 2>&1 &
    "
    echo -e "${GREEN}✅ GitHub sync watcher started${NC}"
fi

# Wait a moment for project registration to complete
sleep 3

# Check if claudecodeui can see the project
echo -e "${BLUE}🔍 Verifying project registration...${NC}"
if [ -d "/home/user/.claude/projects" ]; then
    echo -e "${GREEN}✅ Claude projects directory exists${NC}"
    ls -la /home/user/.claude/projects/ || echo "Projects directory is empty"
else
    echo -e "${YELLOW}⚠️  Claude projects directory not found${NC}"
fi

echo -e "${GREEN}✅ Instance startup complete!${NC}"