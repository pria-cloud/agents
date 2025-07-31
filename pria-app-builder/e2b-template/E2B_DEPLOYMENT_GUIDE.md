# PRIA E2B Template Deployment Guide

This guide provides comprehensive instructions for building and deploying the PRIA E2B template for Target App generation.

## 🏗️ Template Overview

The PRIA E2B template provides a complete development environment for generating PRIA-compliant Next.js applications with:

- **Node.js 22 LTS** with npm and development tools
- **Claude Code SDK** for AI-powered code generation
- **Git & GitHub CLI** for version control integration
- **PRIA Context System** for Builder App communication
- **Next.js 15 + TypeScript** foundation with PRIA compliance patterns
- **Comprehensive development scripts** for workflow automation

## 📋 Prerequisites

### 1. E2B CLI Installation

```bash
# Install E2B CLI via npm
npm install -g @e2b/cli

# Or via Homebrew (macOS)
brew install e2b
```

### 2. Authentication Setup

```bash
# Login to E2B
e2b auth login
```

### 3. Environment Variables (Builder App)

Ensure these environment variables are available in your Builder App:

```bash
# Required for E2B integration
E2B_API_KEY=your_e2b_api_key

# Template identification
PRIA_E2B_TEMPLATE_ID=pria-dev-env

# Optional: Team configuration
E2B_TEAM_ID=your_team_id
```

## 🚀 Template Build Process

### Step 1: Navigate to Template Directory

```bash
cd e2b-template
```

### Step 2: Verify Template Structure

Ensure your template includes all required files:

```
e2b-template/
├── e2b.Dockerfile          # ✅ Docker image definition
├── e2b.toml                # ✅ E2B template configuration
├── scripts/
│   ├── startup.sh          # ✅ Container initialization
│   ├── init-pria-project.sh
│   ├── claude-runner.sh
│   └── github-sync.sh
├── .pria/
│   └── scripts/
│       ├── init.js         # ✅ PRIA context initialization
│       ├── sync-with-builder.js
│       ├── update-progress.js
│       └── validate-compliance.js
├── app/                    # ✅ Next.js application structure
├── components/             # ✅ shadcn/ui components
├── lib/                    # ✅ Utility libraries and Supabase clients
├── package.json            # ✅ Dependencies and scripts
├── next.config.js          # ✅ Next.js configuration
├── tailwind.config.js      # ✅ Tailwind CSS configuration
├── tsconfig.json           # ✅ TypeScript configuration
├── middleware.ts           # ✅ PRIA authentication middleware
├── CLAUDE.md               # ✅ Claude Code SDK instructions
└── E2B_DEPLOYMENT_GUIDE.md # ✅ This file
```

### Step 3: Build the Template

```bash
# Basic build command
e2b template build

# Build with specific configuration
e2b template build \
  --name pria-dev-env \
  --dockerfile e2b.Dockerfile \
  --cpu-count 2 \
  --memory-mb 2048
```

### Step 4: Verify Build Success

```bash
# List available templates
e2b template list

# Look for your template in the output
# Example output:
# ┌────────────────┬─────────────────────────────┬─────────────────────────────┬─────────────────────────────┐
# │ Template ID    │   Template Alias            │          Built At           │            Dockerfile       │
# ├────────────────┼─────────────────────────────┼─────────────────────────────┼─────────────────────────────┤
# │ abcd1234       │   pria-dev-env              │    2025-01-28T10:30:00Z     │       e2b.Dockerfile        │
# └────────────────┴─────────────────────────────┴─────────────────────────────┴─────────────────────────────┘
```

### Step 5: Test Template Creation

```bash
# Create a test sandbox
e2b sandbox create pria-dev-env

# Expected output:
# Sandbox created successfully
# Sandbox ID: sandbox_abc123
# Connect at: https://your-sandbox-url
```

## 🔧 Template Configuration Details

### E2B.toml Configuration

The template uses the following configuration:

```toml
[template]
name = "pria-dev-env"
description = "PRIA development environment with Node.js 22, Claude Code SDK, Git, and GitHub CLI"
cpu_count = 2
memory_mb = 2048
start_cmd = "/home/user/scripts/startup.sh"

[template.env]
NODE_ENV = "development"
PRIA_WORKSPACE = "/workspace"
PATH = "/opt/node-v22.13.0-linux-x64/bin:/usr/local/bin:/usr/bin:/bin"

[build]
dockerfile = "e2b.Dockerfile"
context = "."

[networking]
ports = [3000, 3001, 3002, 3003, 3004, 3005, 8080, 8000]

[filesystem]
mount_points = ["/workspace"]

[metadata]
version = "1.0.0"
author = "PRIA Team"
tags = ["nodejs", "nextjs", "claude", "github", "pria", "development"]
```

### Docker Configuration

The `e2b.Dockerfile` includes:
- **Base Image**: `e2bdev/code-interpreter:latest` (Debian-based)
- **Node.js 22 LTS**: Latest stable version with npm
- **Claude Code SDK**: Globally installed for code generation
- **Development Tools**: Git, GitHub CLI, development dependencies
- **PRIA Scripts**: Custom helper scripts for development workflow
- **Security Configuration**: Proper user permissions and workspace setup

## 🤖 Builder App Integration

### Template Usage in Builder App

Once built, integrate the template in your Builder App:

