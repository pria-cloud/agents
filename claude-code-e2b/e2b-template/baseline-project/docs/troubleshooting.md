# PRIA Platform Troubleshooting Guide

Comprehensive troubleshooting guide for common issues, error resolution, and system maintenance for the Platform for Rapid Intelligent Applications (PRIA).

## 📋 Table of Contents

1. [Quick Diagnostics](#quick-diagnostics)
2. [Authentication Issues](#authentication-issues)
3. [Application Development Issues](#application-development-issues)
4. [AI Integration Problems](#ai-integration-problems)
5. [E2B Sandbox Issues](#e2b-sandbox-issues)
6. [GitHub Integration Problems](#github-integration-problems)
7. [Deployment Issues](#deployment-issues)
8. [Performance Problems](#performance-problems)
9. [Database Issues](#database-issues)
10. [Network and Connectivity](#network-and-connectivity)
11. [Error Reference](#error-reference)
12. [Getting Help](#getting-help)

## 🔍 Quick Diagnostics

### Health Check Procedure

Before diving into specific issues, run these quick checks:

```bash
# 1. Check system health
curl https://your-pria-instance.com/api/health

# 2. Verify authentication
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://your-pria-instance.com/api/auth/me

# 3. Check workspace access
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://your-pria-instance.com/api/workspaces

# 4. Test database connectivity
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://your-pria-instance.com/api/health/metrics
```

### System Status Indicators

| Status | Health API Response | Meaning |
|--------|-------------------|---------|
| 🟢 **Healthy** | `"status": "healthy"` | All systems operational |
| 🟡 **Degraded** | `"status": "degraded"` | Some services experiencing issues |
| 🔴 **Unhealthy** | `"status": "unhealthy"` | Critical systems down |

### Common Log Locations

```bash
# Application logs (Next.js)
tail -f .next/trace

# System logs (if using Docker)
docker logs pria-platform

# Vercel function logs
vercel logs --follow

# Browser console (for frontend issues)
# Open Developer Tools > Console
```

## 🔐 Authentication Issues

### "Authentication Required" Error

**Symptoms:**
- 401 Unauthorized responses
- Redirect to login page
- "Authentication token required" message

**Diagnosis:**
```bash
# Check if token is present
echo $PRIA_AUTH_TOKEN

# Verify token validity
curl -H "Authorization: Bearer $PRIA_AUTH_TOKEN" \
     https://your-instance.com/api/auth/me
```

**Solutions:**

#### 1. **Missing Token**
```bash
# Log in again to get fresh token
curl -X POST https://your-instance.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "your-email", "password": "your-password"}'
```

#### 2. **Expired Token**
```bash
# Refresh the token
curl -X POST https://your-instance.com/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "YOUR_REFRESH_TOKEN"}'
```

#### 3. **Invalid Token Format**
Ensure token is properly formatted:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### "Workspace Access Denied" Error

**Symptoms:**
- 403 Forbidden responses
- Can authenticate but can't access resources

**Solutions:**

#### 1. **Check Workspace Membership**
```bash
# List accessible workspaces
curl -H "Authorization: Bearer $TOKEN" \
     https://your-instance.com/api/workspaces
```

#### 2. **Verify Role Permissions**
```typescript
// Check user role in workspace
const user = await pria.auth.me()
console.log(user.workspaces.map(w => ({ name: w.name, role: w.role })))
```

#### 3. **Request Access**
Contact workspace admin to invite you or upgrade your role.

### SSO Integration Issues

**Common SSO Problems:**

#### 1. **GitHub OAuth Errors**
```bash
# Verify GitHub app configuration
curl https://api.github.com/applications/YOUR_CLIENT_ID/token \
  -u "YOUR_CLIENT_ID:YOUR_CLIENT_SECRET" \
  -X POST \
  -d '{"access_token": "TOKEN_TO_CHECK"}'
```

#### 2. **Redirect URI Mismatch**
Ensure GitHub app redirect URI matches:
```
https://your-domain.com/auth/callback/github
```

## 📱 Application Development Issues

### Application Creation Failures

**Symptoms:**
- "Application creation failed" error
- Timeout during application setup
- Missing application files

**Diagnosis:**
```bash
# Check application creation logs
curl -H "Authorization: Bearer $TOKEN" \
     "https://your-instance.com/api/applications/APPLICATION_ID" | jq '.status'

# Verify workspace limits
curl -H "Authorization: Bearer $TOKEN" \
     "https://your-instance.com/api/workspaces/WORKSPACE_ID" | jq '.usage'
```

**Solutions:**

#### 1. **Resource Limits Exceeded**
```typescript
// Check workspace usage
const workspace = await pria.workspaces.get(workspaceId)
console.log('Applications:', workspace.usage.applications, '/', workspace.usage.max_applications)
```

**Fix:** Upgrade workspace plan or delete unused applications.

#### 2. **Name Conflicts**
```bash
# Check for existing application with same name
curl -H "Authorization: Bearer $TOKEN" \
     "https://your-instance.com/api/applications?search=APP_NAME"
```

**Fix:** Use a unique application name.

#### 3. **Invalid Configuration**
Ensure application configuration is valid:
```typescript
// Valid application configuration
{
  name: "Valid App Name",        // No special characters
  type: "web_app",              // Valid type
  framework: "nextjs",          // Supported framework
  configuration: {
    database_enabled: true,      // Boolean values
    authentication_enabled: true
  }
}
```

### Session Management Problems

**Symptoms:**
- Sessions not starting
- Session stuck in "pending" state
- Lost session data

**Solutions:**

#### 1. **Session Timeout Issues**
```typescript
// Check session status
const session = await pria.sessions.get(sessionId)
if (session.status === 'timeout') {
  // Restart session
  await pria.sessions.restart(sessionId)
}
```

#### 2. **Memory Issues**
```bash
# Check memory usage
curl -H "Authorization: Bearer $TOKEN" \
     "https://your-instance.com/api/health/metrics" | jq '.memory'
```

**Fix:** Clear browser cache, restart session, or upgrade workspace.

#### 3. **Orphaned Sessions**
```bash
# List active sessions
curl -H "Authorization: Bearer $TOKEN" \
     "https://your-instance.com/api/sessions?status=active"

# Clean up old sessions
curl -X DELETE -H "Authorization: Bearer $TOKEN" \
     "https://your-instance.com/api/sessions/SESSION_ID"
```

## 🤖 AI Integration Problems

### Claude API Errors

**Symptoms:**
- "Claude API error" messages
- Slow AI responses
- AI operations timing out

**Diagnosis:**
```bash
# Check Claude API status
curl -H "Authorization: Bearer $ANTHROPIC_API_KEY" \
     "https://api.anthropic.com/v1/models"

# Verify API key
echo "API Key: ${ANTHROPIC_API_KEY:0:10}..."
```

**Solutions:**

#### 1. **API Key Issues**
```bash
# Test API key validity
curl -H "Authorization: Bearer $ANTHROPIC_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"model": "claude-3-sonnet-20240229", "messages": [{"role": "user", "content": "test"}], "max_tokens": 10}' \
     "https://api.anthropic.com/v1/messages"
```

**Fix:** Verify API key in environment variables:
```bash
export ANTHROPIC_API_KEY=sk-ant-your-actual-key-here
```

#### 2. **Rate Limit Exceeded**
```typescript
// Check rate limit status
const response = await fetch('/api/claude/execute', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify(payload)
})

if (response.status === 429) {
  const retryAfter = response.headers.get('Retry-After')
  console.log(`Rate limited. Retry after ${retryAfter} seconds`)
}
```

**Fix:** Implement exponential backoff or upgrade API plan.

#### 3. **Token Context Limits**
```typescript
// Reduce context size for large operations
const optimizedPrompt = {
  prompt: prompt.substring(0, 4000),  // Truncate if too long
  context: {
    files: context.files?.slice(0, 5), // Limit file count
    previous_conversation: conversation.slice(-10) // Keep recent history
  }
}
```

### AI Operation Timeouts

**Symptoms:**
- Operations taking longer than expected
- Timeout errors
- Incomplete AI responses

**Solutions:**

#### 1. **Increase Timeout Values**
```typescript
// Extend timeout for complex operations
const result = await pria.claude.execute({
  session_id: sessionId,
  prompt: complexPrompt,
  options: {
    timeout: 120000  // 2 minutes instead of default 30 seconds
  }
})
```

#### 2. **Break Down Complex Requests**
```typescript
// Split large operations into smaller chunks
const steps = [
  'Create the database schema',
  'Create the API endpoints',
  'Create the frontend components',
  'Add authentication'
]

for (const step of steps) {
  const result = await pria.claude.execute({
    session_id: sessionId,
    prompt: step,
    options: { timeout: 60000 }
  })
}
```

## 🐳 E2B Sandbox Issues

### Sandbox Creation Failures

**Symptoms:**
- "Failed to create sandbox" error
- Sandbox stuck in "creating" state
- Connection timeouts

**Diagnosis:**
```bash
# Check E2B service status
curl -H "Authorization: Bearer $E2B_API_KEY" \
     "https://api.e2b.dev/sandboxes"

# List active sandboxes
curl -H "Authorization: Bearer $TOKEN" \
     "https://your-instance.com/api/e2b/sandboxes"
```

**Solutions:**

#### 1. **API Key Issues**
```bash
# Verify E2B API key
export E2B_API_KEY=your-e2b-api-key
curl -H "Authorization: Bearer $E2B_API_KEY" \
     "https://api.e2b.dev/templates"
```

#### 2. **Resource Limits**
```typescript
// Check sandbox usage
const sandboxes = await pria.e2b.list()
console.log(`Active sandboxes: ${sandboxes.length}`)

// Clean up unused sandboxes
for (const sandbox of sandboxes) {
  if (sandbox.status === 'idle' && isOlderThan(sandbox.created_at, '1 hour')) {
    await pria.e2b.delete(sandbox.id)
  }
}
```

#### 3. **Template Issues**
```bash
# List available templates
curl -H "Authorization: Bearer $E2B_API_KEY" \
     "https://api.e2b.dev/templates" | jq '.[] | .id'

# Use correct template ID
export E2B_TEMPLATE_ID=node  # or your custom template
```

### Code Execution Problems

**Symptoms:**
- Code execution fails
- Unexpected output
- Permission errors

**Solutions:**

#### 1. **File Permission Issues**
```typescript
// Ensure files are executable
await pria.e2b.execute(sandboxId, 'chmod +x script.sh')
await pria.e2b.execute(sandboxId, './script.sh')
```

#### 2. **Missing Dependencies**
```typescript
// Install required packages
await pria.e2b.execute(sandboxId, 'npm install express axios')
await pria.e2b.execute(sandboxId, 'pip install requests numpy')
```

#### 3. **Environment Variables**
```typescript
// Set required environment variables
await pria.e2b.execute(sandboxId, 'export NODE_ENV=development')
await pria.e2b.execute(sandboxId, 'export DATABASE_URL=postgresql://...')
```

### Sandbox Resource Exhaustion

**Symptoms:**
- Out of memory errors
- CPU throttling
- Disk space issues

**Solutions:**

#### 1. **Memory Optimization**
```typescript
// Monitor memory usage
const memoryCheck = await pria.e2b.execute(sandboxId, 'free -h')
console.log(memoryCheck.stdout)

// Reduce memory usage
await pria.e2b.execute(sandboxId, 'npm run build -- --max-old-space-size=512')
```

#### 2. **Clean Up Temporary Files**
```typescript
// Clear temporary files
await pria.e2b.execute(sandboxId, 'rm -rf /tmp/* node_modules/.cache')
```

## 🐙 GitHub Integration Problems

### OAuth Authentication Failures

**Symptoms:**
- "GitHub authentication failed" error
- Redirect loop during OAuth
- Invalid OAuth state

**Diagnosis:**
```bash
# Check GitHub OAuth app settings
curl -u "CLIENT_ID:CLIENT_SECRET" \
     "https://api.github.com/applications/CLIENT_ID"

# Verify redirect URI configuration
echo "Redirect URI should be: https://your-domain.com/auth/callback/github"
```

**Solutions:**

#### 1. **OAuth App Configuration**
Verify GitHub OAuth app settings:
- **Homepage URL**: `https://your-domain.com`
- **Authorization callback URL**: `https://your-domain.com/auth/callback/github`
- **Application name**: Must match your application

#### 2. **Client Secret Issues**
```bash
# Generate new client secret in GitHub
# Update environment variable
export GITHUB_CLIENT_SECRET=new-secret-here
```

#### 3. **Scope Permissions**
Ensure adequate scopes are requested:
```typescript
const githubOAuthURL = `https://github.com/login/oauth/authorize?` +
  `client_id=${CLIENT_ID}&` +
  `redirect_uri=${REDIRECT_URI}&` +
  `scope=repo user:email&` +  // Ensure repo scope for repository access
  `state=${STATE}`
```

### Repository Access Issues

**Symptoms:**
- "Repository not found" errors
- Permission denied for repository operations
- Unable to create repositories

**Solutions:**

#### 1. **Check Repository Permissions**
```bash
# Verify repository access
curl -H "Authorization: token $GITHUB_TOKEN" \
     "https://api.github.com/repos/username/repo"

# Check user permissions
curl -H "Authorization: token $GITHUB_TOKEN" \
     "https://api.github.com/user/repos?type=owner"
```

#### 2. **Organization Restrictions**
```bash
# Check organization access
curl -H "Authorization: token $GITHUB_TOKEN" \
     "https://api.github.com/user/orgs"

# Request organization access if needed
# Contact organization admin to approve OAuth app
```

#### 3. **Token Scope Issues**
```typescript
// Check token scopes
const response = await fetch('https://api.github.com/user', {
  headers: { 'Authorization': `token ${githubToken}` }
})

const scopes = response.headers.get('X-OAuth-Scopes')
console.log('Available scopes:', scopes)
```

### Webhook Delivery Problems

**Symptoms:**
- Webhooks not received
- Webhook signature verification fails
- Delayed webhook delivery

**Solutions:**

#### 1. **Webhook Configuration**
```bash
# List webhooks for repository
curl -H "Authorization: token $GITHUB_TOKEN" \
     "https://api.github.com/repos/username/repo/hooks"

# Check webhook deliveries
curl -H "Authorization: token $GITHUB_TOKEN" \
     "https://api.github.com/repos/username/repo/hooks/HOOK_ID/deliveries"
```

#### 2. **Signature Verification**
```typescript
// Verify webhook signature
import crypto from 'crypto'

function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = 'sha256=' + 
    crypto.createHmac('sha256', secret)
          .update(payload, 'utf8')
          .digest('hex')
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}
```

#### 3. **Webhook Endpoint Issues**
```bash
# Test webhook endpoint manually
curl -X POST https://your-domain.com/api/github/webhook \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: ping" \
  -d '{"zen": "test"}'
```

## 🚀 Deployment Issues

### Build Failures

**Symptoms:**
- Build process fails
- Missing dependencies
- TypeScript compilation errors

**Diagnosis:**
```bash
# Check build logs
vercel logs $DEPLOYMENT_ID

# Local build test
npm run build
npm run type-check
npm run lint
```

**Solutions:**

#### 1. **Dependency Issues**
```bash
# Clear dependency cache
rm -rf node_modules package-lock.json
npm install

# Check for version conflicts
npm ls
npm audit fix
```

#### 2. **TypeScript Errors**
```bash
# Fix TypeScript issues
npm run type-check

# Common fixes:
# - Add missing type definitions
# - Fix import/export issues
# - Update TypeScript configuration
```

#### 3. **Environment Variables**
```bash
# Ensure all required env vars are set
vercel env ls

# Add missing variables
vercel env add VARIABLE_NAME production
```

### Deployment Timeouts

**Symptoms:**
- Deployments taking too long
- Function timeout errors
- Build process hanging

**Solutions:**

#### 1. **Optimize Build Process**
```javascript
// next.config.js optimization
module.exports = {
  experimental: {
    outputFileTracingOptimizations: true,
    outputFileTracingExcludes: {
      '*': [
        'node_modules/@swc/core-linux-x64-gnu',
        'node_modules/@swc/core-linux-x64-musl',
        'node_modules/@esbuild/linux-x64',
      ],
    },
  },
  webpack: (config) => {
    config.optimization.splitChunks = {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          chunks: 'all',
        },
      },
    }
    return config
  },
}
```

#### 2. **Increase Function Timeouts**
```json
// vercel.json
{
  "functions": {
    "app/api/**/*.ts": {
      "maxDuration": 60
    }
  }
}
```

### Runtime Errors in Production

**Symptoms:**
- 500 Internal Server Error
- Function crashes
- Memory limit exceeded

**Solutions:**

#### 1. **Memory Optimization**
```json
// vercel.json
{
  "functions": {
    "app/api/claude/**/*.ts": {
      "memory": 1024
    }
  }
}
```

#### 2. **Error Handling**
```typescript
// Add comprehensive error handling
export async function POST(request: NextRequest) {
  try {
    // Your API logic here
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('API Error:', error)
    
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.message },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

## 🚀 Performance Problems

### Slow API Responses

**Symptoms:**
- API calls taking longer than 2 seconds
- Timeout errors
- Poor user experience

**Diagnosis:**
```bash
# Check API response times
curl -w "@curl-format.txt" -o /dev/null -s \
     -H "Authorization: Bearer $TOKEN" \
     "https://your-instance.com/api/applications"

# Create curl-format.txt:
echo "time_namelookup:  %{time_namelookup}s
time_connect:     %{time_connect}s
time_appconnect:  %{time_appconnect}s
time_pretransfer: %{time_pretransfer}s
time_redirect:    %{time_redirect}s
time_starttransfer: %{time_starttransfer}s
time_total:       %{time_total}s" > curl-format.txt
```

**Solutions:**

#### 1. **Database Query Optimization**
```sql
-- Add missing indexes
CREATE INDEX CONCURRENTLY idx_applications_workspace_id_status 
ON applications(workspace_id, status);

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM applications 
WHERE workspace_id = 'uuid' AND status = 'active';
```

#### 2. **Caching Implementation**
```typescript
// Add Redis caching
import { redis } from '@/lib/redis'

export async function getCachedApplications(workspaceId: string) {
  const cacheKey = `applications:${workspaceId}`
  
  // Try cache first
  const cached = await redis.get(cacheKey)
  if (cached) {
    return JSON.parse(cached)
  }
  
  // Fetch from database
  const applications = await fetchApplications(workspaceId)
  
  // Cache for 5 minutes
  await redis.setex(cacheKey, 300, JSON.stringify(applications))
  
  return applications
}
```

#### 3. **API Response Optimization**
```typescript
// Paginate large responses
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
  const offset = parseInt(searchParams.get('offset') || '0')
  
  const applications = await db
    .from('applications')
    .select('*')
    .range(offset, offset + limit - 1)
    .order('created_at', { ascending: false })
  
  return NextResponse.json({
    data: applications,
    pagination: {
      limit,
      offset,
      has_more: applications.length === limit
    }
  })
}
```

### Memory Leaks

**Symptoms:**
- Increasing memory usage over time
- Server crashes due to out of memory
- Slow performance degradation

**Solutions:**

#### 1. **Memory Monitoring**
```typescript
// Monitor memory usage
setInterval(() => {
  const usage = process.memoryUsage()
  console.log('Memory usage:', {
    rss: Math.round(usage.rss / 1024 / 1024) + 'MB',
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + 'MB',
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + 'MB'
  })
}, 30000) // Every 30 seconds
```

#### 2. **Connection Pool Management**
```typescript
// Properly manage database connections
class DatabaseManager {
  private pool: Pool
  
  constructor() {
    this.pool = new Pool({
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000
    })
  }
  
  async query(text: string, params?: any[]) {
    const client = await this.pool.connect()
    try {
      return await client.query(text, params)
    } finally {
      client.release() // Always release connections
    }
  }
}
```

#### 3. **Cleanup Resources**
```typescript
// Clean up event listeners and timers
class SessionManager {
  private timers: Set<NodeJS.Timeout> = new Set()
  
  createTimer(callback: () => void, delay: number) {
    const timer = setTimeout(callback, delay)
    this.timers.add(timer)
    return timer
  }
  
  destroy() {
    // Clean up all timers
    this.timers.forEach(timer => clearTimeout(timer))
    this.timers.clear()
  }
}
```

## 💾 Database Issues

### Connection Problems

**Symptoms:**
- "Connection refused" errors
- Timeout connecting to database
- Max connections exceeded

**Diagnosis:**
```bash
# Test database connection
psql $DATABASE_URL -c "SELECT version();"

# Check connection count
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# Check active connections
psql $DATABASE_URL -c "
SELECT pid, usename, application_name, client_addr, state 
FROM pg_stat_activity 
WHERE state = 'active';"
```

**Solutions:**

#### 1. **Connection Pool Configuration**
```typescript
// Optimize connection pool
const supabase = createClient(url, key, {
  db: {
    pool: {
      min: 5,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000
    }
  }
})
```

#### 2. **Connection Cleanup**
```typescript
// Implement connection cleanup
process.on('SIGTERM', async () => {
  console.log('Closing database connections...')
  await supabase.removeAllChannels()
  process.exit(0)
})
```

### Slow Queries

**Symptoms:**
- Database queries taking longer than 1 second
- High CPU usage on database
- Blocking queries

**Solutions:**

#### 1. **Query Analysis**
```sql
-- Enable query logging
ALTER SYSTEM SET log_min_duration_statement = 1000;
SELECT pg_reload_conf();

-- Find slow queries
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;
```

#### 2. **Index Optimization**
```sql
-- Find missing indexes
SELECT schemaname, tablename, attname, n_distinct, correlation 
FROM pg_stats 
WHERE schemaname = 'public' 
AND n_distinct > 100;

-- Create indexes for frequent queries
CREATE INDEX CONCURRENTLY idx_applications_workspace_created 
ON applications(workspace_id, created_at DESC);
```

### Row-Level Security Issues

**Symptoms:**
- Users seeing data from other workspaces
- RLS policies not working
- Permission denied errors

**Solutions:**

#### 1. **Verify RLS Policies**
```sql
-- Check RLS status
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- List RLS policies
SELECT schemaname, tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public';
```

#### 2. **Test RLS Policies**
```sql
-- Test as specific user
SET role authenticated;
SET "request.jwt.claims" TO '{"sub": "user-id", "workspace_id": "workspace-uuid"}';

SELECT * FROM applications; -- Should only see workspace data
```

## 🌐 Network and Connectivity

### CORS Issues

**Symptoms:**
- Browser console shows CORS errors
- "Access-Control-Allow-Origin" errors
- API calls blocked by browser

**Solutions:**

#### 1. **Configure CORS Headers**
```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const response = NextResponse.next()
  
  // CORS headers
  response.headers.set('Access-Control-Allow-Origin', process.env.NEXT_PUBLIC_APP_URL || '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  
  return response
}
```

#### 2. **Handle Preflight Requests**
```typescript
// app/api/route.ts
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
```

### SSL/TLS Certificate Issues

**Symptoms:**
- "Certificate verification failed" errors
- Browser security warnings
- Mixed content warnings

**Solutions:**

#### 1. **Verify SSL Configuration**
```bash
# Check SSL certificate
openssl s_client -connect your-domain.com:443 -servername your-domain.com

# Check certificate expiration
echo | openssl s_client -connect your-domain.com:443 2>/dev/null | openssl x509 -noout -dates
```

#### 2. **Force HTTPS**
```typescript
// next.config.js
module.exports = {
  async redirects() {
    return [
      {
        source: '/(.*)',
        has: [
          {
            type: 'header',
            key: 'x-forwarded-proto',
            value: 'http',
          },
        ],
        destination: 'https://your-domain.com/:path*',
        permanent: true,
      },
    ]
  },
}
```

## 📚 Error Reference

### HTTP Status Codes

| Status | Error Type | Common Causes | Solutions |
|--------|------------|---------------|-----------|
| **400** | Bad Request | Invalid JSON, missing fields | Validate request format |
| **401** | Unauthorized | Missing/invalid token | Check authentication |
| **403** | Forbidden | Insufficient permissions | Verify user role |
| **404** | Not Found | Resource doesn't exist | Check resource ID |
| **409** | Conflict | Resource already exists | Use unique identifiers |
| **422** | Validation Error | Invalid field values | Fix input validation |
| **429** | Rate Limited | Too many requests | Implement backoff |
| **500** | Server Error | Internal system error | Check logs, contact support |

### Application Error Codes

```typescript
const PRIA_ERROR_CODES = {
  // Authentication
  'AUTH_TOKEN_EXPIRED': 'Authentication token has expired',
  'AUTH_TOKEN_INVALID': 'Authentication token is invalid',
  'AUTH_WORKSPACE_MISMATCH': 'Token workspace does not match request',
  
  // Application Management
  'APP_NAME_TAKEN': 'Application name already exists in workspace',
  'APP_LIMIT_EXCEEDED': 'Workspace application limit exceeded',
  'APP_GENERATION_FAILED': 'Failed to generate application code',
  
  // AI Operations
  'CLAUDE_API_UNAVAILABLE': 'Claude API service is currently unavailable',
  'CLAUDE_RATE_LIMIT': 'Claude API rate limit exceeded',
  'CLAUDE_CONTEXT_TOO_LARGE': 'Request context exceeds token limit',
  
  // E2B Sandbox
  'E2B_SANDBOX_CREATION_FAILED': 'Failed to create E2B sandbox',
  'E2B_EXECUTION_TIMEOUT': 'Code execution timed out',
  'E2B_RESOURCE_LIMIT': 'Sandbox resource limit exceeded',
  
  // GitHub Integration
  'GITHUB_AUTH_FAILED': 'GitHub authentication failed',
  'GITHUB_REPO_ACCESS_DENIED': 'Repository access denied',
  'GITHUB_API_RATE_LIMIT': 'GitHub API rate limit exceeded',
  
  // Deployment
  'DEPLOYMENT_BUILD_FAILED': 'Application build failed',
  'DEPLOYMENT_TIMEOUT': 'Deployment process timed out',
  'DEPLOYMENT_ROLLBACK_FAILED': 'Failed to rollback deployment'
} as const
```

### Debug Information Collection

When reporting issues, collect this information:

```bash
#!/bin/bash
# debug-info.sh - Collect debug information

echo "=== PRIA Debug Information ==="
echo "Timestamp: $(date)"
echo "User: $(whoami)"
echo "Platform: $(uname -a)"
echo ""

echo "=== Environment ==="
echo "Node Version: $(node --version)"
echo "NPM Version: $(npm --version)"
echo "Next.js Version: $(npx next --version)"
echo ""

echo "=== System Health ==="
curl -s https://your-instance.com/api/health | jq '.'
echo ""

echo "=== Authentication Status ==="
curl -s -H "Authorization: Bearer $TOKEN" \
     https://your-instance.com/api/auth/me | jq '.'
echo ""

echo "=== Recent Logs ==="
tail -20 application.log
echo ""

echo "=== Network Connectivity ==="
ping -c 3 your-instance.com
echo ""

echo "=== Browser Information ==="
echo "Please provide:"
echo "- Browser name and version"
echo "- Console error messages"
echo "- Network tab information"
```

## 🆘 Getting Help

### Self-Service Resources

1. **Documentation**
   - [User Guide](./user-guide.md)
   - [API Reference](./api-reference.md)
   - [Architecture Guide](./architecture.md)

2. **Status Pages**
   - PRIA Status: `https://status.pria-platform.com`
   - Supabase Status: `https://status.supabase.com`
   - Vercel Status: `https://www.vercel-status.com`

3. **Community Resources**
   - GitHub Issues: `https://github.com/pria/platform/issues`
   - Discord Server: `https://discord.gg/pria`
   - Stack Overflow: Tag questions with `pria-platform`

### Support Channels

#### **Community Support** (Free)
- GitHub Discussions
- Discord community chat
- Stack Overflow Q&A

#### **Email Support** (Pro Plan)
- Response time: 24-48 hours
- Email: support@pria-platform.com

#### **Priority Support** (Enterprise Plan)
- Response time: 4-8 hours
- Dedicated support channel
- Phone support available

### Before Contacting Support

1. **Check Status Pages**: Verify no known outages
2. **Search Documentation**: Look for existing solutions
3. **Run Diagnostics**: Use health check and debug scripts
4. **Gather Information**: Collect logs and error messages
5. **Try Basic Fixes**: Restart, clear cache, check credentials

### Creating Effective Support Requests

Include this information in your support request:

```markdown
## Issue Summary
Brief description of the problem

## Steps to Reproduce
1. Step one
2. Step two
3. Step three

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Environment
- PRIA Version: 
- Browser: 
- Operating System: 
- Node.js Version: 

## Error Messages
```
Paste any error messages here
```

## Additional Context
Any other relevant information

## Debug Information
Output from debug-info.sh script
```

### Emergency Contacts

For **critical production issues** affecting multiple users:

- **Emergency Hotline**: +1-XXX-XXX-XXXX (Enterprise only)
- **Emergency Email**: emergency@pria-platform.com
- **Status Updates**: Follow @PRIAStatus on Twitter

---

Remember: Most issues can be resolved quickly by following the troubleshooting steps in this guide. When in doubt, start with the health check procedure and work through the relevant sections systematically.