#!/bin/bash

# Debug startup script to identify why npm run dev is failing
# This script starts services separately and provides detailed error logging

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Debug Startup - Identifying claudecodeui Issues${NC}"
echo "================================================"

cd /home/user/claudecodeui

# Check current directory and contents
echo -e "${BLUE}📂 Current directory: $(pwd)${NC}"
echo -e "${BLUE}📋 Directory contents:${NC}"
ls -la | head -20

echo
echo -e "${BLUE}📜 Checking package.json scripts:${NC}"
if [ -f "package.json" ]; then
    cat package.json | grep -A 10 '"scripts"' || echo "No scripts section found"
else
    echo -e "${RED}❌ package.json not found!${NC}"
    exit 1
fi

echo
echo -e "${BLUE}📦 Checking node_modules:${NC}"
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✅ node_modules exists${NC}"
    ls node_modules | head -10
    echo "... (showing first 10 packages)"
else
    echo -e "${RED}❌ node_modules missing${NC}"
    exit 1
fi

echo
echo -e "${BLUE}🔍 Testing npm commands individually:${NC}"

echo -e "${YELLOW}Testing 'npm run server' (dry run):${NC}"
if npm run server --dry-run 2>&1; then
    echo -e "${GREEN}✅ npm run server command exists${NC}"
else
    echo -e "${RED}❌ npm run server command failed${NC}"
fi

echo
echo -e "${YELLOW}Testing 'npm run client' (dry run):${NC}"
if npm run client --dry-run 2>&1; then
    echo -e "${GREEN}✅ npm run client command exists${NC}"
else
    echo -e "${RED}❌ npm run client command failed${NC}"
fi

echo
echo -e "${YELLOW}Testing 'npm run dev' (dry run):${NC}"
if npm run dev --dry-run 2>&1; then
    echo -e "${GREEN}✅ npm run dev command exists${NC}"
else
    echo -e "${RED}❌ npm run dev command failed${NC}"
fi

echo
echo -e "${BLUE}🚀 Testing server startup separately:${NC}"
echo -e "${YELLOW}Starting server with: npm run server${NC}"
timeout 10 npm run server > /tmp/server-test.log 2>&1 &
SERVER_PID=$!

sleep 5

if kill -0 $SERVER_PID 2>/dev/null; then
    echo -e "${GREEN}✅ Server started successfully (PID: $SERVER_PID)${NC}"
    echo "Server log (first 20 lines):"
    head -20 /tmp/server-test.log | sed 's/^/  /'
    kill $SERVER_PID 2>/dev/null
else
    echo -e "${RED}❌ Server failed to start${NC}"
    echo "Server log:"
    cat /tmp/server-test.log | sed 's/^/  /'
fi

echo
echo -e "${BLUE}🌐 Testing client startup separately:${NC}"
echo -e "${YELLOW}Starting client with: npm run client${NC}"
timeout 10 npm run client > /tmp/client-test.log 2>&1 &
CLIENT_PID=$!

sleep 5

if kill -0 $CLIENT_PID 2>/dev/null; then
    echo -e "${GREEN}✅ Client started successfully (PID: $CLIENT_PID)${NC}"
    echo "Client log (first 20 lines):"
    head -20 /tmp/client-test.log | sed 's/^/  /'
    kill $CLIENT_PID 2>/dev/null
else
    echo -e "${RED}❌ Client failed to start${NC}"
    echo "Client log:"
    cat /tmp/client-test.log | sed 's/^/  /'
fi

echo
echo -e "${BLUE}🔄 Testing npm run dev (full startup):${NC}"
echo -e "${YELLOW}Starting with: npm run dev${NC}"
timeout 15 npm run dev > /tmp/dev-test.log 2>&1 &
DEV_PID=$!

sleep 10

if kill -0 $DEV_PID 2>/dev/null; then
    echo -e "${GREEN}✅ npm run dev started successfully (PID: $DEV_PID)${NC}"
    echo "Dev log (first 30 lines):"
    head -30 /tmp/dev-test.log | sed 's/^/  /'
    kill $DEV_PID 2>/dev/null
else
    echo -e "${RED}❌ npm run dev failed to start${NC}"
    echo "Dev log:"
    cat /tmp/dev-test.log | sed 's/^/  /'
fi

echo
echo -e "${BLUE}📊 Process status:${NC}"
ps aux | grep -E "(node|npm)" | grep -v grep | sed 's/^/  /' || echo "No Node.js processes running"

echo
echo -e "${BLUE}🔌 Port status:${NC}"
netstat -tlnp | grep -E "(3008|3009)" | sed 's/^/  /' || echo "No services on ports 3008/3009"

echo
echo -e "${BLUE}🔧 Environment check:${NC}"
echo "NODE_VERSION: $(node --version 2>/dev/null || echo 'Not available')"
echo "NPM_VERSION: $(npm --version 2>/dev/null || echo 'Not available')"
echo "PWD: $(pwd)"
echo "USER: $(whoami)"
echo "HOME: $HOME"

echo
echo "================================================"
echo -e "${BLUE}Debug startup complete. Check logs above for issues.${NC}"