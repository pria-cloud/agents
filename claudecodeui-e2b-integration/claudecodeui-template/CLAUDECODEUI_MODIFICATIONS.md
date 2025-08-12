# claudecodeui Modifications Documentation

This document details all modifications made to the original claudecodeui package for PRIA E2B integration.

## Overview

We use a **pre-modified version** of claudecodeui instead of runtime patching to ensure reliability and avoid file corruption issues. The modified version is stored in `modified-claudecodeui/` and copied during E2B template build.

## Original Package Source

- **Repository**: https://github.com/siteboon/claudecodeui
- **Last Modified Version**: Latest from main branch (downloaded during implementation)
- **Download Method**: `git clone https://github.com/siteboon/claudecodeui.git`

## Core Modifications

### 1. Enhanced CORS Configuration

**File**: `server/index.js`  
**Purpose**: Enable iframe embedding and cross-origin WebSocket communication

```javascript
// Enhanced CORS middleware for iframe support
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'http://localhost:3000',           // Local PRIA Builder
    /^https?:\/\/.*\.e2b\.app$/,       // E2B sandbox domains
    /^https?:\/\/.*\.vercel\.app$/,    // Vercel deployments
  ];

  // Check if origin is allowed
  const isAllowed = allowedOrigins.some(allowedOrigin => {
    if (typeof allowedOrigin === 'string') {
      return origin === allowedOrigin;
    } else {
      return allowedOrigin.test(origin || '');
    }
  });

  if (isAllowed || !origin) {
    res.header('Access-Control-Allow-Origin', origin || '*');
  }

  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-api-key');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});
```

### 2. Authentication Bypass for E2B

**File**: `server/middleware/auth.js`  
**Purpose**: Skip authentication in E2B isolated environments

```javascript
// Skip authentication in development mode or E2B sandbox for iframe integration
if (process.env.NODE_ENV === 'development' || process.env.SKIP_AUTH === 'true') {
  // Create a mock user for development
  req.user = {
    id: 'dev-user',
    username: 'development',
    role: 'admin'
  };
  return next();
}
```

### 3. ES Module Import Fixes

**File**: `server/index.js`  
**Purpose**: Fix CommonJS to ES module compatibility

```javascript
// Fixed imports from CommonJS to ES modules
import { exec, execSync } from 'child_process';
import { promisify } from 'util';

// Instead of:
// const { exec, execSync } = require('child_process');
```

### 4. GitHub API Integration

**File**: `server/routes/git.js` (if exists)  
**Purpose**: Enhanced GitHub integration for PRIA workspace sync

```javascript
// Enhanced GitHub integration endpoints
app.post('/api/github/projects/create', authenticateToken, async (req, res) => {
  // Create project in pria-cloud/workspaces repository
  // Implementation details in server/index.js
});

app.get('/api/github/status/:projectName', authenticateToken, async (req, res) => {
  // Check GitHub sync status for project
});

app.post('/api/github/sync/:projectName', authenticateToken, async (req, res) => {
  // Force sync project to GitHub
});
```

### 5. Instance Initialization API

**File**: `server/routes/instance.js` (NEW FILE)  
**Purpose**: Handle per-sandbox instance initialization

```javascript
import express from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';

const router = express.Router();

// Initialize sandbox instance with project and GitHub sync
router.post('/initialize', async (req, res) => {
  // Runs init-project.sh script to register Claude projects
  // Starts GitHub sync watcher for automatic backup
});

router.get('/status', async (req, res) => {
  // Check instance initialization status
});

export default router;
```

### 6. Socket.IO Cross-Origin Configuration

**File**: `server/index.js`  
**Purpose**: Enable WebSocket communication across iframe boundaries

```javascript
// Socket.IO server with enhanced CORS for iframe support
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3000",         // Local PRIA Builder
      /^https?:\/\/.*\.e2b\.app$/,     // E2B sandbox domains
      /^https?:\/\/.*\.vercel\.app$/   // Vercel deployments
    ],
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["*"]
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true
});
```

### 7. Enhanced Project Configuration

**File**: `server/projects.js`  
**Purpose**: Robust directory creation and error handling

```javascript
// Enhanced saveProjectConfig with directory creation
async function saveProjectConfig(config) {
  const claudeDir = path.join(process.env.HOME, '.claude');
  const configPath = path.join(claudeDir, 'project-config.json');
  
  // Ensure .claude directory exists
  try {
    await fs.mkdir(claudeDir, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }
  
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
}

// Enhanced addProjectManually with directory structure validation
// Added directory existence checks before project creation
```

## E2B Template Integration

### Critical API Key Fix
**Problem**: API keys passed in E2B `metadata` are not available to Claude CLI as environment variables.  
**Solution**: Use E2B `envs` parameter to pass API keys as environment variables.

