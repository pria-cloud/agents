#!/bin/bash
# /home/user/scripts/restore-claude-project.sh

PROJECT_NAME=$1
GITHUB_REPO=$2
BRANCH=${3:-main}

# Check if parameters provided
if [ -z "$PROJECT_NAME" ] || [ -z "$GITHUB_REPO" ]; then
    echo "Usage: $0 <project_name> <github_repo> [branch]"
    echo "Example: $0 my-app https://github.com/user/my-app.git main"
    exit 1
fi

echo "Restoring project: $PROJECT_NAME from $GITHUB_REPO (branch: $BRANCH)"

# Clone project
cd /home/user/projects
if [ -d "$PROJECT_NAME" ]; then
    echo "Project directory already exists, removing..."
    rm -rf "$PROJECT_NAME"
fi

git clone -b "$BRANCH" "$GITHUB_REPO" "$PROJECT_NAME"
if [ $? -ne 0 ]; then
    echo "Failed to clone repository"
    exit 1
fi

# Restore Claude sessions
PROJECT_PATH="/home/user/projects/${PROJECT_NAME}"
if [ -d "${PROJECT_PATH}/.claude" ]; then
    echo "Restoring Claude sessions..."
    
    # Copy to Claude's expected location
    CLAUDE_PROJECT_DIR=$(echo "${PROJECT_PATH}" | sed 's/\//-/g')
    
    # Restore project sessions
    if [ -d "${PROJECT_PATH}/.claude/projects" ]; then
        mkdir -p "$HOME/.claude/projects"
        cp -r "${PROJECT_PATH}/.claude/projects/"* "$HOME/.claude/projects/"
        echo "✓ Restored Claude project sessions"
    fi
    
    # Restore todo lists
    if [ -d "${PROJECT_PATH}/.claude/todos" ]; then
        mkdir -p "$HOME/.claude/todos"
        cp -r "${PROJECT_PATH}/.claude/todos/"* "$HOME/.claude/todos/"
        echo "✓ Restored Claude todo lists"
    fi
    
    echo "✓ Restored Claude sessions for ${PROJECT_NAME}"
else
    echo "No Claude session data found in repository"
fi

cd "${PROJECT_PATH}"

# Install dependencies if package.json exists
if [ -f "package.json" ]; then
    echo "Installing dependencies..."
    npm install
fi

echo "✓ Project restoration complete: ${PROJECT_NAME}"