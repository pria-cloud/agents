# Claude Code E2B Template

This directory contains the complete E2B template for Claude Code integration, providing an isolated development environment with AI-powered development capabilities.

## 🏗️ Template Architecture

```
E2B Sandbox Environment
├── API Service (Port 8080)     # Express.js API with Claude integration
├── Next.js Frontend (Port 3000) # The application being developed
├── File System                 # Project files and git repository
└── Development Tools           # Git, npm, build tools
```

## 🚀 Quick Deployment

### Prerequisites

1. **E2B Account**: Sign up at [e2b.dev](https://e2b.dev)
2. **E2B CLI**: Install and authenticate
3. **API Keys**: Anthropic API key for Claude integration

```bash
# Install E2B CLI
npm install -g @e2b/cli

# Login to E2B
e2b auth login
```

### Deploy Template

```bash
# Make the script executable
chmod +x create-template.sh

# Run the deployment script
./create-template.sh
```

This will:
- ✅ Build the API service
- ✅ Prepare the baseline project
- ✅ Create the E2B template
- ✅ Run health checks
- ✅ Provide template ID for integration

## 📁 Template Structure

### API Service (`api-service/`)

The Express.js API service provides:

- **Claude Integration**: Direct connection to Claude API for AI assistance
- **File Operations**: Read, write, delete files in the sandbox
- **Git Management**: Commit, push, branch operations
- **Project Management**: Build, preview, deploy operations
- **WebSocket Support**: Real-time updates and communication
- **Health Monitoring**: Service status and diagnostics

**Key Endpoints:**
- `POST /api/claude/chat` - Chat with Claude
- `GET /api/files/tree` - Get project file structure
- `POST /api/files/save` - Save file content
- `POST /api/git/commit` - Git commit operations
- `POST /api/project/build` - Build the project
- `GET /health` - Health check

### Baseline Project (`baseline-project/`)

The Next.js application template includes:

- **Next.js 15**: Latest Next.js with App Router
- **React 19**: Latest React with concurrent features
- **TypeScript**: Full TypeScript support
- **Tailwind CSS**: Utility-first CSS framework
- **shadcn/ui**: High-quality React components
- **PRIA Compliance**: Follows PRIA architectural standards

### Scripts (`scripts/`)

- **`start-services.sh`**: Starts both API and Next.js services
- **`setup-git.sh`**: Configures git for the sandbox

## 🔧 Configuration

### Environment Variables

The template requires these environment variables:

```bash
# Required
ANTHROPIC_API_KEY=your_anthropic_api_key

# Optional but recommended
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GIT_USER_NAME="Your Name"
GIT_USER_EMAIL="your.email@domain.com"
GITHUB_TOKEN=your_github_token
```

### E2B Configuration (`e2b.toml`)

The template configuration defines:
- Base image: `e2bdev/code-interpreter:latest`
- Exposed ports: 3000 (Next.js), 8080 (API)
- Resource limits: 2 CPU cores, 4GB RAM
- Build timeout: 10 minutes
- Environment variable mapping

## 🧪 Testing the Template

### Local Testing

```bash
# Build and test locally (requires Docker)
docker build -f e2b.Dockerfile -t claude-code-e2b-test .
docker run -p 3000:3000 -p 8080:8080 claude-code-e2b-test
```

### E2B Testing

```bash
# Create a test sandbox
e2b sandbox create your-template-id

# Check health
curl https://sandbox-id-8080.e2b.dev/health

# Test frontend
open https://sandbox-id-3000.e2b.dev
```

## 🔄 Template Updates

To update the template:

1. Make changes to your code
2. Run the deployment script again:
   ```bash
   ./create-template.sh
   ```
3. Update your integration with the new template ID

## 📊 Monitoring & Debugging

### Service Logs

Logs are available at:
- API Service: `/code/logs/api-service.log`
- Next.js: `/code/logs/nextjs.log`

### Health Checks

The API service provides health information:
```bash
curl https://your-sandbox-8080.e2b.dev/health
```

Response includes:
- Overall service status
- Individual service health (Claude, Git, Files, Project)
- Timestamp and diagnostic information

### WebSocket Monitoring

Real-time events are broadcast via WebSocket:
- File changes
- Git operations
- Claude responses
- Build status updates

## 🔒 Security

### Environment Variables

- Never hardcode API keys in the Dockerfile or code
- Use E2B's environment variable injection
- Sensitive variables are not logged or exposed

### Sandbox Isolation

- Each sandbox is completely isolated
- File system access is sandboxed
- Network access is controlled by E2B
- Automatic cleanup when sandbox is destroyed

## 🐛 Troubleshooting

### Common Issues

**Template Build Fails:**
```bash
# Check build logs
e2b template logs your-template-id

# Test Docker build locally
docker build -f e2b.Dockerfile -t test .
```

**Services Don't Start:**
```bash
# Check start script permissions
chmod +x scripts/start-services.sh

# Verify ports are not conflicting
netstat -tlnp | grep ':3000\|:8080'
```

**API Service Unhealthy:**
```bash
# Check API logs in sandbox
cat /code/logs/api-service.log

# Verify environment variables
env | grep ANTHROPIC_API_KEY
```

**Next.js Build Issues:**
```bash
# Check Next.js logs
cat /code/logs/nextjs.log

# Verify dependencies
cd /code/baseline-project && npm ls
```

### Support

For template-specific issues:
1. Check the logs in `/code/logs/`
2. Verify environment variables are set
3. Test health endpoints
4. Check E2B sandbox status
5. Review build and start script outputs

## 📈 Performance

### Resource Usage

- **Memory**: ~2GB for both services
- **CPU**: Moderate usage during builds, low during idle
- **Disk**: ~1GB for base template, grows with project files
- **Network**: Minimal except during git operations

### Optimization Tips

- Use `.dockerignore` to exclude unnecessary files
- Pre-install common dependencies in the base image
- Use multi-stage builds for smaller images
- Monitor resource usage with E2B dashboard

## 🎯 Integration

This template is designed to work seamlessly with:

- **PRIA Frontend**: Through the integration guide
- **Supabase**: For database and real-time features
- **GitHub**: For version control and deployment
- **Vercel**: For application deployment
- **Claude API**: For AI-powered development assistance

The template provides the isolated development environment that PRIA users interact with to build their applications using Claude Code integration.