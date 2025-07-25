import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateRequest } from './schemas'

export interface ValidationResult<T> {
  success: boolean
  data?: T
  errors?: string[]
}

export interface ValidatedRequestData {
  body?: any
  query?: any
  params?: any
}

/**
 * Validate API request body, query parameters, and route parameters
 */
export async function validateAPIRequest<TBody = any, TQuery = any, TParams = any>(
  request: NextRequest,
  schemas: {
    body?: z.ZodSchema<TBody>
    query?: z.ZodSchema<TQuery>
    params?: z.ZodSchema<TParams>
  }
): Promise<ValidationResult<{
  body?: TBody
  query?: TQuery
  params?: TParams
}>> {
  const errors: string[] = []
  const validatedData: ValidatedRequestData = {}

  try {
    // Validate request body
    if (schemas.body) {
      try {
        const body = await request.json()
        const bodyValidation = validateRequest(schemas.body, body)
        
        if (!bodyValidation.success) {
          errors.push(`Body validation: ${bodyValidation.error}`)
        } else {
          validatedData.body = bodyValidation.data
        }
      } catch (error) {
        if (error instanceof SyntaxError) {
          errors.push('Invalid JSON in request body')
        } else {
          errors.push('Failed to parse request body')
        }
      }
    }

    // Validate query parameters
    if (schemas.query) {
      const searchParams = request.nextUrl.searchParams
      const queryObject: Record<string, any> = {}
      
      for (const [key, value] of searchParams.entries()) {
        queryObject[key] = value
      }
      
      const queryValidation = validateRequest(schemas.query, queryObject)
      
      if (!queryValidation.success) {
        errors.push(`Query validation: ${queryValidation.error}`)
      } else {
        validatedData.query = queryValidation.data
      }
    }

    // Validate route parameters
    if (schemas.params) {
      // Extract params from URL - this would need to be passed in from the route handler
      // For now, we'll skip this validation as Next.js handles route params differently
    }

    return {
      success: errors.length === 0,
      data: validatedData as any,
      errors: errors.length > 0 ? errors : undefined
    }
  } catch (error) {
    return {
      success: false,
      errors: [`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`]
    }
  }
}

/**
 * Create a validation error response
 */
export function createValidationErrorResponse(errors: string[]): NextResponse {
  return NextResponse.json(
    {
      error: 'Validation failed',
      details: errors,
      timestamp: new Date().toISOString()
    },
    { status: 400 }
  )
}

/**
 * Higher-order function to wrap API route handlers with validation
 */
export function withValidation<TBody = any, TQuery = any>(
  schemas: {
    body?: z.ZodSchema<TBody>
    query?: z.ZodSchema<TQuery>
  },
  handler: (
    request: NextRequest,
    validatedData: {
      body?: TBody
      query?: TQuery
    }
  ) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      // Validate the request
      const validation = await validateAPIRequest(request, schemas)
      
      if (!validation.success) {
        return createValidationErrorResponse(validation.errors || ['Validation failed'])
      }

      // Call the original handler with validated data
      return await handler(request, validation.data!)
    } catch (error) {
      console.error('API handler error:', error)
      return NextResponse.json(
        {
          error: 'Internal server error',
          timestamp: new Date().toISOString()
        },
        { status: 500 }
      )
    }
  }
}

/**
 * Validate workspace access for authenticated users
 */
export async function validateWorkspaceAccess(
  request: NextRequest,
  requiredWorkspaceId?: string
): Promise<{
  success: boolean
  user?: any
  workspaceId?: string
  error?: string
}> {
  try {
    // Get authentication from middleware-added headers or cookies
    const authHeader = request.headers.get('authorization')
    const userHeader = request.headers.get('x-user-id')
    const workspaceHeader = request.headers.get('x-workspace-id')
    
    if (!userHeader || !workspaceHeader) {
      return {
        success: false,
        error: 'Authentication required'
      }
    }

    // Validate workspace access if specific workspace required
    if (requiredWorkspaceId && workspaceHeader !== requiredWorkspaceId) {
      return {
        success: false,
        error: 'Workspace access denied'
      }
    }

    return {
      success: true,
      user: { id: userHeader },
      workspaceId: workspaceHeader
    }
  } catch (error) {
    return {
      success: false,
      error: 'Authentication validation failed'
    }
  }
}

/**
 * Sanitize input data to prevent XSS and injection attacks
 */
export function sanitizeInput(data: any): any {
  if (typeof data === 'string') {
    // Basic XSS prevention - remove script tags and dangerous attributes
    return data
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim()
  }
  
  if (Array.isArray(data)) {
    return data.map(sanitizeInput)
  }
  
  if (data && typeof data === 'object') {
    const sanitized: any = {}
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeInput(value)
    }
    return sanitized
  }
  
  return data
}

/**
 * Rate limit check for specific operations
 */
export interface RateLimitConfig {
  requests: number
  windowMs: number
  keyGenerator?: (request: NextRequest) => string
}

const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

