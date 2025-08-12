#!/bin/bash

# Enhanced startup script that properly validates service startup
# This replaces the basic startup script with comprehensive validation

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 PRIA Development Environment - Enhanced Startup${NC}"
echo "================================================"

# Configuration
STARTUP_TIMEOUT=120  # 2 minutes timeout for initial startup
SERVICE_CHECK_DELAY=5  # Wait 5 seconds between service checks
MAX_SERVICE_RETRIES=24  # 24 * 5 = 120 seconds max wait

# Check required environment variables
echo -e "${BLUE}🔧 Environment validation:${NC}"
ENV_OK=true

if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo -e "${RED}⚠️  ANTHROPIC_API_KEY not set${NC}"
    ENV_OK=false
else
    echo -e "${GREEN}✅ ANTHROPIC_API_KEY: Set${NC}"
fi

if [ -z "$GITHUB_TOKEN" ]; then
    echo -e "${YELLOW}⚠️  GITHUB_TOKEN not set (GitHub integration will be limited)${NC}"
else
    echo -e "${GREEN}✅ GITHUB_TOKEN: Set${NC}"
fi

if [ -z "$SUPABASE_URL" ]; then
    echo -e "${YELLOW}⚠️  SUPABASE_URL not set${NC}"
else
    echo -e "${GREEN}✅ SUPABASE_URL: Set${NC}"
fi

# Validate claudecodeui setup
echo -e "${BLUE}📂 Validating claudecodeui setup...${NC}"
cd /home/user/claudecodeui

if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ package.json not found in claudecodeui directory${NC}"
    exit 1
fi

