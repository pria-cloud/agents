#!/bin/bash

# Enhanced health check script with proper service validation and retry logic
# This script ensures all services are fully started before marking sandbox as ready

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Enhanced PRIA Environment Health Check${NC}"
echo "================================================"

# Configuration
MAX_RETRIES=60  # Wait up to 5 minutes (60 * 5 seconds)
RETRY_DELAY=5   # Wait 5 seconds between retries
SUCCESS_COUNT=0
REQUIRED_SUCCESSES=3  # Require 3 consecutive successful checks

# Function to check if a service is responding properly
check_service() {
    local service_name="$1"
    local url="$2"
    local expected_status="$3"
    
    echo -n "  Checking ${service_name}... "
    
    # Use curl with proper timeout and follow redirects
    response=$(curl -s -w "%{http_code}" -o /dev/null --connect-timeout 3 --max-time 10 "$url" 2>/dev/null)
    
    if [ "$response" = "$expected_status" ]; then
        echo -e "${GREEN}✅ OK (HTTP $response)${NC}"
        return 0
    else
        echo -e "${RED}❌ Failed (HTTP $response)${NC}"
        return 1
    fi
}

# Function to check if processes are running
check_processes() {
    echo -e "${BLUE}📋 Checking running processes:${NC}"
    
    # Check for node processes
    local node_processes=$(ps aux | grep -E "(node|npm)" | grep -v grep | wc -l)
    if [ "$node_processes" -gt 0 ]; then
        echo -e "  ${GREEN}✅ Found $node_processes Node.js processes${NC}"
        ps aux | grep -E "(node|npm)" | grep -v grep | sed 's/^/    /'
        return 0
    else
        echo -e "  ${RED}❌ No Node.js processes found${NC}"
        return 1
    fi
}

# Function to check ports
check_ports() {
    echo -e "${BLUE}🔌 Checking port bindings:${NC}"
    
    local ports_ok=0
    
    # Check port 3008 (server)
    if netstat -tlnp 2>/dev/null | grep -q ":3008 "; then
        echo -e "  ${GREEN}✅ Port 3008 (server): Listening${NC}"
        ports_ok=$((ports_ok + 1))
    else
        echo -e "  ${RED}❌ Port 3008 (server): Not listening${NC}"
    fi
    
    # Check port 3009 (frontend)
    if netstat -tlnp 2>/dev/null | grep -q ":3009 "; then
        echo -e "  ${GREEN}✅ Port 3009 (frontend): Listening${NC}"
        ports_ok=$((ports_ok + 1))
    else
        echo -e "  ${RED}❌ Port 3009 (frontend): Not listening${NC}"
    fi
    
    return $((2 - ports_ok))  # Return 0 if both ports are ok
}

# Function to validate claudecodeui setup
check_claudecodeui_setup() {
    echo -e "${BLUE}📂 Checking claudecodeui setup:${NC}"
    
    # Check if directory exists
    if [ ! -d "/home/user/claudecodeui" ]; then
        echo -e "  ${RED}❌ claudecodeui directory missing${NC}"
        return 1
    fi
    
    # Check if package.json exists
    if [ ! -f "/home/user/claudecodeui/package.json" ]; then
        echo -e "  ${RED}❌ package.json missing${NC}"
        return 1
    fi
    
    # Check if node_modules exists
    if [ ! -d "/home/user/claudecodeui/node_modules" ]; then
        echo -e "  ${RED}❌ node_modules missing (dependencies not installed)${NC}"
        return 1
    fi
    
    echo -e "  ${GREEN}✅ claudecodeui setup: Complete${NC}"
    return 0
}

# Function to perform comprehensive health check
perform_health_check() {
    local attempt="$1"
    
    echo -e "${YELLOW}🔄 Health check attempt $attempt/$MAX_RETRIES${NC}"
    echo "----------------------------------------"
    
    # Check basic setup first
    if ! check_claudecodeui_setup; then
        return 1
    fi
    
    # Check if processes are running
    if ! check_processes; then
        return 1
    fi
    
    # Check port bindings
    if ! check_ports; then
        return 1
    fi
    
    # Check service endpoints
    local services_ok=0
    
    echo -e "${BLUE}🌐 Checking service endpoints:${NC}"
    
    # Check server endpoint (port 3008)
    if check_service "claudecodeui server" "http://localhost:3008/api/github/status/test" "200"; then
        services_ok=$((services_ok + 1))
    fi
    
    # Check frontend endpoint (port 3009)
    if check_service "claudecodeui frontend" "http://localhost:3009" "200"; then
        services_ok=$((services_ok + 1))
    fi
    
    # Both services must be responding
    if [ "$services_ok" -eq 2 ]; then
        echo -e "${GREEN}✅ All services responding correctly${NC}"
        return 0
    else
        echo -e "${RED}❌ $((2 - services_ok)) service(s) not responding${NC}"
        return 1
    fi
}

# Main health check loop with retry logic
echo -e "${BLUE}🚀 Starting enhanced health check with retry logic...${NC}"
echo "Max retries: $MAX_RETRIES, Delay: ${RETRY_DELAY}s, Required successes: $REQUIRED_SUCCESSES"
echo

for attempt in $(seq 1 $MAX_RETRIES); do
    if perform_health_check "$attempt"; then
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
        echo -e "${GREEN}✅ Health check passed ($SUCCESS_COUNT/$REQUIRED_SUCCESSES consecutive successes)${NC}"
        
        if [ "$SUCCESS_COUNT" -ge "$REQUIRED_SUCCESSES" ]; then
            echo
            echo -e "${GREEN}🎉 PRIA Environment is READY!${NC}"
            echo "================================================"
            echo -e "${GREEN}📋 claudecodeui: http://localhost:3009${NC}"
            echo -e "${GREEN}🔧 API Server: http://localhost:3008${NC}"
            echo -e "${GREEN}📁 Projects: /home/user/projects${NC}"
            echo -e "${GREEN}🧠 Claude Sessions: /home/user/.claude${NC}"
            echo "================================================"
            exit 0
        fi
    else
        SUCCESS_COUNT=0  # Reset success count on failure
        echo -e "${RED}❌ Health check failed (attempt $attempt/$MAX_RETRIES)${NC}"
    fi
    
    if [ "$attempt" -lt "$MAX_RETRIES" ]; then
        echo -e "${YELLOW}⏳ Waiting ${RETRY_DELAY}s before next attempt...${NC}"
        echo
        sleep $RETRY_DELAY
    fi
done

# If we get here, all retries failed
echo
echo -e "${RED}💥 PRIA Environment health check FAILED after $MAX_RETRIES attempts${NC}"
echo "================================================"
echo -e "${RED}❌ Services did not start properly within the timeout period${NC}"

# Show final diagnostics
echo -e "${BLUE}🔍 Final diagnostic information:${NC}"
echo "Process list:"
ps aux | grep -E "(node|npm|vite)" | grep -v grep || echo "No relevant processes found"
echo
echo "Port status:"
netstat -tlnp | grep -E "(3008|3009)" || echo "Ports 3008/3009 not found"
echo
echo "Environment variables:"
echo "ANTHROPIC_API_KEY: $([ -n "$ANTHROPIC_API_KEY" ] && echo "Set" || echo "Not set")"
echo "GITHUB_TOKEN: $([ -n "$GITHUB_TOKEN" ] && echo "Set" || echo "Not set")"

exit 1