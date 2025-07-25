# Claude Code E2B Integration

A complete development environment that runs Claude Code directly inside E2B containers, providing native AI-powered development assistance with full project context.

## 🚀 Features

- **Direct Claude Code Integration**: Claude Code SDK running natively in the container
- **Real-time Development**: Live file watching and hot reload
- **Git Integration**: Full version control with commit, push, pull, and branch management
- **Project Management**: Create, clone, build, and preview projects
- **WebSocket Communication**: Real-time updates and status monitoring
- **File Explorer**: Browse, edit, and manage project files
- **Interactive Chat**: Natural language interface for development tasks

## 🏗️ Architecture

```
E2B Container
├── Next.js App (Port 3000)         # Frontend interface
├── API Service (Port 8080)         # Express server with Claude Code SDK
├── Claude Code SDK                  # AI development assistant
├── Git Integration                  # Version control operations
└── File System Access              # Direct project file manipulation
```

## 📦 Components

### API Service
- **Express server** with TypeScript
- **Claude Code SDK** integration
- **WebSocket support** for real-time updates
- **Git operations** via simple-git
- **File management** with security controls
- **Project management** for creation and cloning

### Frontend Application
- **Next.js 15** with App Router
- **Tailwind CSS** for styling
- **Real-time chat** interface with Claude Code
- **File explorer** with editing capabilities
- **Git integration** UI
- **Project management** dashboard

### Services Architecture
- **ClaudeService**: Handles AI conversations and code generation
- **GitService**: Manages version control operations
- **ProjectService**: Handles project lifecycle and building
- **FileService**: Manages file operations with security
- **WebSocketService**: Provides real-time communication

## 🛠️ Setup

### Prerequisites
- E2B account with API access
- Anthropic API key for Claude Code
- Docker (for local development)

### Environment Variables

Required for the container:
```bash
ANTHROPIC_API_KEY=your_anthropic_api_key
GITHUB_TOKEN=your_github_token
GIT_USER_NAME="Your Name"
GIT_USER_EMAIL="your.email@example.com"
PROJECT_ROOT=/code/baseline-project
NODE_ENV=development
API_PORT=8080
NEXT_PORT=3000
```

### E2B Template Setup

1. **Build the template**:
```bash
cd claude-code-e2b/e2b-template
e2b template build
```

2. **Configure environment variables** in E2B dashboard:
   - Add your Anthropic API key
   - Configure Git credentials
   - Set any custom environment variables

3. **Deploy template**:
```bash
e2b template deploy
```

### Local Development

1. **Start the API service**:
```bash
cd api-service
npm install
npm run dev
```

2. **Start the Next.js app**:
```bash
cd baseline-project
npm install
npm run dev
```

## 🎯 Usage

### Creating a New Project

1. Open the **Project Manager** tab
2. Click **"New Project"**
3. Enter project details:
   - Name: Your project name
   - Template: Choose from Next.js, React, Vue, or Custom
   - Description: Optional project description
4. Click **"Create Project"**

The system will:
- Create the project structure
- Initialize Git repository
- Install dependencies
- Set up development environment

### Cloning an Existing Repository

1. Open the **Project Manager** tab
2. Click **"Clone Repository"**
3. Enter the Git URL and optional branch
4. Click **"Clone Repository"**

The system will:
- Clone the repository
- Install dependencies
- Set up the development environment
- Initialize the project for editing

### Working with Claude Code

1. Open the **Claude Code** tab
2. Start a conversation with natural language:
   - "Create a new React component for user profiles"
   - "Fix the authentication bug in the login form"
   - "Add TypeScript types for the API responses"
   - "Refactor this component to use hooks"

Claude Code will:
- Analyze your project structure
- Understand the current codebase
- Generate or modify files as needed
- Provide explanations and documentation
- Execute commands when necessary

### File Management

1. Open the **Files** tab
2. Browse the project structure
3. Click files to view/edit content
4. Use the **Edit** button to modify files
5. **Save** changes to update the project

Features:
- Real-time file watching
- Syntax highlighting
- Create/delete files and directories
- Search and navigation

### Git Operations

1. Open the **Git** tab
2. View current repository status
3. Stage and commit changes
4. Push/pull from remote repositories
5. Create and switch branches

Features:
- Visual diff display
- Commit history
- Branch management
- Conflict resolution

