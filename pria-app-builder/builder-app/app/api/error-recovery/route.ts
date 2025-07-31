/**
 * Sandbox Error Recovery API
 * Provides endpoints for monitoring sandbox health and triggering recovery
 */

import { NextRequest, NextResponse } from 'next/server'
import createServerClient from '@/lib/supabase/server'
import { sandboxErrorRecovery } from '@/lib/error-recovery/sandbox-error-recovery'
import { performanceMonitor } from '@/lib/monitoring/performance-monitor'

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
    const { action, sessionId, ...actionData } = body

    if (!sessionId) {
      return NextResponse.json({ 
        error: 'Session ID is required' 
      }, { status: 400 })
    }

    // Verify session exists and user has access
    const { data: session } = await supabase
      .from('sessions')
      .select('id, workspace_id, e2b_sandbox_id')
      .eq('id', sessionId)
      .eq('workspace_id', workspaceId)
      .single()

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    switch (action) {
      case 'register_sandbox':
        // Register sandbox for monitoring
        const { sandbox_id } = actionData

        if (!sandbox_id) {
          return NextResponse.json({
            error: 'Sandbox ID is required'
          }, { status: 400 })
        }

        try {
          await sandboxErrorRecovery.registerSandbox(sandbox_id, sessionId)

          return NextResponse.json({
            success: true,
            message: 'Sandbox registered for error recovery monitoring',
            monitoring: {
              health_check_interval_ms: 30000,
              max_consecutive_failures: 3,
              auto_recovery_enabled: true
            }
          })
        } catch (error) {
          return NextResponse.json({
            error: `Failed to register sandbox: ${error instanceof Error ? error.message : 'Unknown error'}`
          }, { status: 500 })
        }

      case 'unregister_sandbox':
        // Unregister sandbox from monitoring
        try {
          sandboxErrorRecovery.unregisterSandbox(sessionId)

          return NextResponse.json({
            success: true,
            message: 'Sandbox unregistered from error recovery monitoring'
          })
        } catch (error) {
          return NextResponse.json({
            error: `Failed to unregister sandbox: ${error instanceof Error ? error.message : 'Unknown error'}`
          }, { status: 500 })
        }

      case 'trigger_manual_recovery':
        // Manually trigger recovery
        const { 
          failure_type, 
          error_message, 
          error_context 
        } = actionData

        if (!failure_type || !error_message) {
          return NextResponse.json({
            error: 'Failure type and error message are required'
          }, { status: 400 })
        }

        const metricId = performanceMonitor.startMetric(
          sessionId,
          workspaceId,
          'sandbox_operation',
          'manual_recovery_trigger'
        )

        try {
          const recoveryResult = await sandboxErrorRecovery.triggerManualRecovery(
            sessionId,
            {
              failure_type,
              error_message,
              occurred_at: new Date(),
              error_context: error_context || {}
            }
          )

          performanceMonitor.finishMetric(metricId, recoveryResult.success)

          return NextResponse.json({
            success: recoveryResult.success,
            recovery_result: {
              new_sandbox_id: recoveryResult.new_sandbox_id,
              context_restored: recoveryResult.context_restored,
              recovery_duration_ms: recoveryResult.recovery_duration_ms,
              strategy_used: recoveryResult.strategy_used,
              restored_state: recoveryResult.restored_state
            },
            errors: recoveryResult.errors,
            warnings: recoveryResult.warnings,
            message: recoveryResult.success 
              ? 'Recovery completed successfully'
              : 'Recovery failed'
          })
        } catch (error) {
          performanceMonitor.finishMetric(metricId, false, error instanceof Error ? error.message : 'Unknown error')
          
          return NextResponse.json({
            error: `Recovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          }, { status: 500 })
        }

      case 'force_recovery_all':
        // Force recovery for all unhealthy sandboxes in workspace
        const forceRecoveryMetricId = performanceMonitor.startMetric(
          sessionId,
          workspaceId,
          'sandbox_operation',
          'force_recovery_all'
        )

        try {
          const bulkRecoveryResult = await sandboxErrorRecovery.forceRecoveryAll()

          performanceMonitor.finishMetric(forceRecoveryMetricId, bulkRecoveryResult.successful > 0)

          return NextResponse.json({
            success: bulkRecoveryResult.successful > 0,
            bulk_recovery_result: {
              attempted: bulkRecoveryResult.attempted,
              successful: bulkRecoveryResult.successful,
              failed: bulkRecoveryResult.failed,
              success_rate: bulkRecoveryResult.attempted > 0 
                ? (bulkRecoveryResult.successful / bulkRecoveryResult.attempted) * 100 
                : 0
            },
            individual_results: bulkRecoveryResult.results.map(result => ({
              strategy_used: result.strategy_used,
              success: result.success,
              context_restored: result.context_restored,
              recovery_duration_ms: result.recovery_duration_ms
            })),
            message: `Bulk recovery completed: ${bulkRecoveryResult.successful}/${bulkRecoveryResult.attempted} successful`
          })
        } catch (error) {
          performanceMonitor.finishMetric(forceRecoveryMetricId, false, error instanceof Error ? error.message : 'Unknown error')
          
          return NextResponse.json({
            error: `Bulk recovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          }, { status: 500 })
        }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('Error in error recovery API:', error)
    return NextResponse.json(
      { error: 'Failed to process error recovery request' },
      { status: 500 }
    )
  }
}

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
    const action = searchParams.get('action') || 'health_status'
    const sessionId = searchParams.get('sessionId')

    switch (action) {
      case 'health_status':
        // Get overall health status
        try {
          const healthStatus = sandboxErrorRecovery.getHealthStatus()

          return NextResponse.json({
            success: true,
            health_status: {
              summary: {
                total_sandboxes: healthStatus.total,
                healthy: healthStatus.healthy,
                degraded: healthStatus.degraded,
                unhealthy: healthStatus.unhealthy,
                unresponsive: healthStatus.unresponsive,
                overall_health_percentage: healthStatus.total > 0 
                  ? Math.round((healthStatus.healthy / healthStatus.total) * 100)
                  : 100
              },
              sandboxes: healthStatus.sandboxes.map(sandbox => ({
                session_id: sandbox.session_id,
                sandbox_id: sandbox.sandbox_id,
                health_status: sandbox.health_status,
                last_heartbeat: sandbox.last_heartbeat.toISOString(),
                response_time_ms: sandbox.response_time_ms,
                error_count: sandbox.error_count,
                consecutive_failures: sandbox.consecutive_failures,
                recovery_attempts: sandbox.recovery_attempts,
                last_error: sandbox.last_error
              }))
            },
            message: 'Health status retrieved successfully'
          })
        } catch (error) {
          return NextResponse.json({
            error: `Failed to get health status: ${error instanceof Error ? error.message : 'Unknown error'}`
          }, { status: 500 })
        }

      case 'sandbox_health':
        // Get health status for specific sandbox
        if (!sessionId) {
          return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
        }

        try {
          const healthStatus = sandboxErrorRecovery.getHealthStatus()
          const sandboxHealth = healthStatus.sandboxes.find(s => s.session_id === sessionId)

          if (!sandboxHealth) {
            return NextResponse.json({
              error: 'Sandbox not found in monitoring system'
            }, { status: 404 })
          }

          return NextResponse.json({
            success: true,
            sandbox_health: {
              session_id: sandboxHealth.session_id,
              sandbox_id: sandboxHealth.sandbox_id,
              health_status: sandboxHealth.health_status,
              last_heartbeat: sandboxHealth.last_heartbeat.toISOString(),
              response_time_ms: sandboxHealth.response_time_ms,
              error_count: sandboxHealth.error_count,
              consecutive_failures: sandboxHealth.consecutive_failures,
              recovery_attempts: sandboxHealth.recovery_attempts,
              last_error: sandboxHealth.last_error,
              last_recovery_attempt: sandboxHealth.last_recovery_attempt?.toISOString(),
              needs_recovery: sandboxHealth.health_status === 'unhealthy' || sandboxHealth.health_status === 'unresponsive',
              recommendations: generateHealthRecommendations(sandboxHealth)
            },
            message: 'Sandbox health retrieved successfully'
          })
        } catch (error) {
          return NextResponse.json({
            error: `Failed to get sandbox health: ${error instanceof Error ? error.message : 'Unknown error'}`
          }, { status: 500 })
        }

      case 'recovery_strategies':
        // Get available recovery strategies
        return NextResponse.json({
          success: true,
          recovery_strategies: [
            {
              name: 'sandbox_restart',
              description: 'Restart existing sandbox while preserving context',
              priority: 1,
              applicable_to: ['connection_timeout', 'command_failure'],
              preserves_context: true,
              estimated_duration_ms: 30000
            },
            {
              name: 'context_preserving_recreation',
              description: 'Create new sandbox and restore previous state',
              priority: 2,
              applicable_to: ['sandbox_terminated', 'resource_exhaustion'],
              preserves_context: true,
              estimated_duration_ms: 60000
            },
            {
              name: 'clean_slate_recovery',
              description: 'Create fresh sandbox with minimal setup',
              priority: 3,
              applicable_to: ['unknown', 'resource_exhaustion'],
              preserves_context: false,
              estimated_duration_ms: 90000
            },
            {
              name: 'backup_failover',
              description: 'Switch to pre-configured backup sandbox',
              priority: 4,
              applicable_to: ['sandbox_terminated', 'connection_timeout'],
              preserves_context: true,
              estimated_duration_ms: 45000
            }
          ],
          message: 'Recovery strategies retrieved successfully'
        })

      case 'recovery_history':
        // Get recovery history for workspace
        const limit = parseInt(searchParams.get('limit') || '50')
        const days = parseInt(searchParams.get('days') || '7')

        try {
          // Mock recovery history - in real implementation, would query database
          const recoveryHistory = [
            {
              session_id: sessionId || 'mock-session-1',
              recovery_timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
              strategy_used: 'sandbox_restart',
              success: true,
              recovery_duration_ms: 15000,
              failure_type: 'connection_timeout',
              context_restored: true
            },
            {
              session_id: sessionId || 'mock-session-2',
              recovery_timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
              strategy_used: 'context_preserving_recreation',
              success: true,
              recovery_duration_ms: 45000,
              failure_type: 'sandbox_terminated',
              context_restored: true
            }
          ].slice(0, limit)

          return NextResponse.json({
            success: true,
            recovery_history: recoveryHistory,
            summary: {
              total_recoveries: recoveryHistory.length,
              successful_recoveries: recoveryHistory.filter(r => r.success).length,
              average_duration_ms: recoveryHistory.reduce((acc, r) => acc + r.recovery_duration_ms, 0) / recoveryHistory.length,
              most_common_strategy: 'sandbox_restart',
              most_common_failure_type: 'connection_timeout'
            },
            message: 'Recovery history retrieved successfully'
          })
        } catch (error) {
          return NextResponse.json({
            error: `Failed to get recovery history: ${error instanceof Error ? error.message : 'Unknown error'}`
          }, { status: 500 })
        }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('Error in error recovery GET API:', error)
    return NextResponse.json(
      { error: 'Failed to get error recovery information' },
      { status: 500 }
    )
  }

}

// Helper function to generate health recommendations
function generateHealthRecommendations(health: any): string[] {
    const recommendations: string[] = []

    if (health.consecutive_failures > 0) {
      recommendations.push('Monitor sandbox closely for recurring issues')
    }

    if (health.response_time_ms > 5000) {
      recommendations.push('Consider optimizing sandbox performance')
    }

    if (health.error_count > 10) {
      recommendations.push('Investigate root cause of frequent errors')
    }

    if (health.recovery_attempts > 2) {
      recommendations.push('Consider manual investigation or clean slate recovery')
    }

    if (health.health_status === 'unresponsive') {
      recommendations.push('Immediate recovery action required')
    }

    return recommendations.length > 0 ? recommendations : ['Sandbox is operating normally']
}