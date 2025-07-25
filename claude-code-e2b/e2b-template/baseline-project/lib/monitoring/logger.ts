import pino from 'pino'

// Create base logger instance
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(process.env.NODE_ENV === 'production' 
    ? {
        // Production logging configuration
        formatters: {
          level: (label) => ({ level: label.toUpperCase() }),
          log: (object) => {
            // Add trace ID for distributed tracing
            const traceId = process.env.TRACE_ID || generateTraceId()
            return { ...object, traceId }
          }
        },
        redact: {
          paths: [
            'password',
            'token',
            'authorization',
            'cookie',
            'github_token',
            'api_key',
            '*.password',
            '*.token',
            '*.authorization'
          ],
          censor: '[REDACTED]'
        }
      }
    : {
        // Development logging configuration
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            ignore: 'pid,hostname',
            translateTime: 'SYS:standard'
          }
        }
      }
  )
})

// Generate unique trace ID for request tracking
function generateTraceId(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15)
}

// Structured logging interface
export interface LogContext {
  userId?: string
  workspaceId?: string
  sessionId?: string
  operationType?: string
  requestId?: string
  ip?: string
  userAgent?: string
  duration?: number
  error?: Error | string
  metadata?: Record<string, any>
}

export class Logger {
  private baseContext: LogContext = {}

  constructor(baseContext?: LogContext) {
    this.baseContext = baseContext || {}
  }

  // Create child logger with additional context
  child(context: LogContext): Logger {
    return new Logger({ ...this.baseContext, ...context })
  }

  // Info level logging
  info(message: string, context?: LogContext): void {
    logger.info({ ...this.baseContext, ...context }, message)
  }

  // Warning level logging
  warn(message: string, context?: LogContext): void {
    logger.warn({ ...this.baseContext, ...context }, message)
  }

  // Error level logging
  error(message: string, error?: Error | string, context?: LogContext): void {
    const errorContext = {
      ...this.baseContext,
      ...context,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error
    }
    logger.error(errorContext, message)
  }

