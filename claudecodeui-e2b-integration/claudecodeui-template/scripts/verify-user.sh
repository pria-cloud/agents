#!/bin/bash

# Verify that we're running as non-root user for Claude CLI compatibility
echo "🔍 Verifying user configuration..."

# Check current user
CURRENT_USER=$(whoami)
USER_ID=$(id -u)

echo "Current user: $CURRENT_USER"
echo "User ID: $USER_ID"

# Verify we're not root
if [ "$USER_ID" = "0" ]; then
    echo "❌ ERROR: Running as root user!"
    echo "Claude CLI with --dangerously-skip-permissions requires non-root user"
    exit 1
else
    echo "✅ Running as non-root user (ID: $USER_ID)"
fi

# Check sudo privileges
if sudo -n true 2>/dev/null; then
    echo "⚠️  WARNING: User has passwordless sudo access"
    echo "This may interfere with --dangerously-skip-permissions flag"
else
    echo "✅ No passwordless sudo access (good for Claude CLI)"
fi

# Check home directory
echo "Home directory: $HOME"
echo "Claude config directory: $HOME/.claude"

# Verify Claude CLI can be executed
if command -v claude >/dev/null 2>&1; then
    echo "✅ Claude CLI is available at: $(which claude)"
    
    # Test if --dangerously-skip-permissions works
    echo "Testing --dangerously-skip-permissions flag..."
    echo "test" | claude --print "echo test" --dangerously-skip-permissions --output-format json 2>&1 | head -5
    
    if [ $? -eq 0 ]; then
        echo "✅ Claude CLI with --dangerously-skip-permissions works!"
    else
        echo "⚠️  Claude CLI test had issues - check output above"
    fi
else
    echo "❌ Claude CLI not found in PATH"
fi

echo "================================"
echo "User verification complete!"