/**
 * Claude Code SDK Executor - Real integration with Claude Code SDK
 * Replaces the simulation system with actual Claude Code SDK execution
 */

import { query } from '@anthropic-ai/claude-code'
import createServerClient from '@/lib/supabase/server'
import { SubagentArtifact } from '../workflow/subagent-workflow-manager'

export interface ClaudeCodeExecutionOptions {
  maxTurns?: number
  timeout?: number
  tools?: string[]
  preserveContext?: boolean
  workingDirectory?: string
  subagentRole?: string
}

export interface ClaudeCodeExecutionResult {
  response: string
  context: any
  artifacts: SubagentArtifact[]
  duration: number
  tokensUsed?: number
  success: boolean
  error?: string
  toolUse?: any[]
  filesModified?: string[]
}

export interface ClaudeCodeContext {
  sessionId: string
  workspaceId: string
  phase: number
  previousContext?: any
  requirements?: any[]
  specifications?: any[]
  artifacts?: SubagentArtifact[]
}

export class ClaudeCodeExecutor {
  private apiKey: string
  private defaultOptions: ClaudeCodeExecutionOptions

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.ANTHROPIC_API_KEY || ''
    this.defaultOptions = {
      maxTurns: 10,
      timeout: 120000, // 2 minutes
      preserveContext: true,
      tools: ['write-file', 'read-file', 'run-command', 'list-files']
    }
  }

  /**
   * Execute Claude Code SDK query with proper context and artifact handling
   */
  async executeQuery(
    prompt: string,
    context: ClaudeCodeContext,
    options: ClaudeCodeExecutionOptions = {}
  ): Promise<ClaudeCodeExecutionResult> {
    const startTime = Date.now()
    
    try {
      // Merge options with defaults
      const executionOptions = { ...this.defaultOptions, ...options }
      
      // Build enhanced prompt with context
      const enhancedPrompt = await this.buildContextualPrompt(prompt, context)
      
      console.log(`[CLAUDE EXECUTOR] Starting execution for session ${context.sessionId}`)
      console.log(`[CLAUDE EXECUTOR] Prompt length: ${enhancedPrompt.length} characters`)
      console.log(`[CLAUDE EXECUTOR] Max turns: ${executionOptions.maxTurns}`)
      
      // Prepare execution context
      const queryOptions = {
        maxTurns: executionOptions.maxTurns,
        timeout: executionOptions.timeout,
        tools: executionOptions.tools,
        workingDirectory: executionOptions.workingDirectory || process.cwd(),
        preserveContext: executionOptions.preserveContext
      }
      
      let fullResponse = ''
      let toolUse: any[] = []
      let filesModified: string[] = []
      
      // Execute Claude Code SDK query
      for await (const message of query(enhancedPrompt, queryOptions)) {
        console.log(`[CLAUDE EXECUTOR] Received message type: ${message.type}`)
        
        switch (message.type) {
          case 'text':
            fullResponse += message.content
            break
            
          case 'tool_use':
            toolUse.push(message)
            if (message.name === 'write-file' || message.name === 'edit-file') {
              filesModified.push(message.input?.path || 'unknown')
            }
            break
            
          case 'error':
            throw new Error(`Claude execution error: ${message.content}`)
            
          default:
            console.log(`[CLAUDE EXECUTOR] Unhandled message type: ${message.type}`)
        }
      }
      
      // Extract artifacts from the response and tool use
      const artifacts = await this.extractArtifacts(fullResponse, toolUse, context)
      
      // Store execution context for future use
      await this.storeExecutionContext(context, {
        response: fullResponse,
        artifacts,
        toolUse,
        executedAt: new Date().toISOString()
      })
      
      const duration = Date.now() - startTime
      
      console.log(`[CLAUDE EXECUTOR] Execution completed in ${duration}ms`)
      console.log(`[CLAUDE EXECUTOR] Response length: ${fullResponse.length} characters`)
      console.log(`[CLAUDE EXECUTOR] Artifacts extracted: ${artifacts.length}`)
      console.log(`[CLAUDE EXECUTOR] Files modified: ${filesModified.length}`)
      
      return {
        response: fullResponse,
        context: {
          lastExecuted: new Date().toISOString(),
          sessionId: context.sessionId,
          workspaceId: context.workspaceId,
          phase: context.phase,
          promptLength: enhancedPrompt.length,
          executionOptions
        },
        artifacts,
        duration,
        success: true,
        toolUse,
        filesModified
      }
      
    } catch (error) {
      const duration = Date.now() - startTime
      console.error(`[CLAUDE EXECUTOR] Execution failed:`, error)
      
      return {
        response: `Claude Code execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        context: {
          lastExecuted: new Date().toISOString(),
          sessionId: context.sessionId,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        artifacts: [],
        duration,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Build contextual prompt with session context, requirements, and artifacts
   */
  private async buildContextualPrompt(
    userPrompt: string,
    context: ClaudeCodeContext
  ): Promise<string> {
    let prompt = ''
    
    // Add session context
    prompt += `## Session Context\n`
    prompt += `- **Session ID**: ${context.sessionId}\n`
    prompt += `- **Workspace ID**: ${context.workspaceId}\n`
    prompt += `- **Current Phase**: ${context.phase}\n`
    prompt += `- **Date**: ${new Date().toISOString()}\n\n`
    
    // Add requirements context if available
    if (context.requirements && context.requirements.length > 0) {
      prompt += `## Current Requirements\n`
      context.requirements.forEach((req, index) => {
        prompt += `${index + 1}. **${req.type}**: ${req.description}\n`
        if (req.acceptance_criteria) {
          prompt += `   - Acceptance: ${req.acceptance_criteria}\n`
        }
      })
      prompt += '\n'
    }
    
    // Add specifications context if available
    if (context.specifications && context.specifications.length > 0) {
      prompt += `## Technical Specifications\n`
      context.specifications.forEach((spec, index) => {
        prompt += `${index + 1}. **${spec.category}**: ${spec.description}\n`
        if (spec.implementation_details) {
          prompt += `   - Implementation: ${spec.implementation_details}\n`
        }
      })
      prompt += '\n'
    }
    
    // Add artifact context if available
    if (context.artifacts && context.artifacts.length > 0) {
      prompt += `## Available Artifacts\n`
      const artifactsByType = new Map<string, SubagentArtifact[]>()
      
      context.artifacts.forEach(artifact => {
        const type = artifact.type
        if (!artifactsByType.has(type)) {
          artifactsByType.set(type, [])
        }
        artifactsByType.get(type)!.push(artifact)
      })
      
      for (const [type, artifacts] of artifactsByType) {
        prompt += `### ${type.charAt(0).toUpperCase() + type.slice(1)} Artifacts\n`
        artifacts.forEach((artifact, index) => {
          prompt += `${index + 1}. Created by @${artifact.metadata.agent} in Phase ${artifact.metadata.phase}\n`
          if (typeof artifact.content === 'string') {
            prompt += `   Content: ${artifact.content.substring(0, 200)}${artifact.content.length > 200 ? '...' : ''}\n`
          }
        })
      }
      prompt += '\n'
    }
    
    // Add previous context if available
    if (context.previousContext) {
      prompt += `## Previous Context\n`
      prompt += `${JSON.stringify(context.previousContext, null, 2)}\n\n`
    }
    
    // Add the main user prompt
    prompt += `## Current Request\n`
    prompt += userPrompt
    
    return prompt
  }

  /**
   * Extract artifacts from Claude's response and tool usage
   */
  private async extractArtifacts(
    response: string,
    toolUse: any[],
    context: ClaudeCodeContext
  ): Promise<SubagentArtifact[]> {
    const artifacts: SubagentArtifact[] = []
    
    // Extract artifacts from file operations
    toolUse.forEach(tool => {
      if (tool.name === 'write-file' || tool.name === 'edit-file') {
        artifacts.push({
          type: this.determineArtifactType(tool.input?.path || ''),
          content: {
            path: tool.input?.path,
            content: tool.input?.content,
            operation: tool.name
          },
          metadata: {
            phase: context.phase,
            agent: 'claude-code-executor',
            confidence: 0.9,
            createdAt: new Date().toISOString(),
            toolUse: tool
          }
        })
      }
    })
    
    // Extract structured artifacts from response text
    const codeBlocks = this.extractCodeBlocks(response)
    codeBlocks.forEach(block => {
      artifacts.push({
        type: 'code',
        content: {
          language: block.language,
          code: block.code,
          description: block.description
        },
        metadata: {
          phase: context.phase,
          agent: 'claude-code-executor',
          confidence: 0.8,
          extractedFromResponse: true
        }
      })
    })
    
    // Extract requirements or specifications if mentioned
    if (response.includes('requirement') || response.includes('specification')) {
      const extractedRequirements = this.extractRequirements(response)
      extractedRequirements.forEach(req => {
        artifacts.push({
          type: 'requirement',
          content: req,
          metadata: {
            phase: context.phase,
            agent: 'claude-code-executor',
            confidence: 0.7,
            extractedFromResponse: true
          }
        })
      })
    }
    
    return artifacts
  }

  /**
   * Determine artifact type based on file path or content
   */
  private determineArtifactType(path: string): 'code' | 'documentation' | 'specification' | 'requirement' | 'test' {
    const extension = path.split('.').pop()?.toLowerCase()
    
    switch (extension) {
      case 'ts':
      case 'tsx':
      case 'js':
      case 'jsx':
      case 'py':
      case 'java':
      case 'cpp':
      case 'c':
        return 'code'
      case 'md':
      case 'txt':
      case 'doc':
        return 'documentation'
      case 'test.ts':
      case 'test.js':
      case 'spec.ts':
      case 'spec.js':
        return 'test'
      default:
        return 'code'
    }
  }

  /**
   * Extract code blocks from response text
   */
  private extractCodeBlocks(response: string): Array<{
    language: string
    code: string
    description?: string
  }> {
    const codeBlocks: Array<{
      language: string
      code: string
      description?: string
    }> = []
    
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g
    let match
    
    while ((match = codeBlockRegex.exec(response)) !== null) {
      codeBlocks.push({
        language: match[1] || 'text',
        code: match[2].trim(),
        description: this.extractCodeDescription(response, match.index)
      })
    }
    
    return codeBlocks
  }

  /**
   * Extract code description from surrounding context
   */
  private extractCodeDescription(response: string, codeBlockIndex: number): string | undefined {
    const beforeCode = response.substring(Math.max(0, codeBlockIndex - 200), codeBlockIndex)
    const lines = beforeCode.split('\n')
    const lastLine = lines[lines.length - 1]?.trim()
    
    if (lastLine && lastLine.length > 10 && lastLine.length < 100) {
      return lastLine
    }
    
    return undefined
  }

  /**
   * Extract requirements from response text
   */
  private extractRequirements(response: string): any[] {
    const requirements: any[] = []
    
    // Simple pattern matching for requirements
    const requirementPatterns = [
      /(?:requirement|req)\s*:?\s*(.+)/gi,
      /(?:the system|application|app)\s+(?:must|should|shall)\s+(.+)/gi,
      /(?:user|users)\s+(?:can|should be able to|must be able to)\s+(.+)/gi
    ]
    
    requirementPatterns.forEach(pattern => {
      let match
      while ((match = pattern.exec(response)) !== null) {
        requirements.push({
          description: match[1].trim(),
          type: 'functional',
          extractedFrom: 'claude-response'
        })
      }
    })
    
    return requirements
  }

  /**
   * Store execution context for future reference
   */
  private async storeExecutionContext(
    context: ClaudeCodeContext,
    executionResult: any
  ): Promise<void> {
    try {
      const supabase = await createServerClient()
      
      const { error } = await supabase
        .from('claude_execution_contexts')
        .insert({
          session_id: context.sessionId,
          workspace_id: context.workspaceId,
          phase: context.phase,
          execution_result: executionResult,
          created_at: new Date().toISOString()
        })
      
      if (error) {
        console.error('[CLAUDE EXECUTOR] Failed to store execution context:', error)
      }
      
    } catch (error) {
      console.error('[CLAUDE EXECUTOR] Context storage error:', error)
    }
  }

  /**
   * Create streaming version of executeQuery for real-time updates
   */
  async* executeQueryStream(
    prompt: string,
    context: ClaudeCodeContext,
    options: ClaudeCodeExecutionOptions = {}
  ): AsyncGenerator<{
    type: 'text' | 'tool_use' | 'artifact' | 'error' | 'complete'
    content: any
  }> {
    try {
      const executionOptions = { ...this.defaultOptions, ...options }
      const enhancedPrompt = await this.buildContextualPrompt(prompt, context)
      
      const queryOptions = {
        maxTurns: executionOptions.maxTurns,
        timeout: executionOptions.timeout,
        tools: executionOptions.tools,
        workingDirectory: executionOptions.workingDirectory || process.cwd(),
        preserveContext: executionOptions.preserveContext
      }
      
      let fullResponse = ''
      let toolUse: any[] = []
      
      for await (const message of query(enhancedPrompt, queryOptions)) {
        switch (message.type) {
          case 'text':
            fullResponse += message.content
            yield { type: 'text', content: message.content }
            break
            
          case 'tool_use':
            toolUse.push(message)
            yield { type: 'tool_use', content: message }
            
            // Extract and yield artifacts from tool use
            if (message.name === 'write-file' || message.name === 'edit-file') {
              const artifact: SubagentArtifact = {
                type: this.determineArtifactType(message.input?.path || ''),
                content: {
                  path: message.input?.path,
                  content: message.input?.content,
                  operation: message.name
                },
                metadata: {
                  phase: context.phase,
                  agent: 'claude-code-executor',
                  confidence: 0.9,
                  createdAt: new Date().toISOString(),
                  toolUse: message
                }
              }
              yield { type: 'artifact', content: artifact }
            }
            break
            
          case 'error':
            yield { type: 'error', content: message.content }
            return
        }
      }
      
      // Final artifact extraction
      const artifacts = await this.extractArtifacts(fullResponse, toolUse, context)
      
      yield {
        type: 'complete',
        content: {
          response: fullResponse,
          artifacts,
          toolUse,
          duration: Date.now()
        }
      }
      
    } catch (error) {
      yield {
        type: 'error',
        content: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}