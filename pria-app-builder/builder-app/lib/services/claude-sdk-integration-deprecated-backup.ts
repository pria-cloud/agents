/**
 * Claude Code SDK Integration Service
 * Manages communication between Builder App and Claude Code SDK running in E2B sandboxes
 */

import { Sandbox } from 'e2b'
import { SupabaseClient } from '@supabase/supabase-js'

export interface ClaudeSDKConfig {
  templateId: string
  anthropicApiKey: string
  builderAppUrl: string
  timeoutMs?: number
}

export interface SessionContext {
  sessionId: string
  workspaceId: string
  currentPhase: number
  subagentRole: string
  requirements: any[]
  technicalSpecs: any
  tasks: any[]
  artifacts: Record<string, any>
}

export interface ClaudeSDKResponse {
  success: boolean
  message?: string
  artifacts?: string[]
  phase?: number
  progress?: number
  error?: string
  logs?: string[]
}

export class ClaudeSDKIntegrationService {
  private config: ClaudeSDKConfig
  private supabase: SupabaseClient
  private activeSandboxes: Map<string, Sandbox> = new Map()

  constructor(config: ClaudeSDKConfig, supabase: SupabaseClient) {
    this.config = config
    this.supabase = supabase
  }

  /**
   * Initialize a new Target App sandbox with Claude Code SDK
   */
  async initializeTargetApp(
    sessionId: string,
    workspaceId: string,
    initialContext: Partial<SessionContext>
  ): Promise<{ sandbox: Sandbox; sandboxId: string }> {
    try {
      // Create E2B sandbox with PRIA template
      const sandbox = await Sandbox.create(this.config.templateId, {
        timeoutMs: this.config.timeoutMs || 120000,
        metadata: {
          sessionId,
          workspaceId,
          type: 'pria-target-app',
          builderAppUrl: this.config.builderAppUrl
        }
      })

      this.activeSandboxes.set(sessionId, sandbox)

      // Set up environment variables
      await this.setupSandboxEnvironment(sandbox, sessionId, workspaceId)

      // Initialize PRIA context system
      await this.initializePRIAContext(sandbox, sessionId, workspaceId, initialContext)

      // Verify Claude Code SDK is working
      await this.verifyClaudeSDK(sandbox)

      return { sandbox, sandboxId: sandbox.id }

    } catch (error) {
      console.error('Failed to initialize Target App:', error)
      throw new Error(`Target App initialization failed: ${error}`)
    }
  }

  /**
   * Execute Claude Code SDK command in Target App
   */
  async executeClaudeCommand(
    sessionId: string,
    prompt: string,
    options: {
      maxTurns?: number
      subagentRole?: string
      contextFiles?: string[]
      artifacts?: string[]
    } = {}
  ): Promise<ClaudeSDKResponse> {
    const sandbox = this.activeSandboxes.get(sessionId)
    if (!sandbox) {
      throw new Error(`No active sandbox found for session ${sessionId}`)
    }

    try {
      // Update session context before execution
      await this.syncSessionContext(sandbox, sessionId)

      // Prepare Claude Code SDK command
      const claudeCommand = this.buildClaudeCommand(prompt, options)

      // Execute Claude Code SDK
      const result = await sandbox.process.startAndWait(claudeCommand, {
        timeout: 300000 // 5 minutes
      })

      // Parse and process results
      const response = await this.processClaudeResponse(sandbox, result, sessionId)

      // Update Builder App with progress
      await this.reportProgressToBuilder(sessionId, response)

      return response

    } catch (error) {
      console.error('Claude Code SDK execution failed:', error)
      return {
        success: false,
        error: `Claude execution failed: ${error}`
      }
    }
  }

