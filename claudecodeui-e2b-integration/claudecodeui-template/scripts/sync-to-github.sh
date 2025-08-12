#!/bin/bash

# Sync Claude Code project and session data to GitHub
# This script runs periodically or on-demand to backup state

set -e

# Color codes for output
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration from environment
GITHUB_TOKEN="${GITHUB_TOKEN}"
GITHUB_REPOSITORY="${GITHUB_REPOSITORY:-https://github.com/pria-cloud/workspaces}"
SESSION_ID="${SESSION_ID:-session-default}"
PROJECT_NAME="${PROJECT_NAME:-baseline-project}"
PROJECT_PATH="/home/user/${PROJECT_NAME}"

# Extract org/repo from URL
GITHUB_ORG=$(echo "$GITHUB_REPOSITORY" | sed -E 's|https://github.com/([^/]+)/.*|\1|')
GITHUB_REPO=$(echo "$GITHUB_REPOSITORY" | sed -E 's|https://github.com/[^/]+/(.*)|\1|')

echo -e "${BLUE}🔄 Syncing Claude Code project to GitHub...${NC}"

# Function to sync project files and Claude session data
sync_to_github() {
    if [ -z "$GITHUB_TOKEN" ]; then
        echo -e "${RED}❌ No GitHub token provided, cannot sync${NC}"
        return 1
    fi
    
    # Create temporary directory for sync
    TEMP_DIR=$(mktemp -d)
    cd "$TEMP_DIR"
    
    # Clone repository (or create if doesn't exist)
    git clone "https://${GITHUB_TOKEN}@github.com/${GITHUB_ORG}/${GITHUB_REPO}.git" repo 2>/dev/null || {
        echo -e "${YELLOW}⚠️  Repository not found, creating structure locally${NC}"
        mkdir -p repo
        cd repo
        git init
        git remote add origin "https://${GITHUB_TOKEN}@github.com/${GITHUB_ORG}/${GITHUB_REPO}.git"
        cd ..
    }
    
    cd repo
    
    # Create session structure
    mkdir -p "${SESSION_ID}/${PROJECT_NAME}"
    mkdir -p ".claude-storage/${SESSION_ID}"
    
    # Copy project files
    if [ -d "$PROJECT_PATH" ]; then
        echo -e "${BLUE}📁 Copying project files...${NC}"
        cp -r "$PROJECT_PATH"/* "${SESSION_ID}/${PROJECT_NAME}/" 2>/dev/null || true
        echo -e "${GREEN}✅ Project files copied${NC}"
    fi
    
    # Copy Claude session data
    if [ -d "/home/user/.claude" ]; then
        echo -e "${BLUE}🧠 Backing up Claude session data...${NC}"
        cp -r /home/user/.claude/* ".claude-storage/${SESSION_ID}/" 2>/dev/null || true
        echo -e "${GREEN}✅ Claude session data backed up${NC}"
    fi
    
    # Configure git
    git config user.email "claude@pria-cloud.com"
    git config user.name "Claude Code Bot"
    
    # Add and commit changes
    git add -A
    
    # Check if there are changes to commit
    if git diff --staged --quiet; then
        echo -e "${YELLOW}⚠️  No changes to sync${NC}"
    else
        # Create commit message
        COMMIT_MSG="Sync Claude Code session ${SESSION_ID}"
        if [ -n "$SYNC_MESSAGE" ]; then
            COMMIT_MSG="$COMMIT_MSG: $SYNC_MESSAGE"
        fi
        
        git commit -m "$COMMIT_MSG"
        
        # Push to GitHub
        echo -e "${BLUE}📤 Pushing to GitHub...${NC}"
        git push origin main 2>/dev/null || git push --set-upstream origin main
        
        echo -e "${GREEN}✅ Successfully synced to GitHub${NC}"
    fi
    
    # Clean up
    cd /
    rm -rf "$TEMP_DIR"
}

# Main execution
sync_to_github