#!/bin/bash
# Startup script for Python Claude API server with dependency check

echo "Starting Python Claude API server..."

# Set up Python paths dynamically based on Python version
export PATH="$HOME/.local/bin:$HOME/.npm-global/bin:$PATH"
PYTHON_VERSION=$(python3 -c "import sys; print(f'python{sys.version_info.major}.{sys.version_info.minor}')")
export PYTHONPATH="$HOME/.local/lib/$PYTHON_VERSION/site-packages:$PYTHONPATH"
echo "Using Python version: $PYTHON_VERSION"

# Check if Claude Code CLI is accessible
echo "Checking Claude Code CLI availability..."
if command -v claude >/dev/null 2>&1; then
    echo "✅ Claude Code CLI found: $(claude --version 2>/dev/null || echo 'version check failed')"
else
    echo "❌ Claude Code CLI not found in PATH"
    echo "PATH: $PATH"
    echo "Searching for claude binary..."
    find /home/user -name "claude" -type f 2>/dev/null || echo "No claude binary found"
fi

# Check if required dependencies are installed
echo "Checking Python dependencies..."
if ! python3 -c "import uvicorn, fastapi, claude_code_sdk" 2>/dev/null; then
    echo "⚠️ Python dependencies not found. Installing..."
    pip3 install --user --upgrade pip
    pip3 install --user -r requirements.txt
    
    # Verify installation
    if python3 -c "import uvicorn, fastapi, claude_code_sdk" 2>/dev/null; then
        echo "✅ Python dependencies installed successfully"
    else
        echo "❌ Failed to install Python dependencies"
        exit 1
    fi
else
    echo "✅ Python dependencies already installed"
fi

# Debug: Show environment variables
echo "Debug - Environment variables:"
echo "ANTHROPIC_API_KEY available: $(if [ -n "$ANTHROPIC_API_KEY" ]; then echo "YES (length: ${#ANTHROPIC_API_KEY})"; else echo "NO"; fi)"
echo "ANTHROPIC_API_KEY starts with: ${ANTHROPIC_API_KEY:0:20}..."

# Start the API server with explicit environment variable
cd /home/user/api
echo "Starting API server on port 8080..."
exec python3 claude_api_server.py