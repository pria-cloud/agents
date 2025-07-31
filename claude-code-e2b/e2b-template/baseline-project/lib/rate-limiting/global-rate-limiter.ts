import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/monitoring/logger'
import createServerClient from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export interface RateLimitConfig {
  requests: number
  windowMs: number
  burst?: number // Allow burst requests
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
  keyGenerator?: (request: NextRequest) => Promise<string>
  onLimitReached?: (key: string, request: NextRequest) => void
}

export interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  resetTime: number
  retryAfter?: number
}

// In-memory store for rate limiting (production should use Redis)
interface RateLimitEntry {
  count: number
  resetTime: number
  windowStart: number
  burstUsed: number
}

class GlobalRateLimiter {
  private static instance: GlobalRateLimiter
  private store = new Map<string, RateLimitEntry>()
  private cleanupInterval: NodeJS.Timeout

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 5 * 60 * 1000)
  }

  static getInstance(): GlobalRateLimiter {
    if (!GlobalRateLimiter.instance) {
      GlobalRateLimiter.instance = new GlobalRateLimiter()
    }
    return GlobalRateLimiter.instance
  }

  /**
   * Check rate limit for a request
   */
  async checkRateLimit(
    request: NextRequest,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    try {
      const key = config.keyGenerator 
        ? await config.keyGenerator(request)
        : await this.generateDefaultKey(request)

      const now = Date.now()
      const windowStart = now - config.windowMs
      
      // Get or create entry
      let entry = this.store.get(key)
      
      if (!entry || entry.resetTime <= now) {
        // New window
        entry = {
          count: 0,
          resetTime: now + config.windowMs,
          windowStart: now,
          burstUsed: 0
        }
        this.store.set(key, entry)
      }

      // Check if within limits
      const burstLimit = config.burst || 0
      const totalAllowed = config.requests + burstLimit
      
      if (entry.count >= totalAllowed) {
        // Rate limit exceeded
        const retryAfter = Math.ceil((entry.resetTime - now) / 1000)
        
        if (config.onLimitReached) {
          config.onLimitReached(key, request)
        }

        logger.warn('Rate limit exceeded', {
          metadata: {
            key,
            count: entry.count,
            limit: config.requests,
            burst: burstLimit,
            retryAfter,
            url: request.url,
            method: request.method,
            userAgent: request.headers.get('user-agent') || undefined
          }
        })

        return {
          allowed: false,
          limit: config.requests,
          remaining: 0,
          resetTime: entry.resetTime,
          retryAfter
        }
      }

      // Increment counter
      entry.count++
      
      // Track burst usage
      if (entry.count > config.requests) {
        entry.burstUsed++
      }

      const remaining = Math.max(0, totalAllowed - entry.count)

      return {
        allowed: true,
        limit: config.requests,
        remaining,
        resetTime: entry.resetTime
      }

    } catch (error) {
      logger.error('Rate limit check failed', error instanceof Error ? error : new Error(String(error)))
      
      // Fail open - allow request if rate limiting fails
      return {
        allowed: true,
        limit: config.requests,
        remaining: config.requests,
        resetTime: Date.now() + config.windowMs
      }
    }
  }

  /**
   * Create rate limit middleware
   */
  createMiddleware(config: RateLimitConfig) {
    return async (request: NextRequest): Promise<NextResponse | null> => {
      const result = await this.checkRateLimit(request, config)
      
      if (!result.allowed) {
        const response = NextResponse.json(
          {
            error: 'Rate limit exceeded',
            code: 'RATE_LIMIT_EXCEEDED',
            limit: result.limit,
            remaining: result.remaining,
            resetTime: result.resetTime,
            retryAfter: result.retryAfter,
            timestamp: new Date().toISOString()
          },
          { status: 429 }
        )

        // Add rate limit headers
        response.headers.set('X-RateLimit-Limit', result.limit.toString())
        response.headers.set('X-RateLimit-Remaining', result.remaining.toString())
        response.headers.set('X-RateLimit-Reset', result.resetTime.toString())
        if (result.retryAfter) {
          response.headers.set('Retry-After', result.retryAfter.toString())
        }

        return response
      }

      // Add rate limit headers to successful responses
      const response = NextResponse.next()
      response.headers.set('X-RateLimit-Limit', result.limit.toString())
      response.headers.set('X-RateLimit-Remaining', result.remaining.toString())
      response.headers.set('X-RateLimit-Reset', result.resetTime.toString())

      return null // Continue to next middleware
    }
  }

  /**
   * Get rate limit status for debugging
   */
  async getRateLimitStatus(request: NextRequest, config: RateLimitConfig): Promise<{
    key: string
    current: RateLimitEntry | null
    wouldAllow: boolean
  }> {
    const key = config.keyGenerator 
      ? await config.keyGenerator(request)
      : await this.generateDefaultKey(request)
    
    const entry = this.store.get(key)
    const wouldAllow = !entry || entry.count < (config.requests + (config.burst || 0))
    
    return {
      key,
      current: entry || null,
      wouldAllow
    }
  }

  /**
   * Reset rate limit for a specific key (admin function)
   */
  async resetRateLimit(request: NextRequest, config: RateLimitConfig): Promise<void> {
    const key = config.keyGenerator 
      ? await config.keyGenerator(request)
      : await this.generateDefaultKey(request)
    
    this.store.delete(key)
    
    logger.info('Rate limit reset', { metadata: { key } })
  }

  /**
   * Get current statistics
   */
  getStatistics(): {
    totalKeys: number
    activeWindows: number
    memoryUsage: number
  } {
    const now = Date.now()
    let activeWindows = 0
    
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetTime > now) {
        activeWindows++
      }
    }

    return {
      totalKeys: this.store.size,
      activeWindows,
      memoryUsage: typeof process !== 'undefined' && process.memoryUsage ? process.memoryUsage().heapUsed : 0
    }
  }

  // Private methods

  private async generateDefaultKey(request: NextRequest): Promise<string> {
    // Use IP address + endpoint pattern as default key
    const ip = this.getClientIP(request)
    const endpoint = this.getEndpointPattern(request.nextUrl.pathname)
    
    // For authenticated requests, include user ID
    try {
      // cookieStore is now handled internally by createServerClient
      const supabase = await createServerClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        return `user:${user.id}:${endpoint}`
      }
    } catch (error) {
      // Ignore auth errors in rate limiting
    }
    
    return `ip:${ip}:${endpoint}`
  }

  private getClientIP(request: NextRequest): string {
    // Try various headers for IP address
    const forwardedFor = request.headers.get('x-forwarded-for')
    if (forwardedFor) {
      return forwardedFor.split(',')[0].trim()
    }
    
    const realIP = request.headers.get('x-real-ip')
    if (realIP) {
      return realIP
    }
    
    const cfConnectingIP = request.headers.get('cf-connecting-ip')
    if (cfConnectingIP) {
      return cfConnectingIP
    }
    
    return 'unknown'
  }

  private getEndpointPattern(pathname: string): string {
    // Normalize API paths to patterns
    return pathname
      .replace(/\/api\/[^\/]+\/[a-f0-9-]{36}/, '/api/*/[id]') // UUIDs
      .replace(/\/api\/[^\/]+\/\d+/, '/api/*/[id]') // Numeric IDs
      .replace(/\?.*$/, '') // Remove query parameters
  }

  private cleanup(): void {
    const now = Date.now()
    let cleaned = 0
    
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetTime <= now) {
        this.store.delete(key)
        cleaned++
      }
    }
    
    if (cleaned > 0) {
      logger.debug('Rate limiter cleanup completed', {
        metadata: {
          entriesRemoved: cleaned,
          remainingEntries: this.store.size
        }
      })
    }
  }

  // Cleanup on process exit
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    this.store.clear()
  }
}

