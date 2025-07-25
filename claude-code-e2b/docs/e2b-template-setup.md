# E2B Template Setup Guide

## 🎯 Overview

This guide walks through creating the E2B template that provides the isolated development environment for Claude Code E2B. The template includes both the API service and the Next.js frontend baseline project.

## 🏗️ E2B Template Architecture

```
E2B Sandbox Template
├── api-service/          # Express API server (Port 8080)
│   ├── src/
│   │   ├── server.ts     # Main Express server
│   │   ├── claude-service.ts
│   │   ├── git-service.ts
│   │   ├── file-service.ts
│   │   └── websocket-service.ts
│   ├── package.json
│   └── Dockerfile
├── baseline-project/     # Next.js app template (Port 3000)
│   ├── app/             # Next.js 15 App Router
│   ├── components/      # React components + shadcn/ui
│   ├── lib/            # Utilities and configurations
│   ├── package.json
│   └── next.config.js
└── e2b.toml            # E2B template configuration
```

## 📋 Prerequisites

1. **E2B Account**: Sign up at [e2b.dev](https://e2b.dev)
2. **E2B CLI**: Install the E2B CLI tool
3. **Docker**: For local template testing (optional)

## 🚀 Step 1: Install E2B CLI

```bash
# Install E2B CLI
npm install -g @e2b/cli

# Login to E2B
e2b auth login

# Verify installation
e2b --version
```

## 🏗️ Step 2: Create E2B Template Structure

```bash
# Navigate to your claude-code-e2b directory
cd /path/to/claude-code-e2b

# Create E2B template directory
mkdir e2b-template
cd e2b-template

# Create the directory structure
mkdir -p api-service/src
mkdir -p baseline-project
```

## 📝 Step 3: Create E2B Configuration

**`e2b.toml`:**
```toml
name = "claude-code-e2b"
base_image = "ubuntu:22.04"

[build]
dockerfile = "Dockerfile"

[start]
cmd = ["./start.sh"]

[ports]
3000 = "Next.js Frontend"
8080 = "API Service"

[env]
NODE_ENV = "development"
ANTHROPIC_API_KEY = "$ANTHROPIC_API_KEY"
```

## 🐳 Step 4: Create Dockerfile

**`Dockerfile`:**
```dockerfile
FROM ubuntu:22.04

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    build-essential \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs

# Set working directory
WORKDIR /code

# Copy package files first for better Docker layer caching
COPY api-service/package*.json ./api-service/
COPY baseline-project/package*.json ./baseline-project/

# Install dependencies
RUN cd api-service && npm install
RUN cd baseline-project && npm install

# Copy application code
COPY . .

# Build the API service
RUN cd api-service && npm run build

# Build the baseline project
RUN cd baseline-project && npm run build

# Create start script
COPY start.sh /code/start.sh
RUN chmod +x /code/start.sh

# Expose ports
EXPOSE 3000 8080

# Start command
CMD ["./start.sh"]
```

## 🚀 Step 5: Create Start Script

**`start.sh`:**
```bash
#!/bin/bash

# Start API service in background
cd /code/api-service
npm start &

# Start Next.js frontend
cd /code/baseline-project
npm start

# Keep container running
wait
```

## 📦 Step 6: Copy API Service Files

Copy the API service files we created earlier:

```bash
# Copy from our existing implementation
cp -r ../e2b-template/api-service/* ./api-service/
```

**Update `api-service/package.json`:**
```json
{
  "name": "claude-code-e2b-api",
  "version": "1.0.0",
  "description": "API service for Claude Code E2B",
  "main": "dist/server.js",
  "scripts": {
    "start": "node dist/server.js",
    "dev": "ts-node src/server.ts",
    "build": "tsc",
    "test": "jest"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "ws": "^8.14.2",
    "simple-git": "^3.20.0",
    "chokidar": "^3.5.3",
    "@anthropic-ai/sdk": "^0.24.3",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/express": "^4.17.17",
    "@types/cors": "^2.8.13",
    "@types/ws": "^8.5.5",
    "typescript": "^5.0.0",
    "ts-node": "^10.9.1"
  }
}
```

**`api-service/tsconfig.json`:**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## 🎨 Step 7: Create Baseline Next.js Project

```bash
# Create baseline Next.js project
cd baseline-project

# Initialize Next.js project structure
npm init -y
```

**`baseline-project/package.json`:**
```json
{
  "name": "claude-code-baseline",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@supabase/ssr": "^0.4.0",
    "@supabase/supabase-js": "^2.38.0",
    "lucide-react": "^0.263.1",
    "tailwindcss": "^3.3.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^1.14.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0",
    "typescript": "^5.0.0",
    "eslint": "^8.0.0",
    "eslint-config-next": "^15.0.0",
    "autoprefixer": "^10.0.0",
    "postcss": "^8.0.0"
  }
}
```

Copy the baseline project files from our existing PRIA baseline:

```bash
# Copy baseline structure from your PRIA baseline-project
cp -r ../../baseline-project/* ./
```

## 🔧 Step 8: Create Template Build Script

**`build-template.sh`:**
```bash
#!/bin/bash

echo "Building Claude Code E2B Template..."

# Clean previous builds
rm -rf dist/

# Install dependencies
echo "Installing API service dependencies..."
cd api-service && npm install && cd ..

echo "Installing baseline project dependencies..."
cd baseline-project && npm install && cd ..

echo "Building API service..."
cd api-service && npm run build && cd ..

echo "Building baseline project..."
cd baseline-project && npm run build && cd ..

echo "Template build complete!"
```

## 🚀 Step 9: Build and Deploy Template

```bash
# Make build script executable
chmod +x build-template.sh

# Build the template
./build-template.sh

# Create E2B template
e2b template create

# This will create a template and give you a template ID
# Example output: Template created with ID: claude-code-e2b-xyz123
```

## 🧪 Step 10: Test Template Locally

```bash
# Test the template locally
e2b sandbox create claude-code-e2b-xyz123

# This will give you a sandbox ID and URLs:
# - Frontend: https://xyz123-3000.e2b.dev
# - API: https://xyz123-8080.e2b.dev
```

## ⚙️ Step 11: Update Environment Variables

Add the template ID to your environment:

```bash
# In your .env files
E2B_TEMPLATE_ID=claude-code-e2b-xyz123
```

## 🔄 Step 12: Template Update Process

When you need to update the template:

```bash
# Make changes to your code
# Rebuild the template
./build-template.sh

# Update the E2B template
e2b template deploy

# Test the updated template
e2b sandbox create claude-code-e2b-xyz123
```

## 📊 Step 13: Template Monitoring

**Monitor template health:**
```bash
# List your templates
e2b template list

# Check template details
e2b template get claude-code-e2b-xyz123

# View sandbox logs
e2b sandbox logs <sandbox-id>
```

## 🔒 Step 14: Environment Variables in E2B

Configure sensitive environment variables in E2B:

```bash
# Set environment variables for the template
e2b template env set ANTHROPIC_API_KEY your_api_key_here
e2b template env set SUPABASE_URL your_supabase_url
e2b template env set SUPABASE_ANON_KEY your_supabase_anon_key
```

## 🐛 Troubleshooting

**Template Build Issues:**
```bash
# Check Docker build locally
docker build -t claude-code-e2b .
docker run -p 3000:3000 -p 8080:8080 claude-code-e2b

# Check E2B logs
e2b template logs claude-code-e2b-xyz123
```

**Sandbox Connection Issues:**
```bash
# Test API connectivity
curl https://xyz123-8080.e2b.dev/health

# Test frontend
curl https://xyz123-3000.e2b.dev
```

## 📝 Template Configuration Options

**Advanced `e2b.toml` configuration:**
```toml
name = "claude-code-e2b"
base_image = "ubuntu:22.04"

[build]
dockerfile = "Dockerfile"

[start]
cmd = ["./start.sh"]

[ports]
3000 = "Next.js Frontend"
8080 = "API Service"

[env]
NODE_ENV = "development"

[resources]
cpu = 2
memory = 4096

[timeout]
build = 600  # 10 minutes
start = 120  # 2 minutes

[metadata]
description = "Claude Code E2B development environment"
version = "1.0.0"
```

## ✅ Template Validation Checklist

Before deploying:

- [ ] Template builds successfully
- [ ] Both ports (3000, 8080) are accessible
- [ ] API service starts and responds to health checks
- [ ] Next.js frontend loads and displays correctly
- [ ] Environment variables are properly configured
- [ ] File system operations work
- [ ] Git operations function
- [ ] WebSocket connections establish
- [ ] Template can be destroyed and recreated

Once your E2B template is created and tested, you'll have the `E2B_TEMPLATE_ID` to use in your integration!