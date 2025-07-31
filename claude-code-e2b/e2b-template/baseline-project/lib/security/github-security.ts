import crypto from 'crypto'
import { logger } from '@/lib/monitoring/logger'

/**
 * GitHub Integration Security Service
 * Handles secure token management, webhook verification, and permission validation
 */
export class GitHubSecurityService {
  private static instance: GitHubSecurityService
  private encryptionKey: string
  private webhookSecret: string

  constructor() {
    this.encryptionKey = process.env.GITHUB_TOKEN_ENCRYPTION_KEY || this.generateEncryptionKey()
    this.webhookSecret = process.env.GITHUB_WEBHOOK_SECRET || ''
    
    if (!this.webhookSecret) {
      logger.warn('GitHub webhook secret not configured - webhooks will not be verified')
    }
  }

  static getInstance(): GitHubSecurityService {
    if (!GitHubSecurityService.instance) {
      GitHubSecurityService.instance = new GitHubSecurityService()
    }
    return GitHubSecurityService.instance
  }

  /**
   * Encrypt GitHub token for secure storage
   */
  encryptToken(token: string): string {
    try {
      const algorithm = 'aes-256-gcm'
      const iv = crypto.randomBytes(16)
      const cipher = crypto.createCipher(algorithm, this.encryptionKey)
      
      let encrypted = cipher.update(token, 'utf8', 'hex')
      encrypted += cipher.final('hex')
      
      const authTag = cipher.getAuthTag()
      
      // Combine iv, authTag, and encrypted data
      const result = iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted
      
      return result
    } catch (error) {
      logger.error('Token encryption failed', error instanceof Error ? error : new Error(String(error)))
      throw new Error('Failed to encrypt GitHub token')
    }
  }

