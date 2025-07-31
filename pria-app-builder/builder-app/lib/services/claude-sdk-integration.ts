/**
 * Claude SDK Integration Service - Bridge to UnifiedClaudeExecutor
 * Provides backward compatibility for existing API routes
 */

import { UnifiedClaudeExecutor } from '@/lib/claude-sdk/unified-claude-executor'

export interface ClaudeSDKConfig {
  templateId: string
  anthropicApiKey: string
  timeoutMs?: number
}

export class ClaudeSDKIntegrationService {
  private executor: UnifiedClaudeExecutor

  constructor(config: ClaudeSDKConfig, supabase?: any) {
    this.executor = UnifiedClaudeExecutor.getInstance()
  }

  async syncContextToTargetApp(sessionId: string, context: any): Promise<void> {
    // Context sync is handled internally by UnifiedClaudeExecutor
    console.log(`[CLAUDE-SDK-BRIDGE] Context sync for session ${sessionId} - handled internally`)
  }

  async executeClaudeCommand(
    sessionId: string,
    prompt: string,
    options: {
      maxTurns?: number
      subagentRole?: string
      contextFiles?: string[]
      requirements?: any[]
      techSpecs?: any[]
      tasks?: any[]
      artifacts?: any
    } = {}
  ) {
    try {
      const result = await this.executor.executeQuery(
        prompt,
        {
          sessionId,
          workspaceId: 'unknown', // Will be determined by executor
          userId: 'unknown', // Will be determined by executor
          currentPhase: 1,
          subagent: options.subagentRole || 'requirements-analyst'
        },
        {
          maxTurns: options.maxTurns || 1,
          cwd: `/workspace/session-${sessionId}`,
          permissionMode: 'default'
        }
      )

      return {
        success: result.success,
        messages: result.messages,
        executionTime: result.executionTime,
        artifacts: result.artifacts || {},
        error: result.success ? null : 'Execution failed'
      }
    } catch (error) {
      console.error('[CLAUDE-SDK-BRIDGE] Execution failed:', error)
      return {
        success: false,
        messages: [],
        executionTime: 0,
        artifacts: {},
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async getGeneratedFiles(sessionId: string) {
    // Simplified file retrieval - in a real implementation would query the E2B sandbox
    return {
      files: [],
      timestamp: new Date().toISOString()
    }
  }

  async initializeTargetApp(sessionId: string, config: any) {
    console.log(`[CLAUDE-SDK-BRIDGE] Target app initialization for session ${sessionId}`)
    return {
      success: true,
      sandboxId: `sandbox-${sessionId}`,
      workingDirectory: `/workspace/session-${sessionId}`
    }
  }

  async cleanupTargetApp(sessionId: string) {
    console.log(`[CLAUDE-SDK-BRIDGE] Target app cleanup for session ${sessionId}`)
    return { success: true }
  }
}