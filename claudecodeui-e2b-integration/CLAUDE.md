# PRIA Code Integration with E2B Sandboxes - CLAUDE.md

This document provides comprehensive technical architecture guidelines for the claudecodeui E2B integration project - a sophisticated system that enables PRIA Code development (powered by Claude Code CLI) in isolated, persistent sandbox environments. The UI dynamically rebrands to show "PRIA" while maintaining full Claude Code functionality.

## 🏗️ Project Architecture Overview

### Core Components

The system consists of two main components working together:

1. **E2B Sandbox Template** (`claudecodeui-template/`)
   - **Role**: Isolated development environment with claudecodeui web interface
   - **Technology**: E2B sandbox with pre-modified claudecodeui + production Next.js build
   - **Responsibilities**:
     - Run claudecodeui web interface in production mode for fast startup
     - Execute Claude Code CLI commands with full file creation permissions
     - Automatically register projects in `~/.claude/projects/` directory structure
     - Sync project changes and Claude sessions to GitHub repository
     - Provide 20-minute persistent development sessions

2. **Frontend Launcher** (`claude-ui-launcher/`)
   - **Role**: Sandbox orchestration and management interface
   - **Technology**: Next.js application with E2B SDK integration
   - **Responsibilities**:
     - Create E2B sandbox instances with proper environment variable injection
     - Display claudecodeui interface in secure iframe with cross-origin support
     - Manage sandbox lifecycle and session association
     - Handle API key distribution and security configuration

### Critical Architecture Principles

#### Single-User Sandbox Design
- **Each E2B sandbox = one authenticated user** - perfect isolation model
- **claudecodeui = single-user tool** - no multi-user complexity needed
- **Authentication bypass enabled** - users pre-authenticated in parent system
- **Session isolation** - independent `~/.claude/` directories per sandbox

#### Dynamic Project Registration System
- **Auto-discovery mechanism**: claudecodeui reads from `~/.claude/projects/`
- **Claude CLI integration**: Proper project registration creates discoverable entries
- **GitHub sync restore**: Existing projects pulled from repository on startup
- **Baseline project initialization**: New sandboxes start with working Next.js template

## 🔧 Technical Implementation Details

### Environment Variable Architecture

**Critical Finding**: API keys must be passed via E2B `envs` parameter, not `metadata`.

```typescript
// ✅ CORRECT - E2B environment variables approach
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

// ❌ INCORRECT - Metadata approach (API keys not accessible to Claude CLI)
const sandbox = await Sandbox.create(templateId, {
  metadata: {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY // Wrong!
  }
})
```

### claudecodeui Modifications

We use a **pre-modified version** of claudecodeui stored in `modified-claudecodeui/` to ensure reliability and avoid runtime patching issues.

#### Key Modifications Made:

**1. Enhanced CORS Configuration**
```javascript
// server/index.js - Enhanced CORS for iframe support
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'http://localhost:3000',           // Local development
    /^https?:\/\/.*\.e2b\.app$/,       // E2B sandbox domains
    /^https?:\/\/.*\.vercel\.app$/,    // Vercel deployments
  ];
  // Set appropriate CORS headers for iframe communication
});
```

**2. Authentication Bypass**
```javascript
// server/middleware/auth.js - Skip auth in E2B environment
if (process.env.SKIP_AUTH === 'true') {
  req.user = {
    id: 'dev-user',
    username: 'development', 
    role: 'admin'
  };
  return next();
}
```

**3. Socket.IO Cross-Origin Support**
```javascript
// server/index.js - WebSocket CORS configuration
const io = new Server(server, {
  cors: {
    origin: [/^https?:\/\/.*\.e2b\.app$/, /^https?:\/\/.*\.vercel\.app$/],
    methods: ["GET", "POST"],
    credentials: true
  }
});
```

**4. Instance Initialization API**
```javascript
// server/routes/instance.js - NEW API endpoint
router.post('/initialize', async (req, res) => {
  // Runs init-project.sh to register Claude projects
  // Starts GitHub sync watcher for automatic backup
});
```

### Production Build Optimization

**Key Decision**: Use production builds instead of development mode for faster E2B sandbox startup.

```dockerfile
# Build for production (faster startup than dev mode)
RUN npm run build

# Start with production server
npm start > /tmp/claudecodeui.log 2>&1 &
```