```typescript
// Frontend creates sandbox with environment variables (FIXED APPROACH)
const sandbox = await Sandbox.create(templateId, {
  apiKey: e2bApiKey,
  timeoutMs: 1200000, // 20 minutes
  envs: {
    // API keys as environment variables (required for Claude CLI)
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    GITHUB_REPOSITORY: 'https://github.com/pria-cloud/workspaces',
    SESSION_ID: sessionId,
    PROJECT_NAME: 'baseline-project'
  },
  metadata: {
    sessionId,
    createdAt: new Date().toISOString()
  }
})
```

### Template Environment Variables
```dockerfile
ENV SKIP_AUTH=true              # Bypass authentication in E2B
ENV NODE_ENV=production         # Use production build for performance
ENV PORT=3008                   # Backend API server
ENV VITE_PORT=3009             # Frontend UI port
# API keys injected via E2B envs parameter at runtime
```

### Instance Initialization API (Simplified)
```bash
# Simplified API call - environment variables already set by E2B
POST /api/instance/initialize
{
  "sessionId": "session-xxx",
  "projectName": "baseline-project"
  # Environment variables automatically available from E2B
}
```

## Supporting Scripts Created

### 1. Project Initialization (`scripts/init-project.sh`)
- Checks GitHub for existing project
- Restores from GitHub OR initializes new with Claude CLI
- Creates proper `~/.claude/projects/` entries

### 2. GitHub Sync (`scripts/sync-to-github.sh`) 
- Backs up project files to `{SESSION_ID}/{PROJECT_NAME}/`
- Backs up Claude data to `.claude-storage/{SESSION_ID}/`
- Automatic commits and push to GitHub

### 3. File Watcher (`scripts/watch-and-sync.sh`)
- Monitors changes in project and `.claude/` directories
- Debounced sync (30-second cooldown)
- Automatic backup when Claude Code makes changes

## Upgrade Process

When upgrading claudecodeui to a newer version:

### 1. Download Latest Version
```bash
cd claudecodeui-template/
rm -rf modified-claudecodeui/
git clone https://github.com/siteboon/claudecodeui.git modified-claudecodeui
cd modified-claudecodeui/
```

### 2. Apply CORS Modifications
Re-apply the CORS configuration to `server/index.js` (see section 1 above)

### 3. Apply Authentication Bypass
Re-apply the SKIP_AUTH logic to `server/middleware/auth.js` (see section 2 above)

### 4. Fix ES Module Imports
Update any CommonJS requires to ES imports in `server/index.js` (see section 3 above)

### 5. Add Instance Routes
Create `server/routes/instance.js` and add to main server (see section 5 above)

### 6. Add Socket.IO CORS
Update Socket.IO configuration for iframe support (see section 6 above)

### 7. Enhance Project Functions
Apply directory creation enhancements to `server/projects.js` (see section 7 above)

### 8. Test Integration
```bash
# Build and test the template
cd ../
e2b template build
```

## Architecture Benefits

### Single-User Sandbox Design
- **claudecodeui = single-user per installation** (perfect for E2B isolation)
- **Each E2B sandbox = one user** (no multi-user complexity needed)
- **SKIP_AUTH = correct approach** (users pre-authenticated in PRIA)

### Project Discovery Flow
1. Instance API registers project with Claude CLI
2. Claude CLI creates `~/.claude/projects/` entry
3. claudecodeui auto-discovers from `~/.claude/projects/`
4. User selects project, chat interface enables

### GitHub Integration
- **Project Files**: Stored in `pria-cloud/workspaces/{SESSION_ID}/{PROJECT_NAME}/`
- **Claude Sessions**: Stored in `pria-cloud/workspaces/.claude-storage/{SESSION_ID}/`
- **Automatic Sync**: File watcher triggers GitHub backup on changes
- **Session Restoration**: Pull existing `.claude/` data on instance startup

## Testing Checklist

After applying modifications:

- [ ] claudecodeui loads in iframe without authentication prompts
- [ ] Baseline project appears in project dropdown after instance initialization
- [ ] Chat interface enables when project is selected
- [ ] Claude Code commands work and create/modify files
- [ ] File changes trigger automatic GitHub sync
- [ ] Existing projects restore properly from GitHub
- [ ] Multiple sandbox instances work independently

## Known Limitations

1. **Single User per Sandbox**: Each E2B sandbox supports one user only (by design)
2. **Production Build**: No hot reloading in E2B (not needed for sandboxes)
3. **GitHub Dependency**: Project persistence requires GitHub token
4. **Sync Latency**: 30-second debounce on automatic GitHub sync

## File Structure

```
modified-claudecodeui/
├── server/
│   ├── index.js                    # MODIFIED - CORS, Socket.IO, GitHub APIs
│   ├── middleware/auth.js          # MODIFIED - SKIP_AUTH bypass
│   ├── projects.js                 # MODIFIED - Enhanced directory handling
│   ├── routes/instance.js          # NEW - Instance initialization API
│   └── database/                   # UNCHANGED - SQLite auth system
├── client/                         # UNCHANGED - React frontend
└── package.json                    # UNCHANGED - Dependencies
```

This documentation ensures future upgrades can be applied systematically while preserving all PRIA-specific enhancements.