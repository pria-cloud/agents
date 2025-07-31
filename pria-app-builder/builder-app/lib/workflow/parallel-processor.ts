/**
 * Parallel Processor - Enables concurrent execution of multiple subagents
 * Implements parallel processing patterns for efficient workflow execution
 */

import { SubagentWorkflowManager } from './subagent-workflow-manager'
import { SubagentRegistryManager } from '@/lib/subagents/subagent-registry'
import { SubagentConfig, SubagentResult, SubagentContext, ArtifactReference } from '@/lib/subagents/types'

export interface ParallelTask {
  id: string
  agentName: string
  description: string
  prompt: string
  context: SubagentContext
  dependencies?: string[]
  estimatedDuration?: number
  priority: 'high' | 'medium' | 'low'
}

export interface ParallelBatch {
  id: string
  sessionId: string
  workspaceId: string
  phase: number
  tasks: ParallelTask[]
  status: 'pending' | 'running' | 'completed' | 'failed'
  startTime?: Date
  endTime?: Date
  results: Record<string, SubagentResult>
  errors: Record<string, Error>
}

export interface ConcurrencyConfig {
  maxConcurrentTasks: number
  timeoutMs: number
  retryAttempts: number
  enableLoadBalancing: boolean
  priorityBased: boolean
}

export interface DependencyGraph {
  tasks: Record<string, ParallelTask>
  dependencies: Record<string, string[]>
  execution_order: string[][]
}

/**
 * ParallelProcessor - Manages concurrent execution of multiple subagents
 */
export class ParallelProcessor {
  private activeBatches: Map<string, ParallelBatch> = new Map()
  private workflowManager: SubagentWorkflowManager

  constructor(workflowManager: SubagentWorkflowManager) {
    this.workflowManager = workflowManager
  }

  /**
   * Create a parallel batch of tasks for execution
   */
  async createParallelBatch(
    sessionId: string,
    workspaceId: string,
    phase: number,
    tasks: Omit<ParallelTask, 'id'>[]
  ): Promise<ParallelBatch> {
    const batchId = `batch_${sessionId}_${phase}_${Date.now()}`
    
    const parallelTasks: ParallelTask[] = tasks.map((task, index) => ({
      ...task,
      id: `task_${batchId}_${index}`
    }))

    const batch: ParallelBatch = {
      id: batchId,
      sessionId,
      workspaceId,
      phase,
      tasks: parallelTasks,
      status: 'pending',
      results: {},
      errors: {}
    }

    this.activeBatches.set(batchId, batch)
    return batch
  }

  /**
   * Execute parallel batch with dependency resolution
   */
  async executeParallelBatch(
    batchId: string,
    config: ConcurrencyConfig = {
      maxConcurrentTasks: 3,
      timeoutMs: 300000, // 5 minutes
      retryAttempts: 2,
      enableLoadBalancing: true,
      priorityBased: true
    }
  ): Promise<ParallelBatch> {
    const batch = this.activeBatches.get(batchId)
    if (!batch) {
      throw new Error(`Batch ${batchId} not found`)
    }

    batch.status = 'running'
    batch.startTime = new Date()

    try {
      // Build dependency graph
      const dependencyGraph = this.buildDependencyGraph(batch.tasks)
      
      // Execute tasks in parallel waves based on dependencies
      for (const wave of dependencyGraph.execution_order) {
        await this.executeTaskWave(batch, wave, config)
      }

      batch.status = 'completed'
      batch.endTime = new Date()

    } catch (error) {
      batch.status = 'failed'
      batch.endTime = new Date()
      console.error(`Parallel batch ${batchId} failed:`, error)
      throw error
    }

    return batch
  }

