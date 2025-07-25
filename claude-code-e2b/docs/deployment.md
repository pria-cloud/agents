# Deployment Guide

This guide covers deploying the Claude Code E2B integration to production environments.

## 🚀 E2B Template Deployment

### Prerequisites

1. **E2B Account**: Sign up at [e2b.dev](https://e2b.dev)
2. **E2B CLI**: Install the E2B command line tool
```bash
npm install -g @e2b/cli
e2b auth login
```

3. **Environment Setup**: Prepare your environment variables
4. **Docker**: Ensure Docker is installed for local testing

### Step 1: Configure Template

1. **Update e2b.toml**:
```toml
template_id = "your-unique-template-id"
team_id = "your-e2b-team-id"
dockerfile = "e2b.Dockerfile"

[resources]
cpu = 2
memory = 4096
disk = 10240

[networking]
ports = [3000, 8080]
```

2. **Set Environment Variables** in E2B Dashboard:
   - `ANTHROPIC_API_KEY`: Your Anthropic API key
   - `GITHUB_TOKEN`: GitHub personal access token
   - `GIT_USER_NAME`: Default git user name
   - `GIT_USER_EMAIL`: Default git email
   - `NODE_ENV`: Set to `production`

### Step 2: Build and Deploy Template

1. **Navigate to template directory**:
```bash
cd claude-code-e2b/e2b-template
```

2. **Build the template**:
```bash
e2b template build
```

3. **Test locally** (optional):
```bash
e2b template test
```

4. **Deploy to E2B**:
```bash
e2b template deploy
```

### Step 3: Verify Deployment

1. **Create a sandbox** to test:
```bash
e2b sandbox create your-template-id
```

2. **Check services are running**:
   - API service should be accessible on port 8080
   - Next.js app should be accessible on port 3000
   - Health check: `curl http://localhost:8080/health`

## 🌐 Frontend Integration

### Option 1: Direct E2B Integration

Use E2B sandboxes directly from your frontend application:

```typescript
import { Sandbox } from '@e2b/sdk'

const sandbox = await Sandbox.create('your-template-id')
const url = await sandbox.getHostname()

// Redirect user to the sandbox
window.open(`https://${url}`, '_blank')
```

### Option 2: A2A Router Integration

Route requests through your existing A2A router:

```typescript
// In your A2A router
app.post('/api/create-claude-session', async (req, res) => {
  const sandbox = await Sandbox.create('your-template-id')
  const hostname = await sandbox.getHostname()
  
  res.json({
    sandboxId: sandbox.sandboxId,
    url: `https://${hostname}`,
    apiUrl: `https://${hostname}:8080`
  })
})
```

### Option 3: Embedded Interface

Embed the Claude Code interface in your existing application:

```typescript
// Iframe integration
const iframe = document.createElement('iframe')
iframe.src = `https://${sandboxHostname}`
iframe.style.width = '100%'
iframe.style.height = '100vh'
document.body.appendChild(iframe)
```

## 🔧 Configuration Management

### Environment Variables

Create different configurations for different environments:

**Development** (`.env.development`):
```bash
NODE_ENV=development
API_PORT=8080
NEXT_PORT=3000
DEBUG=*
LOG_LEVEL=debug
```

**Staging** (`.env.staging`):
```bash
NODE_ENV=staging
API_PORT=8080
NEXT_PORT=3000
LOG_LEVEL=info
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
```

**Production** (`.env.production`):
```bash
NODE_ENV=production
API_PORT=8080
NEXT_PORT=3000
LOG_LEVEL=warn
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
```

### Template Variants

Create different templates for different use cases:

1. **Development Template** (`claude-code-dev`):
   - Full debugging tools
   - Development dependencies
   - Hot reload enabled
   - Verbose logging

2. **Production Template** (`claude-code-prod`):
   - Optimized build
   - Minimal dependencies
   - Production logging
   - Enhanced security

3. **Enterprise Template** (`claude-code-enterprise`):
   - Additional security features
   - Audit logging
   - Custom authentication
   - Resource monitoring

## 📊 Monitoring and Logging

### Health Checks

Implement comprehensive health checks:

```typescript
// Enhanced health check endpoint
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      claude: await claudeService.isHealthy(),
      git: await gitService.isHealthy(),
      files: await fileService.isHealthy(),
      websocket: wsService.isHealthy()
    },
    resources: {
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      loadAverage: os.loadavg()
    }
  }
  
  const allHealthy = Object.values(health.services).every(Boolean)
  res.status(allHealthy ? 200 : 503).json(health)
})
```

### Logging Configuration

Set up structured logging:

```typescript
import winston from 'winston'

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: '/code/logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: '/code/logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
})
```

### Metrics Collection

Implement metrics for monitoring:

```typescript
import promClient from 'prom-client'

