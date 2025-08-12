#!/bin/bash

# Simple startup script that starts server and client separately
# This avoids issues with concurrently package

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 PRIA Simple Startup - Starting Services Separately${NC}"
echo "================================================"

# Check required environment variables
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo -e "${RED}⚠️  ANTHROPIC_API_KEY not set${NC}"
fi

if [ -z "$GITHUB_TOKEN" ]; then
    echo -e "${RED}⚠️  GITHUB_TOKEN not set (GitHub integration will be limited)${NC}"
fi

cd /home/user/claudecodeui

# Start server first
echo -e "${BLUE}📡 Starting claudecodeui server (port 3008)...${NC}"
node server/index.js > /tmp/server.log 2>&1 &
SERVER_PID=$!

if kill -0 $SERVER_PID 2>/dev/null; then
    echo -e "${GREEN}✅ Server started with PID: $SERVER_PID${NC}"
else
    echo -e "${RED}❌ Server failed to start${NC}"
    echo "Server log:"
    cat /tmp/server.log | head -20 | sed 's/^/  /'
    exit 1
fi

# Wait for server to initialize
sleep 8

# Check if server port is available
echo -e "${BLUE}🔍 Checking server on port 3008...${NC}"
if ss -tlnp | grep -q ":3008 "; then
    echo -e "${GREEN}✅ Server listening on port 3008${NC}"
else
    echo -e "${RED}❌ Server not listening on port 3008${NC}"
    echo "Server log (last 10 lines):"
    tail -10 /tmp/server.log | sed 's/^/  /'
fi

# Start client/frontend
echo -e "${BLUE}🌐 Starting claudecodeui frontend (port 3009)...${NC}"
npx vite --host --port 3009 > /tmp/client.log 2>&1 &
CLIENT_PID=$!

if kill -0 $CLIENT_PID 2>/dev/null; then
    echo -e "${GREEN}✅ Client started with PID: $CLIENT_PID${NC}"
else
    echo -e "${RED}❌ Client failed to start${NC}"
    echo "Client log:"
    cat /tmp/client.log | head -20 | sed 's/^/  /'
    exit 1
fi

# Wait for client to initialize
sleep 10

# Check if client port is available
echo -e "${BLUE}🔍 Checking client on port 3009...${NC}"
if ss -tlnp | grep -q ":3009 "; then
    echo -e "${GREEN}✅ Client listening on port 3009${NC}"
else
    echo -e "${RED}❌ Client not listening on port 3009${NC}"
    echo "Client log (last 10 lines):"
    tail -10 /tmp/client.log | sed 's/^/  /'
fi

# Show status
echo
echo -e "${GREEN}✅ Services started successfully!${NC}"
echo "================================================"
echo -e "${GREEN}📋 claudecodeui: http://localhost:3009${NC}"
echo -e "${GREEN}🔧 API Server: http://localhost:3008${NC}"
echo -e "${GREEN}📁 Projects: /home/user/projects${NC}"
echo -e "${GREEN}🧠 Claude Sessions: /home/user/.claude${NC}"
echo "================================================"

# Show process information
echo -e "${BLUE}📋 Running processes:${NC}"
ps aux | grep -E "(node|vite)" | grep -v grep | sed 's/^/  /'

# Show port information
echo -e "${BLUE}🔌 Port bindings:${NC}"
ss -tlnp | grep -E "(3008|3009)" | sed 's/^/  /'

# Function to handle shutdown
cleanup() {
    echo -e "${BLUE}🛑 Shutting down services...${NC}"
    [ -n "$SERVER_PID" ] && kill $SERVER_PID 2>/dev/null
    [ -n "$CLIENT_PID" ] && kill $CLIENT_PID 2>/dev/null
    exit 0
}

# Handle shutdown signals
trap cleanup SIGINT SIGTERM

# Keep script running and monitor services
echo -e "${BLUE}🔄 Monitoring services (services will restart if they crash)...${NC}"
while true; do
    # Check if server is still running
    if ! kill -0 $SERVER_PID 2>/dev/null; then
        echo -e "${RED}❌ Server crashed, restarting...${NC}"
        node server/index.js > /tmp/server.log 2>&1 &
        SERVER_PID=$!
        echo -e "${GREEN}🔄 Server restarted with PID: $SERVER_PID${NC}"
    fi
    
    # Check if client is still running
    if ! kill -0 $CLIENT_PID 2>/dev/null; then
        echo -e "${RED}❌ Client crashed, restarting...${NC}"
        npx vite --host --port 3009 > /tmp/client.log 2>&1 &
        CLIENT_PID=$!
        echo -e "${GREEN}🔄 Client restarted with PID: $CLIENT_PID${NC}"
    fi
    
    sleep 30
done