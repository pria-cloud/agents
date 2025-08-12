#!/bin/bash
# Create a robust startup script that adapts to claudecodeui's actual package.json

cat > /home/user/start-all-services.sh << 'EOF'
#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting PRIA Development Environment${NC}"

# Check required environment variables
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo -e "${RED}⚠️  ANTHROPIC_API_KEY not set${NC}"
fi

if [ -z "$GITHUB_TOKEN" ]; then
    echo -e "${RED}⚠️  GITHUB_TOKEN not set (GitHub integration will be limited)${NC}"
fi

cd /home/user/claudecodeui

# Check what scripts are available
echo -e "${BLUE}📋 Checking available npm scripts...${NC}"
npm run 2>&1 | grep -E "^  [a-zA-Z]" || echo "No scripts found"

# Check package.json scripts
if [ -f "package.json" ]; then
    echo -e "${BLUE}📜 Available scripts:${NC}"
    cat package.json | grep -A 20 '"scripts"' | head -15
fi

# Try different server start commands
echo -e "${BLUE}📡 Starting server (trying multiple approaches)...${NC}"

# Method 1: Try npm run server
if npm run server --dry-run 2>/dev/null; then
    echo "Starting with: npm run server"
    npm run server &
    SERVER_PID=$!
# Method 2: Try npm run dev
elif npm run dev --dry-run 2>/dev/null; then
    echo "Starting with: npm run dev"
    npm run dev &
    SERVER_PID=$!
# Method 3: Try direct node server start
elif [ -f "server.js" ]; then
    echo "Starting with: node server.js"
    node server.js &
    SERVER_PID=$!
elif [ -f "server/index.js" ]; then
    echo "Starting with: node server/index.js"
    node server/index.js &
    SERVER_PID=$!
else
    echo -e "${RED}❌ No server script found${NC}"
fi

sleep 5

# Try different client/frontend start commands
echo -e "${BLUE}🌐 Starting frontend (trying multiple approaches)...${NC}"

# Method 1: Try npm run client
if npm run client --dry-run 2>/dev/null; then
    echo "Starting with: npm run client"
    npm run client &
    CLIENT_PID=$!
# Method 2: Try vite directly
elif command -v vite >/dev/null 2>&1; then
    echo "Starting with: vite --host 0.0.0.0 --port 3009"
    vite --host 0.0.0.0 --port 3009 &
    CLIENT_PID=$!
# Method 3: Try npm start
elif npm run start --dry-run 2>/dev/null; then
    echo "Starting with: npm start"
    npm start &
    CLIENT_PID=$!
else
    echo -e "${RED}❌ No client script found${NC}"
fi

# Wait and check if services started
sleep 10

echo -e "${GREEN}✅ Startup complete!${NC}"
echo -e "${GREEN}📋 claudecodeui should be available at: http://localhost:3009${NC}"
echo -e "${GREEN}🔧 API Server should be at: http://localhost:3008${NC}"

# Check if ports are actually listening
echo -e "${BLUE}🔍 Port status:${NC}"
netstat -tlnp | grep -E "(3008|3009)" || echo "No services found on ports 3008/3009"

# Show running node processes
echo -e "${BLUE}🔍 Node processes:${NC}"
ps aux | grep node | grep -v grep || echo "No node processes found"

# Keep script running and monitor services
while true; do
    # Check if server is still running
    if [ ! -z "$SERVER_PID" ] && ! kill -0 $SERVER_PID 2>/dev/null; then
        echo -e "${RED}❌ Server crashed, restarting...${NC}"
        cd /home/user/claudecodeui
        if npm run server --dry-run 2>/dev/null; then
            npm run server &
        elif [ -f "server.js" ]; then
            node server.js &
        fi
        SERVER_PID=$!
    fi
    
    # Check if client is still running
    if [ ! -z "$CLIENT_PID" ] && ! kill -0 $CLIENT_PID 2>/dev/null; then
        echo -e "${RED}❌ Client crashed, restarting...${NC}"
        cd /home/user/claudecodeui
        if npm run client --dry-run 2>/dev/null; then
            npm run client &
        elif command -v vite >/dev/null 2>&1; then
            vite --host 0.0.0.0 --port 3009 &
        fi
        CLIENT_PID=$!
    fi
    
    sleep 30
done
EOF

chmod +x /home/user/start-all-services.sh