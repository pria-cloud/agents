/**
 * Claude Sandbox Executor
 * Executes Claude Code SDK commands INSIDE the E2B sandbox environment
 * This preserves all agent logic and Claude integration
 */

import { E2BSandboxManager } from './sandbox-manager'

export interface ClaudeSDKExecutionOptions {
  sessionId: string
  prompt: string
  subAgent?: string
  workingDirectory?: string
  maxTurns?: number
  timeout?: number
  preserveContext?: boolean
}

export interface ClaudeSDKExecutionResult {
  success: boolean
  response: string
  artifacts?: any[]
  error?: string
  duration: number
  messages?: any[]
}

export class ClaudeSandboxExecutor {
  private sandboxManager: E2BSandboxManager

  constructor(sandboxManager: E2BSandboxManager) {
    this.sandboxManager = sandboxManager
  }

  /**
   * Execute Claude Code SDK inside the E2B sandbox
   * This runs the actual Claude SDK where it's available
   */
  async executeClaudeInSandbox(options: ClaudeSDKExecutionOptions): Promise<ClaudeSDKExecutionResult> {
    const startTime = Date.now()
    
    try {
      // Get or create sandbox
      const environment = await this.sandboxManager.getSandbox(options.sessionId)
      if (!environment || environment.status !== 'ready') {
        throw new Error('Sandbox not available')
      }

      // Set up Claude Code authentication if not already configured
      console.log('[CLAUDE SANDBOX EXECUTOR] Setting up Claude Code authentication...')
      const apiKey = process.env.ANTHROPIC_API_KEY
      if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY environment variable is required but not set')
      }

      // Verify API key is valid and accessible
      console.log('[CLAUDE SANDBOX EXECUTOR] API key length:', apiKey.length)
      console.log('[CLAUDE SANDBOX EXECUTOR] API key prefix:', apiKey.substring(0, 15) + '...')

      // Check if Claude Code SDK is available globally in the E2B template
      console.log('[CLAUDE SANDBOX EXECUTOR] Checking for Claude Code SDK availability...')
      
      // First check what's in the npm global bin directory
      const lsResult = await this.sandboxManager.executeCommand(
        options.sessionId,
        'ls -la /home/user/.npm-global/bin/',
        {}
      )
      console.log('[CLAUDE SANDBOX EXECUTOR] NPM global bin contents:', lsResult.stdout)
      
      // Check if claude binary exists
      const whichResult = await this.sandboxManager.executeCommand(
        options.sessionId,
        'export PATH=/home/user/.npm-global/bin:$PATH && which claude || echo "claude not found in PATH"',
        {}
      )
      console.log('[CLAUDE SANDBOX EXECUTOR] Which claude result:', whichResult.stdout)
      
      // Try with full path
      const fullPath = '/home/user/.npm-global/bin/claude'
      console.log(`[CLAUDE SANDBOX EXECUTOR] Trying claude with full path: ${fullPath}`)
      const claudeCheckResult = await this.sandboxManager.executeCommand(
        options.sessionId,
        `${fullPath} --version`,
        {}
      )
      
      console.log('[CLAUDE SANDBOX EXECUTOR] Claude SDK check result:', claudeCheckResult.stdout.trim())
      
      if (claudeCheckResult.exitCode !== 0) {
        throw new Error(`Claude Code SDK CLI not available in E2B template. Template may need to be rebuilt with proper Claude SDK installation. Error: ${claudeCheckResult.stderr}`)
      }
      
      // Test environment variable setup
      const envTestResult = await this.sandboxManager.executeCommand(
        options.sessionId,
        `export ANTHROPIC_API_KEY="${apiKey}" && echo "Environment test: $ANTHROPIC_API_KEY" | head -c 50`,
        {}
      )

      console.log('[CLAUDE SANDBOX EXECUTOR] Environment test result:', envTestResult.stdout.trim())
      
      // Simple authentication test with detailed output  
      const authTestResult = await this.sandboxManager.executeCommand(
        options.sessionId,
        `export ANTHROPIC_API_KEY="${apiKey}" && echo "hello" | ${fullPath} -p 2>&1`,
        {}
      )

      console.log('[CLAUDE SANDBOX EXECUTOR] Auth test exit code:', authTestResult.exitCode)
      console.log('[CLAUDE SANDBOX EXECUTOR] Auth test output:', authTestResult.stdout.trim())
      if (authTestResult.stderr) {
        console.log('[CLAUDE SANDBOX EXECUTOR] Auth test stderr:', authTestResult.stderr.trim())
      }

      // Create a prompt file for Claude CLI
      const promptFilePath = `/tmp/claude-prompt-${Date.now()}.txt`
      let fullPrompt = options.prompt
      
      // Add subagent prefix if specified
      if (options.subAgent) {
        fullPrompt = `/use-agent ${options.subAgent}\n\n${options.prompt}`
      }
      
      await this.sandboxManager.writeFile(options.sessionId, promptFilePath, fullPrompt)
      
      // Execute Claude CLI with session context and resume flag for chat history
      const claudeBinary = '/home/user/.npm-global/bin/claude'
      const workingDir = options.workingDirectory || environment.workingDirectory
      
      // Ensure working directory exists and has proper Claude configuration
      await this.sandboxManager.executeCommand(options.sessionId, `mkdir -p "${workingDir}"`)
      
      // Check if this is the first message or if we should continue the conversation
      const isFirstMessage = await this.isFirstClaudeMessage(options.sessionId)
      
      // Check if we need to restore conversation context (returning user with previous messages)
      let restorationResult = { restored: false, method: 'none' as const, claudeSessionId: undefined as string | undefined }
      
      if (!isFirstMessage) {
        console.log('[CLAUDE SANDBOX EXECUTOR] Detected returning session - checking for context restoration')
        restorationResult = await this.restoreConversationContext(options.sessionId, workingDir, claudeBinary, apiKey)
      }
      
      let executeCommand: string
      if (isFirstMessage) {
        // First message - use -p with JSON output to capture session ID
        const claudeFlags = `-p --output-format json`
        executeCommand = `export ANTHROPIC_API_KEY="${apiKey}" && cd "${workingDir}" && ${claudeBinary} ${claudeFlags} < "${promptFilePath}"`
        console.log('[CLAUDE SANDBOX EXECUTOR] First message - using JSON output to capture session ID')
      } else if (restorationResult.restored && restorationResult.method === 'resume') {
        // Successfully resumed existing Claude session
        const claudeFlags = `-p --resume ${restorationResult.claudeSessionId}`
        executeCommand = `export ANTHROPIC_API_KEY="${apiKey}" && cd "${workingDir}" && ${claudeBinary} ${claudeFlags} < "${promptFilePath}"`
        console.log(`[CLAUDE SANDBOX EXECUTOR] Resuming restored Claude session: ${restorationResult.claudeSessionId}`)
      } else if (restorationResult.restored && restorationResult.method === 'replay') {
        // Context restored via conversation replay, continue with --continue
        const claudeFlags = `-p --continue`
        executeCommand = `export ANTHROPIC_API_KEY="${apiKey}" && cd "${workingDir}" && ${claudeBinary} ${claudeFlags} < "${promptFilePath}"`
        console.log('[CLAUDE SANDBOX EXECUTOR] Continuing conversation after context restoration via replay')
      } else {
        // Continue the most recent conversation in this working directory
        // NOTE: --continue automatically continues the most recent conversation in the current working directory
        // This works because each PRIA session has its own isolated working directory
        const claudeFlags = `-p --continue`
        executeCommand = `export ANTHROPIC_API_KEY="${apiKey}" && cd "${workingDir}" && ${claudeBinary} ${claudeFlags} < "${promptFilePath}"`
        console.log('[CLAUDE SANDBOX EXECUTOR] Continuing conversation with --continue flag')
      }
      
      console.log('[CLAUDE SANDBOX EXECUTOR] Executing command:', executeCommand)
      console.log('[CLAUDE SANDBOX EXECUTOR] Working directory:', workingDir)
      
      const result = await this.sandboxManager.executeCommand(
        options.sessionId,
        executeCommand,
        {}
      )
      
      // Clean up the prompt file
      await this.sandboxManager.executeCommand(options.sessionId, `rm -f "${promptFilePath}"`)
      
      // Parse the result from Claude CLI
      if (result.exitCode === 0) {
        let response = result.stdout || ''
        
        // If this was the first message with JSON output, extract the session ID and response
        if (isFirstMessage && response) {
          const { sessionId: claudeSessionId, content } = await this.parseClaudeJsonResponse(options.sessionId, response)
          response = content || response // Use extracted content or fall back to full response
          
          // Mark that we've had our first Claude interaction
          await this.markClaudeSessionStarted(options.sessionId, claudeSessionId, {
            restored: false,
            method: 'none'
          })
        } else if (restorationResult.restored) {
          // Update metadata with restoration info for subsequent messages
          await this.markClaudeSessionStarted(options.sessionId, restorationResult.claudeSessionId, {
            restored: restorationResult.restored,
            method: restorationResult.method,
            previousClaudeSessionId: restorationResult.method === 'resume' ? restorationResult.claudeSessionId : undefined
          })
        }
        
        return {
          success: true,
          response,
          artifacts: [], // CLI doesn't provide structured artifacts
          messages: [], // CLI doesn't provide message history
          duration: Date.now() - startTime
        }
      } else {
        return {
          success: false,
          response: '',
          error: result.stderr || result.stdout || 'Claude CLI execution failed',
          duration: Date.now() - startTime
        }
      }
      
    } catch (error) {
      console.error('[CLAUDE SANDBOX EXECUTOR] Execution failed:', error)
      return {
        success: false,
        response: '',
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      }
    }
  }


  /**
   * Execute Claude with sub-agent delegation
   */
  async executeWithSubAgent(
    sessionId: string,
    prompt: string,
    subAgentName: string,
    options?: Partial<ClaudeSDKExecutionOptions>
  ): Promise<ClaudeSDKExecutionResult> {
    return this.executeClaudeInSandbox({
      sessionId,
      prompt,
      subAgent: subAgentName,
      ...options
    })
  }

  /**
   * Check if this is the first Claude message for this session
   */
  private async isFirstClaudeMessage(sessionId: string): Promise<boolean> {
    try {
      const { createServiceClient } = await import('@/lib/supabase/service')
      const supabase = createServiceClient()
      
      const { data: session } = await supabase
        .from('sessions')
        .select('metadata')
        .eq('id', sessionId)
        .single()
      
      // If we don't have claude_session_started flag, this is the first message
      return !session?.metadata?.claude_session_started
    } catch (error) {
      console.error('[CLAUDE SANDBOX EXECUTOR] Failed to check if first message:', error)
      return true // Default to first message on error
    }
  }

  /**
   * Restore conversation context when returning to a session
   * This handles both Claude session resume and conversation replay
   */
  private async restoreConversationContext(sessionId: string, workingDir: string, claudeBinary: string, apiKey: string): Promise<{ restored: boolean, method: 'resume' | 'replay' | 'none', claudeSessionId?: string }> {
    try {
      console.log('[CLAUDE SANDBOX EXECUTOR] Attempting to restore conversation context...')
      
      const { createServiceClient } = await import('@/lib/supabase/service')
      const supabase = createServiceClient()
      
      // Get session metadata and previous messages
      const [sessionResult, messagesResult] = await Promise.all([
        supabase
          .from('sessions')
          .select('metadata, workspace_id')
          .eq('id', sessionId)
          .single(),
        supabase
          .from('chat_messages')
          .select('role, content, created_at, metadata')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true })
      ])
      
      const session = sessionResult.data
      const previousMessages = messagesResult.data || []
      
      if (!session || previousMessages.length === 0) {
        console.log('[CLAUDE SANDBOX EXECUTOR] No previous conversation to restore')
        return { restored: false, method: 'none' }
      }
      
      const claudeSessionId = session.metadata?.claude_session_id
      
      // Strategy 1: Try to resume existing Claude session
      if (claudeSessionId) {
        console.log(`[CLAUDE SANDBOX EXECUTOR] Attempting to resume Claude session: ${claudeSessionId}`)
        
        try {
          const testPrompt = 'Continue our conversation. What were we working on?'
          const testPromptPath = `/tmp/claude-test-resume-${Date.now()}.txt`
          await this.sandboxManager.writeFile(sessionId, testPromptPath, testPrompt)
          
          const resumeCommand = `export ANTHROPIC_API_KEY="${apiKey}" && cd "${workingDir}" && ${claudeBinary} -p --resume ${claudeSessionId} < "${testPromptPath}"`
          
          const resumeResult = await this.sandboxManager.executeCommand(sessionId, resumeCommand, {})
          
          // Clean up test file
          await this.sandboxManager.executeCommand(sessionId, `rm -f "${testPromptPath}"`)
          
          if (resumeResult.exitCode === 0) {
            console.log('[CLAUDE SANDBOX EXECUTOR] Successfully resumed Claude session')
            return { restored: true, method: 'resume', claudeSessionId }
          } else {
            console.log('[CLAUDE SANDBOX EXECUTOR] Claude session resume failed, trying replay method')
          }
        } catch (resumeError) {
          console.log('[CLAUDE SANDBOX EXECUTOR] Claude session resume failed:', resumeError)
        }
      }
      
      // Strategy 2: Replay conversation history to restore context
      console.log(`[CLAUDE SANDBOX EXECUTOR] Replaying ${previousMessages.length} messages to restore context`)
      
      try {
        // Create a conversation restoration prompt
        const conversationHistory = previousMessages
          .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
          .join('\n\n')
        
        const restorationPrompt = `I'm returning to a previous conversation. Here's our conversation history so far:

${conversationHistory}

Please acknowledge that you understand the context and are ready to continue our work. Briefly summarize what we were working on.`

        const restorationPath = `/tmp/claude-restore-${Date.now()}.txt`
        await this.sandboxManager.writeFile(sessionId, restorationPath, restorationPrompt)
        
        // Start fresh conversation with context restoration
        const restoreCommand = `export ANTHROPIC_API_KEY="${apiKey}" && cd "${workingDir}" && ${claudeBinary} -p --output-format json < "${restorationPath}"`
        
        const restoreResult = await this.sandboxManager.executeCommand(sessionId, restoreCommand, {})
        
        // Clean up restoration file
        await this.sandboxManager.executeCommand(sessionId, `rm -f "${restorationPath}"`)
        
        if (restoreResult.exitCode === 0) {
          // Parse the new Claude session ID from JSON response
          const { sessionId: newClaudeSessionId } = await this.parseClaudeJsonResponse(sessionId, restoreResult.stdout)
          
          console.log('[CLAUDE SANDBOX EXECUTOR] Successfully restored context via conversation replay')
          return { restored: true, method: 'replay', claudeSessionId: newClaudeSessionId || undefined }
        }
      } catch (replayError) {
        console.error('[CLAUDE SANDBOX EXECUTOR] Conversation replay failed:', replayError)
      }
      
      console.log('[CLAUDE SANDBOX EXECUTOR] Context restoration failed, will start fresh conversation')
      return { restored: false, method: 'none' }
      
    } catch (error) {
      console.error('[CLAUDE SANDBOX EXECUTOR] Error in conversation restoration:', error)
      return { restored: false, method: 'none' }
    }
  }

  /**
   * Parse Claude's JSON response to extract session ID and content
   */
  private async parseClaudeJsonResponse(sessionId: string, jsonResponse: string): Promise<{ sessionId: string | null, content: string | null }> {
    try {
      console.log('[CLAUDE SANDBOX EXECUTOR] Parsing Claude JSON response...')
      
      // Try to parse as JSON first
      const parsed = JSON.parse(jsonResponse)
      
      if (parsed.session_id && parsed.content) {
        console.log('[CLAUDE SANDBOX EXECUTOR] Extracted Claude session ID:', parsed.session_id)
        return {
          sessionId: parsed.session_id,
          content: parsed.content
        }
      }
      
      // If JSON doesn't have expected format, return the response as-is
      return {
        sessionId: null,
        content: jsonResponse
      }
      
    } catch (error) {
      console.log('[CLAUDE SANDBOX EXECUTOR] Response is not JSON, using as plain text')
      // Not JSON, return as plain content
      return {
        sessionId: null,
        content: jsonResponse
      }
    }
  }

  /**
   * Mark that we've started a Claude session and store the session ID
   */
  private async markClaudeSessionStarted(sessionId: string, claudeSessionId: string | null, restorationInfo?: {
    restored: boolean
    method: 'resume' | 'replay' | 'none'
    previousClaudeSessionId?: string
  }): Promise<void> {
    try {
      const { createServiceClient } = await import('@/lib/supabase/service')
      const supabase = createServiceClient()
      
      const { data: currentSession } = await supabase
        .from('sessions')
        .select('metadata')
        .eq('id', sessionId)
        .single()
      
      const updatedMetadata = {
        ...currentSession?.metadata,
        claude_session_started: true,
        claude_session_id: claudeSessionId,
        claude_first_message_at: currentSession?.metadata?.claude_first_message_at || new Date().toISOString(),
        claude_last_interaction_at: new Date().toISOString(),
        ...(restorationInfo && {
          claude_restoration: {
            restored: restorationInfo.restored,
            method: restorationInfo.method,
            restored_at: new Date().toISOString(),
            previous_claude_session_id: restorationInfo.previousClaudeSessionId
          }
        })
      }
      
      await supabase
        .from('sessions')
        .update({ metadata: updatedMetadata })
        .eq('id', sessionId)
      
      console.log('[CLAUDE SANDBOX EXECUTOR] Updated Claude session metadata:', {
        claudeSessionId,
        restored: restorationInfo?.restored,
        method: restorationInfo?.method
      })
      
    } catch (error) {
      console.error('[CLAUDE SANDBOX EXECUTOR] Failed to mark Claude session started:', error)
    }
  }
}

export default ClaudeSandboxExecutor