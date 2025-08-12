# PRIA claudecodeui E2B Template Usage Guide

## 🚀 Complete Development Environment

This E2B template provides a **complete PRIA development environment** with:

- **claudecodeui** - Web interface for Claude Code CLI
- **Baseline Next.js template** - Pre-installed PRIA-compliant project template
- **Claude session management** - Automatic session persistence to GitHub
- **GitHub integration** - Full API for project management and sync
- **PostMessage bridge** - Complete iframe communication system

## 📋 Template Contents

### **Services Included:**
- ✅ claudecodeui frontend (port 3009)
- ✅ claudecodeui server (port 3008) 
- ✅ Claude Code CLI (authenticated)
- ✅ GitHub CLI integration
- ✅ Git with session sync automation

### **Templates Available:**
- ✅ Baseline Next.js template (`/home/user/baseline-project`)
- ✅ PRIA project structure with `.claude/` directories
- ✅ Automatic session persistence configuration

### **API Endpoints:**
- ✅ `POST /api/github/init` - Initialize project from GitHub
- ✅ `POST /api/github/create` - Create new project with template
- ✅ `POST /api/github/sync` - Manual sync trigger
- ✅ `GET /api/github/status/:project` - Get project sync status
- ✅ `GET /api/github/projects` - List available projects

## 🔧 Environment Variables Required

### **Essential Variables:**
```bash
ANTHROPIC_API_KEY="your-claude-api-key"     # Required for Claude Code CLI
```

### **Optional Variables:**
```bash
GITHUB_TOKEN="your-github-token"            # For GitHub integration
SUPABASE_URL="your-supabase-url"           # For Supabase integration
SUPABASE_ANON_KEY="your-supabase-anon-key" # For Supabase client
SUPABASE_SERVICE_ROLE_KEY="your-service-key" # For Supabase admin operations
```

## 🚀 Usage Examples

### **1. Basic Template Creation**
```javascript
import { Sandbox } from 'e2b'

const sandbox = await Sandbox.create('claude-code-ui-launcher', {
  metadata: {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    githubToken: process.env.GITHUB_TOKEN // optional
  }
})

// Access claudecodeui at sandbox URL on port 3009
const claudeUI = `https://${sandbox.getHost(3009)}`
```

### **2. Creating New Project via API**
```javascript
// After sandbox is running, create a new project
const response = await fetch(`https://${sandbox.getHost(3008)}/api/github/create`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    projectName: 'my-new-app',
    template: 'baseline-nextjs', // or 'blank'
    workspaceId: 'workspace-123',
    sessionId: 'session-456'
  })
})

const result = await response.json()
console.log('Project created:', result.projectPath)
```

### **3. Restoring Project from GitHub**
```javascript
const response = await fetch(`https://${sandbox.getHost(3008)}/api/github/init`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    projectName: 'existing-app',
    githubRepo: 'https://github.com/user/existing-app.git',
    githubToken: process.env.GITHUB_TOKEN,
    branch: 'main'
  })
})

const result = await response.json()
console.log('Project restored:', result.projectPath)
```

## 🖥️ iframe Integration

### **PRIA Admin Integration**
```typescript
// In your PRIA Admin app
<iframe
  src={`https://${sandboxHost}:3009`}
  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-modals allow-top-navigation-by-user-activation"
  allow="clipboard-read; clipboard-write; web-share; microphone; camera; fullscreen"
  onLoad={() => {
    // Send initialization message
    iframe.contentWindow.postMessage({
      type: 'INIT_PROJECT',
      data: {
        projectName: 'my-app',
        workspaceId: 'workspace-123',
        sessionId: 'session-456',
        githubToken: process.env.NEXT_PUBLIC_GITHUB_TOKEN
      }
    }, '*')
  }}
/>
```

### **PostMessage Events**
The iframe automatically emits these events:
- `IFRAME_READY` - Iframe loaded successfully
- `PROJECT_LOADED` - Project initialization complete
- `CLAUDE_SESSION_READY` - Claude CLI session active
- `FILE_CREATED` - File created/modified
- `GITHUB_SYNC_STATUS` - Sync status updates
- `ERROR` - Error occurred

## 🔍 Health Monitoring

### **Built-in Health Check**
```bash
# Run health check in sandbox
/home/user/health-check.sh
```

**Sample Output:**
```
🔍 PRIA Environment Health Check
================================
📡 Checking claudecodeui server (port 3008)...
✅ Server: Running
🌐 Checking claudecodeui frontend (port 3009)...
✅ Frontend: Running
🧠 Checking Claude Code CLI...
✅ Claude CLI: Available
📂 Checking Git...
✅ Git: Available
🐙 Checking GitHub CLI...
✅ GitHub CLI: Available
📁 Checking directories...
✅ Projects directory: Exists
✅ Claude directory: Exists
✅ Baseline template: Available
================================
🔧 Environment Variables:
✅ ANTHROPIC_API_KEY: Set
❌ GITHUB_TOKEN: Not set
❌ SUPABASE_URL: Not set
❌ SUPABASE_ANON_KEY: Not set
================================
```

## 📁 Directory Structure

```
/home/user/
├── claudecodeui/              # Main claudecodeui application
├── baseline-project/          # Next.js template for new projects
├── projects/                  # User projects directory
├── .claude/                   # Claude session persistence
│   ├── projects/             # Conversation histories
│   └── todos/                # Todo lists
├── scripts/                   # PRIA integration scripts
├── start-all-services.sh     # Main startup script
└── health-check.sh           # Health monitoring
```

## 🛠️ Development Workflow

### **1. Template Deployment**
```bash
# Build new template version
cd claudecodeui-template
e2b template build

# Update template ID in e2b.toml with new ID
# template_id = "NEW_TEMPLATE_ID"
```

### **2. Sandbox Creation**
```javascript
const sandbox = await Sandbox.create('claude-code-ui-launcher', {
  metadata: {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    githubToken: process.env.GITHUB_TOKEN
  }
})
```

### **3. Project Development**
1. Access claudecodeui at `https://${sandbox.getHost(3009)}`
2. Create or restore projects via API or UI
3. Develop with Claude Code CLI assistance
4. Sessions automatically sync to GitHub repositories

### **4. iframe Embedding**
1. Embed sandbox URL in PRIA Admin iframe
2. Configure PostMessage communication
3. Monitor sync status and project updates
4. Handle errors and connection issues gracefully

## 🔐 Security Considerations

- **API Keys**: Never expose keys in client-side code
- **CORS**: Template configured for E2B and localhost origins
- **iframe Security**: Proper sandbox permissions and CSP headers
- **GitHub Tokens**: Use fine-grained tokens with minimal permissions

## 🚨 Troubleshooting

### **Common Issues:**

1. **Claude CLI not authenticated**
   - Ensure `ANTHROPIC_API_KEY` is set correctly
   - Check `/home/user/health-check.sh` output

2. **GitHub integration failing**
   - Verify `GITHUB_TOKEN` has repository permissions
   - Check GitHub CLI authentication: `gh auth status`

3. **iframe communication broken**
   - Verify CORS headers and allowed origins
   - Check browser console for PostMessage errors
   - Test with `/api/github/status/test` endpoint

4. **Services not starting**
   - Check logs: `docker logs <sandbox-id>`
   - Run health check: `/home/user/health-check.sh`
   - Verify port availability (3008, 3009)

The template is now **production-ready** with complete service orchestration, environment variable support, and comprehensive monitoring!