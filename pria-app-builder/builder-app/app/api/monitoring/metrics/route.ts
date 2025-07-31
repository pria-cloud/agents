/**
 * Performance Metrics API
 * Provides endpoints for performance monitoring and metrics collection
 */

import { NextRequest, NextResponse } from 'next/server'
import createServerClient from '@/lib/supabase/server'
import { performanceMonitor } from '@/lib/monitoring/performance-monitor'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const workspaceId = user.app_metadata?.workspace_id
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'stats'
    const sessionId = searchParams.get('sessionId')

    switch (action) {
      case 'stats':
        // Get performance statistics
        const hours = parseInt(searchParams.get('hours') || '24')
        const metricType = searchParams.get('metricType')
        
        const startTime = new Date(Date.now() - hours * 60 * 60 * 1000)
        const endTime = new Date()

        const { data: stats } = await supabase
          .rpc('get_performance_stats', {
            p_workspace_id: workspaceId,
            p_start_time: startTime.toISOString(),
            p_end_time: endTime.toISOString(),
            p_metric_type: metricType,
            p_session_id: sessionId
          })

        if (stats && stats.length > 0) {
          const stat = stats[0]
          return NextResponse.json({
            success: true,
            timeRange: {
              start: startTime.toISOString(),
              end: endTime.toISOString(),
              hours
            },
            stats: {
              totalOperations: parseInt(stat.total_operations) || 0,
              successfulOperations: parseInt(stat.successful_operations) || 0,
              failedOperations: parseInt(stat.failed_operations) || 0,
              avgDurationMs: parseFloat(stat.avg_duration_ms) || 0,
              medianDurationMs: parseFloat(stat.median_duration_ms) || 0,
              p95DurationMs: parseFloat(stat.p95_duration_ms) || 0,
              p99DurationMs: parseFloat(stat.p99_duration_ms) || 0,
              maxDurationMs: stat.max_duration_ms || 0,
              minDurationMs: stat.min_duration_ms || 0,
              successRate: parseFloat(stat.success_rate) || 0,
              operationsPerHour: parseFloat(stat.operations_per_hour) || 0
            }
          })
        } else {
          return NextResponse.json({
            success: true,
            timeRange: {
              start: startTime.toISOString(),
              end: endTime.toISOString(),
              hours
            },
            stats: {
              totalOperations: 0,
              successfulOperations: 0,
              failedOperations: 0,
              avgDurationMs: 0,
              medianDurationMs: 0,
              p95DurationMs: 0,
              p99DurationMs: 0,
              maxDurationMs: 0,
              minDurationMs: 0,
              successRate: 0,
              operationsPerHour: 0
            }
          })
        }

      case 'report':
        // Generate comprehensive metrics report
        const reportHours = parseInt(searchParams.get('hours') || '24')
        const reportSessionId = searchParams.get('sessionId')
        
        const reportStart = new Date(Date.now() - reportHours * 60 * 60 * 1000)
        const reportEnd = new Date()

        const report = await performanceMonitor.generateReport(
          workspaceId,
          reportStart,
          reportEnd,
          reportSessionId
        )

        if (!report) {
          return NextResponse.json({ 
            error: 'Failed to generate performance report' 
          }, { status: 500 })
        }

        return NextResponse.json({
          success: true,
          report
        })

      case 'slowest':
        // Get slowest operations
        const slowestHours = parseInt(searchParams.get('hours') || '24')
        const limit = parseInt(searchParams.get('limit') || '10')

        const { data: slowestOps } = await supabase
          .rpc('get_slowest_operations', {
            p_workspace_id: workspaceId,
            p_hours: slowestHours,
            p_limit: limit
          })

        return NextResponse.json({
          success: true,
          slowestOperations: (slowestOps || []).map((op: any) => ({
            metricType: op.metric_type,
            operation: op.operation,
            avgDurationMs: parseFloat(op.avg_duration_ms),
            maxDurationMs: op.max_duration_ms,
            operationCount: parseInt(op.operation_count),
            successRate: parseFloat(op.success_rate)
          }))
        })

      case 'anomalies':
        // Detect performance anomalies
        const lookbackMinutes = parseInt(searchParams.get('lookbackMinutes') || '60')
        const thresholdMultiplier = parseFloat(searchParams.get('thresholdMultiplier') || '2.0')

        const { data: anomalies } = await supabase
          .rpc('detect_performance_anomalies', {
            p_workspace_id: workspaceId,
            p_lookback_minutes: lookbackMinutes,
            p_threshold_multiplier: thresholdMultiplier
          })

        return NextResponse.json({
          success: true,
          anomalies: (anomalies || []).map((anomaly: any) => ({
            metricType: anomaly.metric_type,
            operation: anomaly.operation,
            currentAvgDuration: parseFloat(anomaly.current_avg_duration),
            baselineAvgDuration: parseFloat(anomaly.baseline_avg_duration),
            anomalyFactor: parseFloat(anomaly.anomaly_factor),
            sampleSize: parseInt(anomaly.sample_size)
          }))
        })

      case 'breakdown':
        // Get metric breakdown by type and operation
        const breakdownHours = parseInt(searchParams.get('hours') || '24')
        const breakdownStart = new Date(Date.now() - breakdownHours * 60 * 60 * 1000)

        let breakdownQuery = supabase
          .from('performance_metrics')
          .select('metric_type, operation, duration, success')
          .eq('workspace_id', workspaceId)
          .gte('start_time', breakdownStart.toISOString())

        if (sessionId) {
          breakdownQuery = breakdownQuery.eq('session_id', sessionId)
        }

        const { data: breakdownData } = await breakdownQuery

        if (!breakdownData) {
          return NextResponse.json({
            success: true,
            breakdown: { byType: {}, byOperation: {} }
          })
        }

        const byType: Record<string, { count: number; avgDuration: number; successRate: number }> = {}
        const byOperation: Record<string, { count: number; avgDuration: number; successRate: number }> = {}

        breakdownData.forEach(metric => {
          // By type
          if (!byType[metric.metric_type]) {
            byType[metric.metric_type] = { count: 0, avgDuration: 0, successRate: 0 }
          }
          byType[metric.metric_type].count++
          if (metric.duration) {
            byType[metric.metric_type].avgDuration += metric.duration
          }
          if (metric.success) {
            byType[metric.metric_type].successRate++
          }

          // By operation
          if (!byOperation[metric.operation]) {
            byOperation[metric.operation] = { count: 0, avgDuration: 0, successRate: 0 }
          }
          byOperation[metric.operation].count++
          if (metric.duration) {
            byOperation[metric.operation].avgDuration += metric.duration
          }
          if (metric.success) {
            byOperation[metric.operation].successRate++
          }
        })

        // Calculate averages and success rates
        Object.values(byType).forEach(data => {
          data.avgDuration = data.count > 0 ? data.avgDuration / data.count : 0
          data.successRate = data.count > 0 ? (data.successRate / data.count) * 100 : 0
        })

        Object.values(byOperation).forEach(data => {
          data.avgDuration = data.count > 0 ? data.avgDuration / data.count : 0
          data.successRate = data.count > 0 ? (data.successRate / data.count) * 100 : 0
        })

        return NextResponse.json({
          success: true,
          breakdown: { byType, byOperation }
        })

      case 'health':
        // Get system health metrics
        const currentStats = performanceMonitor.getCurrentStats()
        
        return NextResponse.json({
          success: true,
          health: {
            monitoringActive: true,
            activeMetrics: currentStats.activeMetrics,
            bufferedMetrics: currentStats.bufferedMetrics,
            totalTracked: currentStats.totalTracked,
            timestamp: new Date().toISOString()
          }
        })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('Error in performance metrics API:', error)
    return NextResponse.json(
      { error: 'Failed to process metrics request' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const workspaceId = user.app_metadata?.workspace_id
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 400 })
    }

    const body = await request.json()
    const { action } = body

    switch (action) {
      case 'cleanup':
        // Cleanup old metrics
        const daysToKeep = body.daysToKeep || 30

        const { data: cleanupResult } = await supabase
          .rpc('cleanup_old_performance_metrics', { days_to_keep: daysToKeep })

        return NextResponse.json({
          success: true,
          deletedCount: cleanupResult || 0,
          message: `Cleaned up metrics older than ${daysToKeep} days`
        })

      case 'create_alert':
        // Create performance alert
        const {
          alertType,
          metricType,
          operation,
          thresholdValue,
          thresholdUnit,
          comparisonOperator
        } = body

        if (!alertType || !metricType || !thresholdValue || !thresholdUnit || !comparisonOperator) {
          return NextResponse.json({
            error: 'Missing required fields for alert creation'
          }, { status: 400 })
        }

        const { data: newAlert, error: alertError } = await supabase
          .from('performance_alerts')
          .insert({
            workspace_id: workspaceId,
            alert_type: alertType,
            metric_type: metricType,
            operation,
            threshold_value: thresholdValue,
            threshold_unit: thresholdUnit,
            comparison_operator: comparisonOperator,
            is_active: true
          })
          .select()
          .single()

        if (alertError) {
          return NextResponse.json({
            error: `Failed to create alert: ${alertError.message}`
          }, { status: 500 })
        }

        return NextResponse.json({
          success: true,
          alert: newAlert,
          message: 'Performance alert created successfully'
        })

      case 'record_system_metric':
        // Record system metric
        const { metricName, metricValue, metricUnit, tags } = body

        if (!metricName || metricValue === undefined) {
          return NextResponse.json({
            error: 'Metric name and value are required'
          }, { status: 400 })
        }

        const { error: systemMetricError } = await supabase
          .from('system_metrics')
          .insert({
            workspace_id: workspaceId,
            metric_name: metricName,
            metric_value: metricValue,
            metric_unit: metricUnit,
            tags: tags || {}
          })

        if (systemMetricError) {
          return NextResponse.json({
            error: `Failed to record system metric: ${systemMetricError.message}`
          }, { status: 500 })
        }

        return NextResponse.json({
          success: true,
          message: 'System metric recorded successfully'
        })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('Error in performance metrics POST API:', error)
    return NextResponse.json(
      { error: 'Failed to process metrics request' },
      { status: 500 }
    )
  }
}