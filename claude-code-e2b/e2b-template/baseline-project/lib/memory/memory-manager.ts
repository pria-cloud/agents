import { logger } from '@/lib/monitoring/logger'

export interface MemoryStats {
  heapUsed: number
  heapTotal: number
  external: number
  rss: number
  arrayBuffers: number
  freeMemory: number
  totalMemory: number
  uptime: number
}

export interface MemoryThresholds {
  heapUsedWarning: number // MB
  heapUsedCritical: number // MB
  cleanupInterval: number // ms
  forceGCThreshold: number // MB
}

/**
 * Memory Management Service
 * Monitors memory usage, detects leaks, and performs cleanup
 */
export class MemoryManager {
  private static instance: MemoryManager
  private monitoringInterval: NodeJS.Timeout | null = null
  private cleanupInterval: NodeJS.Timeout | null = null
  private thresholds: MemoryThresholds
  private memoryHistory: MemoryStats[] = []
  private maxHistorySize = 100
  private conversationContexts = new Map<string, any>()
  private sandboxInstances = new Map<string, any>()
  private lastCleanup = Date.now()

  constructor() {
    this.thresholds = {
      heapUsedWarning: parseInt(process.env.MEMORY_WARNING_MB || '500'),
      heapUsedCritical: parseInt(process.env.MEMORY_CRITICAL_MB || '800'),
      cleanupInterval: parseInt(process.env.MEMORY_CLEANUP_INTERVAL_MS || '300000'), // 5 minutes
      forceGCThreshold: parseInt(process.env.FORCE_GC_THRESHOLD_MB || '700')
    }

    this.startMonitoring()
    this.startCleanupScheduler()
  }