  /**
   * Decrypt GitHub token for use
   */
  decryptToken(encryptedToken: string): string {
    try {
      const algorithm = 'aes-256-gcm'
      const parts = encryptedToken.split(':')
      
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted token format')
      }
      
      const iv = Buffer.from(parts[0], 'hex')
      const authTag = Buffer.from(parts[1], 'hex')
      const encrypted = parts[2]
      
      const decipher = crypto.createDecipher(algorithm, this.encryptionKey)
      decipher.setAuthTag(authTag)
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      
      return decrypted
    } catch (error) {
      logger.error('Token decryption failed', error instanceof Error ? error : new Error(String(error)))
      throw new Error('Failed to decrypt GitHub token')
    }
  }

  /**
   * Validate GitHub webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!this.webhookSecret) {
      logger.warn('Webhook verification attempted but no secret configured')
      return false
    }

    try {
      const expectedSignature = 'sha256=' + crypto
        .createHmac('sha256', this.webhookSecret)
        .update(payload, 'utf8')
        .digest('hex')

      // Use crypto.timingSafeEqual to prevent timing attacks
      const signatureBuffer = Buffer.from(signature, 'utf8')
      const expectedBuffer = Buffer.from(expectedSignature, 'utf8')

      if (signatureBuffer.length !== expectedBuffer.length) {
        return false
      }

      return crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
    } catch (error) {
      logger.error('Webhook signature verification failed', error instanceof Error ? error : new Error(String(error)))
      return false
    }
  }

  /**
   * Validate GitHub token and get user permissions
   */
  async validateTokenAndPermissions(token: string): Promise<{
    valid: boolean
    user?: any
    permissions?: string[]
    rateLimit?: {
      limit: number
      remaining: number
      resetTime: Date
    }
    error?: string
  }> {
    try {
      // Test token validity with GitHub API
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'PRIA-Platform/1.0'
        }
      })

      // Check rate limiting
      const rateLimit = this.extractRateLimitInfo(response)
      
      if (rateLimit.remaining < 100) {
        logger.warn('GitHub API rate limit approaching', {
          metadata: {
            remaining: rateLimit.remaining,
            resetTime: rateLimit.resetTime
          }
        })
      }

      if (!response.ok) {
        const errorText = await response.text()
        logger.warn('GitHub token validation failed', {
          metadata: {
            status: response.status,
            error: errorText
          }
        })

        return {
          valid: false,
          error: response.status === 401 ? 'Invalid token' : 'GitHub API error',
          rateLimit
        }
      }

      const user = await response.json()

      // Get token scopes/permissions
      const scopes = response.headers.get('x-oauth-scopes')?.split(', ') || []
      
      // Validate required permissions
      const requiredScopes = ['repo', 'user:email']
      const hasRequiredScopes = requiredScopes.every(scope => scopes.includes(scope))
      
      if (!hasRequiredScopes) {
        logger.warn('GitHub token missing required scopes', {
          metadata: {
            required: requiredScopes,
            actual: scopes,
            userId: user.id
          }
        })

        return {
          valid: false,
          error: `Missing required permissions: ${requiredScopes.filter(s => !scopes.includes(s)).join(', ')}`,
          rateLimit
        }
      }

      logger.info('GitHub token validated successfully', {
        metadata: {
          userId: user.id,
          username: user.login,
          scopes
        }
      })

      return {
        valid: true,
        user,
        permissions: scopes,
        rateLimit
      }

    } catch (error) {
      logger.error('GitHub token validation error', error instanceof Error ? error : new Error(String(error)))
      return {
        valid: false,
        error: 'Token validation failed'
      }
    }
  }

  /**
   * Validate repository access permissions
   */
  async validateRepositoryAccess(token: string, repoUrl: string): Promise<{
    hasAccess: boolean
    permissions?: {
      admin: boolean
      push: boolean
      pull: boolean
    }
    error?: string
  }> {
    try {
      const { owner, repo } = this.parseRepositoryUrl(repoUrl)
      
      if (!owner || !repo) {
        return {
          hasAccess: false,
          error: 'Invalid repository URL'
        }
      }

      // Check repository access
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'PRIA-Platform/1.0'
        }
      })

      if (!response.ok) {
        if (response.status === 404) {
          return {
            hasAccess: false,
            error: 'Repository not found or no access'
          }
        }

        return {
          hasAccess: false,
          error: 'Failed to verify repository access'
        }
      }

      const repoData = await response.json()
      
      // Extract permissions
      const permissions = {
        admin: repoData.permissions?.admin || false,
        push: repoData.permissions?.push || false,
        pull: repoData.permissions?.pull || false
      }

      // Require at least push access for PRIA operations
      if (!permissions.push) {
        return {
          hasAccess: false,
          error: 'Insufficient repository permissions - push access required'
        }
      }

      logger.info('Repository access validated', {
        metadata: {
          owner,
          repo,
          permissions
        }
      })

      return {
        hasAccess: true,
        permissions
      }

    } catch (error) {
      logger.error('Repository access validation error', error instanceof Error ? error : new Error(String(error)))
      return {
        hasAccess: false,
        error: 'Repository access validation failed'
      }
    }
  }

  /**
   * Implement GitHub API rate limiting
   */
  async withRateLimit<T>(
    operation: () => Promise<T>,
    retryOptions: {
      maxRetries: number
      baseDelay: number
    } = { maxRetries: 3, baseDelay: 1000 }
  ): Promise<T> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= retryOptions.maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        // Check if it's a rate limit error
        if (this.isRateLimitError(error)) {
          const delay = retryOptions.baseDelay * Math.pow(2, attempt)
          
          logger.warn('GitHub API rate limit hit, retrying', {
            metadata: {
              attempt: attempt + 1,
              maxRetries: retryOptions.maxRetries,
              delay
            }
          })

          if (attempt < retryOptions.maxRetries) {
            await new Promise(resolve => setTimeout(resolve, delay))
            continue
          }
        }

        // For non-rate-limit errors or final attempt, throw immediately
        throw error
      }
    }

    throw lastError
  }

  /**
   * Rotate GitHub token (for scheduled rotation)
   */
  async rotateToken(oldToken: string): Promise<{
    success: boolean
    newToken?: string
    error?: string
  }> {
    try {
      // Note: GitHub OAuth apps don't support programmatic token rotation
      // This would need to be implemented with GitHub Apps or manual refresh
      logger.warn('GitHub token rotation requested but not implemented for OAuth apps')
      
      return {
        success: false,
        error: 'Token rotation not supported for OAuth apps - manual refresh required'
      }
    } catch (error) {
      logger.error('Token rotation failed', error instanceof Error ? error : new Error(String(error)))
      return {
        success: false,
        error: 'Token rotation failed'
      }
    }
  }

  // Private helper methods

  private generateEncryptionKey(): string {
    // Generate a secure encryption key if not provided
    return crypto.randomBytes(32).toString('hex')
  }

  private extractRateLimitInfo(response: Response): {
    limit: number
    remaining: number
    resetTime: Date
  } {
    return {
      limit: parseInt(response.headers.get('x-ratelimit-limit') || '5000'),
      remaining: parseInt(response.headers.get('x-ratelimit-remaining') || '5000'),
      resetTime: new Date(parseInt(response.headers.get('x-ratelimit-reset') || '0') * 1000)
    }
  }

  private parseRepositoryUrl(url: string): { owner: string; repo: string } {
    try {
      // Handle various GitHub URL formats
      const patterns = [
        /github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?(?:\/.*)?$/,
        /github\.com:([^\/]+)\/([^\/]+?)(?:\.git)?$/
      ]

      for (const pattern of patterns) {
        const match = url.match(pattern)
        if (match) {
          return {
            owner: match[1],
            repo: match[2]
          }
        }
      }

      throw new Error('Invalid GitHub URL format')
    } catch (error) {
      logger.error('Repository URL parsing failed', error instanceof Error ? error : new Error(String(error)), { 
        metadata: { url } 
      })
      return { owner: '', repo: '' }
    }
  }

  private isRateLimitError(error: any): boolean {
    // Check for GitHub API rate limit errors
    return (
      error?.response?.status === 429 ||
      error?.status === 429 ||
      (error?.message && error.message.includes('rate limit'))
    )
  }
}

// Export singleton instance
export const githubSecurity = GitHubSecurityService.getInstance()

// Helper function for validating GitHub operations
export async function validateGitHubOperation(
  token: string,
  operation: 'read' | 'write' | 'admin',
  repoUrl?: string
): Promise<{
  allowed: boolean
  error?: string
}> {
  try {
    // Validate token
    const tokenValidation = await githubSecurity.validateTokenAndPermissions(token)
    if (!tokenValidation.valid) {
      return {
        allowed: false,
        error: tokenValidation.error
      }
    }

    // Validate repository access if repo URL provided
    if (repoUrl) {
      const repoValidation = await githubSecurity.validateRepositoryAccess(token, repoUrl)
      if (!repoValidation.hasAccess) {
        return {
          allowed: false,
          error: repoValidation.error
        }
      }

      // Check operation permissions
      const permissions = repoValidation.permissions!
      if (operation === 'admin' && !permissions.admin) {
        return {
          allowed: false,
          error: 'Admin access required for this operation'
        }
      }
      if (operation === 'write' && !permissions.push) {
        return {
          allowed: false,
          error: 'Write access required for this operation'
        }
      }
    }

    return { allowed: true }
  } catch (error) {
    logger.error('GitHub operation validation failed', error instanceof Error ? error : new Error(String(error)))
    return {
      allowed: false,
      error: 'Operation validation failed'
    }
  }
}