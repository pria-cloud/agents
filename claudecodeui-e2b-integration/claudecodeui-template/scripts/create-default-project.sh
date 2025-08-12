#!/bin/bash

# Create default Claude project for claudecodeui
echo "📂 Creating default Claude project..."

# Exit gracefully if Claude CLI is not available (e.g., during Docker build)
if [ ! -f "/home/user/.npm-global/bin/claude" ]; then
    echo "⚠️ Claude CLI not yet installed, skipping project creation"
    exit 0
fi

# Set up environment
export HOME="/home/user"
export PATH="/home/user/.npm-global/bin:/home/user/.local/bin:$PATH"
export ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-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}"

# Ensure directories exist
mkdir -p /home/user/.claude/projects
mkdir -p /home/user/.config/claude
mkdir -p /home/user/baseline-project

# Create Claude config if it doesn't exist
if [ ! -f "/home/user/.config/claude/config.json" ]; then
    echo "{\"anthropicApiKey\": \"$ANTHROPIC_API_KEY\"}" > /home/user/.config/claude/config.json
    echo "✅ Created Claude config"
fi

# Navigate to baseline project
cd /home/user/baseline-project

# Test Claude CLI is accessible
echo "🧪 Testing Claude CLI..."
if /home/user/.npm-global/bin/claude --version 2>&1; then
    echo "✅ Claude CLI is accessible"
    
    # Create initial project session
    echo "📝 Creating initial project session..."
    echo "Initialize PRIA baseline project" | /home/user/.npm-global/bin/claude -p --dangerously-skip-permissions 2>&1 | tee /tmp/claude-init.log
    
    # Check if project was created
    if [ -d "/home/user/.claude/projects" ] && [ "$(ls -A /home/user/.claude/projects 2>/dev/null)" ]; then
        echo "✅ Claude project created successfully"
        ls -la /home/user/.claude/projects/
    else
        echo "⚠️ No Claude projects found after initialization"
    fi
else
    echo "❌ Claude CLI not accessible"
    echo "Checking Claude installation..."
    ls -la /home/user/.npm-global/bin/ | grep claude || echo "Claude not found in npm-global"
fi

echo "📂 Project initialization complete"