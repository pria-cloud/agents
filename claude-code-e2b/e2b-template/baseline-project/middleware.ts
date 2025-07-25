import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { globalAuth } from '@/lib/auth/global-auth'
import { globalRateLimiter, RATE_LIMIT_CONFIGS } from '@/lib/rate-limiting/global-rate-limiter'

// Rate limiting configuration mapping
const ENDPOINT_RATE_LIMITS = {
  '/api/claude': RATE_LIMIT_CONFIGS.API_CLAUDE,
  '/api/e2b': RATE_LIMIT_CONFIGS.API_E2B,
  '/api/github': RATE_LIMIT_CONFIGS.API_GITHUB,
  '/api/deploy': RATE_LIMIT_CONFIGS.API_DEPLOY,
  '/api/auth': RATE_LIMIT_CONFIGS.AUTH_LOGIN,
  '/api/health': RATE_LIMIT_CONFIGS.HEALTH,
  '/api/webhook': RATE_LIMIT_CONFIGS.WEBHOOK,
  default: RATE_LIMIT_CONFIGS.API_GENERAL
}

// Protected route patterns
const PROTECTED_ROUTES = [
  '/dashboard',
  '/workspace',
  '/api/claude',
  '/api/e2b',
  '/api/github',
  '/api/deploy',
  '/api/sessions',
  '/api/requirements',
  '/api/workflows'
]

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/signup',
  '/auth',
  '/api/auth',
  '/api/health'
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Skip middleware for static assets and internal Next.js routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Check if route requires authentication
  const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname.startsWith(route))
  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith(route))

  // Apply global rate limiting for all API routes
  if (pathname.startsWith('/api')) {
    const rateLimitResult = await applyGlobalRateLimit(request)
    if (rateLimitResult) {
      return addSecurityHeaders(rateLimitResult)
    }
  }

  // Skip authentication for public routes
  if (isPublicRoute) {
    return addSecurityHeaders(NextResponse.next())
  }

  // For protected routes, use global authentication
  if (isProtectedRoute) {
    const authMiddleware = globalAuth.createAuthMiddleware({
      requireAuth: true,
      skipPaths: PUBLIC_ROUTES
    })
    
    const authResult = await authMiddleware(request)
    if (authResult) {
      return addSecurityHeaders(authResult)
    }
  }

  // Update session and add security headers
  const response = await updateSession(request)
  return addSecurityHeaders(response)
}

/**
 * Check user authentication and workspace access
 */
async function checkAuthentication(request: NextRequest): Promise<NextResponse | null> {
  try {
    const response = NextResponse.next({
      request: {
        headers: request.headers,
      },
    })

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            request.cookies.set({
              name,
              value,
              ...options,
            })
            response.cookies.set({
              name,
              value,
              ...options,
            })
          },
          remove(name: string, options: any) {
            request.cookies.set({
              name,
              value: '',
              ...options,
            })
            response.cookies.set({
              name,
              value: '',
              ...options,
            })
          },
        },
      }
    )

    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
      console.log('Authentication failed:', error?.message || 'No user found')
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // For API routes, check workspace access
    if (request.nextUrl.pathname.startsWith('/api')) {
      const workspaceId = user.app_metadata?.workspace_id
      if (!workspaceId) {
        return NextResponse.json(
          { error: 'Workspace access denied' },
          { status: 403 }
        )
      }
    }

    return null // Authentication successful
  } catch (error) {
    console.error('Authentication middleware error:', error)
    return NextResponse.redirect(new URL('/login', request.url))
  }
}

/**
 * Apply global rate limiting using the new rate limiter
 */
async function applyGlobalRateLimit(request: NextRequest): Promise<NextResponse | null> {
  const pathname = request.nextUrl.pathname
  
  // Determine rate limit configuration for this endpoint
  let config = ENDPOINT_RATE_LIMITS.default
  for (const [pattern, rateLimitConfig] of Object.entries(ENDPOINT_RATE_LIMITS)) {
    if (pattern !== 'default' && pathname.startsWith(pattern)) {
      config = rateLimitConfig
      break
    }
  }

  // Use the global rate limiter
  const result = await globalRateLimiter.checkRateLimit(request, config)
  
  if (!result.allowed) {
    return NextResponse.json(
      {
        error: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED',
        limit: result.limit,
        remaining: result.remaining,
        resetTime: result.resetTime,
        retryAfter: result.retryAfter,
        timestamp: new Date().toISOString()
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': result.limit.toString(),
          'X-RateLimit-Remaining': result.remaining.toString(),
          'X-RateLimit-Reset': result.resetTime.toString(),
          'Retry-After': result.retryAfter?.toString() || '60'
        }
      }
    )
  }

  return null // Rate limit passed
}

/**
 * Update Supabase session
 */
async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            request.cookies.set({
              name,
              value,
              ...options,
            })
            response.cookies.set({
              name,
              value,
              ...options,
            })
          },
          remove(name: string, options: any) {
            request.cookies.set({
              name,
              value: '',
              ...options,
            })
            response.cookies.set({
              name,
              value: '',
              ...options,
            })
          },
        },
      }
    )

    await supabase.auth.getUser()
  } catch (error) {
    console.error('Session update error:', error)
  }

  return response
}

/**
 * Add security headers to response
 */
function addSecurityHeaders(response: NextResponse): NextResponse {
  // Security headers
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  
  // CSP header for enhanced security
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vercel.live",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.supabase.co https://*.supabase.co wss://*.supabase.co https://api.github.com https://github.com https://api.vercel.com https://*.e2b.app wss://*.e2b.app",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ')
  
  response.headers.set('Content-Security-Policy', cspDirectives)
  
  // CORS headers for API routes
  if (response.url && new URL(response.url).pathname.startsWith('/api')) {
    response.headers.set('Access-Control-Allow-Origin', process.env.NEXT_PUBLIC_APP_URL || '*')
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  }

  return response
}

export const config = {
  /*
   * Match all request paths except:
   * - _next/static (static files)
   * - _next/image (image optimization files)
   * - favicon.ico (favicon file)
   * - public files (public directory files)
   */
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}