  // Debug level logging (only in development)
  debug(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV !== 'production') {
      logger.debug({ ...this.baseContext, ...context }, message)
    }
  }

  // Critical error logging with immediate alerting
  critical(message: string, error: Error | string, context?: LogContext): void {
    const criticalContext = {
      ...this.baseContext,
      ...context,
      severity: 'CRITICAL',
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error
    }
    
    logger.fatal(criticalContext, message)
    
    // In production, this should trigger immediate alerts
    if (process.env.NODE_ENV === 'production') {
      this.sendAlert(message, error, criticalContext)
    }
  }

  // Send alert for critical issues
  private async sendAlert(message: string, error: Error | string, context: LogContext): Promise<void> {
    try {
      // This would integrate with your alerting system (Slack, PagerDuty, etc.)
      if (process.env.ALERT_WEBHOOK_URL) {
        await fetch(process.env.ALERT_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `🚨 CRITICAL ERROR in PRIA Platform`,
            attachments: [{
              color: 'danger',
              fields: [
                { title: 'Message', value: message, short: false },
                { title: 'Error', value: error instanceof Error ? error.message : error, short: false },
                { title: 'Workspace', value: context.workspaceId || 'Unknown', short: true },
                { title: 'User', value: context.userId || 'Unknown', short: true },
                { title: 'Timestamp', value: new Date().toISOString(), short: true }
              ]
            }]
          })
        })
      }
    } catch (alertError) {
      logger.error({ error: alertError }, 'Failed to send critical alert')
    }
  }

  // Log API request/response
  logAPIRequest(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    context?: LogContext
  ): void {
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info'
    const logContext = {
      ...this.baseContext,
      ...context,
      api: {
        method,
        url,
        statusCode,
        duration
      }
    }

    logger[level](logContext, `API ${method} ${url} - ${statusCode} (${duration}ms)`)
  }

  // Log Claude operation
  logClaudeOperation(
    operationType: string,
    status: 'started' | 'completed' | 'failed',
    duration?: number,
    context?: LogContext
  ): void {
    const logContext = {
      ...this.baseContext,
      ...context,
      claude: {
        operationType,
        status,
        duration
      }
    }

    if (status === 'failed') {
      this.error(`Claude operation failed: ${operationType}`, undefined, logContext)
    } else {
      this.info(`Claude operation ${status}: ${operationType}`, logContext)
    }
  }

  // Log E2B sandbox operation
  logE2BOperation(
    operation: string,
    sandboxId: string,
    status: 'started' | 'completed' | 'failed',
    duration?: number,
    context?: LogContext
  ): void {
    const logContext = {
      ...this.baseContext,
      ...context,
      e2b: {
        operation,
        sandboxId,
        status,
        duration
      }
    }

    if (status === 'failed') {
      this.error(`E2B operation failed: ${operation}`, undefined, logContext)
    } else {
      this.info(`E2B operation ${status}: ${operation}`, logContext)
    }
  }

  // Log GitHub operation
  logGitHubOperation(
    operation: string,
    repository: string,
    status: 'started' | 'completed' | 'failed',
    context?: LogContext
  ): void {
    const logContext = {
      ...this.baseContext,
      ...context,
      github: {
        operation,
        repository,
        status
      }
    }

    if (status === 'failed') {
      this.error(`GitHub operation failed: ${operation}`, undefined, logContext)
    } else {
      this.info(`GitHub operation ${status}: ${operation}`, logContext)
    }
  }

  // Log deployment operation
  logDeployment(
    platform: 'vercel' | 'netlify' | 'other',
    environment: 'preview' | 'production',
    status: 'started' | 'completed' | 'failed',
    deploymentUrl?: string,
    context?: LogContext
  ): void {
    const logContext = {
      ...this.baseContext,
      ...context,
      deployment: {
        platform,
        environment,
        status,
        deploymentUrl
      }
    }

    if (status === 'failed') {
      this.error(`Deployment failed: ${platform} ${environment}`, undefined, logContext)
    } else {
      this.info(`Deployment ${status}: ${platform} ${environment}`, logContext)
    }
  }

  // Log performance metrics
  logPerformance(
    operation: string,
    duration: number,
    metrics?: Record<string, number>,
    context?: LogContext
  ): void {
    const logContext = {
      ...this.baseContext,
      ...context,
      performance: {
        operation,
        duration,
        metrics
      }
    }

    // Log warning if operation is slow
    if (duration > 5000) { // 5 seconds
      this.warn(`Slow operation detected: ${operation} (${duration}ms)`, logContext)
    } else {
      this.info(`Performance: ${operation} (${duration}ms)`, logContext)
    }
  }

  // Log database operation
  logDatabaseOperation(
    operation: string,
    table: string,
    duration: number,
    rowsAffected?: number,
    context?: LogContext
  ): void {
    const logContext = {
      ...this.baseContext,
      ...context,
      database: {
        operation,
        table,
        duration,
        rowsAffected
      }
    }

    // Log warning for slow database operations
    if (duration > 1000) { // 1 second
      this.warn(`Slow database operation: ${operation} on ${table} (${duration}ms)`, logContext)
    } else {
      this.debug(`Database: ${operation} on ${table} (${duration}ms)`, logContext)
    }
  }
}

// Export default logger instance
export const logger = new Logger()

// Create request-scoped logger
export function createRequestLogger(
  requestId: string,
  userId?: string,
  workspaceId?: string,
  ip?: string,
  userAgent?: string
): Logger {
  return logger.child({
    requestId,
    userId,
    workspaceId,
    ip,
    userAgent
  })
}

// Error tracking for production monitoring
export class ErrorTracker {
  private static instance: ErrorTracker
  private errors: Array<{
    error: Error
    context: LogContext
    timestamp: Date
    count: number
  }> = []

