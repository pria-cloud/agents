#!/bin/bash

# Startup script for Claude Code UI in E2B sandbox

set -e

# Ensure API key is available for all processes
export ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-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}"

echo "🚀 Starting Claude Code UI (Production Mode)..."

# Ensure Claude Code CLI is available
if ! command -v claude &> /dev/null; then
    echo "❌ Claude Code CLI not found, installing..."
    npm install -g @anthropic-ai/claude-code@latest
fi

# Verify Claude Code CLI installation
echo "✅ Claude Code CLI version: $(claude --version)"

# Navigate to the application directory
cd /home/user/claudecodeui

# Verify the dist folder exists
if [ ! -d "dist" ]; then
    echo "⚠️  dist folder not found, building frontend..."
    npm run build
fi

# The frontend is already built in the Dockerfile
echo "🌐 Starting Claude Code UI services..."
echo "📝 Backend API: http://localhost:3008"
echo "🎨 Frontend UI: http://localhost:3009"
echo ""
echo "Note: Frontend is served from pre-built dist folder"

# Start the API server in the background
echo "Starting API server on port 3008..."
npm run server &
API_PID=$!

# Wait a moment for the API server to start
sleep 2

# Start Vite preview to serve the built frontend on port 3009
echo "Starting frontend on port 3009..."
npx vite preview --port 3009 --host 0.0.0.0 &
FRONTEND_PID=$!

echo "✅ Services started:"
echo "   API Server PID: $API_PID"
echo "   Frontend PID: $FRONTEND_PID"

# Keep the script running and monitor both services
wait $API_PID $FRONTEND_PID