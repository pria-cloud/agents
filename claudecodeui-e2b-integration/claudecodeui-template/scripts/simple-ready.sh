#!/bin/bash

# Simple ready script - just check if both services respond
# This is less strict than the enhanced version

echo "🔍 Simple PRIA Ready Check"
echo "=========================="

MAX_ATTEMPTS=30
DELAY=10

for i in $(seq 1 $MAX_ATTEMPTS); do
    echo "Attempt $i/$MAX_ATTEMPTS..."
    
    # Check server
    SERVER_OK=false
    if curl -s --connect-timeout 5 --max-time 10 http://localhost:3008/api/github/status/test >/dev/null 2>&1; then
        echo "✅ Server (3008): OK"
        SERVER_OK=true
    else
        echo "❌ Server (3008): Not ready"
    fi
    
    # Check client
    CLIENT_OK=false
    if curl -s --connect-timeout 5 --max-time 10 http://localhost:3009 >/dev/null 2>&1; then
        echo "✅ Client (3009): OK"
        CLIENT_OK=true
    else
        echo "❌ Client (3009): Not ready"
    fi
    
    # Both must be OK
    if $SERVER_OK && $CLIENT_OK; then
        echo
        echo "🎉 PRIA Environment is READY!"
        echo "📋 claudecodeui: http://localhost:3009"
        echo "🔧 API Server: http://localhost:3008"
        exit 0
    fi
    
    if [ $i -lt $MAX_ATTEMPTS ]; then
        echo "⏳ Waiting ${DELAY}s..."
        sleep $DELAY
    fi
done

echo
echo "💥 Ready check FAILED after $MAX_ATTEMPTS attempts"
echo "Services did not start within $((MAX_ATTEMPTS * DELAY)) seconds"

# Show diagnostics
echo
echo "📋 Process status:"
ps aux | grep -E "(node|vite)" | grep -v grep || echo "No Node.js/Vite processes found"

echo
echo "🔌 Port status:"
ss -tlnp | grep -E "(3008|3009)" || echo "Ports 3008/3009 not found"

echo
echo "📄 Log files:"
echo "Server log (last 10 lines):"
tail -10 /tmp/server.log 2>/dev/null | sed 's/^/  /' || echo "No server log"

echo "Client log (last 10 lines):"
tail -10 /tmp/client.log 2>/dev/null | sed 's/^/  /' || echo "No client log"

exit 1