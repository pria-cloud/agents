# PRIA App Builder Architecture

## 🏗️ Two-App System Design

### Builder App (This Repository)
**Location:** Local development machine
**Purpose:** Development experience and orchestration
**Port:** 3001 (default)

#### Responsibilities:
- ✅ User interface and experience
- ✅ Chat interface for Claude interactions  
- ✅ Project management (workspaces, sessions)
- ✅ Requirements gathering and tracking
- ✅ E2B sandbox lifecycle management
- ✅ Data persistence (Supabase)
- ✅ Testing and monitoring dashboard

#### What Builder App SHOULD NOT Do:
- ❌ Direct file operations on target projects
- ❌ Running Claude Code SDK commands
- ❌ File watching target app files directly
- ❌ Development server management
- ❌ Build/test execution of target apps

### Target App (E2B Sandbox)
**Location:** E2B cloud sandbox environment
**Purpose:** Actual development environment and code execution
**Port:** 3000 (development server)

#### Responsibilities:
- ✅ Claude Code SDK execution
- ✅ File system operations (create, modify, delete)
- ✅ Development server (Next.js, npm run dev)
- ✅ Package management and dependencies
- ✅ Build and test execution
- ✅ Git operations and version control
- ✅ File watching and change detection
- ✅ Live preview serving

#### What Target App SHOULD NOT Do:
- ❌ User interface for development experience
- ❌ Data persistence (except local project files)
- ❌ Session/workspace management
- ❌ Requirements tracking

## 🔄 Communication Flow

```
User Input → Builder App UI → E2B API → Target App (Claude SDK) → File Operations → Live Preview
                ↑                                                        ↓
            Supabase DB ←── Response Stream ←── Claude Code SDK ←── File Changes
```

### Communication Protocols:

1. **Builder → Target:**
   - HTTP/WebSocket to E2B sandbox
   - Claude Code SDK commands via E2B API
   - File sync requests

2. **Target → Builder:**
   - Real-time streaming responses
   - File change notifications
   - Build/test results
   - Development server status

## 🛠️ Implementation Fixes Needed

### 1. Remove from Builder App:
```typescript
// ❌ Remove these from Builder App
- ClaudeSDKClient (should only be in Target App)
- Direct file operations
- File watching of target app files
- Project state management of target files
```

### 2. Add to Target App:
```typescript
// ✅ Add to Target App
- Claude Code SDK runner service
- File watcher for local changes
- Development server management
- Build/test execution endpoints
```

### 3. Communication Layer:
```typescript
// ✅ Builder App communicates via E2B API
interface BuilderToTargetAPI {
  sendClaudeCommand(sessionId: string, command: string): Promise<Response>
  getProjectState(sessionId: string): Promise<ProjectState>
  streamResponse(sessionId: string): WebSocket
}
```

## 📁 Proper File Structure

### Builder App:
```
builder-app/
├── app/                     # Next.js pages (UI)
├── components/              # UI components only
├── lib/
│   ├── supabase/           # Database operations
│   ├── e2b/                # E2B sandbox management
│   └── types/              # TypeScript definitions
└── public/                 # Static assets
```

### Target App (E2B Sandbox):
```
target-app/
├── app/                     # Generated Next.js app
├── components/              # Generated components
├── lib/
│   ├── claude-runner/      # Claude Code SDK integration
│   ├── file-watcher/       # File change detection
│   └── dev-server/         # Development server management
├── package.json            # Target app dependencies
└── .claude/                # Claude Code SDK configuration
```

## 🎯 Correct Responsibilities

### Builder App Examples:
```typescript
// ✅ Correct Builder App code
const sendToTarget = async (message: string) => {
  // Send command to target app via E2B
  const response = await e2bClient.execute({
    sessionId,
    command: `claude ask "${message}"`
  })
  return response
}
```

### Target App Examples:
```typescript
// ✅ Correct Target App code (runs in E2B)
import { query } from '@anthropic-ai/claude-code'

const handleClaudeCommand = async (command: string) => {
  for await (const message of query(command)) {
    // Stream back to Builder App
    sendToBuilder(message)
  }
}
```

This separation ensures:
- Builder App focuses on user experience
- Target App focuses on actual development work
- Clear boundaries and responsibilities
- Scalable architecture for multiple projects