export function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig
): {
  allowed: boolean
  remaining: number
  resetTime: number
} {
  const key = config.keyGenerator ? 
    config.keyGenerator(request) : 
    request.ip || request.headers.get('x-forwarded-for') || 'unknown'
  
  const now = Date.now()
  const windowStart = now - config.windowMs
  
  // Clean up old entries
  for (const [k, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < windowStart) {
      rateLimitStore.delete(k)
    }
  }
  
  const entry = rateLimitStore.get(key)
  
  if (entry) {
    if (entry.resetTime > now) {
      // Within rate limit window
      if (entry.count >= config.requests) {
        // Rate limit exceeded
        return {
          allowed: false,
          remaining: 0,
          resetTime: entry.resetTime
        }
      } else {
        // Increment counter
        entry.count++
        return {
          allowed: true,
          remaining: config.requests - entry.count,
          resetTime: entry.resetTime
        }
      }
    } else {
      // Reset window
      entry.count = 1
      entry.resetTime = now + config.windowMs
      return {
        allowed: true,
        remaining: config.requests - 1,
        resetTime: entry.resetTime
      }
    }
  } else {
    // First request for this key
    const resetTime = now + config.windowMs
    rateLimitStore.set(key, {
      count: 1,
      resetTime
    })
    
    return {
      allowed: true,
      remaining: config.requests - 1,
      resetTime
    }
  }
}

/**
 * Create rate limit error response
 */
export function createRateLimitErrorResponse(resetTime: number): NextResponse {
  const retryAfter = Math.ceil((resetTime - Date.now()) / 1000)
  
  return NextResponse.json(
    {
      error: 'Rate limit exceeded',
      retryAfter,
      timestamp: new Date().toISOString()
    },
    {
      status: 429,
      headers: {
        'Retry-After': retryAfter.toString(),
        'X-RateLimit-Reset': resetTime.toString()
      }
    }
  )
}

/**
 * Logging utility for API requests
 */
export function logAPIRequest(
  request: NextRequest,
  response: NextResponse,
  duration: number,
  error?: Error
): void {
  const logData = {
    timestamp: new Date().toISOString(),
    method: request.method,
    url: request.url,
    userAgent: request.headers.get('user-agent'),
    ip: request.ip || request.headers.get('x-forwarded-for'),
    status: response.status,
    duration,
    error: error?.message
  }
  
  if (error) {
    console.error('API Request Error:', logData)
  } else {
    console.log('API Request:', logData)
  }
}

/**
 * Comprehensive API wrapper that includes validation, rate limiting, and logging
 */
export function createAPIHandler<TBody = any, TQuery = any>(
  config: {
    schemas?: {
      body?: z.ZodSchema<TBody>
      query?: z.ZodSchema<TQuery>
    }
    rateLimit?: RateLimitConfig
    requireAuth?: boolean
    requiredWorkspace?: string
  },
  handler: (
    request: NextRequest,
    context: {
      validatedData: {
        body?: TBody
        query?: TQuery
      }
      user?: any
      workspaceId?: string
    }
  ) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const startTime = Date.now()
    let response: NextResponse
    let error: Error | undefined
    
    try {
      // Rate limiting
      if (config.rateLimit) {
        const rateLimitResult = checkRateLimit(request, config.rateLimit)
        if (!rateLimitResult.allowed) {
          response = createRateLimitErrorResponse(rateLimitResult.resetTime)
          logAPIRequest(request, response, Date.now() - startTime)
          return response
        }
      }
      
      // Authentication
      let user: any = undefined
      let workspaceId: string | undefined = undefined
      
      if (config.requireAuth) {
        const authResult = await validateWorkspaceAccess(request, config.requiredWorkspace)
        if (!authResult.success) {
          response = NextResponse.json(
            { error: authResult.error },
            { status: 401 }
          )
          logAPIRequest(request, response, Date.now() - startTime)
          return response
        }
        user = authResult.user
        workspaceId = authResult.workspaceId
      }
      
      // Validation
      let validatedData: any = {}
      if (config.schemas) {
        const validation = await validateAPIRequest(request, config.schemas)
        if (!validation.success) {
          response = createValidationErrorResponse(validation.errors || ['Validation failed'])
          logAPIRequest(request, response, Date.now() - startTime)
          return response
        }
        validatedData = validation.data
      }
      
      // Sanitize input data
      if (validatedData.body) {
        validatedData.body = sanitizeInput(validatedData.body)
      }
      if (validatedData.query) {
        validatedData.query = sanitizeInput(validatedData.query)
      }
      
      // Call handler
      response = await handler(request, {
        validatedData,
        user,
        workspaceId
      })
      
    } catch (err) {
      error = err instanceof Error ? err : new Error('Unknown error')
      console.error('API Handler Error:', error)
      
      response = NextResponse.json(
        {
          error: 'Internal server error',
          timestamp: new Date().toISOString()
        },
        { status: 500 }
      )
    } finally {
      // Log request
      logAPIRequest(request, response!, Date.now() - startTime, error)
    }
    
    return response!
  }
}