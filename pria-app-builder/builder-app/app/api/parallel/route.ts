import { NextRequest, NextResponse } from 'next/server'
import { SubagentWorkflowManager } from '@/lib/workflow/subagent-workflow-manager'
import { ParallelProcessor, ConcurrencyConfig } from '@/lib/workflow/parallel-processor'
import { createServerClient } from '@/lib/supabase/server'

// Initialize parallel processor
const workflowManager = new SubagentWorkflowManager()
const parallelProcessor = new ParallelProcessor(workflowManager)

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
    const { action, sessionId, phase, tasks, batchId, config, userPrompt } = body

    switch (action) {
      case 'create_batch':
        // Create a new parallel batch
        if (!sessionId || !phase) {
          return NextResponse.json({ 
            error: 'sessionId and phase required for create_batch action' 
          }, { status: 400 })
        }

        let parallelTasks = tasks || []
        
        // Auto-generate optimized tasks if not provided
        if (!tasks && userPrompt) {
          parallelTasks = await parallelProcessor.createOptimizedTaskSet(
            sessionId,
            workspaceId,
            phase,
            userPrompt
          )
        }

        const batch = await parallelProcessor.createParallelBatch(
          sessionId,
          workspaceId,
          phase,
          parallelTasks
        )

        return NextResponse.json({
          success: true,
          batch: {
            id: batch.id,
            sessionId: batch.sessionId,
            phase: batch.phase,
            taskCount: batch.tasks.length,
            status: batch.status,
            tasks: batch.tasks.map(task => ({
              id: task.id,
              agentName: task.agentName,
              description: task.description,
              priority: task.priority,
              dependencies: task.dependencies
            }))
          }
        })

      case 'execute_batch':
        // Execute an existing batch
        if (!batchId) {
          return NextResponse.json({ 
            error: 'batchId required for execute_batch action' 
          }, { status: 400 })
        }

        const concurrencyConfig: ConcurrencyConfig = {
          maxConcurrentTasks: config?.maxConcurrentTasks || 3,
          timeoutMs: config?.timeoutMs || 300000,
          retryAttempts: config?.retryAttempts || 2,
          enableLoadBalancing: config?.enableLoadBalancing ?? true,
          priorityBased: config?.priorityBased ?? true
        }

        // Execute batch in background
        parallelProcessor.executeParallelBatch(batchId, concurrencyConfig)
          .catch(error => {
            console.error(`Batch execution failed for ${batchId}:`, error)
          })

        return NextResponse.json({
          success: true,
          message: 'Batch execution started',
          batchId,
          config: concurrencyConfig
        })

      case 'create_and_execute':
        // Create and immediately execute a batch
        if (!sessionId || !phase) {
          return NextResponse.json({ 
            error: 'sessionId and phase required for create_and_execute action' 
          }, { status: 400 })
        }

        let taskSet = tasks || []
        
        // Auto-generate optimized tasks if not provided
        if (!tasks && userPrompt) {
          taskSet = await parallelProcessor.createOptimizedTaskSet(
            sessionId,
            workspaceId,
            phase,
            userPrompt
          )
        }

        const newBatch = await parallelProcessor.createParallelBatch(
          sessionId,
          workspaceId,
          phase,
          taskSet
        )

        const executionConfig: ConcurrencyConfig = {
          maxConcurrentTasks: config?.maxConcurrentTasks || 3,
          timeoutMs: config?.timeoutMs || 300000,
          retryAttempts: config?.retryAttempts || 2,
          enableLoadBalancing: config?.enableLoadBalancing ?? true,
          priorityBased: config?.priorityBased ?? true
        }

        // Execute batch in background
        parallelProcessor.executeParallelBatch(newBatch.id, executionConfig)
          .catch(error => {
            console.error(`Batch execution failed for ${newBatch.id}:`, error)
          })

        return NextResponse.json({
          success: true,
          batch: {
            id: newBatch.id,
            sessionId: newBatch.sessionId,
            phase: newBatch.phase,
            taskCount: newBatch.tasks.length,
            status: newBatch.status
          },
          message: 'Batch created and execution started',
          config: executionConfig
        })

      case 'create_cross_cutting_tasks':
        // Create tasks for cross-cutting concerns
        if (!sessionId || !userPrompt) {
          return NextResponse.json({ 
            error: 'sessionId and userPrompt required for create_cross_cutting_tasks action' 
          }, { status: 400 })
        }

        const crossCuttingTasks = await parallelProcessor.createCrossCuttingTasks(
          sessionId,
          workspaceId,
          userPrompt
        )

        const crossCuttingBatch = await parallelProcessor.createParallelBatch(
          sessionId,
          workspaceId,
          0, // Cross-cutting phase
          crossCuttingTasks
        )

        return NextResponse.json({
          success: true,
          batch: {
            id: crossCuttingBatch.id,
            sessionId: crossCuttingBatch.sessionId,
            phase: crossCuttingBatch.phase,
            taskCount: crossCuttingBatch.tasks.length,
            status: crossCuttingBatch.status,
            tasks: crossCuttingBatch.tasks.map(task => ({
              id: task.id,
              agentName: task.agentName,
              description: task.description,
              priority: task.priority
            }))
          }
        })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('Error in parallel processing API:', error)
    return NextResponse.json(
      { error: 'Failed to process parallel request' },
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

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'status'
    const batchId = searchParams.get('batchId')

    switch (action) {
      case 'status':
        // Get batch status and progress
        if (!batchId) {
          return NextResponse.json({ 
            error: 'batchId required for status action' 
          }, { status: 400 })
        }

        const statusInfo = parallelProcessor.getBatchStatus(batchId)
        
        if (!statusInfo.batch) {
          return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
        }

        return NextResponse.json({
          success: true,
          batch: {
            id: statusInfo.batch.id,
            sessionId: statusInfo.batch.sessionId,
            phase: statusInfo.batch.phase,
            status: statusInfo.batch.status,
            startTime: statusInfo.batch.startTime,
            endTime: statusInfo.batch.endTime,
            taskCount: statusInfo.batch.tasks.length,
            results: Object.keys(statusInfo.batch.results),
            errors: Object.keys(statusInfo.batch.errors)
          },
          progress: statusInfo.progress
        })

      case 'results':
        // Get batch results
        if (!batchId) {
          return NextResponse.json({ 
            error: 'batchId required for results action' 
          }, { status: 400 })
        }

        const resultsInfo = parallelProcessor.getBatchStatus(batchId)
        
        if (!resultsInfo.batch) {
          return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
        }

        return NextResponse.json({
          success: true,
          batchId,
          results: resultsInfo.batch.results,
          errors: resultsInfo.batch.errors,
          summary: {
            total_tasks: resultsInfo.batch.tasks.length,
            successful_tasks: Object.keys(resultsInfo.batch.results).length,
            failed_tasks: Object.keys(resultsInfo.batch.errors).length,
            completion_rate: resultsInfo.progress.completion_percentage
          }
        })

      case 'task_details':
        // Get detailed task information
        if (!batchId) {
          return NextResponse.json({ 
            error: 'batchId required for task_details action' 
          }, { status: 400 })
        }

        const taskId = searchParams.get('taskId')
        const taskInfo = parallelProcessor.getBatchStatus(batchId)
        
        if (!taskInfo.batch) {
          return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
        }

        if (taskId) {
          const task = taskInfo.batch.tasks.find(t => t.id === taskId)
          const result = taskInfo.batch.results[taskId]
          const error = taskInfo.batch.errors[taskId]

          if (!task) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 })
          }

          return NextResponse.json({
            success: true,
            task: {
              ...task,
              result,
              error: error?.message,
              status: result ? 'completed' : error ? 'failed' : 'pending'
            }
          })
        } else {
          return NextResponse.json({
            success: true,
            tasks: taskInfo.batch.tasks.map(task => ({
              id: task.id,
              agentName: task.agentName,
              description: task.description,
              priority: task.priority,
              dependencies: task.dependencies,
              status: taskInfo.batch.results[task.id] ? 'completed' : 
                     taskInfo.batch.errors[task.id] ? 'failed' : 'pending'
            }))
          })
        }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('Error in parallel processing GET API:', error)
    return NextResponse.json(
      { error: 'Failed to get parallel processing info' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const batchId = searchParams.get('batchId')
    const action = searchParams.get('action') || 'cancel'

    switch (action) {
      case 'cancel':
        // Cancel a running batch
        if (!batchId) {
          return NextResponse.json({ 
            error: 'batchId required for cancel action' 
          }, { status: 400 })
        }

        await parallelProcessor.cancelBatch(batchId)

        return NextResponse.json({
          success: true,
          message: 'Batch cancelled successfully',
          batchId
        })

      case 'cleanup':
        // Clean up old completed batches
        const olderThanHours = parseInt(searchParams.get('olderThanHours') || '1')
        const olderThanMs = olderThanHours * 60 * 60 * 1000

        parallelProcessor.cleanupBatches(olderThanMs)

        return NextResponse.json({
          success: true,
          message: `Cleaned up batches older than ${olderThanHours} hours`
        })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('Error in parallel processing DELETE API:', error)
    return NextResponse.json(
      { error: 'Failed to process delete request' },
      { status: 500 }
    )
  }
}