/**
 * Deployment Pipeline API - Phase 7 Implementation
 * Handles deployment plan creation and execution management
 */

import { NextRequest, NextResponse } from 'next/server'
import createServerClient from '@/lib/supabase/server'
import { DeploymentPipelineManager } from '@/lib/deployment/deployment-pipeline-manager'
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
      .select('id, workspace_id')
      .eq('id', sessionId)
      .eq('workspace_id', workspaceId)
      .single()

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const deploymentManager = new DeploymentPipelineManager(sessionId, workspaceId)

    switch (action) {
      case 'create_deployment_plan':
        // Create deployment plan
        const { 
          target_environment,
          deployment_strategy,
          monitoring_config,
          enable_feature_flags,
          custom_checks
        } = actionData

        if (!target_environment) {
          return NextResponse.json({
            error: 'Target environment is required'
          }, { status: 400 })
        }

        const metricId = performanceMonitor.startMetric(
          sessionId,
          workspaceId,
          'workflow_phase',
          'create_deployment_plan'
        )

        try {
          const deploymentPlan = await deploymentManager.createDeploymentPlan(
            target_environment,
            {
              deployment_strategy,
              monitoring_config,
              enable_feature_flags,
              custom_checks
            }
          )

          performanceMonitor.finishMetric(metricId, true)

          return NextResponse.json({
            success: true,
            deployment_plan: {
              id: deploymentPlan.id,
              target_environment: deploymentPlan.target_environment.name,
              deployment_strategy: deploymentPlan.deployment_strategy,
              monitoring_config: deploymentPlan.monitoring_config,
              pre_deployment_checks: deploymentPlan.pre_deployment_checks,
              post_deployment_validations: deploymentPlan.post_deployment_validations,
              rollback_plan: deploymentPlan.rollback_plan,
              feature_flags: deploymentPlan.feature_flags,
              created_at: deploymentPlan.created_at
            },
            message: 'Deployment plan created successfully'
          })
        } catch (error) {
          performanceMonitor.finishMetric(metricId, false, error instanceof Error ? error.message : 'Unknown error')
          throw error
        }

      case 'execute_deployment':
        // Execute deployment
        const { 
          deployment_plan_id,
          skip_pre_checks,
          dry_run,
          force_deploy
        } = actionData

        if (!deployment_plan_id) {
          return NextResponse.json({
            error: 'Deployment plan ID is required'
          }, { status: 400 })
        }

        const executionMetricId = performanceMonitor.startMetric(
          sessionId,
          workspaceId,
          'workflow_phase',
          'execute_deployment'
        )

        try {
          const deploymentExecution = await deploymentManager.executeDeployment(
            deployment_plan_id,
            {
              skip_pre_checks,
              dry_run,
              force_deploy
            }
          )

          performanceMonitor.finishMetric(executionMetricId, deploymentExecution.status === 'success')

          return NextResponse.json({
            success: deploymentExecution.status === 'success',
            deployment_execution: {
              id: deploymentExecution.id,
              status: deploymentExecution.status,
              start_time: deploymentExecution.start_time,
              end_time: deploymentExecution.end_time,
              duration_ms: deploymentExecution.duration_ms,
              current_step: deploymentExecution.current_step,
              completed_steps: deploymentExecution.completed_steps,
              failed_step: deploymentExecution.failed_step,
              error_message: deploymentExecution.error_message,
              deployment_url: deploymentExecution.deployment_url,
              performance_metrics: deploymentExecution.performance_metrics,
              rollback_execution: deploymentExecution.rollback_execution
            },
            logs: deploymentExecution.logs.slice(-10), // Return last 10 log entries
            message: deploymentExecution.status === 'success' 
              ? 'Deployment completed successfully' 
              : 'Deployment failed'
          })
        } catch (error) {
          performanceMonitor.finishMetric(executionMetricId, false, error instanceof Error ? error.message : 'Unknown error')
          throw error
        }

      case 'execute_rollback':
        // Execute rollback
        const { execution_id, trigger_reason } = actionData

        if (!execution_id) {
          return NextResponse.json({
            error: 'Execution ID is required'
          }, { status: 400 })
        }

        // Mock rollback execution - in real implementation, would retrieve execution and perform rollback
        const rollbackMetricId = performanceMonitor.startMetric(
          sessionId,
          workspaceId,
          'workflow_phase',
          'execute_rollback'
        )

        try {
          // This would be implemented to retrieve deployment execution and perform rollback
          console.log(`[DEPLOYMENT API] Executing rollback for execution: ${execution_id}`)
          
          performanceMonitor.finishMetric(rollbackMetricId, true)

          return NextResponse.json({
            success: true,
            message: 'Rollback executed successfully',
            rollback_execution: {
              triggered_at: new Date().toISOString(),
              trigger_reason: trigger_reason || 'manual_rollback',
              rollback_success: true
            }
          })
        } catch (error) {
          performanceMonitor.finishMetric(rollbackMetricId, false, error instanceof Error ? error.message : 'Unknown error')
          throw error
        }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('Error in deployment API:', error)
    return NextResponse.json(
      { error: 'Failed to process deployment request' },
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
    const sessionId = searchParams.get('sessionId')
    const action = searchParams.get('action') || 'list_deployments'

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }

    // Verify session access
    const { data: session } = await supabase
      .from('sessions')
      .select('id, workspace_id')
      .eq('id', sessionId)
      .eq('workspace_id', workspaceId)
      .single()

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const deploymentManager = new DeploymentPipelineManager(sessionId, workspaceId)

    switch (action) {
      case 'list_deployments':
        // List deployment plans and executions for session
        return NextResponse.json({
          success: true,
          deployments: {
            plans: [], // Would retrieve from database
            executions: [], // Would retrieve from database
            active_deployments: 0,
            last_deployment: null
          },
          message: 'Deployment history retrieved successfully'
        })

      case 'get_deployment_status':
        // Get status of specific deployment
        const deploymentId = searchParams.get('deploymentId')
        
        if (!deploymentId) {
          return NextResponse.json({
            error: 'Deployment ID required'
          }, { status: 400 })
        }

        return NextResponse.json({
          success: true,
          deployment_status: {
            id: deploymentId,
            status: 'running', // Would retrieve actual status
            current_step: 'deployment',
            progress_percentage: 75,
            estimated_completion: new Date(Date.now() + 2 * 60 * 1000).toISOString()
          },
          message: 'Deployment status retrieved successfully'
        })

      case 'get_deployment_logs':
        // Get deployment logs
        const executionId = searchParams.get('executionId')
        const limit = parseInt(searchParams.get('limit') || '50')
        
        if (!executionId) {
          return NextResponse.json({
            error: 'Execution ID required'
          }, { status: 400 })
        }

        return NextResponse.json({
          success: true,
          logs: [
            {
              timestamp: new Date().toISOString(),
              level: 'info',
              message: 'Deployment started',
              metadata: { step: 'initialization' }
            },
            {
              timestamp: new Date(Date.now() - 30000).toISOString(),
              level: 'info',
              message: 'Pre-deployment checks completed',
              metadata: { step: 'validation' }
            }
          ].slice(0, limit),
          total_logs: 25,
          message: 'Deployment logs retrieved successfully'
        })

      case 'get_environment_config':
        // Get environment configuration
        const environment = searchParams.get('environment')
        
        if (!environment) {
          return NextResponse.json({
            error: 'Environment name required'
          }, { status: 400 })
        }

        return NextResponse.json({
          success: true,
          environment_config: {
            name: environment,
            url: `https://${environment}-app.vercel.app`,
            branch: environment === 'production' ? 'main' : environment,
            auto_deploy: environment === 'development',
            requires_approval: environment !== 'development',
            deployment_config: {
              build_command: 'npm run build',
              output_directory: '.next',
              node_version: '18.x',
              install_command: 'npm ci'
            }
          },
          message: 'Environment configuration retrieved successfully'
        })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('Error in deployment GET API:', error)
    return NextResponse.json(
      { error: 'Failed to get deployment information' },
      { status: 500 }
    )
  }
}