**Benefits**:
- **Faster startup**: Pre-built assets load immediately
- **Lower resource usage**: No webpack dev server overhead  
- **Reduced timeout risk**: Production builds start much faster
- **Better reliability**: More stable than dev mode in containerized environments

### GitHub Integration Architecture

**Project Storage Structure**:
```
pria-cloud/workspaces/
├── {SESSION_ID}/
│   └── {PROJECT_NAME}/          # Project source files
└── .claude-storage/
    └── {SESSION_ID}/            # Claude session data and project configs
```

**Sync Scripts**:
1. **`init-project.sh`**: Project initialization with GitHub restore capability
2. **`sync-to-github.sh`**: Manual and automatic project backup
3. **`watch-and-sync.sh`**: File watcher with debounced sync (30-second cooldown)

## 🔄 Development Workflow

### Sandbox Creation Flow
1. **Frontend** creates E2B sandbox with environment variables
2. **E2B** provisions sandbox from template with claudecodeui running
3. **Instance API** registers baseline project with Claude Code CLI
4. **claudecodeui** auto-discovers project from `~/.claude/projects/`
5. **User** selects project and begins Claude Code development
6. **File watcher** automatically syncs changes to GitHub

### Project Registration Process
```bash
# In baseline project directory
cd /home/user/baseline-project
echo "Initialize project" | claude

# This creates:
# ~/.claude/projects/baseline-project/ (project registration)
# ~/.claude/project-config.json (claudecodeui metadata)
```

### Session Persistence Strategy
- **New projects**: Initialize with Claude CLI, start fresh development
- **Existing projects**: Restore from GitHub, continue previous work
- **Session continuity**: Claude session history preserved across sandbox recreations
- **Cross-session isolation**: Each session ID maintains independent project state

## 🛡️ Security Architecture

### Iframe Security Model
```html
<!-- Secure iframe configuration -->
<iframe
  src={sandboxUrl}
  sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
  className="w-full h-full border-0"
/>
```

**Security Features**:
- **Origin restrictions**: CORS limits to specific domains
- **Sandbox isolation**: Each user gets completely isolated E2B environment
- **API key security**: Environment variables never exposed to client
- **Session association**: Sandbox tied to authenticated user session

### Environment Variable Security
- **Build-time**: No API keys in Docker images
- **Runtime**: E2B injects environment variables securely
- **Process isolation**: Environment variables scoped to sandbox processes
- **Audit logging**: All API key usage logged for security monitoring

## 🎨 PRIA Branding System

### Dynamic UI Rebranding

The system includes automatic rebranding from "Claude" to "PRIA" in the user interface:

**Implementation**:
- **JavaScript-based**: `pria-branding.js` dynamically replaces text nodes
- **CSS fallback**: `pria-branding.css` provides instant visual updates
- **MutationObserver**: Monitors DOM changes for new content
- **Comprehensive coverage**: Handles titles, buttons, placeholders, tooltips

**Branding Replacements**:
- "Ask Claude to change your code" → "Ask PRIA to build or change your application"
- "Claude Code UI" → "PRIA Code UI"
- "Claude UI" → "PRIA UI"  
- "Claude Code" → "PRIA Code"
- "Claude" → "PRIA"
- Claude logos → Animated PRIA QR code grid logos

