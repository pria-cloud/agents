/**
 * Secure Encryption Utility for PRIA App Builder
 * Provides AES-256-GCM encryption for sensitive data like GitHub tokens
 */

import { createCipherGCM, createDecipherGCM, randomBytes, createHash } from 'crypto'

export interface EncryptionResult {
  encryptedData: string
  iv: string
  tag: string
}

export interface DecryptionInput {
  encryptedData: string
  iv: string
  tag: string
}

export class PRIAEncryption {
  private static readonly ALGORITHM = 'aes-256-gcm'
  private static readonly KEY_LENGTH = 32 // 256 bits
  private static readonly IV_LENGTH = 16 // 128 bits
  
  private static encryptionKey: Buffer | null = null
  
  /**
   * Initialize encryption key from environment
   */
  private static getEncryptionKey(): Buffer {
    if (this.encryptionKey) {
      return this.encryptionKey
    }
    
    const keySource = process.env.PRIA_ENCRYPTION_KEY
    if (!keySource) {
      throw new Error('PRIA_ENCRYPTION_KEY environment variable is required')
    }
    
    if (keySource.length < 32) {
      throw new Error('PRIA_ENCRYPTION_KEY must be at least 32 characters long')
    }
    
    // Derive a consistent key from the environment variable
    this.encryptionKey = createHash('sha256')
      .update(keySource)
      .digest()
    
    return this.encryptionKey
  }
  
  /**
   * Encrypt sensitive data using AES-256-GCM
   */
  static encrypt(plaintext: string): EncryptionResult {
    try {
      if (!plaintext || plaintext.trim() === '') {
        throw new Error('Cannot encrypt empty data')
      }
      
      const key = this.getEncryptionKey()
      const iv = randomBytes(this.IV_LENGTH)
      
      const cipher = createCipherGCM(this.ALGORITHM, key, iv)
      
      let encrypted = cipher.update(plaintext, 'utf8', 'hex')
      encrypted += cipher.final('hex')
      
      // Get authentication tag for GCM mode
      const tag = cipher.getAuthTag()
      
      return {
        encryptedData: encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex')
      }
      
    } catch (error) {
      console.error('[ENCRYPTION] Failed to encrypt data:', error)
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  /**
   * Decrypt sensitive data using AES-256-GCM
   */
  static decrypt(input: DecryptionInput): string {
    try {
      if (!input.encryptedData || !input.iv || !input.tag) {
        throw new Error('Invalid decryption input - missing encrypted data, IV, or authentication tag')
      }
      
      const key = this.getEncryptionKey()
      const iv = Buffer.from(input.iv, 'hex')
      const tag = Buffer.from(input.tag, 'hex')
      
      const decipher = createDecipherGCM(this.ALGORITHM, key, iv)
      decipher.setAuthTag(tag)
      
      let decrypted = decipher.update(input.encryptedData, 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      
      return decrypted
      
    } catch (error) {
      console.error('[ENCRYPTION] Failed to decrypt data:', error)
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  /**
   * Encrypt GitHub token specifically
   */
  static encryptGitHubToken(token: string): string {
    try {
      if (!token.startsWith('ghp_') && !token.startsWith('gho_') && !token.startsWith('ghu_') && !token.startsWith('ghs_')) {
        console.warn('[ENCRYPTION] Token does not appear to be a valid GitHub token format')
      }
      
      const result = this.encrypt(token)
      
      // Combine all parts into a single string for database storage
      return JSON.stringify({
        data: result.encryptedData,
        iv: result.iv,
        tag: result.tag,
        type: 'github_token',
        version: '1.0'
      })
      
    } catch (error) {
      console.error('[ENCRYPTION] Failed to encrypt GitHub token:', error)
      throw error
    }
  }
  
  /**
   * Decrypt GitHub token specifically
   */
  static decryptGitHubToken(encryptedToken: string): string {
    try {
      const parsed = JSON.parse(encryptedToken)
      
      if (parsed.type !== 'github_token') {
        throw new Error('Invalid token type')
      }
      
      return this.decrypt({
        encryptedData: parsed.data,
        iv: parsed.iv,
        tag: parsed.tag
      })
      
    } catch (error) {
      console.error('[ENCRYPTION] Failed to decrypt GitHub token:', error)
      throw error
    }
  }
  
  /**
   * Encrypt webhook secret specifically
   */
  static encryptWebhookSecret(secret: string): string {
    try {
      const result = this.encrypt(secret)
      
      return JSON.stringify({
        data: result.encryptedData,
        iv: result.iv,
        tag: result.tag,
        type: 'webhook_secret',
        version: '1.0'
      })
      
    } catch (error) {
      console.error('[ENCRYPTION] Failed to encrypt webhook secret:', error)
      throw error
    }
  }
  
  /**
   * Decrypt webhook secret specifically
   */
  static decryptWebhookSecret(encryptedSecret: string): string {
    try {
      const parsed = JSON.parse(encryptedSecret)
      
      if (parsed.type !== 'webhook_secret') {
        throw new Error('Invalid secret type')
      }
      
      return this.decrypt({
        encryptedData: parsed.data,
        iv: parsed.iv,
        tag: parsed.tag
      })
      
    } catch (error) {
      console.error('[ENCRYPTION] Failed to decrypt webhook secret:', error)
      throw error
    }
  }
  
  /**
   * Hash sensitive data for comparison (one-way)
   */
  static hashSensitiveData(data: string, salt?: string): string {
    const actualSalt = salt || randomBytes(16).toString('hex')
    const hash = createHash('sha256')
    hash.update(data + actualSalt)
    return `${actualSalt}:${hash.digest('hex')}`
  }
  
  /**
   * Verify hashed data
   */
  static verifyHashedData(data: string, hashedData: string): boolean {
    try {
      const [salt, hash] = hashedData.split(':')
      if (!salt || !hash) {
        return false
      }
      
      const expectedHash = createHash('sha256')
      expectedHash.update(data + salt)
      const expectedResult = expectedHash.digest('hex')
      
      return expectedResult === hash
      
    } catch (error) {
      console.error('[ENCRYPTION] Hash verification failed:', error)
      return false
    }
  }
  
  /**
   * Validate encryption environment setup
   */
  static validateEnvironment(): {
    isConfigured: boolean
    errors: string[]
    recommendations: string[]
  } {
    const errors: string[] = []
    const recommendations: string[] = []
    
    // Check encryption key
    const encryptionKey = process.env.PRIA_ENCRYPTION_KEY
    if (!encryptionKey) {
      errors.push('PRIA_ENCRYPTION_KEY environment variable is not set')
    } else if (encryptionKey.length < 32) {
      errors.push('PRIA_ENCRYPTION_KEY must be at least 32 characters long')
    } else if (encryptionKey === 'your-secure-encryption-key-here' || encryptionKey.includes('default')) {
      errors.push('PRIA_ENCRYPTION_KEY appears to be using a default/placeholder value')
    }
    
    // Recommendations
    if (process.env.NODE_ENV === 'production') {
      recommendations.push('In production, consider using AWS KMS, Azure Key Vault, or similar key management service')
      recommendations.push('Regularly rotate encryption keys and update encrypted data')
      recommendations.push('Monitor access to encryption keys and audit usage')
    }
    
    return {
      isConfigured: errors.length === 0,
      errors,
      recommendations
    }
  }
  
  /**
   * Generate a secure encryption key for setup
   */
  static generateEncryptionKey(): string {
    return randomBytes(32).toString('hex')
  }
}

// Export types for external use
export type { EncryptionResult, DecryptionInput }