  /**
   * Build dependency graph for task execution ordering
   */
  private buildDependencyGraph(tasks: ParallelTask[]): DependencyGraph {
    const taskMap: Record<string, ParallelTask> = {}
    const dependencies: Record<string, string[]> = {}

    // Build task map and dependencies
    tasks.forEach(task => {
      taskMap[task.id] = task
      dependencies[task.id] = task.dependencies || []
    })

    // Resolve execution order using topological sort
    const executionOrder: string[][] = []
    const visited = new Set<string>()
    const inProgress = new Set<string>()

    const canExecute = (taskId: string): boolean => {
      return dependencies[taskId].every(depId => visited.has(depId))
    }

    while (visited.size < tasks.length) {
      const currentWave: string[] = []
      
      // Find tasks that can be executed in this wave
      for (const task of tasks) {
        if (!visited.has(task.id) && !inProgress.has(task.id) && canExecute(task.id)) {
          currentWave.push(task.id)
          inProgress.add(task.id)
        }
      }

      if (currentWave.length === 0) {
        throw new Error('Circular dependency detected in task graph')
      }

      executionOrder.push(currentWave)
      
      // Mark wave tasks as completed
      currentWave.forEach(taskId => {
        visited.add(taskId)
        inProgress.delete(taskId)
      })
    }

    return {
      tasks: taskMap,
      dependencies,
      execution_order: executionOrder
    }
  }