  /**
   * Sync requirements and context from Builder App to Target App
   */
  async syncContextToTargetApp(
    sessionId: string,
    context: Partial<SessionContext>
  ): Promise<boolean> {
    const sandbox = this.activeSandboxes.get(sessionId)
    if (!sandbox) {
      throw new Error(`No active sandbox found for session ${sessionId}`)
    }

    try {
      // Update .pria context files
      if (context.requirements) {
        await sandbox.filesystem.writeTextFile(
          '.pria/requirements.json',
          JSON.stringify({
            lastSync: new Date().toISOString(),
            totalRequirements: context.requirements.length,
            requirements: context.requirements
          }, null, 2)
        )
      }

      if (context.technicalSpecs) {
        await sandbox.filesystem.writeTextFile(
          '.pria/technical-specs.json',
          JSON.stringify({
            lastUpdate: new Date().toISOString(),
            specifications: context.technicalSpecs
          }, null, 2)
        )
      }

      if (context.tasks) {
        await sandbox.filesystem.writeTextFile(
          '.pria/tasks.json',
          JSON.stringify({
            lastUpdate: new Date().toISOString(),
            totalTasks: context.tasks.length,
            tasks: context.tasks
          }, null, 2)
        )
      }

      // Update current phase context
      if (context.currentPhase && context.subagentRole) {
        await sandbox.filesystem.writeTextFile(
          '.pria/current-phase.json',
          JSON.stringify({
            phase: context.currentPhase,
            phaseName: this.getPhaseNameFromNumber(context.currentPhase),
            subagent: context.subagentRole,
            startTime: new Date().toISOString(),
            builderAppCallbacks: [
              `POST /api/workflow/${sessionId}/progress`,
              `POST /api/requirements/${sessionId}/updates`
            ]
          }, null, 2)
        )
      }

      // Update artifacts if provided
      if (context.artifacts) {
        await sandbox.filesystem.writeTextFile(
          '.pria/artifacts.json',
          JSON.stringify({
            lastUpdate: new Date().toISOString(),
            artifacts: context.artifacts
          }, null, 2)
        )
      }

      // Run sync script to ensure consistency
      await sandbox.process.startAndWait('node .pria/scripts/sync-with-builder.js')

      return true

    } catch (error) {
      console.error('Context sync failed:', error)
      return false
    }
  }

  /**
   * Get generated files from Target App
   */
  async getGeneratedFiles(sessionId: string): Promise<{
    files: Array<{ path: string; content: string; type: string }>
    timestamp: string
  }> {
    const sandbox = this.activeSandboxes.get(sessionId)
    if (!sandbox) {
      throw new Error(`No active sandbox found for session ${sessionId}`)
    }

    try {
      // Get list of generated files
      const result = await sandbox.process.startAndWait(
        'find . -type f -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.json" -o -name "*.md" | grep -v node_modules | head -50'
      )

      const filePaths = result.stdout.trim().split('\n').filter(path => path.length > 0)
      const files = []

      for (const filePath of filePaths) {
        try {
          const content = await sandbox.filesystem.readTextFile(filePath)
          const type = this.getFileType(filePath)
          
          files.push({
            path: filePath,
            content,
            type
          })
        } catch (error) {
          console.warn(`Failed to read file ${filePath}:`, error)
        }
      }

      return {
        files,
        timestamp: new Date().toISOString()
      }

    } catch (error) {
      console.error('Failed to get generated files:', error)
      throw error
    }
  }

  /**
   * Cleanup sandbox resources
   */
  async cleanupSession(sessionId: string): Promise<boolean> {
    try {
      const sandbox = this.activeSandboxes.get(sessionId)
      if (sandbox) {
        await sandbox.kill()
        this.activeSandboxes.delete(sessionId)
      }
      return true
    } catch (error) {
      console.error('Failed to cleanup session:', error)
      return false
    }
  }

  /**
   * Get active sandbox for session
   */
  getSandbox(sessionId: string): Sandbox | undefined {
    return this.activeSandboxes.get(sessionId)
  }

  /**
   * List all active sandboxes
   */
  getActiveSessions(): string[] {
    return Array.from(this.activeSandboxes.keys())
  }

  // Private helper methods

  private async setupSandboxEnvironment(
    sandbox: Sandbox,
    sessionId: string,
    workspaceId: string
  ): Promise<void> {
    // Set environment variables
    const envVars = [
      `export PRIA_SESSION_ID="${sessionId}"`,
      `export PRIA_WORKSPACE_ID="${workspaceId}"`,
      `export PRIA_BUILDER_APP_URL="${this.config.builderAppUrl}"`,
      `export ANTHROPIC_API_KEY="${this.config.anthropicApiKey}"`,
      `export NODE_ENV="development"`
    ]

    for (const envVar of envVars) {
      await sandbox.process.startAndWait(envVar)
    }

    // Make environment persistent
    await sandbox.filesystem.writeTextFile(
      '/home/user/.bashrc_pria',
      envVars.join('\n') + '\n'
    )

    await sandbox.process.startAndWait('echo "source /home/user/.bashrc_pria" >> /home/user/.bashrc')
  }