// Export singleton instance
export const globalRateLimiter = GlobalRateLimiter.getInstance()

// Predefined rate limit configurations
export const RATE_LIMIT_CONFIGS = {
  // API endpoints
  API_GENERAL: {
    requests: 100,
    windowMs: 60000, // 1 minute
    burst: 20
  } as RateLimitConfig,

  API_CLAUDE: {
    requests: 10,
    windowMs: 60000, // 1 minute
    burst: 5,
    keyGenerator: async (request: NextRequest) => {
      // Rate limit by user for Claude operations
      // cookieStore is now handled internally by createServerClient
      const supabase = await createServerClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        const workspaceId = user.app_metadata?.workspace_id
        return `claude:workspace:${workspaceId || user.id}`
      }
      
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
      return `claude:ip:${ip}`
    }
  } as RateLimitConfig,

  API_E2B: {
    requests: 30,
    windowMs: 60000, // 1 minute
    burst: 10
  } as RateLimitConfig,

  API_GITHUB: {
    requests: 60,
    windowMs: 60000, // 1 minute
    burst: 20
  } as RateLimitConfig,

  API_DEPLOY: {
    requests: 5,
    windowMs: 300000, // 5 minutes
    burst: 2
  } as RateLimitConfig,

  // Authentication endpoints
  AUTH_LOGIN: {
    requests: 5,
    windowMs: 60000, // 1 minute
    burst: 0, // No burst for auth
    keyGenerator: async (request: NextRequest) => {
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
      return `auth:${ip}`
    }
  } as RateLimitConfig,

  // Webhook endpoints
  WEBHOOK: {
    requests: 100,
    windowMs: 60000, // 1 minute
    burst: 50
  } as RateLimitConfig,

  // Health check
  HEALTH: {
    requests: 60,
    windowMs: 60000, // 1 minute
    burst: 0
  } as RateLimitConfig
}

// Helper function to apply rate limiting to API handlers
export function withRateLimit(
  config: RateLimitConfig,
  handler: (request: NextRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    // Check rate limit
    const rateLimitResult = await globalRateLimiter.checkRateLimit(request, config)
    
    if (!rateLimitResult.allowed) {
      const response = NextResponse.json(
        {
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED',
          limit: rateLimitResult.limit,
          remaining: rateLimitResult.remaining,
          resetTime: rateLimitResult.resetTime,
          retryAfter: rateLimitResult.retryAfter,
          timestamp: new Date().toISOString()
        },
        { status: 429 }
      )

      // Add rate limit headers
      response.headers.set('X-RateLimit-Limit', rateLimitResult.limit.toString())
      response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString())
      response.headers.set('X-RateLimit-Reset', rateLimitResult.resetTime.toString())
      if (rateLimitResult.retryAfter) {
        response.headers.set('Retry-After', rateLimitResult.retryAfter.toString())
      }

      return response
    }

    // Call the handler
    const response = await handler(request)
    
    // Add rate limit headers to successful responses
    response.headers.set('X-RateLimit-Limit', rateLimitResult.limit.toString())
    response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString())
    response.headers.set('X-RateLimit-Reset', rateLimitResult.resetTime.toString())

    return response
  }
}

// Cleanup on process exit (Node.js only - not available in Edge Runtime)
if (typeof process !== 'undefined' && process.on) {
  process.on('exit', () => {
    globalRateLimiter.destroy()
  })
}