```typescript
// lib/services/e2b.ts
import { Sandbox } from 'e2b'

export class E2BSandboxManager {
  private static TEMPLATE_ID = 'pria-dev-env' // Your built template ID

  async createTargetAppSandbox(
    sessionId: string,
    workspaceId: string,
    requirements: any
  ): Promise<Sandbox> {
    const sandbox = await Sandbox.create(E2BSandboxManager.TEMPLATE_ID, {
      timeoutMs: 120000, // 2 minutes timeout
      metadata: {
        sessionId,
        workspaceId,
        type: 'pria-target-app'
      }
    })

    // Initialize PRIA context
    await this.initializePRIAContext(sandbox, sessionId, workspaceId, requirements)
    
    return sandbox
  }

  private async initializePRIAContext(
    sandbox: Sandbox,
    sessionId: string,
    workspaceId: string,
    requirements: any
  ) {
    // Set environment variables
    await sandbox.process.startAndWait(`export PRIA_SESSION_ID="${sessionId}"`)
    await sandbox.process.startAndWait(`export PRIA_WORKSPACE_ID="${workspaceId}"`)
    await sandbox.process.startAndWait(`export PRIA_BUILDER_APP_URL="${process.env.NEXT_PUBLIC_APP_URL}"`)
    
    // Initialize PRIA context system
    const result = await sandbox.process.startAndWait('node .pria/scripts/init.js')
    
    if (result.exitCode !== 0) {
      throw new Error(`PRIA context initialization failed: ${result.stderr}`)
    }
    
    // Sync initial requirements
    await sandbox.filesystem.writeTextFile(
      '.pria/requirements.json',
      JSON.stringify(requirements, null, 2)
    )
  }
}
```

### API Endpoint for Sandbox Creation

```typescript
// app/api/e2b/sandbox/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { E2BSandboxManager } from '@/lib/services/e2b'

export async function POST(request: NextRequest) {
  try {
    const { sessionId, workspaceId, requirements } = await request.json()
    
    const sandboxManager = new E2BSandboxManager()
    const sandbox = await sandboxManager.createTargetAppSandbox(
      sessionId,
      workspaceId,
      requirements
    )
    
    return NextResponse.json({
      success: true,
      sandboxId: sandbox.id,
      sandboxUrl: `https://${sandbox.getHostname()}`,
      message: 'Target App sandbox created successfully'
    })
    
  } catch (error) {
    console.error('Sandbox creation failed:', error)
    return NextResponse.json(
      { error: 'Failed to create sandbox' },
      { status: 500 }
    )
  }
}
```

## 🔍 Troubleshooting

### Common Build Issues

#### 1. Template Build Fails

```bash
# Error: "Dockerfile not found"
# Solution: Ensure e2b.Dockerfile exists in the current directory
ls -la e2b.Dockerfile

# Error: "Build context too large"
# Solution: Add .e2bignore file to exclude unnecessary files
echo "node_modules" > .e2bignore
echo ".git" >> .e2bignore
echo "*.log" >> .e2bignore
```

#### 2. Permission Issues

```bash
# Error: "Permission denied" during startup
# Solution: Ensure scripts are executable
chmod +x scripts/*.sh
chmod +x .pria/scripts/*.js
```

#### 3. Network/Port Issues

```bash
# Error: "Port already in use"
# Solution: Update e2b.toml networking configuration
# Add more ports or change the port range
```

### Runtime Issues

#### 1. PRIA Context Initialization Fails

```bash
# Check initialization logs
docker logs <container_id>

# Manually run initialization
node .pria/scripts/init.js
```

#### 2. Claude Code SDK Not Working

```bash
# Verify installation
claude --version

# Check API key configuration
echo $ANTHROPIC_API_KEY

# Reinstall if needed
npm install -g @anthropic-ai/claude-code@latest
```

#### 3. GitHub Integration Issues

```bash
# Check GitHub CLI authentication
gh auth status

# Re-authenticate if needed
gh auth login --with-token < echo $GITHUB_TOKEN
```

## 📊 Template Verification Checklist

Before deploying to production, verify:

- [ ] **Template builds successfully** without errors
- [ ] **Test sandbox creation** works with `e2b sandbox create pria-dev-env`
- [ ] **Startup script executes** without failures
- [ ] **PRIA context initializes** properly
- [ ] **Claude Code SDK** is accessible and functional
- [ ] **GitHub integration** works (if enabled)
- [ ] **Next.js application** starts successfully
- [ ] **Builder App communication** functions correctly
- [ ] **Environment variables** are properly configured
- [ ] **File permissions** are correct for all scripts

## 🚀 Production Deployment

### Template Updates

When updating the template:

1. **Increment version** in `e2b.toml` metadata
2. **Rebuild template** with `e2b template build`
3. **Update template ID** in Builder App configuration
4. **Test thoroughly** before deploying to production
5. **Document changes** in your deployment logs

### Monitoring

Monitor template usage:

```bash
# List active sandboxes
e2b sandbox list

# Get sandbox details
e2b sandbox get <sandbox_id>

# View sandbox logs
e2b sandbox logs <sandbox_id>
```

### Cleanup

Regular cleanup of unused sandboxes:

```bash
# List all sandboxes
e2b sandbox list

# Delete specific sandbox
e2b sandbox delete <sandbox_id>

# Bulk cleanup (be careful!)
e2b sandbox list --format json | jq -r '.[].id' | xargs -I {} e2b sandbox delete {}
```

## 📞 Support

For issues with:
- **E2B Platform**: Check [E2B Documentation](https://e2b.dev/docs)
- **Claude Code SDK**: Refer to [Claude Code SDK Documentation](https://docs.anthropic.com/claude/docs/claude-code)
- **PRIA System**: Review the Builder App logs and documentation

## 🎯 Next Steps

After successful template deployment:

1. **Set up Claude Code SDK integration** with Builder App context synchronization
2. **Create TARGET_APP_SPECIFICATION template** with Builder App integration
3. **Test end-to-end workflow** from Builder App to generated application
4. **Implement monitoring and logging** for production usage
5. **Set up automated template updates** for continuous improvement

---

*This deployment guide is maintained as part of the PRIA E2B template system. Updates and improvements are welcome.*