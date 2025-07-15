# Next.js Development Scaffold

A production-ready Next.js scaffold with **Daytona.io integration**, Docker development environment, and comprehensive API communication capabilities.

## 🚀 Quick Start

### Local Development
```bash
npm install
npm run dev
```

### Docker Development (Hot Reload)
```bash
npm run docker:dev
```

### Daytona.io Cloud Development
1. Import this repository to Daytona.io
2. Your environment will auto-start with hot reload
3. Access via: `https://<workspace-id>.daytona.app`

## 📡 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check and system status |
| `/api/workspace` | GET | Workspace information |
| `/api/workspace/files` | POST | List files in directory |
| `/api/workspace/files` | GET | **🔥 Read file content** |
| `/api/workspace/files` | PUT | **🔥 HOT SWAP: Write/update files** |
| `/api/workspace/files` | DELETE | **🔥 Delete files** |
| `/api/workspace/github` | GET | **🚀 Preview GitHub repository** |
| `/api/workspace/github` | POST | **🚀 Import GitHub repository & hot swap** |
| `/api/webhooks/external` | POST | Receive external webhooks |

### 🔥 **NEW: Hot Swap File API**
You can now **modify, create, and delete files remotely** with instant hot reload!

```bash
# Read a file
curl "https://workspace.daytona.app/api/workspace/files?path=app/page.tsx"

# Hot swap a React component (triggers instant reload!)
curl -X PUT "https://workspace.daytona.app/api/workspace/files" \
  -H "Content-Type: application/json" \
  -d '{
    "path": "app/components/HotSwapped.tsx",
    "content": "export default function HotSwapped() { return <div>🔥 Hot Swapped!</div>; }"
  }'
```

### 🚀 **NEW: GitHub Repository Import**
Import entire repositories and hot swap all files instantly!

```bash
# Preview repository
curl "https://workspace.daytona.app/api/workspace/github?url=https://github.com/vercel/next.js-examples"

# Import repository (hot swaps all files!)
curl -X POST "https://workspace.daytona.app/api/workspace/github" \
  -H "Content-Type: application/json" \
  -d '{
    "repoUrl": "https://github.com/shadcn-ui/next-template",
    "branch": "main",
    "overwrite": true
  }'
```

See [`HOT_SWAP_API.md`](./HOT_SWAP_API.md) for complete hot swapping guide.
See [`GITHUB_IMPORT_API.md`](./GITHUB_IMPORT_API.md) for GitHub import guide.

## 🐳 Development Environments

### Local Docker Development
- **Hot reload enabled**
- **File watching with polling**
- **Volume mounting for instant changes**

```bash
npm run docker:dev         # Start development environment
npm run docker:dev:down    # Stop environment
npm run docker:dev:logs    # View logs
```

### Daytona.io Cloud Development
- **Automated container setup**
- **VS Code with extensions**
- **Public URL for API access**
- **Resource allocation: 2 CPU, 4Gi RAM**

See [`DAYTONA_SETUP.md`](./DAYTONA_SETUP.md) for complete integration guide.

## 🔧 Configuration Files

| File | Purpose |
|------|---------|
| `Dockerfile` | Production container |
| `Dockerfile.dev` | Development container with hot reload |
| `docker-compose.dev.yml` | Development orchestration |
| `.devcontainer/devcontainer.json` | VS Code dev container config |
| `.daytona/config.yml` | Daytona workspace configuration |

## 🌐 External API Communication

### Test API from Command Line
```bash
# Health check
npm run daytona:health

# Workspace info
npm run daytona:workspace

# List files
npm run daytona:test-api

# 🔥 NEW: Hot swap testing
npm run daytona:read-file      # Read file content
npm run daytona:hot-swap-demo  # Hot swap demo file

# 🚀 NEW: GitHub import testing
npm run daytona:github-preview # Preview GitHub repository
npm run daytona:github-import  # Import repository & hot swap
```

### External Service Integration
Use the provided [`examples/api-client-example.js`](./examples/api-client-example.js) to communicate with your workspace from external services.

```javascript
const client = new DaytonaWorkspaceClient('https://your-workspace-id.daytona.app');
await client.checkHealth();
await client.listFiles('src');
```

## 📁 Project Structure

```
├── app/
│   ├── api/                    # API routes
│   │   ├── health/            # Health check endpoint
│   │   ├── workspace/         # Workspace management
│   │   └── webhooks/          # External webhook handlers
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/                 # React components
├── lib/                       # Utilities and configurations
├── .devcontainer/             # VS Code dev container config
├── .daytona/                  # Daytona workspace config
├── examples/                  # API client examples
├── Dockerfile                 # Production container
├── Dockerfile.dev             # Development container
├── docker-compose.dev.yml     # Development orchestration
└── DAYTONA_SETUP.md          # Daytona integration guide
```

## 🔄 Development Workflow

### 1. Choose Your Environment
- **Local**: `npm run dev`
- **Docker**: `npm run docker:dev`
- **Daytona**: Import to Daytona.io

### 2. Code with Hot Reload
- Edit any file
- See changes instantly
- API endpoints are live

### 3. Test API Communication
```bash
# From within environment
curl http://localhost:3000/api/health

# From external (Daytona)
curl https://<workspace-id>.daytona.app/api/health
```

## 🔍 Monitoring & Health Checks

### Built-in Health Monitoring
- Automatic health checks every 30 seconds
- Memory and uptime reporting
- Daytona environment detection

### Manual Health Check
```bash
curl http://localhost:3000/api/health
```

**Response:**
```json
{
  "status": "healthy",
  "environment": "development",
  "daytona": true,
  "uptime": 3600.5,
  "memory": {...}
}
```

## 🚀 Deployment

### Production Docker
```bash
docker build -t my-app .
docker run -p 3000:3000 my-app
```

### Vercel
```bash
npm run build
# Deploy to Vercel
```

## 📚 Documentation

- [`DOCKER_DEV.md`](./DOCKER_DEV.md) - Docker development guide
- [`DAYTONA_SETUP.md`](./DAYTONA_SETUP.md) - Daytona.io integration guide
- [`HOT_SWAP_API.md`](./HOT_SWAP_API.md) - 🔥 Hot swap file API guide
- [`GITHUB_IMPORT_API.md`](./GITHUB_IMPORT_API.md) - 🚀 GitHub repository import guide
- [`examples/`](./examples/) - API client examples

## 🛠️ Tech Stack

- **Framework**: Next.js 15
- **Styling**: Tailwind CSS
- **Components**: Radix UI
- **Development**: Docker + Docker Compose
- **Cloud Dev**: Daytona.io
- **API**: Next.js App Router API routes

## 📋 Features

- ✅ **Hot Reload Development**
- ✅ **Docker Development Environment**
- ✅ **Daytona.io Cloud Integration**
- ✅ **API Communication Ready**
- ✅ **🔥 HOT SWAP File API** - Modify files remotely with instant reload
- ✅ **🚀 GitHub Repository Import** - Import entire repos & hot swap
- ✅ **File System API Access** - Read, write, delete files via API
- ✅ **Health Monitoring**
- ✅ **External Webhook Support**
- ✅ **CORS Enabled**
- ✅ **Security Protected** - Directory traversal protection
- ✅ **Production Ready**

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Test in both Docker and Daytona environments
4. Submit a pull request

---

**Ready for development in any environment!** 🎉
