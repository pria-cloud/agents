/**
 * Unified Claude Code SDK Executor
 * Consolidates all Claude Code SDK execution paths into a single, consistent implementation
 */

import { query } from '@anthropic-ai/claude-code'
import { performanceMonitor } from '@/lib/monitoring/performance-monitor'
import { OfficialSubAgentsManager } from './official-subagents-manager'

export interface ClaudeExecutionContext {
  sessionId: string
  workspaceId: string
  phase?: number
  requirements?: any[]
  specifications?: any[]
  artifacts?: any[]
  projectPath: string
}

export interface ClaudeExecutionOptions {
  maxTurns?: number
  timeout?: number
  subagentRole?: string
  tools?: string[]
  contextFiles?: string[]
  preserveContext?: boolean
}

export interface ClaudeExecutionResult {
  response: string
  duration: number
  success: boolean
  artifacts: any[]
  toolUse: any[]
  filesModified: string[]
  messages: any[]
  subagentUsed?: string
  error?: string
}

export class UnifiedClaudeExecutor {
  private subagentsManager: OfficialSubAgentsManager
  private activeExecutions: Map<string, Promise<ClaudeExecutionResult>> = new Map()

  constructor(projectPath: string) {
    this.subagentsManager = new OfficialSubAgentsManager(projectPath)
  }

  /**
   * Execute Claude Code SDK query with unified handling
   */
  async executeQuery(
    prompt: string,
    context: ClaudeExecutionContext,
    options: ClaudeExecutionOptions = {}
  ): Promise<ClaudeExecutionResult> {
    
    const executionId = `${context.sessionId}-${Date.now()}`
    const startTime = Date.now()
    
    // Prevent concurrent executions for the same session
    const existingExecution = this.activeExecutions.get(context.sessionId)
    if (existingExecution) {
      console.log(`[UNIFIED CLAUDE] Waiting for existing execution to complete: ${context.sessionId}`)
      await existingExecution
    }

    const metricId = performanceMonitor.startMetric(
      context.sessionId,
      context.workspaceId,
      'claude_operation',
      'unified_execution'
    )

    const executionPromise = this.performExecution(prompt, context, options, startTime)
    this.activeExecutions.set(context.sessionId, executionPromise)

    try {
      const result = await executionPromise
      performanceMonitor.finishMetric(metricId, result.success, result.error)
      return result
      
    } finally {
      this.activeExecutions.delete(context.sessionId)
    }
  }

  /**
   * Execute with sub-agent delegation
   */
  async executeWithSubAgent(
    agentName: string,
    prompt: string,
    context: ClaudeExecutionContext,
    options: ClaudeExecutionOptions = {}
  ): Promise<ClaudeExecutionResult> {
    
    console.log(`[UNIFIED CLAUDE] Executing with sub-agent: ${agentName}`)
    
    const subagentResult = await this.subagentsManager.executeSubAgent({
      agentName,
      prompt,
      context: {
        sessionId: context.sessionId,
        workspaceId: context.workspaceId,
        phase: context.phase || 1,
        projectPath: context.projectPath
      },
      options: {
        maxTurns: options.maxTurns,
        timeout: options.timeout
      }
    })

    return {
      response: subagentResult.response,
      duration: subagentResult.duration,
      success: subagentResult.success,
      artifacts: subagentResult.artifacts,
      toolUse: subagentResult.toolUse || [],
      filesModified: [], // Would be extracted from tool use
      messages: [], // Sub-agent doesn't expose raw messages
      subagentUsed: agentName,
      error: subagentResult.error
    }
  }

  /**
   * Check if execution is currently running for a session
   */
  isExecuting(sessionId: string): boolean {
    return this.activeExecutions.has(sessionId)
  }

  /**
   * Cancel execution for a session
   */
  async cancelExecution(sessionId: string): Promise<void> {
    const execution = this.activeExecutions.get(sessionId)
    if (execution) {
      console.log(`[UNIFIED CLAUDE] Cancelling execution for session: ${sessionId}`)
      this.activeExecutions.delete(sessionId)
      // Note: Cannot actually cancel ongoing Claude query, but we remove tracking
    }
  }

  // Private methods

