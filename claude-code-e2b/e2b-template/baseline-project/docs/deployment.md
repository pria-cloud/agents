# PRIA Platform Deployment Guide

Comprehensive guide for deploying the PRIA platform to production environments with best practices for security, performance, and reliability.

## 📋 Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Environment Setup](#environment-setup)
3. [Database Configuration](#database-configuration)
4. [Vercel Deployment](#vercel-deployment)
5. [Environment Variables](#environment-variables)
6. [CI/CD Pipeline](#cicd-pipeline)
7. [Domain & SSL Configuration](#domain--ssl-configuration)
8. [Monitoring Setup](#monitoring-setup)
9. [Security Configuration](#security-configuration)
10. [Performance Optimization](#performance-optimization)
11. [Backup & Recovery](#backup--recovery)
12. [Troubleshooting](#troubleshooting)

## ✅ Pre-Deployment Checklist

### Code Quality Verification
```bash
# Run all quality checks before deployment
npm run lint          # ESLint code quality check
npm run type-check     # TypeScript compilation check
npm run test           # Unit and integration tests
npm run build          # Production build verification
npm run load-test:production  # Performance validation
```

### Security Audit
```bash
# Security vulnerability scan
npm audit --production

# Check for exposed secrets
git log --grep="password\|secret\|key" --oneline

# Verify environment variable security
grep -r "process.env" --include="*.ts" --include="*.js" . | grep -v ".env"
```

### Performance Baseline
```bash
# Establish performance benchmarks
npm run production-readiness

# Verify core metrics:
# - Health check response < 100ms
# - API response times < 500ms
# - Database query performance < 200ms
# - Error rate < 1%
```

## 🌍 Environment Setup

### Production Environment Requirements

#### **Minimum System Requirements**
- Node.js 20+ (LTS)
- PostgreSQL 15+
- Redis 7+ (for caching)
- 2GB RAM minimum
- 20GB storage minimum

#### **Recommended Production Setup**
- Vercel Pro Plan (or Enterprise)
- Supabase Pro Plan (or Team)
- Redis Cloud Basic Plan
- CDN with global distribution

### Environment Configuration Matrix

| Component | Development | Staging | Production |
|-----------|-------------|---------|------------|
| **Database** | Local Supabase | Supabase Staging | Supabase Production |
| **Authentication** | Test users | Limited production data | Full user base |
| **AI Services** | Claude sandbox | Claude production | Claude production |
| **E2B Sandboxes** | Local/shared | Dedicated pool | Dedicated pool |
| **Monitoring** | Basic logging | Full monitoring | Enterprise monitoring |
| **Backups** | None | Daily | Hourly + Real-time |

## 🗄️ Database Configuration

### Supabase Production Setup

#### 1. **Create Production Database**
```bash
# Create new Supabase project
npx supabase projects create pria-production --org-id YOUR_ORG_ID

# Get project credentials
npx supabase projects list
```

#### 2. **Database Schema Migration**
```bash
# Apply schema to production
npx supabase db push --project-ref YOUR_PROJECT_REF

# Verify migration
npx supabase db diff --project-ref YOUR_PROJECT_REF
```

#### 3. **Row-Level Security (RLS) Configuration**
```sql
-- Enable RLS on all tables
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Workspace isolation policy
CREATE POLICY "workspace_isolation" ON applications
FOR ALL USING (
    workspace_id IN (
        SELECT workspace_id 
        FROM user_workspaces 
        WHERE user_id = auth.uid()
    )
);

-- Performance indexes
CREATE INDEX CONCURRENTLY idx_applications_workspace_id ON applications(workspace_id);
CREATE INDEX CONCURRENTLY idx_sessions_workspace_id ON sessions(workspace_id);
CREATE INDEX CONCURRENTLY idx_generated_files_application_id ON generated_files(application_id);
```

#### 4. **Database Performance Optimization**
```sql
-- Connection pooling configuration
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET work_mem = '4MB';

-- Query optimization
ANALYZE;
VACUUM ANALYZE;

-- Enable query logging for slow queries
ALTER SYSTEM SET log_min_duration_statement = 1000;
```

### Redis Configuration

#### **Production Redis Setup**
```typescript
// lib/redis/config.ts
export const redisConfig = {
  production: {
    host: process.env.REDIS_HOST!,
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD!,
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    maxmemoryPolicy: 'allkeys-lru'
  }
}
```

## 🚀 Vercel Deployment

### Project Configuration

#### 1. **Vercel Project Setup**
```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Link project
vercel link

# Configure project settings
vercel env pull .env.production
```

#### 2. **Production Deployment Configuration**
```json
// vercel.json
{
  "version": 2,
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "installCommand": "npm ci",
  "functions": {
    "app/api/claude/**/*.ts": {
      "maxDuration": 60,
      "memory": 1024,
      "regions": ["iad1", "sfo1", "fra1"]
    },
    "app/api/e2b/**/*.ts": {
      "maxDuration": 30,
      "memory": 512
    },
    "app/api/deploy/**/*.ts": {
      "maxDuration": 300,
      "memory": 1024
    }
  },
  "crons": [
    {
      "path": "/api/cron/cleanup-sandboxes",
      "schedule": "0 */6 * * *"
    },
    {
      "path": "/api/cron/backup-database",
      "schedule": "0 2 * * *"
    }
  ],
  "headers": [
    {
      "source": "/api/health",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=60, stale-while-revalidate=300"
        }
      ]
    }
  ],
  "redirects": [
    {
      "source": "/health",
      "destination": "/api/health",
      "permanent": true
    }
  ]
}
```

#### 3. **Build Optimization**
```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Production optimizations
  compress: true,
  poweredByHeader: false,
  generateEtags: true,
  
  // Image optimization
  images: {
    domains: ['your-cdn-domain.com'],
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60
  },
  
  // Bundle optimization
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['lucide-react']
  },
  
  // Security headers
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        {
          key: 'X-Frame-Options',
          value: 'DENY'
        },
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff'
        },
        {
          key: 'Referrer-Policy',
          value: 'strict-origin-when-cross-origin'
        }
      ]
    }
  ]
}

module.exports = nextConfig
```

### Deployment Commands

#### **Preview Deployment**
```bash
# Deploy to preview environment
vercel

# Deploy specific branch
vercel --target preview

# Deploy with custom domain
vercel --target preview --meta branch=feature-xyz
```

#### **Production Deployment**
```bash
# Deploy to production
vercel --prod

# Deploy with environment promotion
vercel promote DEPLOYMENT_URL --target production
```

## 🔐 Environment Variables

### Complete Environment Configuration

#### **Core Application Variables**
```bash
# Application Configuration
NODE_ENV=production
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-super-secret-jwt-secret-here

# Database Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
DATABASE_URL=postgresql://postgres:password@host:5432/database

# AI Services
ANTHROPIC_API_KEY=sk-ant-your-claude-api-key-here
E2B_API_KEY=your-e2b-api-key-here
E2B_TEMPLATE_ID=your-e2b-template-id

# External Integrations
GITHUB_CLIENT_ID=your-github-oauth-app-id
GITHUB_CLIENT_SECRET=your-github-oauth-app-secret
GITHUB_WEBHOOK_SECRET=your-github-webhook-secret

VERCEL_TOKEN=your-vercel-api-token
VERCEL_ORG_ID=your-vercel-org-id
VERCEL_PROJECT_ID=your-vercel-project-id

# Caching & Storage
REDIS_URL=redis://username:password@host:port
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
REDIS_TLS=true

# Monitoring & Alerting
ALERT_WEBHOOK_URL=https://your-alert-webhook-url
SLACK_WEBHOOK_URL=https://hooks.slack.com/your-webhook
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/your-webhook

# Performance & Limits
MEMORY_WARNING_MB=500
MEMORY_CRITICAL_MB=800
RATE_LIMIT_CLAUDE_RPM=10
RATE_LIMIT_E2B_RPM=30
```

#### **Security Variables**
```bash
# Encryption Keys
ENCRYPTION_KEY=your-32-character-encryption-key-here
JWT_SECRET=your-jwt-signing-secret-here
COOKIE_SECRET=your-cookie-encryption-secret

# API Keys (Rotate Regularly)
API_KEY_INTERNAL=your-internal-api-key
API_KEY_EXTERNAL=your-external-api-key

# Security Configuration
CORS_ORIGIN=https://your-domain.com
ALLOWED_HOSTS=your-domain.com,www.your-domain.com
```

### Environment Variable Management

#### **Vercel Environment Setup**
```bash
# Set production environment variables
vercel env add NODE_ENV production
vercel env add SUPABASE_URL production
vercel env add ANTHROPIC_API_KEY production

# Import from file
vercel env import .env.production

# Copy from staging to production
vercel env cp staging production
```

#### **Environment Validation**
```typescript
// lib/config/environment.ts
import { z } from 'zod'

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(50),
  ANTHROPIC_API_KEY: z.string().startsWith('sk-ant-'),
  E2B_API_KEY: z.string().min(20),
  GITHUB_CLIENT_ID: z.string().length(20),
  GITHUB_CLIENT_SECRET: z.string().length(40),
  VERCEL_TOKEN: z.string().min(20),
  REDIS_URL: z.string().url().optional(),
})

// Validate on startup
export const env = environmentSchema.parse(process.env)
```

## 🔄 CI/CD Pipeline

### GitHub Actions Workflow

#### **Complete Deployment Pipeline**
```yaml
# .github/workflows/deploy.yml
name: Deploy PRIA Platform

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20'
  VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
  VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}

jobs:
  test:
    name: Test & Quality Checks
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run linting
      run: npm run lint
    
    - name: Run type checking
      run: npm run type-check
    
    - name: Run unit tests
      run: npm run test
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
    
    - name: Run build
      run: npm run build
    
    - name: Run security audit
      run: npm audit --audit-level moderate
    
    - name: Upload test coverage
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info

  security-scan:
    name: Security Scan
    runs-on: ubuntu-latest
    needs: test
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Run Trivy vulnerability scanner
      uses: aquasecurity/trivy-action@master
      with:
        scan-type: 'fs'
        format: 'sarif'
        output: 'trivy-results.sarif'
    
    - name: Upload Trivy scan results
      uses: github/codeql-action/upload-sarif@v2
      with:
        sarif_file: 'trivy-results.sarif'

  deploy-preview:
    name: Deploy Preview
    runs-on: ubuntu-latest
    needs: [test, security-scan]
    if: github.event_name == 'pull_request'
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'npm'
    
    - name: Install Vercel CLI
      run: npm install -g vercel@latest
    
    - name: Pull Vercel environment
      run: vercel pull --yes --environment=preview --token=${{ secrets.VERCEL_TOKEN }}
    
    - name: Build project
      run: vercel build --token=${{ secrets.VERCEL_TOKEN }}
    
    - name: Deploy to Vercel
      id: deploy
      run: |
        DEPLOYMENT_URL=$(vercel deploy --prebuilt --token=${{ secrets.VERCEL_TOKEN }})
        echo "deployment_url=$DEPLOYMENT_URL" >> $GITHUB_OUTPUT
    
    - name: Run smoke tests on preview
      run: |
        npm run load-test:smoke
      env:
        LOAD_TEST_BASE_URL: ${{ steps.deploy.outputs.deployment_url }}
    
    - name: Comment PR with deployment URL
      uses: actions/github-script@v6
      with:
        script: |
          github.rest.issues.createComment({
            issue_number: context.issue.number,
            owner: context.repo.owner,
            repo: context.repo.repo,
            body: '🚀 Preview deployment ready at: ${{ steps.deploy.outputs.deployment_url }}'
          })

  deploy-production:
    name: Deploy Production
    runs-on: ubuntu-latest
    needs: [test, security-scan]
    if: github.ref == 'refs/heads/main'
    environment: production
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'npm'
    
    - name: Install Vercel CLI
      run: npm install -g vercel@latest
    
    - name: Pull Vercel environment
      run: vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}
    
    - name: Build project
      run: vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}
    
    - name: Deploy to production
      id: deploy
      run: |
        DEPLOYMENT_URL=$(vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }})
        echo "deployment_url=$DEPLOYMENT_URL" >> $GITHUB_OUTPUT
    
    - name: Run production health check
      run: |
        curl -f ${{ steps.deploy.outputs.deployment_url }}/api/health
    
    - name: Run production readiness tests
      run: |
        npm run production-readiness
      env:
        LOAD_TEST_BASE_URL: ${{ steps.deploy.outputs.deployment_url }}
        LOAD_TEST_AUTH_TOKEN: ${{ secrets.PRODUCTION_API_TOKEN }}
    
    - name: Notify deployment success
      uses: 8398a7/action-slack@v3
      with:
        status: success
        text: '🚀 PRIA Platform deployed to production successfully!'
      env:
        SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### Deployment Rollback Strategy

#### **Automated Rollback**
```bash
# Rollback to previous deployment
vercel rollback $PREVIOUS_DEPLOYMENT_URL --token=$VERCEL_TOKEN

# Rollback with alias
vercel alias $PREVIOUS_DEPLOYMENT_URL pria-platform.com --token=$VERCEL_TOKEN
```

#### **Health Check Monitoring**
```typescript
// scripts/health-check-monitor.ts
export async function monitorDeployment(
  deploymentUrl: string,
  timeoutMs: number = 300000
): Promise<boolean> {
  const startTime = Date.now()
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await fetch(`${deploymentUrl}/api/health`)
      
      if (response.ok) {
        const health = await response.json()
        if (health.status === 'healthy') {
          return true
        }
      }
    } catch (error) {
      console.log('Health check failed, retrying...', error.message)
    }
    
    await new Promise(resolve => setTimeout(resolve, 10000)) // 10 seconds
  }
  
  return false
}
```

## 🌐 Domain & SSL Configuration

### Custom Domain Setup

#### **Domain Configuration**
```bash
# Add custom domain to Vercel project
vercel domains add your-domain.com --token=$VERCEL_TOKEN

# Add www subdomain
vercel domains add www.your-domain.com --token=$VERCEL_TOKEN

# Verify domain configuration
vercel domains ls --token=$VERCEL_TOKEN
```

#### **DNS Configuration**
```bash
# Required DNS records:
A     your-domain.com        76.76.19.61
CNAME www.your-domain.com    cname.vercel-dns.com
CNAME api.your-domain.com    cname.vercel-dns.com

# For email (optional)
MX    your-domain.com        10 mx.your-email-provider.com
TXT   your-domain.com        "v=spf1 include:your-email-provider.com ~all"
```

### SSL Certificate Management

#### **Automatic SSL with Vercel**
```typescript
// vercel.json SSL configuration
{
  "domains": ["your-domain.com", "www.your-domain.com"],
  "github": {
    "silent": true
  }
}
```

#### **Security Headers Configuration**
```typescript
// next.config.js security headers
const securityHeaders = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains; preload'
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vercel.live",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.github.com https://*.e2b.app wss://*.e2b.app",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ')
  }
]
```

## 📊 Monitoring Setup

### Application Performance Monitoring

#### **Custom Monitoring Dashboard**
```typescript
// lib/monitoring/dashboard.ts
export class MonitoringDashboard {
  async getSystemMetrics(): Promise<SystemMetrics> {
    return {
      // Application metrics
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      
      // Database metrics
      databaseConnections: await this.getDatabaseConnections(),
      databaseResponseTime: await this.measureDatabaseResponseTime(),
      
      // API metrics
      apiResponseTimes: await this.getAPIResponseTimes(),
      apiErrorRates: await this.getAPIErrorRates(),
      
      // External service health
      claudeAPIHealth: await this.checkClaudeAPI(),
      e2bServiceHealth: await this.checkE2BService(),
      githubAPIHealth: await this.checkGitHubAPI(),
      
      // Business metrics
      activeUsers: await this.getActiveUserCount(),
      applicationCount: await this.getApplicationCount(),
      deploymentSuccess: await this.getDeploymentSuccessRate()
    }
  }
}
```

#### **Alerting Configuration**
```typescript
// lib/alerting/production-alerts.ts
export const productionAlerts = [
  {
    name: 'High Error Rate',
    condition: 'error_rate > 5%',
    severity: 'critical',
    channels: ['slack', 'email', 'pagerduty']
  },
  {
    name: 'Database Connection Issues',
    condition: 'db_connections > 80% OR db_response_time > 1000ms',
    severity: 'high',
    channels: ['slack', 'email']
  },
  {
    name: 'Memory Usage Critical',
    condition: 'memory_usage > 90%',
    severity: 'critical',
    channels: ['slack', 'email', 'pagerduty']
  },
  {
    name: 'API Response Time Degradation',
    condition: 'api_response_time_p95 > 2000ms',
    severity: 'medium',
    channels: ['slack']
  }
]
```

### Log Aggregation

#### **Structured Logging Setup**
```typescript
// lib/logging/production-logger.ts
export const productionLogger = pino({
  level: 'info',
  formatters: {
    level: (label) => ({ level: label }),
    bindings: (bindings) => ({
      pid: bindings.pid,
      hostname: bindings.hostname,
      environment: 'production',
      version: process.env.npm_package_version
    })
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: ['password', 'token', 'key', 'secret'],
    censor: '[REDACTED]'
  }
})
```

## 🔒 Security Configuration

### Production Security Checklist

#### **Application Security**
- [ ] All environment variables are properly secured
- [ ] JWT secrets are rotated regularly
- [ ] API rate limiting is configured
- [ ] Input validation is implemented
- [ ] SQL injection prevention is active
- [ ] XSS protection is enabled
- [ ] CSRF protection is configured

#### **Infrastructure Security**
- [ ] HTTPS is enforced everywhere
- [ ] Security headers are configured
- [ ] CORS is properly configured
- [ ] Database access is restricted
- [ ] Secrets are encrypted at rest
- [ ] Regular security audits are scheduled

#### **Compliance & Governance**
- [ ] Data retention policies are implemented
- [ ] User privacy controls are active
- [ ] Audit logging is enabled
- [ ] Backup encryption is configured
- [ ] Incident response plan is documented

### Security Monitoring

#### **Security Event Detection**
```typescript
// lib/security/monitoring.ts
export class SecurityMonitor {
  async detectSuspiciousActivity(request: Request): Promise<SecurityAlert | null> {
    const indicators = [
      await this.checkBruteForceAttempts(request),
      await this.checkSQLInjectionAttempts(request),
      await this.checkUnusualAccessPatterns(request),
      await this.checkRateLimitViolations(request)
    ]
    
    const highRiskIndicators = indicators.filter(i => i.risk === 'high')
    
    if (highRiskIndicators.length > 0) {
      return {
        type: 'suspicious_activity',
        severity: 'high',
        indicators: highRiskIndicators,
        timestamp: new Date(),
        sourceIP: request.ip,
        userAgent: request.headers.get('user-agent')
      }
    }
    
    return null
  }
}
```

## 🔧 Performance Optimization

### Production Performance Tuning

#### **Database Optimization**
```sql
-- Production database tuning
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '512MB';
ALTER SYSTEM SET effective_cache_size = '2GB';
ALTER SYSTEM SET maintenance_work_mem = '128MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';

-- Query optimization
CREATE INDEX CONCURRENTLY idx_applications_workspace_status 
ON applications(workspace_id, status) WHERE status = 'active';

CREATE INDEX CONCURRENTLY idx_sessions_workspace_updated 
ON sessions(workspace_id, updated_at DESC);
```

#### **Caching Strategy**
```typescript
// lib/cache/production-cache.ts
export class ProductionCacheManager {
  private readonly strategies = {
    // Static content: 1 hour
    static: { ttl: 3600, strategy: 'cache-first' },
    
    // API responses: 5 minutes
    api: { ttl: 300, strategy: 'stale-while-revalidate' },
    
    // User data: 1 minute
    user: { ttl: 60, strategy: 'cache-first' },
    
    // Real-time data: No cache
    realtime: { ttl: 0, strategy: 'network-only' }
  }
  
  async get<T>(key: string, category: keyof typeof this.strategies): Promise<T | null> {
    const strategy = this.strategies[category]
    
    switch (strategy.strategy) {
      case 'cache-first':
        return await this.getCacheFirst(key, strategy.ttl)
      case 'stale-while-revalidate':
        return await this.getStaleWhileRevalidate(key, strategy.ttl)
      case 'network-only':
        return null // Always fetch fresh
      default:
        return null
    }
  }
}
```

### CDN Configuration

#### **Vercel Edge Caching**
```typescript
// lib/edge/cache-config.ts
export const edgeCacheConfig = {
  '/api/health': {
    'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
    'CDN-Cache-Control': 'max-age=60'
  },
  '/api/applications': {
    'Cache-Control': 'private, max-age=300',
    'Vary': 'Authorization'
  },
  '/static/*': {
    'Cache-Control': 'public, max-age=31536000, immutable'
  }
}
```

## 💾 Backup & Recovery

### Automated Backup Strategy

#### **Database Backup**
```typescript
// lib/backup/database-backup.ts
export class DatabaseBackupService {
  async createBackup(type: 'full' | 'incremental' = 'full'): Promise<BackupResult> {
    const backupId = `backup-${Date.now()}`
    
    try {
      // Create Supabase backup
      const backup = await this.supabaseClient.rpc('create_backup', {
        backup_type: type,
        backup_id: backupId
      })
      
      // Upload to secure storage
      const storageResult = await this.uploadToSecureStorage(backup)
      
      // Record backup metadata
      await this.recordBackupMetadata({
        id: backupId,
        type,
        size: backup.size,
        location: storageResult.location,
        checksum: storageResult.checksum,
        created_at: new Date()
      })
      
      return {
        success: true,
        backupId,
        location: storageResult.location
      }
    } catch (error) {
      logger.error('Backup failed', { backupId, error })
      throw new BackupError(`Backup ${backupId} failed`, error)
    }
  }
}
```

#### **Backup Schedule**
```yaml
# .github/workflows/backup.yml
name: Automated Backup

on:
  schedule:
    # Full backup daily at 2 AM UTC
    - cron: '0 2 * * *'
    # Incremental backup every 6 hours
    - cron: '0 */6 * * *'

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
    - name: Create Database Backup
      run: |
        curl -X POST "${{ secrets.APP_URL }}/api/backup/database" \
          -H "Authorization: Bearer ${{ secrets.BACKUP_API_TOKEN }}" \
          -H "Content-Type: application/json" \
          -d '{"type": "full"}'
```

### Disaster Recovery Plan

#### **Recovery Procedures**
```typescript
// lib/recovery/disaster-recovery.ts
export class DisasterRecoveryManager {
  async executeRecoveryPlan(planId: string): Promise<RecoveryResult> {
    const plan = await this.getRecoveryPlan(planId)
    
    logger.info('Starting disaster recovery', { planId, plan: plan.name })
    
    const steps = [
      () => this.validateBackupIntegrity(),
      () => this.restoreDatabase(),
      () => this.restoreApplicationState(),
      () => this.validateSystemHealth(),
      () => this.notifyStakeholders()
    ]
    
    for (const [index, step] of steps.entries()) {
      try {
        await step()
        logger.info('Recovery step completed', { step: index + 1 })
      } catch (error) {
        logger.error('Recovery step failed', { step: index + 1, error })
        await this.initiateRollback(index)
        throw new RecoveryError(`Recovery failed at step ${index + 1}`)
      }
    }
    
    return { success: true, duration: Date.now() - startTime }
  }
}
```

## 🔍 Troubleshooting

### Common Deployment Issues

#### **Build Failures**
```bash
# Check build logs
vercel logs $DEPLOYMENT_ID

# Common issues and solutions:

# 1. Memory issues during build
# Solution: Increase memory in vercel.json
{
  "functions": {
    "app/**/*.ts": {
      "memory": 1024
    }
  }
}

# 2. Missing environment variables
# Solution: Check environment variable configuration
vercel env ls

# 3. TypeScript compilation errors
# Solution: Run type check locally
npm run type-check
```

#### **Runtime Errors**
```typescript
// lib/error-handling/runtime-errors.ts
export class RuntimeErrorHandler {
  async handleError(error: Error, context: ErrorContext): Promise<void> {
    // Log error with context
    logger.error('Runtime error occurred', {
      error: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString()
    })
    
    // Determine error severity
    const severity = this.determineSeverity(error)
    
    // Alert if critical
    if (severity === 'critical') {
      await this.alertManager.triggerAlert('runtime-error', {
        message: error.message,
        severity,
        context
      })
    }
    
    // Attempt automatic recovery
    if (this.canAutoRecover(error)) {
      await this.attemptRecovery(error, context)
    }
  }
}
```

#### **Performance Issues**
```bash
# Monitor performance metrics
curl https://your-domain.com/api/health | jq '.performance'

# Check database performance
# In Supabase dashboard: Database > Performance

# Check Vercel function performance
vercel logs --follow

# Run load tests
npm run load-test:production
```

### Health Check Endpoints

#### **Comprehensive Health Check**
```typescript
// app/api/health/route.ts
export async function GET() {
  const healthChecks = await Promise.allSettled([
    checkDatabase(),
    checkRedis(),
    checkExternalServices(),
    checkSystemResources()
  ])
  
  const results = healthChecks.map((check, index) => ({
    service: services[index],
    status: check.status === 'fulfilled' ? 'healthy' : 'unhealthy',
    details: check.status === 'fulfilled' ? check.value : check.reason
  }))
  
  const overallStatus = results.every(r => r.status === 'healthy') 
    ? 'healthy' 
    : 'unhealthy'
  
  return Response.json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version,
    uptime: process.uptime(),
    services: results
  })
}
```

---

## 🎉 Deployment Success

Once successfully deployed, your PRIA platform will be:

- ✅ **Highly Available**: Multi-region deployment with automatic failover
- ✅ **Secure**: Enterprise-grade security with monitoring and alerting
- ✅ **Scalable**: Auto-scaling based on demand
- ✅ **Monitored**: Comprehensive monitoring and alerting
- ✅ **Backed Up**: Automated backups with disaster recovery
- ✅ **Optimized**: Performance-tuned for production workloads

For ongoing maintenance and operations, see the [Operations Guide](./operations.md) and [Monitoring Guide](./monitoring.md).