  static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager()
    }
    return MemoryManager.instance
  }

  /**
   * Get current memory statistics
   */
  getMemoryStats(): MemoryStats {
    const memUsage = process.memoryUsage()
    const freeMemory = require('os').freemem()
    const totalMemory = require('os').totalmem()

    return {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
      external: Math.round(memUsage.external / 1024 / 1024), // MB
      rss: Math.round(memUsage.rss / 1024 / 1024), // MB
      arrayBuffers: Math.round(memUsage.arrayBuffers / 1024 / 1024), // MB
      freeMemory: Math.round(freeMemory / 1024 / 1024), // MB
      totalMemory: Math.round(totalMemory / 1024 / 1024), // MB
      uptime: Math.round(process.uptime())
    }
  }

  /**
   * Register conversation context for memory tracking
   */
  registerConversationContext(conversationId: string, context: any): void {
    // Limit context size to prevent memory leaks
    const limitedContext = this.limitContextSize(context)
    this.conversationContexts.set(conversationId, {
      ...limitedContext,
      lastAccessed: Date.now(),
      createdAt: Date.now()
    })

    // Clean up old contexts
    this.cleanupOldContexts()
  }

  /**
   * Get conversation context
   */
  getConversationContext(conversationId: string): any | null {
    const context = this.conversationContexts.get(conversationId)
    if (context) {
      context.lastAccessed = Date.now()
      return context
    }
    return null
  }

  /**
   * Remove conversation context
   */
  removeConversationContext(conversationId: string): void {
    this.conversationContexts.delete(conversationId)
  }

  /**
   * Register sandbox instance for tracking
   */
  registerSandboxInstance(sandboxId: string, instance: any): void {
    this.sandboxInstances.set(sandboxId, {
      instance,
      createdAt: Date.now(),
      lastAccessed: Date.now()
    })
  }

  /**
   * Remove sandbox instance
   */
  removeSandboxInstance(sandboxId: string): void {
    this.sandboxInstances.delete(sandboxId)
  }

  /**
   * Perform comprehensive memory cleanup
   */
  async performCleanup(): Promise<{
    conversationsCleanedUp: number
    sandboxesCleanedUp: number
    memoryFreed: number
    gcTriggered: boolean
  }> {
    const beforeStats = this.getMemoryStats()
    let conversationsCleanedUp = 0
    let sandboxesCleanedUp = 0
    let gcTriggered = false

    try {
      // Clean up old conversation contexts
      conversationsCleanedUp = this.cleanupOldContexts()

      // Clean up inactive sandbox instances
      sandboxesCleanedUp = this.cleanupInactiveSandboxes()

      // Clear memory history if it's too large
      if (this.memoryHistory.length > this.maxHistorySize) {
        this.memoryHistory = this.memoryHistory.slice(-this.maxHistorySize)
      }

      // Force garbage collection if memory usage is high
      if (beforeStats.heapUsed > this.thresholds.forceGCThreshold) {
        if (global.gc) {
          global.gc()
          gcTriggered = true
          logger.info('Forced garbage collection triggered', {
            metadata: {
              heapUsedBefore: beforeStats.heapUsed,
              threshold: this.thresholds.forceGCThreshold
            }
          })
        } else {
          logger.warn('Garbage collection requested but not available', {
            metadata: {
              heapUsed: beforeStats.heapUsed,
              threshold: this.thresholds.forceGCThreshold
            }
          })
        }
      }

      const afterStats = this.getMemoryStats()
      const memoryFreed = beforeStats.heapUsed - afterStats.heapUsed

      this.lastCleanup = Date.now()

      logger.info('Memory cleanup completed', {
        metadata: {
          conversationsCleanedUp,
          sandboxesCleanedUp,
          memoryFreedMB: memoryFreed,
          gcTriggered,
          heapUsedBefore: beforeStats.heapUsed,
          heapUsedAfter: afterStats.heapUsed
        }
      })

      return {
        conversationsCleanedUp,
        sandboxesCleanedUp,
        memoryFreed,
        gcTriggered
      }

    } catch (error) {
      logger.error('Memory cleanup failed', error instanceof Error ? error : new Error(String(error)))
      return {
        conversationsCleanedUp: 0,
        sandboxesCleanedUp: 0,
        memoryFreed: 0,
        gcTriggered: false
      }
    }
  }

  /**
   * Detect potential memory leaks
   */
  detectMemoryLeaks(): {
    hasLeak: boolean
    leakType?: string
    severity: 'low' | 'medium' | 'high'
    recommendations: string[]
  } {
    const stats = this.getMemoryStats()
    const recommendations: string[] = []
    let hasLeak = false
    let leakType: string | undefined
    let severity: 'low' | 'medium' | 'high' = 'low'

    // Check for steadily increasing heap usage
    if (this.memoryHistory.length >= 10) {
      const recent = this.memoryHistory.slice(-10)
      const increasing = recent.every((stat, index) => 
        index === 0 || stat.heapUsed >= recent[index - 1].heapUsed
      )

      if (increasing) {
        const growthRate = (recent[recent.length - 1].heapUsed - recent[0].heapUsed) / recent.length
        if (growthRate > 5) { // 5MB per measurement
          hasLeak = true
          leakType = 'heap_growth'
          severity = growthRate > 20 ? 'high' : 'medium'
          recommendations.push('Investigate continuously growing heap usage')
          recommendations.push('Check for unclosed resources or event listeners')
        }
      }
    }

    // Check for high conversation context count
    if (this.conversationContexts.size > 100) {
      hasLeak = true
      leakType = 'conversation_contexts'
      severity = this.conversationContexts.size > 500 ? 'high' : 'medium'
      recommendations.push('Too many conversation contexts in memory')
      recommendations.push('Implement more aggressive context cleanup')
    }

    // Check for high sandbox instance count
    if (this.sandboxInstances.size > 50) {
      hasLeak = true
      leakType = 'sandbox_instances'
      severity = this.sandboxInstances.size > 100 ? 'high' : 'medium'
      recommendations.push('Too many sandbox instances tracked')
      recommendations.push('Ensure sandbox instances are properly cleaned up')
    }

    // Check for high heap usage
    if (stats.heapUsed > this.thresholds.heapUsedCritical) {
      hasLeak = true
      leakType = 'high_heap_usage'
      severity = 'high'
      recommendations.push('Critical heap usage detected')
      recommendations.push('Immediate cleanup and investigation required')
    }

    return {
      hasLeak,
      leakType,
      severity,
      recommendations
    }
  }

  /**
   * Get memory usage trends
   */
  getMemoryTrends(): {
    averageHeapUsed: number
    peakHeapUsed: number
    trendDirection: 'increasing' | 'decreasing' | 'stable'
    measurements: number
  } {
    if (this.memoryHistory.length === 0) {
      return {
        averageHeapUsed: 0,
        peakHeapUsed: 0,
        trendDirection: 'stable',
        measurements: 0
      }
    }

    const heapUsages = this.memoryHistory.map(stat => stat.heapUsed)
    const averageHeapUsed = heapUsages.reduce((sum, usage) => sum + usage, 0) / heapUsages.length
    const peakHeapUsed = Math.max(...heapUsages)

    // Determine trend direction
    let trendDirection: 'increasing' | 'decreasing' | 'stable' = 'stable'
    if (this.memoryHistory.length >= 5) {
      const recent = heapUsages.slice(-5)
      const older = heapUsages.slice(-10, -5)
      
      if (older.length > 0) {
        const recentAvg = recent.reduce((sum, usage) => sum + usage, 0) / recent.length
        const olderAvg = older.reduce((sum, usage) => sum + usage, 0) / older.length
        
        const changePct = ((recentAvg - olderAvg) / olderAvg) * 100
        
        if (changePct > 10) {
          trendDirection = 'increasing'
        } else if (changePct < -10) {
          trendDirection = 'decreasing'
        }
      }
    }

    return {
      averageHeapUsed: Math.round(averageHeapUsed),
      peakHeapUsed,
      trendDirection,
      measurements: this.memoryHistory.length
    }
  }

  // Private methods

  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      const stats = this.getMemoryStats()
      this.memoryHistory.push(stats)

      // Keep history size manageable
      if (this.memoryHistory.length > this.maxHistorySize) {
        this.memoryHistory.shift()
      }

      // Check thresholds
      if (stats.heapUsed > this.thresholds.heapUsedCritical) {
        logger.warn('Critical memory usage detected', {
          metadata: {
            heapUsedMB: stats.heapUsed,
            thresholdMB: this.thresholds.heapUsedCritical,
            conversationContexts: this.conversationContexts.size,
            sandboxInstances: this.sandboxInstances.size
          }
        })
      } else if (stats.heapUsed > this.thresholds.heapUsedWarning) {
        logger.warn('High memory usage detected', {
          metadata: {
            heapUsedMB: stats.heapUsed,
            thresholdMB: this.thresholds.heapUsedWarning
          }
        })
      }

      // Detect potential leaks
      const leakDetection = this.detectMemoryLeaks()
      if (leakDetection.hasLeak && leakDetection.severity === 'high') {
        logger.warn('Potential memory leak detected', {
          metadata: {
            leakType: leakDetection.leakType,
            severity: leakDetection.severity,
            recommendations: leakDetection.recommendations
          }
        })
      }
    }, 60000) // Check every minute
  }

  private startCleanupScheduler(): void {
    this.cleanupInterval = setInterval(async () => {
      await this.performCleanup()
    }, this.thresholds.cleanupInterval)
  }

  private cleanupOldContexts(): number {
    const now = Date.now()
    const maxAge = 30 * 60 * 1000 // 30 minutes
    const maxInactive = 10 * 60 * 1000 // 10 minutes
    let cleaned = 0

    for (const [conversationId, context] of this.conversationContexts.entries()) {
      const age = now - context.createdAt
      const inactive = now - context.lastAccessed

      if (age > maxAge || inactive > maxInactive) {
        this.conversationContexts.delete(conversationId)
        cleaned++
      }
    }

    return cleaned
  }

  private cleanupInactiveSandboxes(): number {
    const now = Date.now()
    const maxInactive = 15 * 60 * 1000 // 15 minutes
    let cleaned = 0

    for (const [sandboxId, data] of this.sandboxInstances.entries()) {
      const inactive = now - data.lastAccessed

      if (inactive > maxInactive) {
        // Attempt to cleanup sandbox instance
        try {
          if (data.instance && typeof data.instance.cleanup === 'function') {
            data.instance.cleanup()
          }
        } catch (error) {
          logger.warn('Failed to cleanup sandbox instance', { 
            metadata: { 
              sandboxId, 
              error: error instanceof Error ? error.message : String(error) 
            } 
          })
        }

        this.sandboxInstances.delete(sandboxId)
        cleaned++
      }
    }

    return cleaned
  }

  private limitContextSize(context: any): any {
    if (!context || typeof context !== 'object') {
      return context
    }

    const limited = { ...context }

    // Limit conversation history
    if (limited.conversationHistory && Array.isArray(limited.conversationHistory)) {
      if (limited.conversationHistory.length > 20) {
        limited.conversationHistory = limited.conversationHistory.slice(-20)
      }
    }

    // Limit generated files
    if (limited.generatedFiles && Array.isArray(limited.generatedFiles)) {
      if (limited.generatedFiles.length > 50) {
        limited.generatedFiles = limited.generatedFiles.slice(-50)
      }
      
      // Limit file content size
      limited.generatedFiles = limited.generatedFiles.map((file: any) => {
        if (file.content && file.content.length > 100000) { // 100KB
          return {
            ...file,
            content: file.content.substring(0, 100000) + '... [truncated]'
          }
        }
        return file
      })
    }

    return limited
  }

  /**
   * Cleanup on process exit
   */
  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    
    this.conversationContexts.clear()
    this.sandboxInstances.clear()
    this.memoryHistory = []
  }
}

// Export singleton instance
export const memoryManager = MemoryManager.getInstance()

// Cleanup on process exit
process.on('exit', () => {
  memoryManager.destroy()
})

process.on('SIGINT', () => {
  memoryManager.destroy()
  process.exit(0)
})

process.on('SIGTERM', () => {
  memoryManager.destroy()
  process.exit(0)
})