#!/bin/bash

# Setup default Claude project for claudecodeui visibility
echo "🎯 Setting up default Claude project for UID 1000 user..."

# Verify we're running as the correct user
USER_ID=$(id -u)
USER_HOME="/home/user"

echo "Current user ID: $USER_ID"
echo "User home: $USER_HOME" 

# Ensure we have the right HOME environment
export HOME="$USER_HOME"

# Create Claude directories
echo "📁 Creating Claude directories..."
mkdir -p "$HOME/.claude/projects"
mkdir -p "$HOME/.config/claude"

# Verify Claude CLI is available
if ! command -v claude >/dev/null 2>&1; then
    echo "❌ Claude CLI not found in PATH"
    echo "Current PATH: $PATH"
    exit 1
fi

echo "✅ Claude CLI found at: $(which claude)"

# Set up API key for this session
if [ -n "$ANTHROPIC_API_KEY" ]; then
    echo "🔑 Setting ANTHROPIC_API_KEY for current session..."
    export ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY"
else
    echo "⚠️  No ANTHROPIC_API_KEY provided"
fi

# Navigate to baseline project directory
echo "📍 Moving to baseline project directory..."
cd "$HOME/baseline-project"
pwd

# Create initial Claude session to register this project
echo "🚀 Creating initial Claude session for baseline project..."
echo "Initialize this PRIA baseline project. Create a simple welcome message in the README." | claude -p --dangerously-skip-permissions --output-format json 2>&1

# Check if Claude session was created
echo "🔍 Checking Claude projects directory..."
ls -la "$HOME/.claude/projects/" || echo "No projects directory found"

# List any created project folders
if [ -d "$HOME/.claude/projects" ]; then
    echo "📂 Claude projects found:"
    for project in "$HOME/.claude/projects"/*; do
        if [ -d "$project" ]; then
            echo "  - $(basename "$project")"
            ls -la "$project"/ | head -3
        fi
    done
else
    echo "❌ No Claude projects directory exists"
fi

# Verify file ownership
echo "👤 Checking file ownership..."
ls -la "$HOME/.claude/" || echo "No .claude directory found"

echo "✅ Default Claude project setup complete!"