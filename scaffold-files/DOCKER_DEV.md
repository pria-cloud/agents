# Docker Development Environment

This project includes a complete Docker development environment with hot reload capabilities.

## Quick Start

### Start Development Environment
```bash
npm run docker:dev
```

### Stop Development Environment
```bash
npm run docker:dev:down
```

### View Logs
```bash
npm run docker:dev:logs
```

## Manual Docker Commands

### Build and Run Development Container
```bash
docker-compose -f docker-compose.dev.yml up --build
```

### Run in Background
```bash
docker-compose -f docker-compose.dev.yml up -d --build
```

### Stop All Services
```bash
docker-compose -f docker-compose.dev.yml down
```

## How It Works

### 🔥 Hot Reload
- Your local files are mounted into the container
- Changes to your code trigger automatic reloads
- No need to rebuild the Docker image for code changes

### 📁 Volume Mounting
- `./` → `/app` (your source code)
- `/app/node_modules` (excluded - uses container's node_modules)
- `/app/.next` (excluded - uses container's build cache)

### 🔧 Environment Variables
- `NODE_ENV=development`
- `CHOKIDAR_USEPOLLING=true` (enables file watching in Docker)
- `WATCHPACK_POLLING=true` (webpack polling for better compatibility)

## Development Workflow

1. **Start the development environment:**
   ```bash
   npm run docker:dev
   ```

2. **Open your browser:**
   ```
   http://localhost:3000
   ```

3. **Edit your code:**
   - Make changes to any file in your project
   - See changes reflected immediately in the browser
   - Hot reload works for React components, styles, and pages

4. **Install new packages:**
   ```bash
   # Stop the container first
   npm run docker:dev:down
   
   # Install packages locally
   npm install <package-name>
   
   # Restart with rebuild to include new packages
   npm run docker:dev
   ```

## Production vs Development

| Aspect | Development (Dockerfile.dev) | Production (Dockerfile) |
|--------|------------------------------|-------------------------|
| Purpose | Hot reload development | Optimized production build |
| Size | Larger (includes dev deps) | Smaller (standalone) |
| Speed | Fast startup | Fast runtime |
| File watching | ✅ Enabled | ❌ Not needed |
| Volume mounting | ✅ Source code mounted | ❌ Code copied to image |

## Troubleshooting

### Port Already in Use
```bash
# Stop any running containers
npm run docker:dev:down

# Check what's using port 3000
lsof -i :3000

# Kill the process if needed
kill -9 <PID>
```

### File Changes Not Detected
If hot reload isn't working:
1. Check that polling is enabled (it should be by default)
2. Restart the development container:
   ```bash
   npm run docker:dev:down
   npm run docker:dev
   ```

### Permission Issues (Linux/WSL)
```bash
# Fix ownership if files are created by Docker
sudo chown -R $USER:$USER .
```

## Performance Tips

- Use `.dockerignore` to exclude unnecessary files
- Keep `node_modules` and `.next` as volume exclusions
- Consider using Docker Desktop's file sharing optimizations
- On Windows, enable WSL2 backend for better performance 