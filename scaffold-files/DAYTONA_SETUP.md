# Daytona.io Integration Guide

This Next.js scaffold is fully configured for **Daytona.io** cloud development environments with API communication capabilities.

## 🚀 Quick Start with Daytona

### 1. Create Workspace in Daytona
```bash
# Using Daytona CLI
daytona create <your-repo-url>

# Or use the Daytona dashboard to import your repository
```

### 2. Access Your Environment
- **Development Server**: `https://<workspace-id>.daytona.app`
- **API Endpoints**: `https://<workspace-id>.daytona.app/api/`

## 📡 API Communication

### Available API Endpoints

#### Health Check
```bash
GET /api/health
```
Returns environment status, uptime, memory usage, and Daytona detection.

**Example Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "environment": "development",
  "daytona": true,
  "uptime": 3600.5,
  "memory": {
    "rss": 67108864,
    "heapTotal": 29360128,
    "heapUsed": 20971520
  },
  "version": "1.0.0"
}
```

#### Workspace Information
```bash
GET /api/workspace
```
Returns workspace details and capabilities.

```bash
POST /api/workspace/files
Content-Type: application/json

{
  "path": "src/components"
}
```
Lists files and directories in the specified path.

### External API Communication

#### From Outside Daytona → Your Workspace
```bash
# Health check
curl https://<workspace-id>.daytona.app/api/health

# Get workspace info
curl https://<workspace-id>.daytona.app/api/workspace

# List files
curl -X POST https://<workspace-id>.daytona.app/api/workspace/files \
  -H "Content-Type: application/json" \
  -d '{"path": "src"}'
```

#### From Your Workspace → External APIs
```javascript
// In your Next.js application
const response = await fetch('https://external-api.com/data', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + process.env.API_TOKEN
  },
  body: JSON.stringify({ data: 'your-data' })
});
```

## 🔧 Configuration Files

### `.devcontainer/devcontainer.json`
- Configures VS Code development environment
- Sets up port forwarding (3000)
- Installs recommended extensions
- Configures environment variables

### `.daytona/config.yml`
- Daytona-specific workspace configuration
- Resource allocation settings
- Health check configuration
- Auto-start scripts

### `docker-compose.dev.yml`
- Development container orchestration
- Volume mounting for hot reload
- Health check monitoring
- Network configuration

## 🌐 Networking & Ports

| Port | Service | Access | Description |
|------|---------|--------|-------------|
| 3000 | Next.js Dev Server | Public | Main application and API endpoints |

## 🔐 Environment Variables

The following environment variables are automatically set in Daytona:

```bash
DAYTONA_ENV=true              # Indicates Daytona environment
NODE_ENV=development          # Development mode
NEXT_TELEMETRY_DISABLED=1     # Disable Next.js telemetry
CHOKIDAR_USEPOLLING=true      # Enable file watching
WATCHPACK_POLLING=true        # Enable webpack polling
HOSTNAME=0.0.0.0              # Allow external connections
```

## 🔄 Development Workflow

### 1. Start Development
Your environment automatically starts when the workspace is created:
```bash
npm install
npm run dev
```

### 2. Live Development
- Edit files in the Daytona VS Code interface
- Changes are reflected immediately (hot reload)
- API endpoints are live and accessible

### 3. Test API Communication
```bash
# Test from terminal in Daytona
curl http://localhost:3000/api/health

# Test from external system
curl https://<workspace-id>.daytona.app/api/health
```

## 🔍 Monitoring & Debugging

### Health Monitoring
The workspace includes automatic health checks:
- **Endpoint**: `/api/health`
- **Interval**: Every 30 seconds
- **Timeout**: 10 seconds
- **Retries**: 3 attempts

### Log Access
```bash
# View application logs in Daytona terminal
npm run docker:dev:logs

# Or check the integrated terminal
tail -f .next/trace
```

### Debug API Calls
```bash
# Enable detailed logging
export DEBUG=next:*

# Restart development server
npm run dev
```

## 📋 API Integration Examples

### External Service Integration
```typescript
// lib/api-client.ts
export class ExternalApiClient {
  private baseUrl: string;
  
  constructor() {
    this.baseUrl = process.env.EXTERNAL_API_URL || 'https://api.example.com';
  }
  
  async syncData(data: any) {
    const response = await fetch(`${this.baseUrl}/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.API_TOKEN}`
      },
      body: JSON.stringify(data)
    });
    
    return response.json();
  }
}
```

### Webhook Handling
```typescript
// app/api/webhooks/external/route.ts
export async function POST(request: NextRequest) {
  const payload = await request.json();
  
  // Process webhook data
  console.log('Received webhook:', payload);
  
  // Respond to external system
  return NextResponse.json({ 
    received: true, 
    timestamp: new Date().toISOString() 
  });
}
```

## 🛠️ Troubleshooting

### Port Not Accessible
1. Check Daytona port forwarding is enabled
2. Verify the service is running on `0.0.0.0:3000`
3. Check firewall settings in workspace

### API Calls Failing
1. Verify CORS headers are set correctly
2. Check environment variables are loaded
3. Test locally with curl first

### Hot Reload Not Working
1. Ensure volume mounting is working
2. Check file watching environment variables
3. Restart the workspace if needed

### Performance Issues
1. Increase resource allocation in `.daytona/config.yml`
2. Check memory usage via `/api/health`
3. Monitor container logs for errors

## 📚 Additional Resources

- [Daytona Documentation](https://daytona.io/docs)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [DevContainer Specification](https://containers.dev/)

## 🔗 Quick Links

- **Health Check**: `/api/health`
- **Workspace Info**: `/api/workspace`
- **File Listing**: `/api/workspace/files`
- **Development Server**: `http://localhost:3000`

Your Daytona environment is now ready for development with full API communication capabilities! 🎉 