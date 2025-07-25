import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { e2bSandboxService } from '@/lib/services/e2b'
import { logger, metrics, errorTracker, type HealthStatus } from '@/lib/monitoring/logger'

// Cache health check results for 30 seconds to avoid excessive checks
let healthCache: { status: HealthStatus; timestamp: number } | null = null
const CACHE_DURATION = 30000 // 30 seconds

export async function GET(request: NextRequest) {
  const now = Date.now()
  
  // Return cached result if still valid
  if (healthCache && (now - healthCache.timestamp) < CACHE_DURATION) {
    return NextResponse.json(healthCache.status)
  }

  const startTime = Date.now()
  
  try {
    // Check database health
    const databaseStatus = await checkDatabaseHealth()
    
    // Check E2B service health
    const e2bStatus = await checkE2BHealth()
    
    // Check GitHub API health
    const githubStatus = await checkGitHubHealth()
    
    // Check Claude API health
    const claudeStatus = await checkClaudeHealth()
    
    // Get application metrics
    const appMetrics = metrics.getMetrics()
    const errorStats = errorTracker.getErrorStats()
    
    // Determine overall health status
    const services = {
      database: databaseStatus,
      e2b: e2bStatus,
      github: githubStatus,
      claude: claudeStatus
    }
    
    const overallStatus = determineOverallStatus(services)
    
    const healthStatus: HealthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      services,
      errors: errorStats.length,
      performance: {
        averageResponseTime: appMetrics.averageResponseTime,
        activeRequests: appMetrics.activeRequests
      }
    }
    
    // Cache the result
    healthCache = {
      status: healthStatus,
      timestamp: now
    }
    
    // Log health check
    const duration = Date.now() - startTime
    logger.info('Health check completed', {
      status: overallStatus,
      duration,
      services: Object.entries(services).map(([name, status]) => `${name}:${status}`).join(',')
    })
    
    // Return appropriate HTTP status code
    const httpStatus = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 200 : 503
    
    return NextResponse.json(healthStatus, { status: httpStatus })
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown health check error'
    
    logger.error('Health check failed', error, {
      duration: Date.now() - startTime
    })
    
    const healthStatus: HealthStatus = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      services: {
        database: 'unhealthy',
        e2b: 'unhealthy',
        github: 'unhealthy',
        claude: 'unhealthy'
      },
      errors: errorTracker.getErrorStats().length,
      performance: {
        averageResponseTime: 0,
        activeRequests: 0
      }
    }
    
    return NextResponse.json(
      {
        ...healthStatus,
        error: errorMessage
      },
      { status: 503 }
    )
  }
}

// Detailed health check endpoint (requires authentication)
export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = createClient(cookieStore)
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    
    const workspaceId = user.app_metadata?.workspace_id
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace access denied' }, { status: 403 })
    }
    
    // Detailed health information
    const detailedHealth = {
      basicHealth: await GET(request).then(res => res.json()),
      errorDetails: errorTracker.getErrorStats(),
      metrics: metrics.getMetrics(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        architecture: process.arch,
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      },
      configuration: {
        logLevel: process.env.LOG_LEVEL || 'info',
        nodeEnv: process.env.NODE_ENV || 'development',
        hasE2BKey: !!process.env.E2B_API_KEY,
        hasGitHubKeys: !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
        hasVercelToken: !!process.env.VERCEL_TOKEN,
        hasSupabaseKeys: !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
      }
    }
    
    logger.info('Detailed health check requested', {
      userId: user.id,
      workspaceId
    })
    
    return NextResponse.json(detailedHealth)
    
  } catch (error) {
    logger.error('Detailed health check failed', error)
    return NextResponse.json(
      { error: 'Failed to retrieve detailed health information' },
      { status: 500 }
    )
  }
}

// Individual service health checks

