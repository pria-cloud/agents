#!/bin/bash

# Minimal ready script - just wait and check basic connectivity
echo "🔍 Minimal Ready Check"
echo "====================="

# Wait for services to start
echo "Waiting 30 seconds for services to initialize..."
sleep 30

# Check if processes are running
PROCESSES=$(ps aux | grep -E "(node|npm)" | grep -v grep | wc -l)
echo "Node/npm processes running: $PROCESSES"

if [ "$PROCESSES" -gt 0 ]; then
    echo "✅ Processes are running"
else
    echo "❌ No Node/npm processes found"
    
    echo "=== Debug Info ==="
    echo "Current directory contents:"
    ls -la /home/user/claudecodeui/ | head -10
    
    echo "Package.json exists:"
    [ -f "/home/user/claudecodeui/package.json" ] && echo "Yes" || echo "No"
    
    echo "Node modules exists:"
    [ -d "/home/user/claudecodeui/node_modules" ] && echo "Yes" || echo "No"
    
    echo "Server log:"
    head -10 /tmp/server.log 2>/dev/null || echo "No server log"
    
    echo "Client log:"
    head -10 /tmp/client.log 2>/dev/null || echo "No client log"
    
    exit 1
fi

# Simple HTTP check
for i in {1..10}; do
    echo "Attempt $i: Testing HTTP connectivity..."
    
    if curl -s --connect-timeout 3 --max-time 5 http://localhost:3008 >/dev/null 2>&1; then
        echo "✅ Server responding on 3008"
        SERVER_OK=true
    else
        echo "❌ Server not responding on 3008"
        SERVER_OK=false
    fi
    
    if curl -s --connect-timeout 3 --max-time 5 http://localhost:3009 >/dev/null 2>&1; then
        echo "✅ Client responding on 3009"
        CLIENT_OK=true
    else
        echo "❌ Client not responding on 3009"
        CLIENT_OK=false
    fi
    
    if $SERVER_OK && $CLIENT_OK; then
        echo
        echo "🎉 Services are ready!"
        echo "📋 claudecodeui: http://localhost:3009"
        echo "🔧 API Server: http://localhost:3008"
        exit 0
    fi
    
    sleep 10
done

echo "💥 Services did not become ready within timeout"
exit 1