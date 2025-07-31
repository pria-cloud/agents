/**
 * Performance Monitor - Comprehensive metrics collection and monitoring
 * Tracks Claude Code SDK performance, sandbox operations, and system metrics
 */

import createServerClient from '@/lib/supabase/server'

export interface PerformanceMetric {
  id: string
  sessionId: string
  workspaceId: string
  metricType: 'claude_execution' | 'sandbox_operation' | 'api_request' | 'database_query' | 'workflow_phase'
  operation: string
  startTime: Date
  endTime?: Date
  duration?: number
  success: boolean
  metadata?: Record<string, any>
  resourceUsage?: {
    memoryMB?: number
    cpuPercent?: number
    diskMB?: number
    networkBytes?: number
  }
  error?: string
}

export interface MetricsReport {
  timeRange: {
    start: Date
    end: Date
  }
  summary: {
    totalOperations: number
    successfulOperations: number
    failedOperations: number
    avgDuration: number
    maxDuration: number
    minDuration: number
    successRate: number
  }
  breakdown: {
    byType: Record<string, number>
    byOperation: Record<string, number>
    byHour: Array<{ hour: number; count: number; avgDuration: number }>
  }
  slowest: PerformanceMetric[]
  errors: Array<{ error: string; count: number }>
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor
  private activeMetrics: Map<string, PerformanceMetric> = new Map()
  private batchBuffer: PerformanceMetric[] = []
  private batchSize = 50
  private flushInterval = 10000 // 10 seconds

