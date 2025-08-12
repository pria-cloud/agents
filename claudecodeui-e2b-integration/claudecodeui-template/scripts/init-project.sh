#!/bin/bash

# Initialize Claude Code project with GitHub sync
# This script runs during E2B sandbox startup

set -e

# Color codes for output
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Initializing Claude Code project...${NC}"

# Configuration from environment
GITHUB_TOKEN="${GITHUB_TOKEN}"
GITHUB_REPOSITORY="${GITHUB_REPOSITORY:-https://github.com/pria-cloud/workspaces}"
SESSION_ID="${SESSION_ID:-session-default}"
PROJECT_NAME="${PROJECT_NAME:-baseline-project}"
PROJECT_PATH="/home/user/${PROJECT_NAME}"

# Extract org/repo from URL
GITHUB_ORG=$(echo "$GITHUB_REPOSITORY" | sed -E 's|https://github.com/([^/]+)/.*|\1|')
GITHUB_REPO=$(echo "$GITHUB_REPOSITORY" | sed -E 's|https://github.com/[^/]+/(.*)|\1|')

echo -e "${BLUE}📦 Configuration:${NC}"
echo "   Session ID: $SESSION_ID"
echo "   Project: $PROJECT_NAME"
echo "   GitHub: $GITHUB_ORG/$GITHUB_REPO"

# Function to check if project exists in GitHub
check_github_project() {
    local project_path="${SESSION_ID}/${PROJECT_NAME}"
    echo -e "${BLUE}🔍 Checking GitHub for existing project...${NC}"
    
    # Use GitHub API to check if path exists
    response=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Authorization: token $GITHUB_TOKEN" \
        -H "Accept: application/vnd.github.v3+json" \
        "https://api.github.com/repos/$GITHUB_ORG/$GITHUB_REPO/contents/$project_path")
    
    if [ "$response" = "200" ]; then
        echo -e "${GREEN}✅ Found existing project in GitHub${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠️  No existing project found in GitHub${NC}"
        return 1
    fi
}

# Function to restore project from GitHub
restore_from_github() {
    echo -e "${BLUE}📥 Restoring project from GitHub...${NC}"
    
    # Clone the specific project directory using sparse checkout
    cd /home/user
    git clone --no-checkout --depth 1 \
        "https://${GITHUB_TOKEN}@github.com/${GITHUB_ORG}/${GITHUB_REPO}.git" temp-clone
    
    cd temp-clone
    git sparse-checkout init --cone
    git sparse-checkout set "${SESSION_ID}/${PROJECT_NAME}" ".claude-storage/${SESSION_ID}"
    git checkout main
    
    # Move project files to correct location
    if [ -d "${SESSION_ID}/${PROJECT_NAME}" ]; then
        mv "${SESSION_ID}/${PROJECT_NAME}" "/home/user/${PROJECT_NAME}"
        echo -e "${GREEN}✅ Project files restored${NC}"
    fi
    
    # Restore .claude directory if it exists
    if [ -d ".claude-storage/${SESSION_ID}" ]; then
        echo -e "${BLUE}📂 Restoring Claude session data...${NC}"
        mkdir -p /home/user/.claude
        cp -r ".claude-storage/${SESSION_ID}/"* /home/user/.claude/
        echo -e "${GREEN}✅ Claude session data restored${NC}"
    fi
    
    # Clean up
    cd /home/user
    rm -rf temp-clone
}

# Function to initialize new project with Claude CLI
init_new_project() {
    echo -e "${BLUE}🆕 Initializing new project with Claude Code CLI...${NC}"
    
    # Ensure baseline project exists
    if [ ! -d "$PROJECT_PATH" ]; then
        echo -e "${RED}❌ Error: Baseline project not found at $PROJECT_PATH${NC}"
        exit 1
    fi
    
    cd "$PROJECT_PATH"
    
    # Initialize Claude Code in the project directory
    # This creates the proper ~/.claude/projects/ entry
    echo -e "${BLUE}🧠 Running Claude Code CLI to register project...${NC}"
    
    # Use timeout to prevent hanging
    # Create a single clean initialization session
    timeout 30s bash -c "echo 'Initialize PRIA baseline project. This is a Next.js application ready for development.' | claude -p --dangerously-skip-permissions" || {
        echo -e "${YELLOW}⚠️  Claude CLI initialization timed out (this is normal for first run)${NC}"
    }
    
    # Verify project was registered
    if [ -d "/home/user/.claude/projects" ]; then
        echo -e "${GREEN}✅ Project registered with Claude Code${NC}"
        
        # List registered projects for debugging
        echo -e "${BLUE}📋 Registered projects:${NC}"
        ls -la /home/user/.claude/projects/ || echo "No projects found"
    else
        echo -e "${YELLOW}⚠️  Claude projects directory not created yet${NC}"
    fi
}

# Main execution
main() {
    # Check if we have GitHub token
    if [ -z "$GITHUB_TOKEN" ]; then
        echo -e "${YELLOW}⚠️  No GitHub token provided, initializing local project only${NC}"
        init_new_project
        return
    fi
    
    # Check if project exists in GitHub
    if check_github_project; then
        restore_from_github
    else
        init_new_project
        
        # Optionally create initial GitHub commit for new project
        echo -e "${BLUE}💾 Ready to sync new project to GitHub when changes are made${NC}"
    fi
    
    echo -e "${GREEN}✅ Project initialization complete!${NC}"
}

# Run main function
main