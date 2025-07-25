#!/bin/bash

# Start Services Script for Claude Code E2B Integration
# This script starts both the API service and the Next.js development server

set -e

echo "🚀 Starting Claude Code E2B Services..."
echo "📅 $(date)"
echo "📁 Working directory: $(pwd)"

# Function to handle cleanup on exit
cleanup() {
    echo "🛑 Shutting down services..."
    if [ ! -z "$API_PID" ]; then
        kill $API_PID 2>/dev/null || true
    fi
    if [ ! -z "$DEV_INTERFACE_PID" ]; then
        kill $DEV_INTERFACE_PID 2>/dev/null || true
    fi
    if [ ! -z "$USER_APP_PID" ]; then
        kill $USER_APP_PID 2>/dev/null || true
    fi
    exit 0
}

# Set up signal handlers
trap cleanup SIGTERM SIGINT

# Set environment variables
export NODE_ENV=${NODE_ENV:-development}
export API_PORT=${API_PORT:-8080}
export DEV_INTERFACE_PORT=${DEV_INTERFACE_PORT:-3000}  # Claude Code development interface
export USER_APP_PORT=${USER_APP_PORT:-4000}  # User's actual app
export PROJECT_ROOT=${PROJECT_ROOT:-/code/baseline-project}
export USER_APP_ROOT=${USER_APP_ROOT:-/code/user-app}

# Set default ANTHROPIC_API_KEY if not provided (allows service to start)
export ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-sk-ant-placeholder-key-for-e2b}

# Ensure required directories exist
mkdir -p /code/logs
mkdir -p /code/repos
mkdir -p $PROJECT_ROOT

# Clean up any existing git initialization to prevent conflicts
if [ -d "$PROJECT_ROOT/.git" ]; then
    echo "🧹 Cleaning existing git repository..."
    rm -rf "$PROJECT_ROOT/.git"
fi

# Display API key status
if [ "$ANTHROPIC_API_KEY" = "sk-ant-placeholder-key-for-e2b" ]; then
    echo "⚠️  Using placeholder API key - Claude functionality will be limited"
    echo "💡 Set ANTHROPIC_API_KEY environment variable for full functionality"
else
    echo "✅ ANTHROPIC_API_KEY configured"
fi

# Build the API service
echo "🔨 Building API service..."
cd /code/api-service

# Check if build is needed
if [ ! -d "dist" ] || [ ! -f "dist/server.js" ]; then
    echo "📦 Building API service..."
    npm run build
    if [ $? -ne 0 ]; then
        echo "❌ API service build failed"
        exit 1
    fi
else
    echo "✅ API service already built"
fi

# Start the API service
echo "🌐 Starting API service on port $API_PORT..."
npm start > /code/logs/api-service.log 2>&1 &
API_PID=$!

# Wait a moment for the API service to start
sleep 3

# Check if API service is running
if ! kill -0 $API_PID 2>/dev/null; then
    echo "❌ API service failed to start"
    cat /code/logs/api-service.log
    exit 1
fi

echo "✅ API service started (PID: $API_PID)"

# Set up Claude Code development interface (port 3000)
echo "📦 Setting up Claude Code development interface..."
cd $PROJECT_ROOT

# Ensure development interface directory exists
if [ ! -d "$PROJECT_ROOT" ]; then
    echo "❌ Development interface directory not found: $PROJECT_ROOT"
    exit 1
fi

# Install dependencies for development interface if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing development interface dependencies..."
    npm install --legacy-peer-deps
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install development interface dependencies"
        exit 1
    fi
    
    # Install Playwright browsers for testing (done at runtime for E2B)
    echo "🎭 Installing Playwright browsers at runtime..."
    npx playwright install > /dev/null 2>&1 &
    echo "📋 Playwright browser installation started in background"
fi

# Ensure the development interface uses port 3000
if [ -f "$PROJECT_ROOT/package.json" ]; then
    echo "🔧 Updating development interface to use port $DEV_INTERFACE_PORT..."
    sed -i "s/next dev -p [0-9]*/next dev -p $DEV_INTERFACE_PORT/g" package.json
    sed -i "s/next start -p [0-9]*/next start -p $DEV_INTERFACE_PORT/g" package.json
fi

# Set up user app (port 4000)
echo "📦 Setting up user application..."
cd $USER_APP_ROOT

# Ensure user app directory exists
if [ ! -d "$USER_APP_ROOT" ]; then
    echo "❌ User app directory not found: $USER_APP_ROOT"
    exit 1
fi

# Install dependencies for user app if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing user app dependencies..."
    npm install --legacy-peer-deps
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install user app dependencies"
        exit 1
    fi
fi

# Ensure the user app uses port 4000
if [ -f "$USER_APP_ROOT/package.json" ]; then
    echo "🔧 Updating user app to use port $USER_APP_PORT..."
    sed -i "s/next dev -p [0-9]*/next dev -p $USER_APP_PORT/g" package.json
    sed -i "s/next start -p [0-9]*/next start -p $USER_APP_PORT/g" package.json
fi