**Visual Elements**:
- **PRIA Logo**: Animated 3x3 grid (5-7 filled boxes) in violet-600 color
- **Logo Animation**: Boxes fill/empty every 1.5 seconds for visual interest
- **Chat Avatars**: Claude avatars replaced with PRIA animated logos
- **Brand Colors**: Violet (#7c3aed) primary, Indigo (#6366f1) secondary

**Technical Details**:
- Scripts injected during Docker build process
- No runtime performance impact (efficient DOM manipulation)
- Preserves underlying Claude CLI functionality
- Works with dynamic React content
- MutationObserver handles real-time chat messages
- CSS fallbacks for instant visual updates

## 📋 Development Guidelines

### Working with the Project

#### Making Changes to claudecodeui
1. **Modify pre-modified version**: Edit files in `modified-claudecodeui/`
2. **Test locally**: Verify changes work in isolation
3. **Update documentation**: Record modifications in `CLAUDECODEUI_MODIFICATIONS.md`
4. **Rebuild template**: Run `e2b template build`

#### Environment Variables Required
```bash
# E2B Configuration
E2B_API_KEY=your_e2b_api_key
E2B_TEMPLATE_ID=your_template_id

# Claude Code Integration  
ANTHROPIC_API_KEY=your_anthropic_api_key

# GitHub Sync (Optional)
GITHUB_TOKEN=your_github_pat
GITHUB_REPOSITORY=https://github.com/pria-cloud/workspaces
```

#### Testing Workflow
1. **Build template**: `e2b template build`
2. **Start launcher**: `npm run dev` in `claude-ui-launcher/`
3. **Create sandbox**: Use web interface to create test sandbox
4. **Verify integration**: Ensure project appears in claudecodeui dropdown
5. **Test Claude CLI**: Run Claude commands and verify file creation
6. **Check GitHub sync**: Verify changes appear in repository

### Debugging Common Issues

**1. Empty Project List**
```bash
# Check project registration
ls -la ~/.claude/projects/

# Verify Claude CLI installation
which claude && claude --version

# Check environment variables
env | grep ANTHROPIC_API_KEY
```

**2. API Key Issues**
```bash
# Verify environment variable injection
echo $ANTHROPIC_API_KEY

# Test Claude CLI directly
echo "test" | claude
```

**3. CORS/Iframe Issues**
- Check browser console for specific CORS errors
- Verify iframe sandbox permissions
- Confirm claudecodeui CORS headers match expected origins

## 🚀 Deployment Architecture

### E2B Template Deployment
```bash
# Build template
cd claudecodeui-template/
e2b template build

# Deploy to production
e2b template publish
```

### Frontend Deployment
```bash
# Deploy launcher application
cd claude-ui-launcher/
npm run build
# Deploy to Vercel/production environment
```

### Environment Configuration
- **Development**: Local environment variables
- **Staging**: Environment-specific E2B template
- **Production**: Secure API key management with E2B environment injection

## 📊 Performance Considerations

### Optimization Strategies
- **Production builds**: Faster startup than development mode
- **Asset precompilation**: All builds happen during template creation
- **Debounced sync**: Prevents excessive GitHub API calls
- **Persistent sandboxes**: 20-minute timeout reduces recreation overhead

### Resource Management
- **Memory usage**: Production builds use less memory than dev mode
- **Network efficiency**: Bundled assets reduce initial load time
- **Storage optimization**: GitHub sync only backs up changed files
- **Concurrent limits**: E2B handles sandbox scaling automatically

## 🔧 Troubleshooting Guide

### Template Build Issues
```bash
# Check template build logs
e2b template build --verbose

# Verify file permissions
ls -la claudecodeui-template/scripts/

# Test individual components
docker run --rm -it template-id bash
```

### Runtime Issues
```bash
# Check sandbox logs
e2b sandbox logs sandbox-id

# Verify service startup
curl https://sandbox-id.e2b.app/health

# Check environment variables
e2b sandbox exec sandbox-id -- env | grep ANTHROPIC
```

### Integration Testing
```bash
# Test complete workflow
npm run test:e2e  # If implemented

# Manual verification steps
1. Create sandbox
2. Verify claudecodeui loads
3. Check project registration  
4. Test Claude CLI commands
5. Verify GitHub sync
```

## 📚 Documentation References

- **[README.md](README.md)**: Project overview and quick start guide
- **[CLAUDECODEUI_MODIFICATIONS.md](claudecodeui-template/CLAUDECODEUI_MODIFICATIONS.md)**: Complete modification documentation
- **[e2b.Dockerfile](claudecodeui-template/e2b.Dockerfile)**: Template configuration with inline documentation
- **[Original claudecodeui](https://github.com/siteboon/claudecodeui)**: Upstream project repository

## 🎯 Future Enhancements

### Planned Features
- **Branch-based isolation**: Map Claude sessions to GitHub branches
- **Real-time collaboration**: Multiple developers in same project
- **Enhanced monitoring**: Detailed analytics and performance metrics  
- **Advanced recovery**: Automatic conflict resolution and backup strategies

### Technical Debt
- **Test coverage**: Add comprehensive integration test suite
- **Error handling**: Enhanced error recovery and user feedback
- **Documentation**: API documentation and developer guides
- **Security audit**: Regular security review and updates

This project represents a sophisticated integration between Claude Code CLI, claudecodeui web interface, and E2B sandbox infrastructure, providing developers with isolated, persistent, and automatically syncing development environments for AI-assisted coding workflows.