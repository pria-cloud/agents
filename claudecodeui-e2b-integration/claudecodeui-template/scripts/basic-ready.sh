#!/bin/bash

# Most basic ready script using only Node.js and curl
echo "🔍 Basic PRIA Ready Check"
echo "========================"

# Wait using Node.js instead of sleep command
wait_seconds() {
    node -e "setTimeout(() => process.exit(0), $1 * 1000)" 2>/dev/null || echo "Wait failed"
}

MAX_ATTEMPTS=20
DELAY=15

# Use a for loop that doesn't require seq command
i=1
while [ $i -le $MAX_ATTEMPTS ]; do
    echo "Attempt $i/$MAX_ATTEMPTS..."
    
    # Check server (simplified endpoint)
    if curl -s --connect-timeout 3 --max-time 5 http://localhost:3008 >/dev/null 2>&1; then
        echo "✅ Server (3008): Responding"
        SERVER_OK=true
    else
        echo "❌ Server (3008): Not ready"
        SERVER_OK=false
    fi
    
    # Check client
    if curl -s --connect-timeout 3 --max-time 5 http://localhost:3009 >/dev/null 2>&1; then
        echo "✅ Client (3009): Responding"  
        CLIENT_OK=true
    else
        echo "❌ Client (3009): Not ready"
        CLIENT_OK=false
    fi
    
    # Both services OK?
    if [ "$SERVER_OK" = "true" ] && [ "$CLIENT_OK" = "true" ]; then
        echo ""
        echo "🎉 PRIA Environment is READY!"
        echo "📋 claudecodeui: http://localhost:3009"
        echo "🔧 API Server: http://localhost:3008"
        exit 0
    fi
    
    if [ $i -lt $MAX_ATTEMPTS ]; then
        echo "⏳ Waiting ${DELAY}s..."
        wait_seconds $DELAY
    fi
    i=$((i + 1))
done

echo ""
echo "💥 Ready check FAILED after $MAX_ATTEMPTS attempts"
exit 1