async function checkDatabaseHealth(): Promise<'healthy' | 'degraded' | 'unhealthy'> {
  try {
    const cookieStore = cookies()
    const supabase = createClient(cookieStore)
    
    const startTime = Date.now()
    
    // Simple query to test database connectivity
    const { data, error } = await supabase
      .from('workspaces')
      .select('id')
      .limit(1)
    
    const duration = Date.now() - startTime
    
    if (error) {
      logger.warn('Database health check failed', { error: error.message, duration })
      return 'unhealthy'
    }
    
    // Check performance
    if (duration > 2000) { // 2 seconds
      logger.warn('Database responding slowly', { duration })
      return 'degraded'
    }
    
    return 'healthy'
    
  } catch (error) {
    logger.error('Database health check error', error)
    return 'unhealthy'
  }
}

async function checkE2BHealth(): Promise<'healthy' | 'degraded' | 'unhealthy'> {
  try {
    if (!process.env.E2B_API_KEY) {
      return 'unhealthy'
    }
    
    const startTime = Date.now()
    
    // Test E2B API connectivity
    const response = await fetch('https://api.e2b.dev/health', {
      headers: {
        'Authorization': `Bearer ${process.env.E2B_API_KEY}`
      },
      timeout: 5000
    })
    
    const duration = Date.now() - startTime
    
    if (!response.ok) {
      logger.warn('E2B API health check failed', { 
        status: response.status, 
        statusText: response.statusText,
        duration 
      })
      return 'unhealthy'
    }
    
    if (duration > 3000) { // 3 seconds
      logger.warn('E2B API responding slowly', { duration })
      return 'degraded'
    }
    
    return 'healthy'
    
  } catch (error) {
    logger.error('E2B health check error', error)
    return 'unhealthy'
  }
}

async function checkGitHubHealth(): Promise<'healthy' | 'degraded' | 'unhealthy'> {
  try {
    if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
      return 'degraded' // GitHub is optional for basic functionality
    }
    
    const startTime = Date.now()
    
    // Test GitHub API connectivity
    const response = await fetch('https://api.github.com/meta', {
      timeout: 5000
    })
    
    const duration = Date.now() - startTime
    
    if (!response.ok) {
      logger.warn('GitHub API health check failed', { 
        status: response.status, 
        statusText: response.statusText,
        duration 
      })
      return 'degraded' // GitHub issues shouldn't mark system as unhealthy
    }
    
    if (duration > 3000) { // 3 seconds
      logger.warn('GitHub API responding slowly', { duration })
      return 'degraded'
    }
    
    return 'healthy'
    
  } catch (error) {
    logger.warn('GitHub health check error', error)
    return 'degraded'
  }
}

async function checkClaudeHealth(): Promise<'healthy' | 'degraded' | 'unhealthy'> {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return 'unhealthy'
    }
    
    const startTime = Date.now()
    
    // Test Claude API connectivity with a minimal request
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ANTHROPIC_API_KEY}`,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }]
      }),
      timeout: 10000
    })
    
    const duration = Date.now() - startTime
    
    if (!response.ok) {
      if (response.status === 401) {
        logger.error('Claude API authentication failed - invalid API key')
        return 'unhealthy'
      }
      
      logger.warn('Claude API health check failed', { 
        status: response.status, 
        statusText: response.statusText,
        duration 
      })
      return 'degraded'
    }
    
    if (duration > 8000) { // 8 seconds
      logger.warn('Claude API responding slowly', { duration })
      return 'degraded'
    }
    
    return 'healthy'
    
  } catch (error) {
    logger.error('Claude health check error', error)
    return 'unhealthy'
  }
}

function determineOverallStatus(services: Record<string, 'healthy' | 'degraded' | 'unhealthy'>): 'healthy' | 'degraded' | 'unhealthy' {
  const statuses = Object.values(services)
  
  // If any critical service is unhealthy, system is unhealthy
  if (services.database === 'unhealthy' || services.claude === 'unhealthy') {
    return 'unhealthy'
  }
  
  // If any service is unhealthy, system is degraded
  if (statuses.includes('unhealthy')) {
    return 'degraded'
  }
  
  // If any service is degraded, system is degraded
  if (statuses.includes('degraded')) {
    return 'degraded'
  }
  
  return 'healthy'
}