if [ ! -d "node_modules" ]; then
    echo -e "${RED}❌ node_modules not found - running npm install...${NC}"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ npm install failed${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✅ claudecodeui setup validated${NC}"

# Check what scripts are available
echo -e "${BLUE}📋 Checking available npm scripts...${NC}"
if command -v jq >/dev/null 2>&1; then
    cat package.json | jq -r '.scripts | keys[]' | sed 's/^/  - /'
else
    npm run 2>&1 | grep -E "^  [a-zA-Z]" || echo "  No scripts found"
fi

# Function to start claudecodeui using the correct method
start_claudecodeui() {
    echo -e "${BLUE}🚀 Starting claudecodeui (dev mode - both server and client)...${NC}"
    
    # Method 1: Use npm run dev (recommended - starts both services)
    if npm run dev --dry-run 2>/dev/null; then
        echo "  Starting with: npm run dev (starts both server and client)"
        npm run dev > /tmp/claudecodeui.log 2>&1 &
        CLAUDECODEUI_PID=$!
        echo "  claudecodeui PID: $CLAUDECODEUI_PID"
        return 0
    fi
    
    # Fallback: Start services separately if dev script fails
    echo "  npm run dev not available, starting services separately..."
    
    # Start server first
    if npm run server --dry-run 2>/dev/null; then
        echo "  Starting server: npm run server"
        npm run server > /tmp/server.log 2>&1 &
        SERVER_PID=$!
    elif [ -f "server/index.js" ]; then
        echo "  Starting server: node server/index.js"
        node server/index.js > /tmp/server.log 2>&1 &
        SERVER_PID=$!
    else
        echo -e "${RED}❌ No server script found${NC}"
        return 1
    fi
    
    # Wait for server to start
    sleep 5
    
    # Start client
    if npm run client --dry-run 2>/dev/null; then
        echo "  Starting client: npm run client"
        npm run client > /tmp/client.log 2>&1 &
        CLIENT_PID=$!
    elif command -v vite >/dev/null 2>&1; then
        echo "  Starting client: vite --host --port 3009"
        vite --host --port 3009 > /tmp/client.log 2>&1 &
        CLIENT_PID=$!
    else
        echo -e "${RED}❌ No client script found${NC}"
        return 1
    fi
    
    return 0
}

# Function to validate service is responding
validate_service() {
    local service_name="$1"
    local url="$2"
    local max_retries="$3"
    
    echo -e "${BLUE}🔍 Validating $service_name...${NC}"
    
    for i in $(seq 1 $max_retries); do
        if curl -s --connect-timeout 3 --max-time 10 "$url" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ $service_name: Responding (attempt $i)${NC}"
            return 0
        fi
        
        echo -e "${YELLOW}⏳ $service_name: Not ready yet (attempt $i/$max_retries)${NC}"
        
        if [ $i -lt $max_retries ]; then
            sleep $SERVICE_CHECK_DELAY
        fi
    done
    
    echo -e "${RED}❌ $service_name: Failed to respond after $max_retries attempts${NC}"
    return 1
}

# Start claudecodeui services
echo -e "${BLUE}🚀 Starting claudecodeui services...${NC}"

if ! start_claudecodeui; then
    echo -e "${RED}❌ Failed to start claudecodeui services${NC}"
    exit 1
fi

# Wait for initial startup
echo -e "${BLUE}⏳ Waiting for services to initialize...${NC}"
sleep 15

# Validate both services are responding
echo -e "${BLUE}🔍 Validating service startup...${NC}"

SERVER_OK=false
CLIENT_OK=false

if validate_service "Server" "http://localhost:3008/api/github/status/test" $MAX_SERVICE_RETRIES; then
    SERVER_OK=true
fi

if validate_service "Frontend" "http://localhost:3009" $MAX_SERVICE_RETRIES; then
    CLIENT_OK=true
fi

# Check results
if $SERVER_OK && $CLIENT_OK; then
    echo
    echo -e "${GREEN}🎉 All services started successfully!${NC}"
    echo "================================================"
    echo -e "${GREEN}📋 claudecodeui: http://localhost:3009${NC}"
    echo -e "${GREEN}🔧 API Server: http://localhost:3008${NC}"
    echo -e "${GREEN}📁 Projects: /home/user/projects${NC}"
    echo -e "${GREEN}🧠 Claude Sessions: /home/user/.claude${NC}"
    echo "================================================"
    
    # Show process information
    echo -e "${BLUE}📋 Running processes:${NC}"
    ps aux | grep -E "(node|npm)" | grep -v grep | sed 's/^/  /'
    
    # Show port information
    echo -e "${BLUE}🔌 Port bindings:${NC}"
    netstat -tlnp | grep -E "(3008|3009)" | sed 's/^/  /'
    
    # Function to handle shutdown
    cleanup() {
        echo -e "${BLUE}🛑 Shutting down services...${NC}"
        [ -n "$CLAUDECODEUI_PID" ] && kill $CLAUDECODEUI_PID 2>/dev/null
        [ -n "$SERVER_PID" ] && kill $SERVER_PID 2>/dev/null
        [ -n "$CLIENT_PID" ] && kill $CLIENT_PID 2>/dev/null
        exit 0
    }
    
    # Handle shutdown signals
    trap cleanup SIGINT SIGTERM
    
    # Keep script running and monitor services
    echo -e "${BLUE}🔄 Monitoring services (press Ctrl+C to stop)...${NC}"
    while true; do
        # If using single dev process
        if [ -n "$CLAUDECODEUI_PID" ] && ! kill -0 $CLAUDECODEUI_PID 2>/dev/null; then
            echo -e "${RED}❌ claudecodeui process crashed, restarting...${NC}"
            start_claudecodeui
        fi
        
        # If using separate processes
        if [ -n "$SERVER_PID" ] && ! kill -0 $SERVER_PID 2>/dev/null; then
            echo -e "${RED}❌ Server crashed, restarting...${NC}"
            npm run server > /tmp/server.log 2>&1 &
            SERVER_PID=$!
        fi
        
        if [ -n "$CLIENT_PID" ] && ! kill -0 $CLIENT_PID 2>/dev/null; then
            echo -e "${RED}❌ Client crashed, restarting...${NC}"
            npm run client > /tmp/client.log 2>&1 &
            CLIENT_PID=$!
        fi
        
        sleep 30
    done
    
else
    echo
    echo -e "${RED}💥 Service startup validation FAILED${NC}"
    echo "================================================"
    
    if ! $SERVER_OK; then
        echo -e "${RED}❌ Server (port 3008) is not responding${NC}"
        if [ -f "/tmp/claudecodeui.log" ]; then
            echo "claudecodeui log (last 20 lines):"
            tail -20 /tmp/claudecodeui.log 2>/dev/null | sed 's/^/  /'
        elif [ -f "/tmp/server.log" ]; then
            echo "Server log (last 20 lines):"
            tail -20 /tmp/server.log 2>/dev/null | sed 's/^/  /'
        else
            echo "  No server log available"
        fi
    fi
    
    if ! $CLIENT_OK; then
        echo -e "${RED}❌ Frontend (port 3009) is not responding${NC}"
        if [ -f "/tmp/claudecodeui.log" ]; then
            echo "claudecodeui log (last 20 lines):"
            tail -20 /tmp/claudecodeui.log 2>/dev/null | sed 's/^/  /'
        elif [ -f "/tmp/client.log" ]; then
            echo "Client log (last 20 lines):"
            tail -20 /tmp/client.log 2>/dev/null | sed 's/^/  /'
        else
            echo "  No client log available"
        fi
    fi
    
    echo
    echo -e "${BLUE}📋 Process status:${NC}"
    ps aux | grep -E "(node|npm)" | grep -v grep | sed 's/^/  /' || echo "  No Node.js processes found"
    
    echo -e "${BLUE}🔌 Port status:${NC}"
    netstat -tlnp | grep -E "(3008|3009)" | sed 's/^/  /' || echo "  No services on ports 3008/3009"
    
    # Clean up
    [ -n "$CLAUDECODEUI_PID" ] && kill $CLAUDECODEUI_PID 2>/dev/null
    [ -n "$SERVER_PID" ] && kill $SERVER_PID 2>/dev/null
    [ -n "$CLIENT_PID" ] && kill $CLIENT_PID 2>/dev/null
    
    exit 1
fi