  private async initializePRIAContext(
    sandbox: Sandbox,
    sessionId: string,
    workspaceId: string,
    initialContext: Partial<SessionContext>
  ): Promise<void> {
    // Run PRIA initialization script
    const result = await sandbox.process.startAndWait('node .pria/scripts/init.js')
    
    if (result.exitCode !== 0) {
      throw new Error(`PRIA context initialization failed: ${result.stderr}`)
    }

    // Set up initial context if provided
    if (Object.keys(initialContext).length > 0) {
      await this.syncContextToTargetApp(sessionId, initialContext)
    }
  }

  private async verifyClaudeSDK(sandbox: Sandbox): Promise<void> {
    const result = await sandbox.process.startAndWait('claude --version')
    
    if (result.exitCode !== 0) {
      throw new Error(`Claude Code SDK not available: ${result.stderr}`)
    }
  }

  private buildClaudeCommand(
    prompt: string,
    options: {
      maxTurns?: number
      subagentRole?: string
      contextFiles?: string[]
      artifacts?: string[]
    }
  ): string {
    let command = 'claude'

    // Add context files if specified
    if (options.contextFiles) {
      for (const file of options.contextFiles) {
        command += ` --include "${file}"`
      }
    }

    // Add max turns if specified
    if (options.maxTurns) {
      command += ` --max-turns ${options.maxTurns}`
    }

    // Add the prompt
    command += ` "${prompt.replace(/"/g, '\\"')}"`

    return command
  }

  private async processClaudeResponse(
    sandbox: Sandbox,
    result: any,
    sessionId: string
  ): Promise<ClaudeSDKResponse> {
    if (result.exitCode !== 0) {
      return {
        success: false,
        error: result.stderr || 'Claude Code SDK execution failed',
        logs: [result.stdout, result.stderr].filter(Boolean)
      }
    }

    // Parse output for artifacts and progress
    const artifacts = await this.extractArtifacts(sandbox, result.stdout)
    const progress = this.extractProgress(result.stdout)

    return {
      success: true,
      message: result.stdout,
      artifacts: artifacts.map(a => a.path),
      progress,
      logs: [result.stdout]
    }
  }

  private async extractArtifacts(
    sandbox: Sandbox,
    output: string
  ): Promise<Array<{ path: string; type: string }>> {
    // Look for file creation patterns in Claude output
    const filePatterns = [
      /Created file: (.+)/g,
      /Updated file: (.+)/g,
      /Generated: (.+)/g,
      /Writing to (.+)/g
    ]

    const artifacts = []
    
    for (const pattern of filePatterns) {
      let match
      while ((match = pattern.exec(output)) !== null) {
        const filePath = match[1].trim()
        artifacts.push({
          path: filePath,
          type: this.getFileType(filePath)
        })
      }
    }

    return artifacts
  }

  private extractProgress(output: string): number {
    // Look for progress indicators in Claude output
    const progressMatch = output.match(/Progress: (\d+)%/)
    return progressMatch ? parseInt(progressMatch[1]) : 0
  }

  private async reportProgressToBuilder(
    sessionId: string,
    response: ClaudeSDKResponse
  ): Promise<void> {
    try {
      // Update session progress in database (if needed)
      // This could be expanded to send real-time updates to Builder App UI
      
      if (response.artifacts && response.artifacts.length > 0) {
        // Store artifact references in database
        const { error } = await this.supabase
          .from('workflow_artifacts')
          .upsert({
            session_id: sessionId,
            artifacts: response.artifacts,
            updated_at: new Date().toISOString()
          })

        if (error) {
          console.error('Failed to update artifacts:', error)
        }
      }
    } catch (error) {
      console.error('Failed to report progress:', error)
    }
  }

  private async syncSessionContext(sandbox: Sandbox, sessionId: string): Promise<void> {
    // Run sync script to get latest context from Builder App
    await sandbox.process.startAndWait('node .pria/scripts/sync-with-builder.js')
  }

  private getPhaseNameFromNumber(phase: number): string {
    const phaseNames = {
      1: 'Requirements Gathering',
      2: 'Architecture & Technical Design',
      3: 'Implementation Planning',
      4: 'Development & Implementation',
      5: 'Testing & Quality Assurance',
      6: 'Final Validation & Code Review',
      7: 'Deployment & Monitoring'
    }
    return phaseNames[phase as keyof typeof phaseNames] || 'Unknown Phase'
  }

  private getFileType(filePath: string): string {
    const extension = filePath.split('.').pop()?.toLowerCase()
    
    const typeMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript-react',
      'js': 'javascript',
      'jsx': 'javascript-react',
      'json': 'json',
      'md': 'markdown',
      'css': 'css',
      'html': 'html',
      'sql': 'sql'
    }

    return typeMap[extension || ''] || 'text'
  }
}