  /**
   * Execute a wave of tasks concurrently
   */
  private async executeTaskWave(
    batch: ParallelBatch,
    taskIds: string[],
    config: ConcurrencyConfig
  ): Promise<void> {
    // Sort by priority if enabled
    const tasks = taskIds.map(id => batch.tasks.find(t => t.id === id)!!)
    if (config.priorityBased) {
      tasks.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 }
        return priorityOrder[b.priority] - priorityOrder[a.priority]
      })
    }

    // Execute tasks in chunks based on concurrency limit
    const chunks = this.chunkArray(tasks, config.maxConcurrentTasks)
    
    for (const chunk of chunks) {
      const promises = chunk.map(task => this.executeTask(batch, task, config))
      await Promise.allSettled(promises)
    }
  }

  /**
   * Execute a single task with retry logic
   */
  private async executeTask(
    batch: ParallelBatch,
    task: ParallelTask,
    config: ConcurrencyConfig
  ): Promise<void> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= config.retryAttempts; attempt++) {
      try {
        console.log(`Executing task ${task.id} (attempt ${attempt + 1})`)
        
        const result = await Promise.race([
          this.workflowManager.executeSubagent(
            task.agentName,
            task.prompt,
            task.context
          ),
          this.createTimeout(config.timeoutMs)
        ])

        batch.results[task.id] = result
        console.log(`Task ${task.id} completed successfully`)
        return

      } catch (error) {
        lastError = error as Error
        console.error(`Task ${task.id} failed (attempt ${attempt + 1}):`, error)
        
        if (attempt < config.retryAttempts) {
          // Exponential backoff
          await this.delay(Math.pow(2, attempt) * 1000)
        }
      }
    }

    batch.errors[task.id] = lastError!
    throw new Error(`Task ${task.id} failed after ${config.retryAttempts + 1} attempts`)
  }

  /**
   * Create optimized parallel tasks for common workflow patterns
   */
  async createOptimizedTaskSet(
    sessionId: string,
    workspaceId: string,
    phase: number,
    userPrompt: string,
    artifactReferences: ArtifactReference[] = []
  ): Promise<Omit<ParallelTask, 'id'>[]> {
    const tasks: Omit<ParallelTask, 'id'>[] = []
    const baseContext: SubagentContext = {
      sessionId,
      workspaceId,
      currentPhase: phase,
      agentName: '',
      artifactReferences
    }

    switch (phase) {
      case 1: // Requirements Gathering
        tasks.push({
          agentName: 'requirements-analyst',
          description: 'Primary requirements analysis and user story creation',
          prompt: userPrompt,
          context: { ...baseContext, agentName: 'requirements-analyst' },
          priority: 'high'
        })
        break

      case 2: // Architecture & Design
        tasks.push(
          {
            agentName: 'system-architect',
            description: 'System architecture design and technical specifications',
            prompt: `Create comprehensive system architecture for: ${userPrompt}`,
            context: { ...baseContext, agentName: 'system-architect' },
            priority: 'high'
          }
        )
        break

      case 3: // Implementation Planning
        tasks.push(
          {
            agentName: 'project-planner',
            description: 'Task breakdown and sprint planning',
            prompt: `Create detailed implementation plan for: ${userPrompt}`,
            context: { ...baseContext, agentName: 'project-planner' },
            priority: 'high'
          }
        )
        break

      case 4: // Development & Implementation
        tasks.push(
          {
            agentName: 'code-generator',
            description: 'Primary code generation and implementation',
            prompt: `Implement PRIA-compliant application for: ${userPrompt}`,
            context: { ...baseContext, agentName: 'code-generator' },
            priority: 'high'
          }
        )
        break

      case 5: // Testing & QA
        tasks.push(
          {
            agentName: 'qa-engineer',
            description: 'Comprehensive testing and quality assurance',
            prompt: `Create and execute comprehensive test suite for: ${userPrompt}`,
            context: { ...baseContext, agentName: 'qa-engineer' },
            priority: 'high'
          }
        )
        break

      case 6: // Validation & Security
        tasks.push(
          {
            agentName: 'security-auditor',
            description: 'Security audit and compliance validation',
            prompt: `Perform comprehensive security audit for: ${userPrompt}`,
            context: { ...baseContext, agentName: 'security-auditor' },
            priority: 'high'
          }
        )
        break

      case 7: // Deployment & Monitoring
        // To be implemented with devops-engineer
        break
    }

    return tasks
  }

  /**
   * Create parallel tasks for cross-cutting concerns
   */
  async createCrossCuttingTasks(
    sessionId: string,
    workspaceId: string,
    userPrompt: string
  ): Promise<Omit<ParallelTask, 'id'>[]> {
    const baseContext: SubagentContext = {
      sessionId,
      workspaceId,
      currentPhase: 0, // Cross-cutting
      agentName: ''
    }

    return [
      {
        agentName: 'security-auditor',
        description: 'Continuous security analysis',
        prompt: `Perform ongoing security analysis for: ${userPrompt}`,
        context: { ...baseContext, agentName: 'security-auditor' },
        priority: 'medium'
      },
      {
        agentName: 'qa-engineer',
        description: 'Continuous quality monitoring',
        prompt: `Monitor quality metrics for: ${userPrompt}`,
        context: { ...baseContext, agentName: 'qa-engineer' },
        priority: 'medium'
      }
    ]
  }

  /**
   * Get batch status and progress information
   */
  getBatchStatus(batchId: string): {
    batch: ParallelBatch | null
    progress: {
      total: number
      completed: number
      failed: number
      running: number
      completion_percentage: number
    }
  } {
    const batch = this.activeBatches.get(batchId)
    if (!batch) {
      return { batch: null, progress: { total: 0, completed: 0, failed: 0, running: 0, completion_percentage: 0 } }
    }

    const total = batch.tasks.length
    const completed = Object.keys(batch.results).length
    const failed = Object.keys(batch.errors).length
    const running = batch.status === 'running' ? total - completed - failed : 0
    const completion_percentage = total > 0 ? Math.round((completed / total) * 100) : 0

    return {
      batch,
      progress: {
        total,
        completed,
        failed,
        running,
        completion_percentage
      }
    }
  }

  /**
   * Cancel a running batch
   */
  async cancelBatch(batchId: string): Promise<void> {
    const batch = this.activeBatches.get(batchId)
    if (batch && batch.status === 'running') {
      batch.status = 'failed'
      batch.endTime = new Date()
      batch.errors['_cancelled'] = new Error('Batch execution cancelled')
    }
  }

  /**
   * Clean up completed batches older than specified time
   */
  cleanupBatches(olderThanMs: number = 3600000): void { // 1 hour default
    const cutoff = Date.now() - olderThanMs
    
    for (const [batchId, batch] of this.activeBatches.entries()) {
      if (batch.endTime && batch.endTime.getTime() < cutoff) {
        this.activeBatches.delete(batchId)
      }
    }
  }

  // Utility methods
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize))
    }
    return chunks
  }

  private async createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Task execution timeout')), ms)
    })
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

export default ParallelProcessor