  static getInstance(): ErrorTracker {
    if (!ErrorTracker.instance) {
      ErrorTracker.instance = new ErrorTracker()
    }
    return ErrorTracker.instance
  }

  trackError(error: Error, context: LogContext = {}): void {
    // Find existing error
    const existingError = this.errors.find(e => 
      e.error.message === error.message && 
      e.error.name === error.name
    )

    if (existingError) {
      existingError.count++
      existingError.timestamp = new Date()
    } else {
      this.errors.push({
        error,
        context,
        timestamp: new Date(),
        count: 1
      })
    }

    // Log the error
    logger.error('Error tracked', error, context)

    // Alert if error is recurring frequently
    if (existingError && existingError.count > 5) {
      logger.critical(
        `Recurring error detected: ${error.message}`,
        error,
        { ...context, errorCount: existingError.count }
      )
    }

    // Clean up old errors (keep last 1000)
    if (this.errors.length > 1000) {
      this.errors = this.errors.slice(-1000)
    }
  }

  getErrorStats(): Array<{
    error: string
    count: number
    lastSeen: Date
  }> {
    return this.errors.map(e => ({
      error: `${e.error.name}: ${e.error.message}`,
      count: e.count,
      lastSeen: e.timestamp
    }))
  }

  clearErrors(): void {
    this.errors = []
  }
}

// Export error tracker instance
export const errorTracker = ErrorTracker.getInstance()

// Global error handler for unhandled exceptions
process.on('uncaughtException', (error) => {
  logger.critical('Uncaught Exception', error, { source: 'process' })
  errorTracker.trackError(error, { source: 'uncaughtException' })
  
  // Give time for logs to flush before exiting
  setTimeout(() => {
    process.exit(1)
  }, 1000)
})

process.on('unhandledRejection', (reason, promise) => {
  const error = reason instanceof Error ? reason : new Error(String(reason))
  logger.critical('Unhandled Promise Rejection', error, { 
    source: 'process',
    promise: promise.toString()
  })
  errorTracker.trackError(error, { source: 'unhandledRejection' })
})

// Health check endpoint data
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  uptime: number
  version: string
  services: {
    database: 'healthy' | 'degraded' | 'unhealthy'
    e2b: 'healthy' | 'degraded' | 'unhealthy'
    github: 'healthy' | 'degraded' | 'unhealthy'
    claude: 'healthy' | 'degraded' | 'unhealthy'
  }
  errors: number
  performance: {
    averageResponseTime: number
    activeRequests: number
  }
}

// Application metrics
export class Metrics {
  private static instance: Metrics
  private requestTimes: number[] = []
  private activeRequests = 0
  private errorCount = 0

  static getInstance(): Metrics {
    if (!Metrics.instance) {
      Metrics.instance = new Metrics()
    }
    return Metrics.instance
  }

  recordRequest(duration: number): void {
    this.requestTimes.push(duration)
    
    // Keep only last 1000 requests for average calculation
    if (this.requestTimes.length > 1000) {
      this.requestTimes = this.requestTimes.slice(-1000)
    }
  }

  incrementActiveRequests(): void {
    this.activeRequests++
  }

  decrementActiveRequests(): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1)
  }

  recordError(): void {
    this.errorCount++
  }

  getMetrics(): {
    averageResponseTime: number
    activeRequests: number
    totalErrors: number
  } {
    const averageResponseTime = this.requestTimes.length > 0
      ? this.requestTimes.reduce((sum, time) => sum + time, 0) / this.requestTimes.length
      : 0

    return {
      averageResponseTime: Math.round(averageResponseTime),
      activeRequests: this.activeRequests,
      totalErrors: this.errorCount
    }
  }

  reset(): void {
    this.requestTimes = []
    this.activeRequests = 0
    this.errorCount = 0
  }
}

export const metrics = Metrics.getInstance()