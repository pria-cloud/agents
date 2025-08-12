#!/bin/bash

# Minimal startup script that uses npm scripts exactly as intended
# No fancy features, just start the services

# Ensure API key is available for all processes
export ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-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}"

echo "🚀 PRIA Minimal Startup"
echo "======================"

cd /home/user/claudecodeui

# Verify the dist folder exists
if [ ! -d "dist" ]; then
    echo "⚠️  dist folder not found, building frontend..."
    npm run build
fi

# Check if we can access the scripts
echo "Available npm scripts:"
npm run 2>&1 | grep -E "^  [a-zA-Z]" || echo "No scripts found"

echo
echo "📡 Starting server..."
npm run server > /tmp/server.log 2>&1 &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"

sleep 5

echo "🌐 Starting frontend (production build)..."
npx vite preview --port 3009 --host 0.0.0.0 > /tmp/client.log 2>&1 &
CLIENT_PID=$!
echo "Frontend PID: $CLIENT_PID"

echo
echo "Services started:"
echo "- Server PID: $SERVER_PID"
echo "- Client PID: $CLIENT_PID"

echo
echo "Checking logs after 10 seconds..."
sleep 10

echo "=== Server Log ==="
head -20 /tmp/server.log
echo
echo "=== Client Log ==="
head -20 /tmp/client.log

# Function to handle shutdown
cleanup() {
    echo "Shutting down..."
    kill $SERVER_PID $CLIENT_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Keep running
while true; do
    if ! kill -0 $SERVER_PID 2>/dev/null; then
        echo "Server crashed, restarting..."
        npm run server > /tmp/server.log 2>&1 &
        SERVER_PID=$!
    fi
    
    if ! kill -0 $CLIENT_PID 2>/dev/null; then
        echo "Frontend crashed, restarting..."
        npx vite preview --port 3009 --host 0.0.0.0 > /tmp/client.log 2>&1 &
        CLIENT_PID=$!
    fi
    
    sleep 30
done