# If package.json doesn't exist, create it
if [ ! -f "$PROJECT_ROOT/package.json" ]; then
    
    # Copy baseline project files if they exist, otherwise create minimal setup
    if [ -d "/code/baseline-project-template" ]; then
        cp -r /code/baseline-project-template/* .
    else
        # Create minimal Next.js setup
        cat > package.json << EOF
{
  "name": "claude-code-e2b-project",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p $NEXT_PORT",
    "build": "next build",
    "start": "next start -p $NEXT_PORT",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "15.0.0",
    "react": "19.0.0",
    "react-dom": "19.0.0"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "eslint": "^8",
    "eslint-config-next": "15.0.0",
    "typescript": "^5"
  }
}
EOF

        # Create basic app structure
        mkdir -p app components lib public
        
        cat > app/layout.tsx << EOF
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
EOF

        cat > app/page.tsx << EOF
export default function Home() {
  return (
    <main className="container mx-auto p-8">
      <h1 className="text-4xl font-bold mb-4">Claude Code E2B Integration</h1>
      <p className="text-lg mb-4">
        Welcome to your Claude Code development environment! 
        This project is running in an E2B container with full Claude Code integration.
      </p>
      <div className="bg-gray-100 p-4 rounded-lg">
        <h2 className="text-xl font-semibold mb-2">Available Features:</h2>
        <ul className="list-disc list-inside space-y-1">
          <li>Direct Claude Code integration via API</li>
          <li>Real-time file watching and updates</li>
          <li>Git operations and version control</li>
          <li>Project management and deployment</li>
        </ul>
      </div>
    </main>
  )
}
EOF

        cat > next.config.js << EOF
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: []
  }
}

module.exports = nextConfig
EOF
    fi
    
    # Install dependencies
    echo "📦 Installing Next.js dependencies..."
    npm install --legacy-peer-deps
fi

# Start the Claude Code development interface (port 3000)
echo "⚛️  Starting Claude Code development interface on port $DEV_INTERFACE_PORT..."
cd $PROJECT_ROOT
npm run dev > /code/logs/dev-interface.log 2>&1 &
DEV_INTERFACE_PID=$!

# Start the user application (port 4000)
echo "⚛️  Starting user application on port $USER_APP_PORT..."
cd $USER_APP_ROOT
npm run dev > /code/logs/user-app.log 2>&1 &
USER_APP_PID=$!

# Wait a moment for both services to start
sleep 10

# Check if development interface is running
if ! kill -0 $DEV_INTERFACE_PID 2>/dev/null; then
    echo "❌ Claude Code development interface failed to start"
    cat /code/logs/dev-interface.log
    cleanup
    exit 1
fi

echo "✅ Claude Code development interface started (PID: $DEV_INTERFACE_PID)"

# Check if user app is running
if ! kill -0 $USER_APP_PID 2>/dev/null; then
    echo "❌ User application failed to start"
    cat /code/logs/user-app.log
    cleanup
    exit 1
fi

echo "✅ User application started (PID: $USER_APP_PID)"

# Health check
echo "🏥 Performing health checks..."

# Check API service
API_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$API_PORT/health || echo "000")
if [ "$API_HEALTH" = "200" ]; then
    echo "✅ API service health check passed"
else
    echo "❌ API service health check failed (HTTP $API_HEALTH)"
fi

# Check Claude Code development interface (port 3000)
echo "⏳ Waiting for Claude Code development interface to be ready..."
DEV_INTERFACE_READY=false
for i in {1..30}; do
    DEV_INTERFACE_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$DEV_INTERFACE_PORT || echo "000")
    if [ "$DEV_INTERFACE_HEALTH" = "200" ]; then
        DEV_INTERFACE_READY=true
        break
    fi
    sleep 2
done

if [ "$DEV_INTERFACE_READY" = true ]; then
    echo "✅ Claude Code development interface health check passed"
else
    echo "❌ Claude Code development interface health check failed"
fi

# Check user application (port 4000)
echo "⏳ Waiting for user application to be ready..."
USER_APP_READY=false
for i in {1..30}; do
    USER_APP_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$USER_APP_PORT || echo "000")
    if [ "$USER_APP_HEALTH" = "200" ]; then
        USER_APP_READY=true
        break
    fi
    sleep 2
done

if [ "$USER_APP_READY" = true ]; then
    echo "✅ User application health check passed"
else
    echo "❌ User application health check failed"
fi

# Display service information
echo ""
echo "🎉 Claude Code E2B Services are now running!"
echo "┌─────────────────────────────────────────────────────┐"
echo "│                 Service Information                 │"
echo "├─────────────────────────────────────────────────────┤"
echo "│ API Service:      http://localhost:$API_PORT          │"
echo "│ Dev Interface:    http://localhost:$DEV_INTERFACE_PORT  │"
echo "│ User App:         http://localhost:$USER_APP_PORT       │"
echo "│ Health Check:     http://localhost:$API_PORT/health    │"
echo "│ WebSocket:        ws://localhost:$API_PORT             │"
echo "├─────────────────────────────────────────────────────┤"
echo "│ Logs:             /code/logs/                       │"
echo "│ Dev Interface:    $PROJECT_ROOT          │"
echo "│ User App:         $USER_APP_ROOT                │"
echo "│ API PID:          $API_PID                           │"
echo "│ Dev Interface PID: $DEV_INTERFACE_PID                 │"
echo "│ User App PID:     $USER_APP_PID                       │"
echo "└─────────────────────────────────────────────────────┘"
echo ""

# Keep the script running and monitor processes
echo "👀 Monitoring services... (Press Ctrl+C to stop)"

while true; do
    # Check if API service is still running
    if ! kill -0 $API_PID 2>/dev/null; then
        echo "❌ API service died, shutting down..."
        cleanup
        exit 1
    fi
    
    # Check if development interface is still running
    if ! kill -0 $DEV_INTERFACE_PID 2>/dev/null; then
        echo "❌ Claude Code development interface died, shutting down..."
        cleanup
        exit 1
    fi
    
    # Check if user app is still running
    if ! kill -0 $USER_APP_PID 2>/dev/null; then
        echo "❌ User application died, shutting down..."
        cleanup
        exit 1
    fi
    
    sleep 10
done