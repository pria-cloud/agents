# claudecodeui E2B Integration

This project integrates [claudecodeui](https://github.com/siteboon/claudecodeui) with E2B sandboxes to provide a web-based interface for Claude Code development in isolated environments.

## Project Structure

```
claudecodeui-e2b-integration/
├── claudecodeui-template/          # E2B sandbox template
│   ├── e2b.Dockerfile             # E2B template configuration
│   ├── e2b.toml                   # Template metadata
│   ├── modified-claudecodeui/     # Pre-modified claudecodeui with PRIA enhancements
│   ├── scripts/                   # Instance initialization and GitHub sync scripts
│   └── CLAUDECODEUI_MODIFICATIONS.md  # Documentation of all modifications
├── claude-ui-launcher/            # Frontend launcher application
│   ├── app/api/sandbox/           # E2B sandbox management APIs
│   └── app/page.tsx               # UI for creating and managing sandbox instances
└── README.md                      # This file
```

## Key Features

### E2B Sandbox Template
- **Pre-modified claudecodeui**: Includes CORS, authentication bypass, and PRIA enhancements
- **Production build**: Uses `npm run build` + `npm start` for fast startup
- **Dynamic project registration**: Automatically registers projects with Claude Code CLI
- **GitHub integration**: Automatic sync of projects and Claude sessions
- **20-minute keep-alive**: Extended sandbox timeout for development sessions

### Frontend Launcher
- **Sandbox creation**: Creates E2B sandboxes with proper environment variables
- **Iframe integration**: Embeds claudecodeui in iframe with cross-origin support
- **API key management**: Passes Anthropic API key as E2B environment variable
- **Session management**: Associates sandboxes with session IDs

### GitHub Sync System
- **Project backup**: Stores project files in `{SESSION_ID}/{PROJECT_NAME}/`
- **Claude session backup**: Stores Claude data in `.claude-storage/{SESSION_ID}/`
- **Automatic restore**: Pulls existing projects on sandbox startup
- **File watching**: Debounced sync on file changes (30-second cooldown)

## Architecture

### Single-User Design
- **claudecodeui = single-user tool** (perfect for E2B isolation)
- **Each E2B sandbox = one authenticated user** (no multi-user complexity)
- **SKIP_AUTH = correct approach** (users pre-authenticated in parent system)

### Project Discovery Flow
1. Frontend creates E2B sandbox with environment variables
2. Instance API registers baseline project with Claude Code CLI  
3. Claude CLI creates `~/.claude/projects/` entry
4. claudecodeui auto-discovers project from `~/.claude/projects/`
5. User selects project → Chat interface enables

### Environment Variables
**Critical**: API keys must be passed via E2B `envs` parameter, not `metadata`.

```typescript
const sandbox = await Sandbox.create(templateId, {
  envs: {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    SESSION_ID: sessionId,
    PROJECT_NAME: 'baseline-project'
  }
})
```

## Quick Start

### 1. Set Environment Variables
```bash
export E2B_API_KEY="your_e2b_api_key"
export E2B_TEMPLATE_ID="your_template_id"  
export ANTHROPIC_API_KEY="your_anthropic_api_key"
export GITHUB_TOKEN="your_github_token"
```

### 2. Build E2B Template
```bash
cd claudecodeui-template/
e2b template build
```

### 3. Start Frontend Launcher  
```bash
cd claude-ui-launcher/
npm install
npm run dev
```

### 4. Create Sandbox
- Open http://localhost:3000
- Click "Create New Sandbox"
- Wait for claudecodeui to load in iframe
- Select project and start developing!

## Configuration

### E2B Template Settings
- **Template ID**: Set via `E2B_TEMPLATE_ID` environment variable
- **Timeout**: 20 minutes (1,200,000 ms)
- **Ports**: 3008 (API), 3009 (UI)
- **Authentication**: Bypassed with `SKIP_AUTH=true`

### GitHub Integration
- **Repository**: `pria-cloud/workspaces` (configurable)
- **Project storage**: `{SESSION_ID}/{PROJECT_NAME}/`
- **Claude sessions**: `.claude-storage/{SESSION_ID}/`
- **Sync frequency**: Debounced 30-second intervals

## Troubleshooting

### Common Issues

**1. Invalid Anthropic API Key**
- Ensure API key is set as environment variable (not hardcoded)
- Verify E2B passes environment variables via `envs` parameter

**2. Empty Project List in claudecodeui**
- Check if instance initialization API succeeded
- Verify `~/.claude/projects/` directory exists with entries
- Look for Claude CLI registration errors in logs

**3. Sandbox Creation Timeout**
- E2B service may be experiencing slowness
- Check E2B status page and try again
- Verify template ID is correct

**4. CORS Issues in Iframe**
- Ensure claudecodeui has proper CORS headers
- Verify iframe sandbox permissions include required origins
- Check browser console for specific CORS errors

### Debug Commands
```bash
# Check template status
e2b template list

# Create test sandbox
e2b sandbox create your-template-id

# Check sandbox logs  
e2b sandbox logs sandbox-id

# Verify environment variables in sandbox
e2b sandbox exec sandbox-id -- env | grep ANTHROPIC
```

## Documentation

- **[CLAUDECODEUI_MODIFICATIONS.md](claudecodeui-template/CLAUDECODEUI_MODIFICATIONS.md)**: Complete documentation of all modifications made to claudecodeui for E2B integration
- **[e2b.Dockerfile](claudecodeui-template/e2b.Dockerfile)**: E2B template configuration with comprehensive comments
- **[Instance API](claudecodeui-template/modified-claudecodeui/server/routes/instance.js)**: Sandbox initialization and GitHub sync API endpoints

## Known Limitations

1. **Single User per Sandbox**: Each E2B sandbox supports one user (by design)
2. **Production Build**: No hot reloading (not needed for sandboxes)  
3. **GitHub Dependency**: Project persistence requires GitHub token
4. **Sync Latency**: 30-second debounce on automatic sync

## Future Enhancements

- [ ] Branch-based session isolation
- [ ] GitHub sync status indicators in UI
- [ ] Project restoration conflict resolution
- [ ] Real-time collaboration features
- [ ] Enhanced error recovery mechanisms

This project provides a complete solution for running Claude Code development sessions in isolated, persistent E2B sandbox environments with automatic GitHub synchronization.