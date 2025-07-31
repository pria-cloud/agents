/**
 * Input validation and sanitization utilities for PRIA App Builder
 * 
 * SECURITY: All user inputs must be validated and sanitized before processing
 * to prevent injection attacks and malicious code execution.
 */

// Maximum lengths for various inputs
export const MAX_LENGTHS = {
  MESSAGE: 10000,          // Chat messages
  NAME: 100,              // Workspace, project, session names
  DESCRIPTION: 1000,      // Descriptions
  FILE_PATH: 500,         // File paths
  COMMAND: 1000,          // Commands (limited for security)
  URL: 2000,              // URLs
  EMAIL: 320,             // Email addresses (RFC standard)
} as const

// Dangerous command patterns that should be blocked
const DANGEROUS_PATTERNS = [
  // Shell injection attempts
  /[;&|`$(){}[\]]/,        // Shell metacharacters
  /\s*(rm|del|format)\s+/i, // Destructive commands
  /\s*sudo\s+/i,          // Privilege escalation
  /\s*(curl|wget)\s+/i,   // Network commands
  /\s*eval\s*\(/i,        // Code evaluation
  /\s*exec\s*\(/i,        // Code execution
  /\s*system\s*\(/i,      // System calls
  /\s*spawn\s*\(/i,       // Process spawning
  
  // File system attacks
  /\.\.\//,               // Directory traversal
  /\/etc\/passwd/i,       // System file access
  /\/proc\//i,            // Process information
  /\/dev\//i,             // Device access
  
  // Network attacks
  /localhost:\d+/i,       // Local port scanning
  /127\.0\.0\.1/,         // Localhost access
  /0\.0\.0\.0/,           // All interfaces
  
  // Scripting attacks
  /<script[^>]*>/i,       // Script tags
  /javascript:/i,         // JavaScript protocol
  /vbscript:/i,           // VBScript protocol
  /on\w+\s*=/i,          // Event handlers
]

// Allowed file extensions for uploads/operations
const ALLOWED_EXTENSIONS = new Set([
  // Code files
  '.js', '.ts', '.jsx', '.tsx', '.json', '.md', '.txt',
  '.html', '.css', '.scss', '.sass', '.less',
  '.py', '.rb', '.php', '.java', '.cpp', '.c', '.go', '.rs',
  '.sql', '.graphql', '.yaml', '.yml', '.xml',
  
  // Config files
  '.env.example', '.gitignore', '.eslintrc', '.prettierrc',
  '.babelrc', '.dockerignore', '.editorconfig',
  
  // Documentation
  '.md', '.mdx', '.rst', '.txt'
])

/**
 * Sanitizes a string by removing/escaping dangerous characters
 */
export function sanitizeString(input: string, maxLength?: number): string {
  if (typeof input !== 'string') {
    throw new Error('Input must be a string')
  }
  
  // Trim whitespace
  let sanitized = input.trim()
  
  // Enforce length limit
  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength)
  }
  
  // Remove null bytes and control characters (except newlines and tabs)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
  
  // Remove multiple consecutive whitespace (keep single spaces)
  sanitized = sanitized.replace(/\s{2,}/g, ' ')
  
  return sanitized
}

/**
 * Validates and sanitizes a chat message
 */
export function validateChatMessage(message: string): {
  isValid: boolean
  sanitized: string
  errors: string[]
} {
  const errors: string[] = []
  
  // Basic validation
  if (!message || typeof message !== 'string') {
    errors.push('Message must be a non-empty string')
    return { isValid: false, sanitized: '', errors }
  }
  
  // Sanitize
  const sanitized = sanitizeString(message, MAX_LENGTHS.MESSAGE)
  
  if (sanitized.length === 0) {
    errors.push('Message cannot be empty after sanitization')
    return { isValid: false, sanitized, errors }
  }
  
  if (sanitized.length < 1) {
    errors.push('Message is too short')
  }
  
  // Check for dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(sanitized)) {
      errors.push('Message contains potentially dangerous content')
      break
    }
  }
  
  return {
    isValid: errors.length === 0,
    sanitized,
    errors
  }
}

/**
 * Validates and sanitizes a Claude command
 */
export function validateClaudeCommand(command: string): {
  isValid: boolean
  sanitized: string
  errors: string[]
} {
  const errors: string[] = []
  
  if (!command || typeof command !== 'string') {
    errors.push('Command must be a non-empty string')
    return { isValid: false, sanitized: '', errors }
  }
  
  // Sanitize
  const sanitized = sanitizeString(command, MAX_LENGTHS.COMMAND)
  
  if (sanitized.length === 0) {
    errors.push('Command cannot be empty')
    return { isValid: false, sanitized, errors }
  }
  
  // Check for dangerous patterns (more strict for commands)
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(sanitized)) {
      errors.push('Command contains dangerous patterns and cannot be executed')
      return { isValid: false, sanitized, errors }
    }
  }
  
  // Additional command-specific validation
  if (sanitized.includes('\\') && !sanitized.match(/^[a-zA-Z]:\\/)) {
    errors.push('Backslashes not allowed in commands except for Windows paths')
  }
  
  return {
    isValid: errors.length === 0,
    sanitized,
    errors
  }
}

/**
 * Validates a file path for safety
 */
export function validateFilePath(path: string): {
  isValid: boolean
  sanitized: string
  errors: string[]
} {
  const errors: string[] = []
  
  if (!path || typeof path !== 'string') {
    errors.push('File path must be a non-empty string')
    return { isValid: false, sanitized: '', errors }
  }
  
  // Sanitize
  const sanitized = sanitizeString(path, MAX_LENGTHS.FILE_PATH)
  
  if (sanitized.length === 0) {
    errors.push('File path cannot be empty')
    return { isValid: false, sanitized, errors }
  }
  
  // Security checks
  if (sanitized.includes('../') || sanitized.includes('..\\')) {
    errors.push('Directory traversal not allowed')
  }
  
  if (sanitized.startsWith('/') && !sanitized.startsWith('/workspace/')) {
    errors.push('Absolute paths outside workspace not allowed')
  }
  
  // Check file extension if path has one
  const extension = sanitized.includes('.') ? 
    '.' + sanitized.split('.').pop()?.toLowerCase() : ''
  
  if (extension && !ALLOWED_EXTENSIONS.has(extension)) {
    errors.push(`File extension ${extension} is not allowed`)
  }
  
  return {
    isValid: errors.length === 0,
    sanitized,
    errors
  }
}

/**
 * Validates a name (workspace, project, session)
 */
export function validateName(name: string, type: string = 'name'): {
  isValid: boolean
  sanitized: string
  errors: string[]
} {
  const errors: string[] = []
  
  if (!name || typeof name !== 'string') {
    errors.push(`${type} must be a non-empty string`)
    return { isValid: false, sanitized: '', errors }
  }
  
  // Sanitize
  const sanitized = sanitizeString(name, MAX_LENGTHS.NAME)
  
  if (sanitized.length === 0) {
    errors.push(`${type} cannot be empty`)
    return { isValid: false, sanitized, errors }
  }
  
  if (sanitized.length < 2) {
    errors.push(`${type} must be at least 2 characters long`)
  }
  
  // Only allow alphanumeric, spaces, hyphens, underscores
  if (!/^[a-zA-Z0-9\s\-_]+$/.test(sanitized)) {
    errors.push(`${type} can only contain letters, numbers, spaces, hyphens, and underscores`)
  }
  
  return {
    isValid: errors.length === 0,
    sanitized,
    errors
  }
}

/**
 * Validates a URL
 */
export function validateUrl(url: string): {
  isValid: boolean
  sanitized: string
  errors: string[]
} {
  const errors: string[] = []
  
  if (!url || typeof url !== 'string') {
    errors.push('URL must be a non-empty string')
    return { isValid: false, sanitized: '', errors }
  }
  
  // Sanitize
  const sanitized = sanitizeString(url, MAX_LENGTHS.URL)
  
  if (sanitized.length === 0) {
    errors.push('URL cannot be empty')
    return { isValid: false, sanitized, errors }
  }
  
  // Basic URL validation
  try {
    const urlObj = new URL(sanitized)
    
    // Only allow safe protocols
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      errors.push('Only HTTP and HTTPS URLs are allowed')
    }
    
    // Block local/private IPs for security
    if (urlObj.hostname === 'localhost' || 
        urlObj.hostname.startsWith('127.') ||
        urlObj.hostname.startsWith('192.168.') ||
        urlObj.hostname.startsWith('10.') ||
        urlObj.hostname === '0.0.0.0') {
      errors.push('Local/private IP addresses are not allowed')
    }
    
  } catch (e) {
    errors.push('Invalid URL format')
  }
  
  return {
    isValid: errors.length === 0,
    sanitized,
    errors
  }
}

/**
 * Rate limiting check (simple in-memory implementation)
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

export function checkRateLimit(
  identifier: string, 
  maxRequests: number = 100, 
  windowMs: number = 60000 // 1 minute
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now()
  const key = identifier
  
  const record = rateLimitStore.get(key)
  
  if (!record || now > record.resetTime) {
    // New or expired record
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs })
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

/**
 * Cleans up old rate limit records
 */
export function cleanupRateLimitStore(): void {
  const now = Date.now()
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key)
    }
  }
}

// Clean up rate limit store every 5 minutes
setInterval(cleanupRateLimitStore, 5 * 60 * 1000)