# E2B Sandbox Template for Claude Code UI
# Must use Debian-based base image
FROM e2bdev/code-interpreter:latest

# Install Node.js 20 and system dependencies as root first
USER root
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get update && \
    apt-get install -y nodejs git gh inotify-tools python3 python3-pip make g++ coreutils procps grep findutils util-linux && \
    rm -rf /var/lib/apt/lists/* && \
    # Ensure Node.js is in global PATH for all users
    ln -sf /usr/bin/node /usr/local/bin/node && \
    ln -sf /usr/bin/npm /usr/local/bin/npm && \
    # Create system-wide npm global directory
    mkdir -p /usr/local/lib/npm-global && \
    npm config set prefix '/usr/local/lib/npm-global' -g && \
    echo 'export PATH="/usr/local/lib/npm-global/bin:$PATH"' >> /etc/profile

# Set global PATH to include system-wide installations
ENV PATH="/usr/local/lib/npm-global/bin:/usr/local/bin:/home/user/.npm-global/bin:/home/user/.local/bin:$PATH"

# Create directory for the application
WORKDIR /home/user

# Copy pre-modified claudecodeui instead of cloning and patching
COPY modified-claudecodeui/ /home/user/claudecodeui/

# Install dependencies
WORKDIR /home/user/claudecodeui
RUN npm install

# Create .env file with default configuration and API key
RUN echo "PORT=3008" > .env && \
    echo "VITE_PORT=3009" >> .env && \
    echo "NODE_ENV=production" >> .env && \
    echo "ANTHROPIC_API_KEY=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" >> .env

# Create enhanced vite.config.js for iframe websocket support
RUN cat > vite.config.js << 'EOF'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',                // Bind to all interfaces
      port: parseInt(env.VITE_PORT) || 3009,
      strictPort: true,
      allowedHosts: ['.e2b.app', '.localhost', 'localhost'], // Critical E2B fix
      cors: true,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*'
      },
      hmr: {
        port: parseInt(env.VITE_PORT) || 3009,
        host: '0.0.0.0',
        clientPort: parseInt(env.VITE_PORT) || 3009,
        protocol: 'wss'              // Use secure websockets
      },
      watch: {
        usePolling: true,            // Required for container environments
        interval: 1000,
        ignored: ['**/node_modules/**', '**/.git/**']
      },
      proxy: {
        '/ws': {
          target: 'ws://localhost:3008',
          ws: true,
          changeOrigin: true,
          rewriteWsOrigin: true,     // Critical for iframe websockets
          secure: false
        },
        '/api': {
          target: `http://localhost:${env.PORT || 3008}`,
          changeOrigin: true,
          secure: false
        }
      }
    },
    preview: {
      host: '0.0.0.0',
      port: parseInt(env.VITE_PORT) || 3009,
      cors: true
    },
    build: {
      outDir: 'dist'
    }
  }
})
EOF

# Also modify package.json to use --host flag
RUN sed -i 's/"dev": "npm run client"/"dev": "npm run client -- --host"/' package.json || \
    sed -i 's/"client": "vite"/"client": "vite --host"/' package.json

# Add sync scripts and PRIA integration first
COPY scripts/ /home/user/scripts/
RUN chmod +x /home/user/scripts/*.sh

# Ensure enhanced health check is available
RUN ln -sf /home/user/scripts/health-check-enhanced.sh /home/user/health-check-enhanced.sh

# Server patching no longer needed - using pre-modified claudecodeui

# Inject PRIA integration into frontend
RUN node /home/user/scripts/inject-pria-integration.js

# Build claudecodeui for production BEFORE switching directories
RUN npm run build

# Inject PRIA branding into the built frontend
# Copy branding assets to dist folder
RUN cp /home/user/scripts/pria-branding.js /home/user/claudecodeui/dist/pria-branding.js && \
    cp /home/user/scripts/pria-branding.css /home/user/claudecodeui/dist/pria-branding.css && \
    # Inject CSS in head for immediate styling
    sed -i 's|</head>|<link rel="stylesheet" href="/pria-branding.css"></head>|' /home/user/claudecodeui/dist/index.html && \
    # Inject JS before closing body tag for dynamic replacements
    sed -i 's|</body>|<script src="/pria-branding.js"></script></body>|' /home/user/claudecodeui/dist/index.html

# Create baseline Next.js template directly
WORKDIR /home/user
RUN mkdir -p baseline-project
WORKDIR /home/user/baseline-project

# Create a minimal Next.js template with PRIA structure
RUN cat > package.json << 'EOF'
{
  "name": "pria-baseline-nextjs",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "react": "^18",
    "react-dom": "^18",
    "next": "14.2.4"
  },
  "devDependencies": {
    "typescript": "^5",
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "eslint": "^8",
    "eslint-config-next": "14.2.4",
    "tailwindcss": "^3.4.1",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38"
  }
}
EOF

# Create app directory structure
RUN mkdir -p app

# Create layout.tsx
RUN cat > app/layout.tsx << 'EOF'
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PRIA App',
  description: 'Created with PRIA App Builder',
}

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

# Create page.tsx
RUN cat > app/page.tsx << 'EOF'
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex">
        <p className="fixed left-0 top-0 flex w-full justify-center border-b border-gray-300 bg-gradient-to-b from-zinc-200 pb-6 pt-8 backdrop-blur-2xl dark:border-neutral-800 dark:bg-zinc-800/30 dark:from-inherit lg:static lg:w-auto  lg:rounded-xl lg:border lg:bg-gray-200 lg:p-4 lg:dark:bg-zinc-800/30">
          Built with&nbsp;
          <code className="font-mono font-bold">PRIA App Builder</code>
        </p>
      </div>

      <div className="relative flex place-items-center">
        <h1 className="text-4xl font-bold">Welcome to Your PRIA App</h1>
      </div>

      <div className="mb-32 grid text-center lg:max-w-5xl lg:w-full lg:mb-0 lg:grid-cols-4 lg:text-left">
        <div className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30">
          <h2 className="mb-3 text-2xl font-semibold">
            Develop
          </h2>
          <p className="m-0 max-w-[30ch] text-sm opacity-50">
            Use Claude Code CLI to build your application with AI assistance.
          </p>
        </div>

        <div className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30">
          <h2 className="mb-3 text-2xl font-semibold">
            Deploy
          </h2>
          <p className="m-0 max-w-[30ch] text-sm opacity-50">
            Deploy your app to Vercel with automatic CI/CD integration.
          </p>
        </div>

        <div className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30">
          <h2 className="mb-3 text-2xl font-semibold">
            Sessions
          </h2>
          <p className="m-0 max-w-[30ch] text-sm opacity-50">
            Your Claude conversations are automatically saved to Git.
          </p>
        </div>

        <div className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30">
          <h2 className="mb-3 text-2xl font-semibold">
            Collaborate
          </h2>
          <p className="m-0 max-w-[30ch] text-sm opacity-50">
            Share your development context across team members.
          </p>
        </div>
      </div>
    </main>
  )
}
EOF

# Create globals.css
RUN cat > app/globals.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --foreground-rgb: 0, 0, 0;
  --background-start-rgb: 214, 219, 220;
  --background-end-rgb: 255, 255, 255;
}

@media (prefers-color-scheme: dark) {
  :root {
    --foreground-rgb: 255, 255, 255;
    --background-start-rgb: 0, 0, 0;
    --background-end-rgb: 0, 0, 0;
  }
}

body {
  color: rgb(var(--foreground-rgb));
  background: linear-gradient(
      to bottom,
      transparent,
      rgb(var(--background-end-rgb))
    )
    rgb(var(--background-start-rgb));
}
EOF

# Create Next.js config
RUN cat > next.config.js << 'EOF'
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
}

module.exports = nextConfig
EOF

# Create TypeScript config
RUN cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "es6"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
EOF

# Create Tailwind config
RUN cat > tailwind.config.js << 'EOF'
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
EOF

# Create PostCSS config
RUN cat > postcss.config.js << 'EOF'
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
EOF

# Create .gitignore for baseline template
RUN cat > .gitignore << 'EOF'
# Dependencies
/node_modules
/.pnp
.pnp.js
.yarn/install-state.gz

# Testing
/coverage

# Next.js
/.next/
/out/

# Production
/build

# Misc
.DS_Store
*.pem

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Local env files
.env*.local
.env

# Vercel
.vercel

# TypeScript
*.tsbuildinfo
next-env.d.ts

# IDE
.vscode/
.idea/
*.swp
*.swo

# IMPORTANT: Include .claude directory for session persistence
!.claude/
!.claude/**

# .pria directory for project metadata
!.pria/
!.pria/**
EOF

# Create .gitattributes
RUN cat > .gitattributes << 'EOF'
# Git attributes for PRIA project

# Claude session files should use 'ours' merge strategy to prevent conflicts
.claude/projects/*.jsonl merge=ours
.claude/todos/*.json merge=ours

# PRIA metadata files
.pria/project.json merge=ours
.pria/workspace.json merge=ours

# Ensure line endings are consistent
*.ts text eol=lf
*.tsx text eol=lf
*.js text eol=lf
*.jsx text eol=lf
*.json text eol=lf
*.md text eol=lf
*.css text eol=lf
*.scss text eol=lf

# Binary files
*.png binary
*.jpg binary
*.jpeg binary
*.gif binary
*.ico binary
*.svg binary
EOF

# Create PRIA directories and README files
RUN mkdir -p .claude/projects .claude/todos .pria

RUN cat > .claude/README.md << 'EOF'
# Claude Session Directory

This directory contains Claude Code CLI session data for persistent development context.

## Structure

- `projects/` - Contains conversation history files (*.jsonl)
- `todos/` - Contains todo lists and task tracking (*.json)

## Purpose

When working with PRIA App Builder, Claude sessions are automatically synchronized to this directory to maintain development context across E2B sandbox recreations and session restores.
EOF

RUN cat > .pria/README.md << 'EOF'
# PRIA Project Metadata

This directory contains PRIA-specific project configuration and metadata.

## Files

- `project.json` - Project configuration and metadata
- `workspace.json` - Workspace settings and preferences  
- `sync-config.json` - GitHub synchronization settings
EOF

# Install dependencies for baseline project
RUN npm install

# Create projects directory 
RUN mkdir -p /home/user/projects

# Configure npm to use user-writable directory for global packages
RUN mkdir -p /home/user/.npm-global && \
    npm config set prefix '/home/user/.npm-global' && \
    echo 'export PATH=/home/user/.npm-global/bin:$PATH' >> /home/user/.bashrc

# Install Claude CLI globally (system-wide for E2B compatibility)
RUN npm config set prefix '/usr/local/lib/npm-global' && \
    npm install -g @anthropic-ai/claude-code@latest && \
    # Create symlink in /usr/local/bin for all users
    ln -sf /usr/local/lib/npm-global/bin/claude /usr/local/bin/claude

# Copy initialization scripts
COPY scripts/ /home/user/scripts/
RUN chmod +x /home/user/scripts/*.sh

# Setup Claude CLI with API key
RUN /home/user/scripts/setup-claude-cli.sh

# Set environment variables for services
ENV PORT=3008
ENV VITE_PORT=3009
ENV NODE_ENV=production
ENV SKIP_AUTH=true
# Set Anthropic API key as environment variable for all processes
ENV ANTHROPIC_API_KEY=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

# GitHub token can still be provided at build time
ARG GITHUB_TOKEN=""
ARG SUPABASE_URL=""
ARG SUPABASE_ANON_KEY=""
ARG SUPABASE_SERVICE_ROLE_KEY=""

# Set environment variables (Anthropic API key is already set above)
ENV GITHUB_TOKEN=$GITHUB_TOKEN
ENV SUPABASE_URL=$SUPABASE_URL
ENV SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
ENV SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY

# Make startup scripts executable
RUN chmod +x /home/user/scripts/*.sh

# Create main startup script (simple version for Dockerfile, enhanced version available separately)
RUN cat > /home/user/start-all-services.sh << 'EOF'
#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting PRIA Development Environment${NC}"

# If running as root, switch to user for the entire script
if [ "$(id -u)" = "0" ]; then
    echo -e "${BLUE}⚠️  Running as root, switching to user context${NC}"
    # Re-exec this script as the user
    exec sudo -u user -H --preserve-env=ANTHROPIC_API_KEY "$0" "$@"
fi

# Run post-user setup first  
if [ -f "/home/user/scripts/post-user-setup.sh" ]; then
    echo -e "${BLUE}🔧 Running post-user setup...${NC}"
    /bin/bash /home/user/scripts/post-user-setup.sh
fi

# Check required environment variables
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo -e "${RED}⚠️  ANTHROPIC_API_KEY not set${NC}"
fi

if [ -z "$GITHUB_TOKEN" ]; then
    echo -e "${RED}⚠️  GITHUB_TOKEN not set (GitHub integration will be limited)${NC}"
fi

# Verify Claude CLI installation (but don't create sessions)
echo -e "${BLUE}🔍 Verifying Claude CLI installation...${NC}"

# Ensure PATH includes both system-wide and user installations AND system directories
export PATH="/usr/local/lib/npm-global/bin:/usr/local/bin:/home/user/.npm-global/bin:/home/user/.local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

if command -v claude >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Claude CLI is available: $(claude --version 2>&1 | head -1)${NC}"
    
    # Verify API key configuration
    if [ -f "/home/user/.config/claude/config.json" ]; then
        echo -e "${GREEN}✅ Claude config file exists${NC}"
    fi
    
    if [ -n "$ANTHROPIC_API_KEY" ]; then
        echo -e "${GREEN}✅ ANTHROPIC_API_KEY is set${NC}"
    else
        echo -e "${YELLOW}⚠️  ANTHROPIC_API_KEY not set - Claude CLI may not work${NC}"
    fi
else
    echo -e "${RED}❌ Claude CLI not found in PATH${NC}"
fi

# Note: Project initialization will happen via Instance API when sandbox is actually used
echo -e "${BLUE}ℹ️  Claude project initialization deferred to runtime (via Instance API)${NC}"

# Start claudecodeui services in production mode
echo -e "${BLUE}🚀 Starting claudecodeui services (production mode)...${NC}"
cd /home/user/claudecodeui

# Start API server
npm run server > /tmp/claudecodeui-api.log 2>&1 &
API_PID=$!
echo -e "${GREEN}✅ API Server started with PID: $API_PID${NC}"

# Wait for API server to start
node -e "setTimeout(() => process.exit(0), 2000)" 2>/dev/null || echo "Sleep replacement used"

# Start frontend using Vite preview
npx vite preview --port 3009 --host 0.0.0.0 > /tmp/claudecodeui-frontend.log 2>&1 &
FRONTEND_PID=$!
echo -e "${GREEN}✅ Frontend started with PID: $FRONTEND_PID${NC}"

# Wait for services to initialize
node -e "setTimeout(() => process.exit(0), 4000)" 2>/dev/null || echo "Sleep replacement used"

echo -e "${GREEN}📋 claudecodeui Frontend: http://localhost:3009${NC}"
echo -e "${GREEN}🔧 API Server: http://localhost:3008${NC}"
echo -e "${GREEN}📁 Projects: /home/user/projects${NC}"
echo -e "${GREEN}🧠 Claude Sessions: /home/user/.claude${NC}"

# Function to handle shutdown
cleanup() {
    echo -e "${BLUE}🛑 Shutting down services...${NC}"
    kill $API_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit 0
}

# Handle shutdown signals
trap cleanup SIGINT SIGTERM

# Keep script running and monitor services
while true; do
    # Check API server
    if ! kill -0 $API_PID 2>/dev/null; then
        echo -e "${RED}❌ API server crashed, restarting...${NC}"
        cd /home/user/claudecodeui
        npm run server > /tmp/claudecodeui-api.log 2>&1 &
        API_PID=$!
    fi
    
    # Check frontend server
    if ! kill -0 $FRONTEND_PID 2>/dev/null; then
        echo -e "${RED}❌ Frontend crashed, restarting...${NC}"
        cd /home/user/claudecodeui
        npx vite preview --port 3009 --host 0.0.0.0 > /tmp/claudecodeui-frontend.log 2>&1 &
        FRONTEND_PID=$!
    fi
    
    # Sleep for 30 seconds using Node.js since sleep command might not be available
    node -e "setTimeout(() => process.exit(0), 30000)" 2>/dev/null || echo "Sleep failed, continuing..."
done
EOF

RUN chmod +x /home/user/start-all-services.sh

# Create health check script
RUN cat > /home/user/health-check.sh << 'EOF'
#!/bin/bash

echo "🔍 PRIA Environment Health Check"
echo "================================"

# Check services
echo "📡 Checking claudecodeui server (port 3008)..."
if curl -s http://localhost:3008/api/github/status/test >/dev/null; then
    echo "✅ Server: Running"
else
    echo "❌ Server: Not responding"
fi

echo "🌐 Checking claudecodeui frontend (port 3009)..."
if curl -s http://localhost:3009 >/dev/null 2>&1; then
    echo "✅ Frontend: Running"
else
    echo "❌ Frontend: Not responding"
fi

# Check CLI tools
echo "🧠 Checking Claude Code CLI..."
if command -v claude >/dev/null 2>&1; then
    echo "✅ Claude CLI: Available"
    claude --version 2>/dev/null || echo "⚠️  Claude CLI: Not authenticated"
else
    echo "❌ Claude CLI: Not found"
fi

echo "📂 Checking Git..."
if command -v git >/dev/null 2>&1; then
    echo "✅ Git: Available"
else
    echo "❌ Git: Not found"
fi

echo "🐙 Checking GitHub CLI..."
if command -v gh >/dev/null 2>&1; then
    echo "✅ GitHub CLI: Available"
else
    echo "❌ GitHub CLI: Not found"
fi

# Check directories
echo "📁 Checking directories..."
[ -d "/home/user/projects" ] && echo "✅ Projects directory: Exists" || echo "❌ Projects directory: Missing"
[ -d "/home/user/.claude" ] && echo "✅ Claude directory: Exists" || echo "❌ Claude directory: Missing"
[ -d "/home/user/.claude/projects" ] && echo "✅ Claude projects directory: Exists" || echo "❌ Claude projects directory: Missing"
[ -d "/home/user/baseline-project" ] && echo "✅ Baseline template: Available" || echo "❌ Baseline template: Missing"

# Check if project-config.json exists (needed by claudecodeui)
[ -f "/home/user/.claude/project-config.json" ] && echo "✅ Project config file: Exists" || echo "⚠️  Project config file: Missing (will be created on first use)"

echo "================================"

# Environment variables check
echo "🔧 Environment Variables:"
[ -n "$ANTHROPIC_API_KEY" ] && echo "✅ ANTHROPIC_API_KEY: Set (${#ANTHROPIC_API_KEY} chars)" || echo "❌ ANTHROPIC_API_KEY: Not set"
[ -n "$GITHUB_TOKEN" ] && echo "✅ GITHUB_TOKEN: Set" || echo "❌ GITHUB_TOKEN: Not set"
[ -n "$SUPABASE_URL" ] && echo "✅ SUPABASE_URL: Set" || echo "❌ SUPABASE_URL: Not set"
[ -n "$SUPABASE_ANON_KEY" ] && echo "✅ SUPABASE_ANON_KEY: Set" || echo "❌ SUPABASE_ANON_KEY: Not set"

echo "================================"
EOF

RUN chmod +x /home/user/health-check.sh

# Create all user directories, configs, and wrapper files as root first
RUN mkdir -p /home/user/.config/claude /home/user/.claude/projects /home/user/bin && \
    echo '{"anthropicApiKey": "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"}' > /home/user/.config/claude/config.json && \
    echo "export ANTHROPIC_API_KEY='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'" >> /home/user/.bashrc && \
    echo "export PATH='/usr/local/lib/npm-global/bin:/usr/local/bin:/home/user/.npm-global/bin:/home/user/.local/bin:/usr/bin:/bin:/usr/sbin:/sbin:\$PATH'" >> /home/user/.bashrc && \
    # Create Claude command wrapper that ensures proper user execution
    echo '#!/bin/bash' > /home/user/claude-wrapper && \
    echo '# Ensure clean non-root execution for Claude CLI' >> /home/user/claude-wrapper && \
    echo 'if [ "$(id -u)" = "0" ]; then' >> /home/user/claude-wrapper && \
    echo '    echo "ERROR: claude-wrapper should not run as root" >&2' >> /home/user/claude-wrapper && \
    echo '    exit 1' >> /home/user/claude-wrapper && \
    echo 'fi' >> /home/user/claude-wrapper && \
    echo '# Clean sudo environment variables' >> /home/user/claude-wrapper && \
    echo 'unset SUDO_USER SUDO_UID SUDO_GID SUDO_COMMAND' >> /home/user/claude-wrapper && \
    echo 'export USER=user' >> /home/user/claude-wrapper && \
    echo 'export HOME=/home/user' >> /home/user/claude-wrapper && \
    echo 'exec /usr/local/bin/claude "$@"' >> /home/user/claude-wrapper && \
    chmod +x /home/user/claude-wrapper && \
    ln -sf /home/user/claude-wrapper /home/user/bin/claude && \
    ln -sf /usr/local/bin/claude /home/user/bin/pria && \
    # Give user ownership of all created files and directories
    chown -R 1000:1000 /home/user/.config /home/user/.claude /home/user/bin /home/user/.bashrc /home/user/claude-wrapper 2>/dev/null || true && \
    echo "All user files created and ownership set"

# Switch to non-root user for runtime (required for --dangerously-skip-permissions)  
USER 1000

# Set working directory back to user home
WORKDIR /home/user

# Ensure npm-global bin is in PATH for Claude CLI access
ENV PATH="/usr/local/lib/npm-global/bin:/usr/local/bin:/home/user/.npm-global/bin:/home/user/.local/bin:${PATH}"
ENV HOME="/home/user"

# Test Claude CLI access and API key configuration for UID 1000 user
RUN echo "Testing Claude CLI access for UID 1000..." && \
    echo "System-wide Claude CLI: $(/usr/local/bin/claude --version 2>&1 | cut -c1-100 || echo 'failed')" && \
    echo "PATH Claude CLI: $(claude --version 2>&1 | cut -c1-100 || echo 'failed')" && \
    echo "✅ Claude CLI setup completed for UID 1000"

# Make scripts executable  
RUN chmod +x /home/user/scripts/create-default-project.sh /home/user/scripts/fix-claude-command.sh 2>/dev/null || true

# The start command will be defined in e2b.toml