## 🔌 API Reference

### Claude Code Endpoints

#### POST /api/claude/chat
Start or continue a conversation with Claude Code.

```typescript
{
  "message": "Create a new component",
  "conversationId": "optional-conversation-id",
  "projectContext": {
    "currentFile": "path/to/file.tsx",
    "gitBranch": "feature-branch"
  }
}
```

#### GET /api/claude/conversation/:id
Retrieve conversation history.

#### DELETE /api/claude/conversation/:id
Clear conversation history.

### Project Management Endpoints

#### POST /api/project/create
Create a new project.

```typescript
{
  "name": "my-project",
  "template": "nextjs",
  "description": "My awesome project"
}
```

#### POST /api/project/clone
Clone an existing repository.

```typescript
{
  "gitUrl": "https://github.com/user/repo.git",
  "branch": "main"
}
```

#### GET /api/project/status
Get current project status and information.

#### POST /api/project/build
Build the current project.

#### POST /api/project/preview
Start the development server.

### Git Endpoints

#### POST /api/git/commit
Commit changes to the repository.

```typescript
{
  "message": "Add new feature",
  "files": ["optional", "specific", "files"]
}
```

#### POST /api/git/push
Push changes to remote repository.

#### GET /api/git/status
Get current git status.

#### POST /api/git/branch
Create or switch branches.

```typescript
{
  "name": "feature-branch",
  "action": "create_and_switch"
}
```

### File Management Endpoints

#### GET /api/files/tree
Get project file structure.

#### GET /api/files/content/:path
Get file content.

#### POST /api/files/save
Save file content.

```typescript
{
  "path": "components/Button.tsx",
  "content": "file content here",
  "createDirectories": true
}
```

#### DELETE /api/files/:path
Delete file or directory.

## 🔒 Security

### File System Security
- All file operations are restricted to the project root
- Path traversal protection
- Configurable ignore patterns
- Safe directory creation

### Git Security
- Credential management through environment variables
- Safe directory configuration
- Repository isolation

### API Security
- CORS configuration
- Request validation
- Error handling and sanitization
- Rate limiting (configurable)

## 🐛 Troubleshooting

### Common Issues & Recent Fixes

**Claude Code not responding**:
- Check ANTHROPIC_API_KEY is set correctly
- Verify API service is running on port 8080
- Check container logs for errors

**Git operations failing**:
- Ensure GITHUB_TOKEN is configured
- Check Git user name and email are set
- Verify repository permissions

**Build/preview not working**:
- Check Node.js version compatibility
- Verify dependencies are installed
- Check for port conflicts

**WebSocket connection issues**:
- Verify both services are running
- Check firewall settings
- Ensure correct ports are exposed

### Recent Fixes Applied ✅

**React Component Parsing Errors** (Fixed 2025-01-23):
- **Issue**: "Unterminated string constant" errors in Next.js 15 with React 19
- **Root Cause**: Escaped quotes in className attributes (`className=\"...\"`)
- **Solution**: Replaced with standard quotes (`className="..."`)
- **Files Fixed**: `claude-code-interface.tsx`, `requirement-chat.tsx`

**Next.js 15 API Route Compatibility** (Fixed 2025-01-23):
- **Issue**: `params` must be awaited in dynamic API routes
- **Root Cause**: Next.js 15 changed params to be Promise-based
- **Solution**: Updated type signatures and added `await params`
- **Files Fixed**: `[sessionId]/route.ts`

**E2B Template Configuration** (Fixed 2025-01-23):
- **Issue**: Template creation failing with configuration errors
- **Root Cause**: Incorrect TOML format and CLI commands
- **Solution**: Simplified e2b.toml and fixed PowerShell scripts
- **Template ID**: `jdvee4xpdmzq6a5bun58`

### Logs and Debugging

Container logs are available at:
- API service: `/code/logs/api-service.log`
- Next.js: `/code/logs/nextjs.log`

Enable debug mode:
```bash
NODE_ENV=development DEBUG=* npm start
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📝 License

MIT License - see LICENSE file for details.

## 🙏 Acknowledgments

- **Anthropic** for Claude Code SDK
- **E2B** for container infrastructure
- **Next.js** team for the excellent framework
- **Open source community** for the amazing tools and libraries