  private constructor() {
    // Start periodic flushing
    setInterval(() => {
      this.flushMetrics()
    }, this.flushInterval)
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor()
    }
    return PerformanceMonitor.instance
  }

  /**
   * Start tracking a performance metric
   */
  startMetric(
    sessionId: string,
    workspaceId: string,
    metricType: PerformanceMetric['metricType'],
    operation: string,
    metadata?: Record<string, any>
  ): string {
    const metricId = `${metricType}_${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const metric: PerformanceMetric = {
      id: metricId,
      sessionId,
      workspaceId,
      metricType,
      operation,
      startTime: new Date(),
      success: false, // Will be updated when finished
      metadata
    }

    this.activeMetrics.set(metricId, metric)
    
    console.log(`[PERF MONITOR] Started tracking: ${metricType}/${operation} (${metricId})`)
    
    return metricId
  }

  /**
   * Finish tracking a performance metric
   */
  finishMetric(
    metricId: string,
    success: boolean = true,
    error?: string,
    resourceUsage?: PerformanceMetric['resourceUsage']
  ): void {
    const metric = this.activeMetrics.get(metricId)
    if (!metric) {
      console.warn(`[PERF MONITOR] Metric not found: ${metricId}`)
      return
    }

    metric.endTime = new Date()
    metric.duration = metric.endTime.getTime() - metric.startTime.getTime()
    metric.success = success
    metric.error = error
    metric.resourceUsage = resourceUsage

    // Move to batch buffer
    this.batchBuffer.push(metric)
    this.activeMetrics.delete(metricId)

    console.log(`[PERF MONITOR] Finished tracking: ${metric.metricType}/${metric.operation} (${metric.duration}ms, success: ${success})`)

    // Flush if buffer is full
    if (this.batchBuffer.length >= this.batchSize) {
      this.flushMetrics()
    }
  }

  /**
   * Track Claude Code SDK execution performance
   */
  async trackClaudeExecution<T>(
    sessionId: string,
    workspaceId: string,
    operation: string,
    execution: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const metricId = this.startMetric(sessionId, workspaceId, 'claude_execution', operation, metadata)
    const startMemory = process.memoryUsage()

    try {
      const result = await execution()
      
      const endMemory = process.memoryUsage()
      const resourceUsage = {
        memoryMB: (endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024,
        cpuPercent: process.cpuUsage ? this.calculateCpuUsage() : undefined
      }

      this.finishMetric(metricId, true, undefined, resourceUsage)
      return result

    } catch (error) {
      this.finishMetric(
        metricId, 
        false, 
        error instanceof Error ? error.message : 'Unknown error'
      )
      throw error
    }
  }

  /**
   * Track sandbox operation performance
   */
  async trackSandboxOperation<T>(
    sessionId: string,
    workspaceId: string,
    operation: string,
    execution: () => Promise<T>,
    sandboxId?: string
  ): Promise<T> {
    const metricId = this.startMetric(
      sessionId, 
      workspaceId, 
      'sandbox_operation', 
      operation,
      { sandboxId }
    )

    try {
      const result = await execution()
      this.finishMetric(metricId, true)
      return result

    } catch (error) {
      this.finishMetric(
        metricId, 
        false, 
        error instanceof Error ? error.message : 'Unknown error'
      )
      throw error
    }
  }

  /**
   * Track API request performance
   */
  async trackApiRequest<T>(
    sessionId: string,
    workspaceId: string,
    endpoint: string,
    method: string,
    execution: () => Promise<T>
  ): Promise<T> {
    const metricId = this.startMetric(
      sessionId, 
      workspaceId, 
      'api_request', 
      `${method} ${endpoint}`
    )

    try {
      const result = await execution()
      this.finishMetric(metricId, true)
      return result

    } catch (error) {
      this.finishMetric(
        metricId, 
        false, 
        error instanceof Error ? error.message : 'Unknown error'
      )
      throw error
    }
  }

  /**
   * Track database query performance
   */
  async trackDatabaseQuery<T>(
    sessionId: string,
    workspaceId: string,
    table: string,
    operation: 'select' | 'insert' | 'update' | 'delete',
    execution: () => Promise<T>
  ): Promise<T> {
    const metricId = this.startMetric(
      sessionId, 
      workspaceId, 
      'database_query', 
      `${operation}_${table}`
    )

    try {
      const result = await execution()
      this.finishMetric(metricId, true)
      return result

    } catch (error) {
      this.finishMetric(
        metricId, 
        false, 
        error instanceof Error ? error.message : 'Unknown error'
      )
      throw error
    }
  }

  /**
   * Track workflow phase performance
   */
  trackWorkflowPhase(
    sessionId: string,
    workspaceId: string,
    phaseName: string,
    phaseNumber: number
  ): string {
    return this.startMetric(
      sessionId, 
      workspaceId, 
      'workflow_phase', 
      phaseName,
      { phaseNumber }
    )
  }

  /**
   * Get current performance statistics
   */
  getCurrentStats(): {
    activeMetrics: number
    bufferedMetrics: number
    totalTracked: number
  } {
    return {
      activeMetrics: this.activeMetrics.size,
      bufferedMetrics: this.batchBuffer.length,
      totalTracked: this.activeMetrics.size + this.batchBuffer.length
    }
  }

  /**
   * Generate metrics report for a workspace
   */
  async generateReport(
    workspaceId: string,
    startDate: Date,
    endDate: Date,
    sessionId?: string
  ): Promise<MetricsReport | null> {
    try {
      const supabase = await createServerClient()

      let query = supabase
        .from('performance_metrics')
        .select('*')
        .eq('workspace_id', workspaceId)
        .gte('start_time', startDate.toISOString())
        .lte('start_time', endDate.toISOString())

      if (sessionId) {
        query = query.eq('session_id', sessionId)
      }

      const { data: metrics, error } = await query.order('start_time', { ascending: false })

      if (error) {
        console.error('[PERF MONITOR] Failed to fetch metrics:', error)
        return null
      }

      if (!metrics || metrics.length === 0) {
        return {
          timeRange: { start: startDate, end: endDate },
          summary: {
            totalOperations: 0,
            successfulOperations: 0,
            failedOperations: 0,
            avgDuration: 0,
            maxDuration: 0,
            minDuration: 0,
            successRate: 0
          },
          breakdown: { byType: {}, byOperation: {}, byHour: [] },
          slowest: [],
          errors: []
        }
      }

      // Calculate summary statistics
      const totalOperations = metrics.length
      const successfulOperations = metrics.filter(m => m.success).length
      const failedOperations = totalOperations - successfulOperations
      const durations = metrics.filter(m => m.duration).map(m => m.duration)
      const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0
      const maxDuration = durations.length > 0 ? Math.max(...durations) : 0
      const minDuration = durations.length > 0 ? Math.min(...durations) : 0
      const successRate = totalOperations > 0 ? (successfulOperations / totalOperations) * 100 : 0

      // Breakdown by type
      const byType: Record<string, number> = {}
      const byOperation: Record<string, number> = {}
      
      metrics.forEach(metric => {
        byType[metric.metric_type] = (byType[metric.metric_type] || 0) + 1
        byOperation[metric.operation] = (byOperation[metric.operation] || 0) + 1
      })

      // Breakdown by hour
      const byHour: Array<{ hour: number; count: number; avgDuration: number }> = []
      const hourlyData: Record<number, { count: number; totalDuration: number }> = {}

      metrics.forEach(metric => {
        const hour = new Date(metric.start_time).getHours()
        if (!hourlyData[hour]) {
          hourlyData[hour] = { count: 0, totalDuration: 0 }
        }
        hourlyData[hour].count++
        if (metric.duration) {
          hourlyData[hour].totalDuration += metric.duration
        }
      })

      Object.entries(hourlyData).forEach(([hour, data]) => {
        byHour.push({
          hour: parseInt(hour),
          count: data.count,
          avgDuration: data.totalDuration / data.count
        })
      })

      // Get slowest operations
      const slowest = metrics
        .filter(m => m.duration)
        .sort((a, b) => (b.duration || 0) - (a.duration || 0))
        .slice(0, 10)
        .map(this.convertDbMetricToPerformanceMetric)

      // Error breakdown
      const errorMap: Record<string, number> = {}
      metrics
        .filter(m => !m.success && m.error)
        .forEach(m => {
          errorMap[m.error!] = (errorMap[m.error!] || 0) + 1
        })

      const errors = Object.entries(errorMap).map(([error, count]) => ({ error, count }))

      return {
        timeRange: { start: startDate, end: endDate },
        summary: {
          totalOperations,
          successfulOperations,
          failedOperations,
          avgDuration,
          maxDuration,
          minDuration,
          successRate
        },
        breakdown: { byType, byOperation, byHour },
        slowest,
        errors
      }

    } catch (error) {
      console.error('[PERF MONITOR] Failed to generate report:', error)
      return null
    }
  }

  // Private helper methods

  private async flushMetrics(): Promise<void> {
    if (this.batchBuffer.length === 0) {
      return
    }

    console.log(`[PERF MONITOR] Flushing ${this.batchBuffer.length} metrics to database`)

    try {
      const supabase = await createServerClient()
      
      const metricsToInsert = this.batchBuffer.map(metric => ({
        id: metric.id,
        session_id: metric.sessionId,
        workspace_id: metric.workspaceId,
        metric_type: metric.metricType,
        operation: metric.operation,
        start_time: metric.startTime.toISOString(),
        end_time: metric.endTime?.toISOString(),
        duration: metric.duration,
        success: metric.success,
        metadata: metric.metadata,
        resource_usage: metric.resourceUsage,
        error: metric.error
      }))

      const { error } = await supabase
        .from('performance_metrics')
        .insert(metricsToInsert)

      if (error) {
        console.error('[PERF MONITOR] Failed to insert metrics:', error)
        // Keep metrics in buffer for retry
        return
      }

      // Clear buffer on success
      this.batchBuffer = []
      console.log(`[PERF MONITOR] Successfully flushed metrics to database`)

    } catch (error) {
      console.error('[PERF MONITOR] Error flushing metrics:', error)
    }
  }

  private calculateCpuUsage(): number {
    const cpuUsage = process.cpuUsage()
    return ((cpuUsage.user + cpuUsage.system) / 1000000) * 100 // Convert to percentage
  }

  private convertDbMetricToPerformanceMetric(dbMetric: any): PerformanceMetric {
    return {
      id: dbMetric.id,
      sessionId: dbMetric.session_id,
      workspaceId: dbMetric.workspace_id,
      metricType: dbMetric.metric_type,
      operation: dbMetric.operation,
      startTime: new Date(dbMetric.start_time),
      endTime: dbMetric.end_time ? new Date(dbMetric.end_time) : undefined,
      duration: dbMetric.duration,
      success: dbMetric.success,
      metadata: dbMetric.metadata,
      resourceUsage: dbMetric.resource_usage,
      error: dbMetric.error
    }
  }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance()