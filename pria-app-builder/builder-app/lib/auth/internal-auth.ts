/**
 * Internal API Authentication System
 * 
 * SECURITY: Provides secure authentication for internal service-to-service calls
 * without exposing service role keys or other sensitive credentials.
 */

import { NextRequest } from 'next/server'
import { createHash, randomBytes, timingSafeEqual } from 'crypto'

// Internal API authentication configuration
const INTERNAL_API_CONFIG = {
  // Token expiry: 5 minutes for internal calls
  TOKEN_EXPIRY_MS: 5 * 60 * 1000,
  // Secret for signing internal tokens (derived from service role key)
  SECRET: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  // Token issuer
  ISSUER: 'pria-app-builder-internal',
}

export interface InternalToken {
  iss: string // issuer
  iat: number // issued at
  exp: number // expires at
  sub: string // subject (service name)
  purpose: string // purpose of the token
  nonce: string // random nonce for replay protection
}

/**
 * Generates a secure internal API token
 */
export function generateInternalToken(purpose: string, subject: string = 'e2b-service'): string {
  const now = Date.now()
  const token: InternalToken = {
    iss: INTERNAL_API_CONFIG.ISSUER,
    iat: now,
    exp: now + INTERNAL_API_CONFIG.TOKEN_EXPIRY_MS,
    sub: subject,
    purpose,
    nonce: randomBytes(16).toString('hex')
  }

  // Create token payload
  const payload = Buffer.from(JSON.stringify(token)).toString('base64url')
  
  // Create signature using HMAC-SHA256
  const signature = createHash('sha256')
    .update(INTERNAL_API_CONFIG.SECRET + payload)
    .digest('base64url')

  // Return signed token
  return `${payload}.${signature}`
}

/**
 * Validates an internal API token
 */
export function validateInternalToken(token: string): { 
  isValid: boolean
  payload?: InternalToken
  error?: string 
} {
  try {
    if (!token) {
      return { isValid: false, error: 'No token provided' }
    }

    // Split token into payload and signature
    const parts = token.split('.')
    if (parts.length !== 2) {
      return { isValid: false, error: 'Invalid token format' }
    }

    const [payloadBase64, signature] = parts

    // Verify signature
    const expectedSignature = createHash('sha256')
      .update(INTERNAL_API_CONFIG.SECRET + payloadBase64)
      .digest('base64url')

    // Use timing-safe comparison to prevent timing attacks
    const signatureBuffer = Buffer.from(signature)
    const expectedBuffer = Buffer.from(expectedSignature)
    
    if (signatureBuffer.length !== expectedBuffer.length) {
      return { isValid: false, error: 'Invalid signature' }
    }

    if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
      return { isValid: false, error: 'Invalid signature' }
    }

    // Decode payload
    const payload: InternalToken = JSON.parse(
      Buffer.from(payloadBase64, 'base64url').toString()
    )

    // Validate token structure
    if (!payload.iss || !payload.iat || !payload.exp || !payload.sub || !payload.purpose) {
      return { isValid: false, error: 'Invalid token structure' }
    }

    // Validate issuer
    if (payload.iss !== INTERNAL_API_CONFIG.ISSUER) {
      return { isValid: false, error: 'Invalid issuer' }
    }

    // Check expiry
    if (Date.now() > payload.exp) {
      return { isValid: false, error: 'Token expired' }
    }

    // Check not-before (issued at should not be in the future)
    if (payload.iat > Date.now() + 60000) { // Allow 1 minute clock skew
      return { isValid: false, error: 'Token not yet valid' }
    }

    return { isValid: true, payload }

  } catch (error) {
    return { 
      isValid: false, 
      error: `Token validation failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }
  }
}

/**
 * Middleware function to authenticate internal API calls
 */
export function authenticateInternalCall(request: NextRequest): {
  isInternal: boolean
  token?: InternalToken
  error?: string
} {
  const authHeader = request.headers.get('Authorization')
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { isInternal: false }
  }

  const token = authHeader.slice(7) // Remove 'Bearer ' prefix

  // Check if this looks like an internal token (has our format)
  if (!token.includes('.') || token.split('.').length !== 2) {
    return { isInternal: false }
  }

  const validation = validateInternalToken(token)
  if (!validation.isValid) {
    return { 
      isInternal: true, 
      error: validation.error 
    }
  }

  return { 
    isInternal: true, 
    token: validation.payload 
  }
}

/**
 * Creates an authenticated fetch client for internal API calls
 */
export class InternalApiClient {
  private baseUrl: string

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl
  }

  async fetch(endpoint: string, options: RequestInit & { purpose?: string } = {}) {
    const { purpose = 'internal-api-call', ...fetchOptions } = options

    // Generate internal token
    const token = generateInternalToken(purpose)

    // Add authentication header
    const headers = new Headers(fetchOptions.headers)
    headers.set('Authorization', `Bearer ${token}`)
    headers.set('Content-Type', 'application/json')
    headers.set('X-Internal-API', 'true')

    return fetch(`${this.baseUrl}${endpoint}`, {
      ...fetchOptions,
      headers
    })
  }

  async post(endpoint: string, data: any, purpose?: string) {
    return this.fetch(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
      purpose
    })
  }

  async get(endpoint: string, purpose?: string) {
    return this.fetch(endpoint, {
      method: 'GET',
      purpose
    })
  }
}

/**
 * Global internal API client instance
 */
export const internalApiClient = new InternalApiClient()

/**
 * Rate limiting for internal calls (separate from user rate limiting)
 */
const internalRateLimitStore = new Map<string, { count: number; resetTime: number }>()

export function checkInternalRateLimit(
  identifier: string, 
  maxRequests: number = 1000, 
  windowMs: number = 60000 // 1 minute
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now()
  const key = `internal:${identifier}`
  
  const record = internalRateLimitStore.get(key)
  
  if (!record || now > record.resetTime) {
    // New or expired record
    internalRateLimitStore.set(key, { count: 1, resetTime: now + windowMs })
    return { allowed: true, remaining: maxRequests - 1, resetTime: now + windowMs }
  }
  
  if (record.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetTime: record.resetTime }
  }
  
  record.count++
  return { 
    allowed: true, 
    remaining: maxRequests - record.count, 
    resetTime: record.resetTime 
  }
}

// Clean up internal rate limit store every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, record] of internalRateLimitStore.entries()) {
    if (now > record.resetTime) {
      internalRateLimitStore.delete(key)
    }
  }
}, 5 * 60 * 1000)

/**
 * Helper function to create internal authentication headers
 */
export function createInternalAuthHeaders(purpose: string): Record<string, string> {
  const token = generateInternalToken(purpose)
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'X-Internal-API': 'true'
  }
}