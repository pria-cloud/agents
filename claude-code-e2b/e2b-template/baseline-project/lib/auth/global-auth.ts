import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { logger } from '@/lib/monitoring/logger'
import jwt from 'jsonwebtoken'

export interface AuthenticatedUser {
  id: string
  email: string
  workspaceId: string
  permissions: string[]
  sessionToken: string
}

export interface AuthContext {
  user: AuthenticatedUser
  isAuthenticated: boolean
  hasPermission: (permission: string) => boolean
  hasWorkspaceAccess: (workspaceId: string) => boolean
}

/**
 * Global authentication service for all API endpoints
 */
export class GlobalAuthService {
  private static instance: GlobalAuthService
  private jwtSecret: string
  private supabaseUrl: string
  private supabaseAnonKey: string

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET || ''
    this.supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    this.supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    
    if (!this.jwtSecret) {
      throw new Error('JWT_SECRET or SUPABASE_JWT_SECRET must be configured')
    }
    if (!this.supabaseUrl || !this.supabaseAnonKey) {
      throw new Error('Supabase configuration missing')
    }
  }

  static getInstance(): GlobalAuthService {
    if (!GlobalAuthService.instance) {
      GlobalAuthService.instance = new GlobalAuthService()
    }
    return GlobalAuthService.instance
  }

  /**
   * Authenticate request and return user context
   */
  async authenticateRequest(request: NextRequest): Promise<{
    success: boolean
    context?: AuthContext
    error?: string
    statusCode?: number
  }> {
    try {
      // Extract authentication token
      const authResult = await this.extractAuthToken(request)
      if (!authResult.success) {
        return {
          success: false,
          error: authResult.error,
          statusCode: 401
        }
      }

      // Validate and decode JWT token
      const tokenValidation = await this.validateJWTToken(authResult.token!)
      if (!tokenValidation.success) {
        return {
          success: false,
          error: tokenValidation.error,
          statusCode: 401
        }
      }

      // Get user from Supabase
      const userResult = await this.getUserFromSupabase(request, tokenValidation.payload!.sub)
      if (!userResult.success) {
        return {
          success: false,
          error: userResult.error,
          statusCode: userResult.statusCode || 401
        }
      }

      // Create auth context
      const context = this.createAuthContext(userResult.user!, authResult.token!)
      
      logger.info('User authenticated successfully', {
        userId: userResult.user!.id,
        workspaceId: userResult.user!.app_metadata?.workspace_id,
        email: userResult.user!.email
      })

      return {
        success: true,
        context
      }

    } catch (error) {
      logger.error('Authentication error', error, {
        url: request.url,
        method: request.method,
        userAgent: request.headers.get('user-agent')
      })

      return {
        success: false,
        error: 'Authentication failed',
        statusCode: 500
      }
    }
  }

  /**
   * Extract authentication token from request
   */
  private async extractAuthToken(request: NextRequest): Promise<{
    success: boolean
    token?: string
    error?: string
  }> {
    // Check Authorization header (Bearer token)
    const authHeader = request.headers.get('authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return {
        success: true,
        token: authHeader.substring(7)
      }
    }

    // Check x-api-key header (for service-to-service)
    const apiKey = request.headers.get('x-api-key')
    if (apiKey) {
      return {
        success: true,
        token: apiKey
      }
    }

    // Check cookies for session token
    const cookieToken = request.cookies.get('sb-access-token')?.value ||
                       request.cookies.get('supabase-auth-token')?.value
    if (cookieToken) {
      return {
        success: true,
        token: cookieToken
      }
    }

    return {
      success: false,
      error: 'No authentication token found'
    }
  }

  /**
   * Validate JWT token structure and signature
   */
  private async validateJWTToken(token: string): Promise<{
    success: boolean
    payload?: any
    error?: string
  }> {
    try {
      // Verify JWT signature and decode
      const payload = jwt.verify(token, this.jwtSecret, {
        algorithms: ['HS256'],
        issuer: 'supabase',
        audience: 'authenticated'
      })

      if (typeof payload === 'string') {
        return {
          success: false,
          error: 'Invalid token payload'
        }
      }

      // Check token expiration
      const now = Math.floor(Date.now() / 1000)
      if (payload.exp && payload.exp < now) {
        return {
          success: false,
          error: 'Token expired'
        }
      }

      // Validate required claims
      if (!payload.sub || !payload.email) {
        return {
          success: false,
          error: 'Invalid token claims'
        }
      }

      return {
        success: true,
        payload
      }

    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        return {
          success: false,
          error: 'Invalid token signature'
        }
      }
      if (error instanceof jwt.TokenExpiredError) {
        return {
          success: false,
          error: 'Token expired'
        }
      }
      if (error instanceof jwt.NotBeforeError) {
        return {
          success: false,
          error: 'Token not active yet'
        }
      }

      logger.error('JWT validation error', error)
      return {
        success: false,
        error: 'Token validation failed'
      }
    }
  }

  /**
   * Get user details from Supabase
   */
  private async getUserFromSupabase(request: NextRequest, userId: string): Promise<{
    success: boolean
    user?: any
    error?: string
    statusCode?: number
  }> {
    try {
      const supabase = createServerClient(
        this.supabaseUrl,
        this.supabaseAnonKey,
        {
          cookies: {
            get(name: string) {
              return request.cookies.get(name)?.value
            },
            set() {
              // No-op for read-only operations
            },
            remove() {
              // No-op for read-only operations
            }
          }
        }
      )

      const { data: user, error } = await supabase.auth.getUser()
      
      if (error) {
        logger.warn('Supabase user fetch error', { error: error.message, userId })
        return {
          success: false,
          error: 'User session invalid',
          statusCode: 401
        }
      }

      if (!user.user) {
        return {
          success: false,
          error: 'User not found',
          statusCode: 401
        }
      }

      // Verify user ID matches
      if (user.user.id !== userId) {
        logger.warn('User ID mismatch in token', { 
          tokenUserId: userId, 
          supabaseUserId: user.user.id 
        })
        return {
          success: false,
          error: 'Invalid user session',
          statusCode: 401
        }
      }

      // Check if user has workspace access
      const workspaceId = user.user.app_metadata?.workspace_id
      if (!workspaceId) {
        logger.warn('User without workspace access', { userId: user.user.id })
        return {
          success: false,
          error: 'Workspace access required',
          statusCode: 403
        }
      }

      return {
        success: true,
        user: user.user
      }

    } catch (error) {
      logger.error('Supabase user fetch error', error, { userId })
      return {
        success: false,
        error: 'Authentication service error',
        statusCode: 500
      }
    }
  }

  /**
   * Create authentication context
   */
  private createAuthContext(user: any, token: string): AuthContext {
    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      workspaceId: user.app_metadata?.workspace_id,
      permissions: user.app_metadata?.permissions || [],
      sessionToken: token
    }

    return {
      user: authenticatedUser,
      isAuthenticated: true,
      hasPermission: (permission: string) => {
        return authenticatedUser.permissions.includes(permission) ||
               authenticatedUser.permissions.includes('*')
      },
      hasWorkspaceAccess: (workspaceId: string) => {
        return authenticatedUser.workspaceId === workspaceId
      }
    }
  }

  /**
   * Create authentication middleware
   */
  createAuthMiddleware(options: {
    requireAuth?: boolean
    requiredPermissions?: string[]
    requiredWorkspace?: string
    skipPaths?: string[]
  } = {}) {
    const {
      requireAuth = true,
      requiredPermissions = [],
      requiredWorkspace,
      skipPaths = []
    } = options

    return async (request: NextRequest): Promise<NextResponse | null> => {
      const pathname = request.nextUrl.pathname

      // Skip authentication for specified paths
      if (skipPaths.some(path => pathname.startsWith(path))) {
        return null
      }

      // Skip authentication if not required
      if (!requireAuth) {
        return null
      }

      // Authenticate request
      const authResult = await this.authenticateRequest(request)
      
      if (!authResult.success) {
        return NextResponse.json(
          {
            error: authResult.error,
            code: 'AUTHENTICATION_FAILED',
            timestamp: new Date().toISOString()
          },
          { status: authResult.statusCode || 401 }
        )
      }

      const context = authResult.context!

      // Check required permissions
      if (requiredPermissions.length > 0) {
        const hasRequiredPermissions = requiredPermissions.every(permission =>
          context.hasPermission(permission)
        )

        if (!hasRequiredPermissions) {
          logger.warn('Insufficient permissions', {
            userId: context.user.id,
            requiredPermissions,
            userPermissions: context.user.permissions
          })

          return NextResponse.json(
            {
              error: 'Insufficient permissions',
              code: 'INSUFFICIENT_PERMISSIONS',
              required: requiredPermissions,
              timestamp: new Date().toISOString()
            },
            { status: 403 }
          )
        }
      }

      // Check workspace access
      if (requiredWorkspace && !context.hasWorkspaceAccess(requiredWorkspace)) {
        logger.warn('Workspace access denied', {
          userId: context.user.id,
          requiredWorkspace,
          userWorkspace: context.user.workspaceId
        })

        return NextResponse.json(
          {
            error: 'Workspace access denied',
            code: 'WORKSPACE_ACCESS_DENIED',
            timestamp: new Date().toISOString()
          },
          { status: 403 }
        )
      }

      // Add auth context to request headers for downstream handlers
      const response = NextResponse.next()
      response.headers.set('x-user-id', context.user.id)
      response.headers.set('x-user-email', context.user.email)
      response.headers.set('x-workspace-id', context.user.workspaceId)
      response.headers.set('x-user-permissions', JSON.stringify(context.user.permissions))

      return null // Continue to next middleware/handler
    }
  }
}