  private async performExecution(
    prompt: string,
    context: ClaudeExecutionContext,
    options: ClaudeExecutionOptions,
    startTime: number
  ): Promise<ClaudeExecutionResult> {
    
    console.log(`[UNIFIED CLAUDE] Starting execution for session: ${context.sessionId}`)
    console.log(`[UNIFIED CLAUDE] Prompt length: ${prompt.length} characters`)
    console.log(`[UNIFIED CLAUDE] Project path: ${context.projectPath}`)

    try {
      // Build contextual prompt with PRIA context
      const contextualPrompt = this.buildContextualPrompt(prompt, context)
      
      // Execute using Claude Code SDK
      const messages = []
      for await (const message of query(contextualPrompt, {
        maxTurns: options.maxTurns || 10,
        cwd: context.projectPath,
        timeout: options.timeout || 120000,
        tools: options.tools
      })) {
        messages.push(message)
      }

      // Process results
      const result = this.processMessages(messages)
      const duration = Date.now() - startTime

      console.log(`[UNIFIED CLAUDE] Execution completed in ${duration}ms`)
      console.log(`[UNIFIED CLAUDE] Response length: ${result.response.length} characters`)
      console.log(`[UNIFIED CLAUDE] Artifacts: ${result.artifacts.length}`)
      console.log(`[UNIFIED CLAUDE] Tool uses: ${result.toolUse.length}`)

      return {
        ...result,
        duration,
        success: true,
        messages
      }

    } catch (error) {
      const duration = Date.now() - startTime
      console.error(`[UNIFIED CLAUDE] Execution failed:`, error)
      
      return {
        response: `Execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration,
        success: false,
        artifacts: [],
        toolUse: [],
        filesModified: [],
        messages: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  private buildContextualPrompt(prompt: string, context: ClaudeExecutionContext): string {
    const contextSections = []

    // Session context
    contextSections.push(`## Session Context
- Session ID: ${context.sessionId}
- Workspace ID: ${context.workspaceId}
- Current Phase: ${context.phase || 1}
- Project Path: ${context.projectPath}`)

    // Requirements context
    if (context.requirements && context.requirements.length > 0) {
      contextSections.push(`## Current Requirements
${context.requirements.map(req => `- ${req.title}: ${req.description}`).join('\n')}`)
    }

    // Technical specifications context
    if (context.specifications && context.specifications.length > 0) {
      contextSections.push(`## Technical Specifications
${context.specifications.map(spec => `- ${spec.title}: ${spec.content}`).join('\n')}`)
    }

    // Artifacts context
    if (context.artifacts && context.artifacts.length > 0) {
      contextSections.push(`## Available Artifacts
${context.artifacts.map(artifact => `- ${artifact.name}: ${artifact.description || 'No description'}`).join('\n')}`)
    }

    // PRIA compliance reminder
    contextSections.push(`## PRIA Compliance Requirements
- ALL database operations MUST include workspace_id filtering
- Use proper authentication middleware for route protection
- Follow PRIA architectural patterns exactly
- Generate TypeScript with strict mode compliance
- Use only shadcn/ui components from existing component library`)

    const contextualPrompt = `${contextSections.join('\n\n')}

## User Request
${prompt}

Please handle this request according to PRIA standards and current context.`

    return contextualPrompt
  }

  private processMessages(messages: any[]): Omit<ClaudeExecutionResult, 'duration' | 'success' | 'messages'> {
    let response = ''
    const artifacts: any[] = []
    const toolUse: any[] = []
    const filesModified: string[] = []

    for (const message of messages) {
      switch (message.type) {
        case 'text':
          response += message.content
          break
          
        case 'tool_use':
          toolUse.push(message)
          
          // Track file modifications
          if (message.name === 'write-file' || message.name === 'edit-file') {
            const filePath = message.input?.path
            if (filePath && !filesModified.includes(filePath)) {
              filesModified.push(filePath)
            }
            
            // Create artifact
            artifacts.push({
              type: 'file',
              path: filePath,
              content: message.input?.content,
              operation: message.name,
              timestamp: new Date().toISOString()
            })
          }
          break
          
        case 'tool_result':
          // Tool results are processed but don't add to response directly
          break
          
        default:
          console.log(`[UNIFIED CLAUDE] Unknown message type: ${message.type}`)
      }
    }

    return {
      response: response.trim(),
      artifacts,
      toolUse,
      filesModified,
      error: undefined
    }
  }

  /**
   * Get active execution status
   */
  getExecutionStatus(): {
    activeExecutions: number
    sessionIds: string[]
  } {
    return {
      activeExecutions: this.activeExecutions.size,
      sessionIds: Array.from(this.activeExecutions.keys())
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    console.log(`[UNIFIED CLAUDE] Cleaning up ${this.activeExecutions.size} active executions`)
    this.activeExecutions.clear()
  }
}

// Export singleton instance factory
let executorInstance: UnifiedClaudeExecutor | null = null

export function getUnifiedClaudeExecutor(projectPath: string): UnifiedClaudeExecutor {
  if (!executorInstance) {
    executorInstance = new UnifiedClaudeExecutor(projectPath)
  }
  return executorInstance
}