// Create metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'status_code']
})

const claudeRequestsTotal = new promClient.Counter({
  name: 'claude_requests_total',
  help: 'Total number of Claude Code requests'
})

// Metrics endpoint
app.get('/metrics', (req, res) => {
  res.set('Content-Type', promClient.register.contentType)
  res.end(promClient.register.metrics())
})
```

## 🔒 Production Security

### API Security

1. **Rate Limiting**:
```typescript
import rateLimit from 'express-rate-limit'

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
})

app.use('/api/', limiter)
```

2. **Input Validation**:
```typescript
import { body, validationResult } from 'express-validator'

app.post('/api/claude/chat',
  body('message').isLength({ min: 1, max: 10000 }).escape(),
  body('conversationId').optional().isUUID(),
  (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }
    // Process request
  }
)
```

3. **CORS Configuration**:
```typescript
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [],
  credentials: true,
  optionsSuccessStatus: 200
}))
```

### Container Security

1. **Non-root User**:
```dockerfile
# In Dockerfile
RUN useradd -m -u 1001 appuser
USER appuser
```

2. **File Permissions**:
```bash
# Restrict file permissions
chmod 755 /code
chmod 644 /code/logs/*
```

3. **Resource Limits**:
```toml
# In e2b.toml
[resources]
cpu = 2
memory = 4096
disk = 10240
network_bandwidth = "100mbps"
```

## 🔄 CI/CD Pipeline

### GitHub Actions Example

```yaml
name: Deploy Claude Code E2B Template

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: |
          cd claude-code-e2b/e2b-template/api-service
          npm ci
          cd ../baseline-project
          npm ci
          
      - name: Run tests
        run: |
          cd claude-code-e2b/e2b-template/api-service
          npm test
          cd ../baseline-project
          npm run lint
          npm run type-check

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup E2B CLI
        run: |
          npm install -g @e2b/cli
          e2b auth login --api-key ${{ secrets.E2B_API_KEY }}
          
      - name: Deploy template
        run: |
          cd claude-code-e2b/e2b-template
          e2b template build
          e2b template deploy
        env:
          E2B_API_KEY: ${{ secrets.E2B_API_KEY }}
```

## 📈 Scaling Considerations

### Horizontal Scaling

1. **Multiple Template Versions**:
   - Deploy different template versions for A/B testing
   - Load balance between template instances
   - Implement feature flags for gradual rollouts

2. **Regional Deployment**:
   - Deploy templates in multiple regions
   - Route users to nearest region
   - Implement cross-region failover

### Performance Optimization

1. **Container Optimization**:
   - Use multi-stage Docker builds
   - Minimize image size
   - Pre-warm containers

2. **Caching Strategy**:
   - Cache Claude Code responses
   - Implement file system caching
   - Use Redis for session storage

3. **Resource Management**:
   - Monitor resource usage
   - Implement auto-scaling
   - Set appropriate limits

## 🚨 Troubleshooting

### Common Deployment Issues

1. **Template Build Failures**:
```bash
# Check build logs
e2b template build --verbose

# Test locally first
docker build -f e2b.Dockerfile -t test-image .
docker run -it test-image /bin/bash
```

2. **Environment Variable Issues**:
```bash
# Verify in running container
e2b sandbox create your-template-id
e2b sandbox exec <sandbox-id> -- env | grep ANTHROPIC
```

3. **Port Conflicts**:
```bash
# Check if ports are accessible
e2b sandbox exec <sandbox-id> -- netstat -tlnp
curl http://<sandbox-hostname>:8080/health
```

4. **Service Startup Issues**:
```bash
# Check service logs
e2b sandbox exec <sandbox-id> -- cat /code/logs/api-service.log
e2b sandbox exec <sandbox-id> -- cat /code/logs/nextjs.log
```

### Debug Mode

Enable comprehensive debugging:

```bash
# Set debug environment variables
DEBUG=*
LOG_LEVEL=debug
NODE_ENV=development

# Enable verbose logging in services
CLAUDE_DEBUG=true
GIT_DEBUG=true
FILE_DEBUG=true
```

This deployment guide provides a comprehensive approach to deploying and managing the Claude Code E2B integration in production environments.