// Export singleton instance
export const globalAuth = GlobalAuthService.getInstance()

// Helper function for API route handlers
export async function requireAuth(
  request: NextRequest,
  options: {
    requiredPermissions?: string[]
    requiredWorkspace?: string
  } = {}
): Promise<{
  success: boolean
  context?: AuthContext
  error?: NextResponse
}> {
  const authResult = await globalAuth.authenticateRequest(request)
  
  if (!authResult.success) {
    return {
      success: false,
      error: NextResponse.json(
        {
          error: authResult.error,
          code: 'AUTHENTICATION_REQUIRED',
          timestamp: new Date().toISOString()
        },
        { status: authResult.statusCode || 401 }
      )
    }
  }

  const context = authResult.context!

  // Check permissions
  if (options.requiredPermissions?.length) {
    const hasPermissions = options.requiredPermissions.every(permission =>
      context.hasPermission(permission)
    )

    if (!hasPermissions) {
      return {
        success: false,
        error: NextResponse.json(
          {
            error: 'Insufficient permissions',
            code: 'INSUFFICIENT_PERMISSIONS',
            required: options.requiredPermissions,
            timestamp: new Date().toISOString()
          },
          { status: 403 }
        )
      }
    }
  }

  // Check workspace access
  if (options.requiredWorkspace && !context.hasWorkspaceAccess(options.requiredWorkspace)) {
    return {
      success: false,
      error: NextResponse.json(
        {
          error: 'Workspace access denied',
          code: 'WORKSPACE_ACCESS_DENIED',
          timestamp: new Date().toISOString()
        },
        { status: 403 }
      )
    }
  }

  return {
    success: true,
    context
  }
}