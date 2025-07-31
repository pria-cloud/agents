import { Sandbox } from 'e2b'
import { getUnifiedClaudeExecutor, UnifiedClaudeExecutor } from '@/lib/claude-sdk/unified-claude-executor'
import { getE2BSandboxConfig, getTemplateMetadata, E2B_TEMPLATE_CONFIG } from './template-config'

interface SandboxEnvironment {
  id: string
  sandbox: Sandbox
  workingDirectory: string
  status: 'creating' | 'ready' | 'error' | 'terminated'
  metadata: Record<string, any>
  createdAt: Date
  lastActivity: Date
}

interface E2BSandboxConfig {
  template: string
  apiKey: string
  timeoutMs?: number
}

export class E2BSandboxManager {
  private sandboxes: Map<string, SandboxEnvironment> = new Map()
  private config: E2BSandboxConfig
  private claudeExecutor: UnifiedClaudeExecutor

  constructor(config: Partial<E2BSandboxConfig> = {}) {
    // Use centralized template configuration
    this.config = {
      ...getE2BSandboxConfig(),
      ...config
    }
    
    // Log template configuration for debugging
    console.log(`[E2B] Using template: ${this.config.template} v${E2B_TEMPLATE_CONFIG.TEMPLATE_VERSION}`)

    // Initialize Claude Code SDK executor
    this.claudeExecutor = getUnifiedClaudeExecutor('/tmp') // Will be updated with actual project path

    // Cleanup inactive sandboxes every 5 minutes
    setInterval(() => {
      this.cleanupInactiveSandboxes()
    }, 5 * 60 * 1000)
  }

  async createSandbox(sessionId: string, metadata: Record<string, any> = {}): Promise<SandboxEnvironment> {
    console.log(`[SANDBOX MANAGER] createSandbox called for session: ${sessionId}`)
    
    try {
      // Check if sandbox already exists
      const existing = this.sandboxes.get(sessionId)
      if (existing && existing.status !== 'terminated') {
        console.log(`[SANDBOX MANAGER] Existing sandbox found in cache:`, existing.id)
        existing.lastActivity = new Date()
        return existing
      }

      // Create new E2B sandbox with minimal setup
      console.log(`[SANDBOX MANAGER] Creating new E2B sandbox...`)
      const stringMetadata: Record<string, string> = {
        sessionId,
        purpose: 'pria-app-development'
      }
      
      for (const [key, value] of Object.entries(metadata)) {
        stringMetadata[key] = String(value)
      }
      
      const sandbox = await Sandbox.create({
        template: this.config.template,
        apiKey: this.config.apiKey,
        timeoutMs: this.config.timeoutMs,
        metadata: {
          ...stringMetadata,
          ...getTemplateMetadata(sessionId, metadata.workspaceId || 'unknown')
        }
      })
      
      console.log(`[SANDBOX MANAGER] E2B sandbox created successfully with ID: ${sandbox.id}`)
      
      // Create minimal working directory
      const workingDirectory = `~/session-${sessionId}`
      console.log(`[SANDBOX MANAGER] Creating working directory: ${workingDirectory}`)
      
      await sandbox.commands.run(`mkdir -p "${workingDirectory}"`, { timeout: 10000 })
      
      // Verify custom template environment
      console.log(`[SANDBOX MANAGER] Verifying PRIA custom template environment...`)
      try {
        const envCheck = await sandbox.commands.run('/home/user/scripts/startup.sh', { timeout: 30000 })
        console.log(`[SANDBOX MANAGER] Environment check completed:`, envCheck.stdout)
        
        // Verify all tools are available
        const toolsCheck = await sandbox.commands.run('node --version && npm --version && claude --version && git --version && gh --version', { timeout: 10000 })
        console.log(`[SANDBOX MANAGER] All tools verified:`, toolsCheck.stdout)
      } catch (error) {
        console.error(`[SANDBOX MANAGER] Custom template verification failed:`, error)
        console.log(`[SANDBOX MANAGER] Falling back to manual installation...`)
        
        // Fallback installation if custom template fails
        try {
          await sandbox.commands.run('npm install -g @anthropic-ai/claude-code', {
            timeout: 120000
          })
          console.log(`[SANDBOX MANAGER] Fallback Claude Code installation completed`)
        } catch (fallbackError) {
          console.error(`[SANDBOX MANAGER] Fallback installation failed:`, fallbackError)
          throw new Error('Environment setup failed')
        }
      }

      // Initialize PRIA project using custom template scripts
      console.log(`[SANDBOX MANAGER] Initializing PRIA project using custom template...`)
      
      try {
        // Use our custom initialization script
        const projectName = `pria-app-${sessionId.slice(0, 8)}`
        const initResult = await sandbox.commands.run(
          `/home/user/scripts/init-pria-project.sh "${workingDirectory}/${projectName}" "" "${process.env.ANTHROPIC_API_KEY || ''}"`,
          { 
            timeout: 60000, // 1 minute timeout
            cwd: workingDirectory 
          }
        )
        
        console.log(`[SANDBOX MANAGER] PRIA project initialized:`, initResult.stdout)
        
        // Update working directory to the new project
        const newWorkingDirectory = `${workingDirectory}/${projectName}`
        
        // Update environment metadata
        const environment: SandboxEnvironment = {
          id: sessionId,
          sandbox,
          workingDirectory: newWorkingDirectory,
          status: 'ready',
          metadata: { 
            ...metadata, 
            sandboxId: sandbox.id,
            projectName,
            templateType: 'pria-custom'
          },
          createdAt: new Date(),
          lastActivity: new Date()
        }

        // Store updated info in database
        try {
          const { createClient } = await import('@supabase/supabase-js')
          const serviceSupabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          )

          await serviceSupabase
            .from('sessions')
            .update({
              e2b_sandbox_id: sandbox.id,
              target_directory: newWorkingDirectory,
              metadata: {
                ...metadata,
                sandbox_status: 'ready',
                project_name: projectName,
                template_type: 'pria-custom',
                created_at: new Date().toISOString()
              }
            })
            .eq('id', sessionId)

          console.log(`[SANDBOX MANAGER] Updated database with project info`)
        } catch (error) {
          console.error('[SANDBOX MANAGER] Failed to update database:', error)
        }

        this.sandboxes.set(sessionId, environment)
        console.log(`[SANDBOX MANAGER] PRIA project ready: ${newWorkingDirectory}`)
        return environment
        
      } catch (error) {
        console.error(`[SANDBOX MANAGER] Custom script initialization failed:`, error)
        console.log(`[SANDBOX MANAGER] Falling back to minimal setup...`)
        
        // Fallback to minimal setup
        const packageJson = {
          name: `pria-app-${sessionId.slice(0, 8)}`,
          version: '0.1.0',
          private: true,
          scripts: {
            dev: 'next dev',
            build: 'next build', 
            start: 'next start'
          },
          dependencies: {
            'next': '15.4.4',
            'react': '^19.0.0',
            'react-dom': '^19.0.0'
          }
        }

        await this.writeFile(
          sandbox,
          `${workingDirectory}/package.json`,
          JSON.stringify(packageJson, null, 2),
          workingDirectory
        )

        const claudeConfig = {
          "version": "1.0",
          "model": "claude-3-5-sonnet-20241022",
          "anthropic_api_key": process.env.ANTHROPIC_API_KEY || ""
        }

        await this.writeFile(
          sandbox,
          `${workingDirectory}/.claude.json`,
          JSON.stringify(claudeConfig, null, 2),
          workingDirectory
        )

        // Update working directory for fallback case
        const fallbackEnvironment: SandboxEnvironment = {
          id: sessionId,
          sandbox,
          workingDirectory,
          status: 'ready',
          metadata: { 
            ...metadata, 
            sandboxId: sandbox.id,
            projectName: `pria-app-${sessionId.slice(0, 8)}`,
            templateType: 'fallback'
          },
          createdAt: new Date(),
          lastActivity: new Date()
        }

        // Store fallback environment in database
        try {
          const { createClient } = await import('@supabase/supabase-js')
          const serviceSupabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          )

          await serviceSupabase
            .from('sessions')
            .update({
              e2b_sandbox_id: sandbox.id,
              target_directory: workingDirectory,
              metadata: {
                ...metadata,
                sandbox_status: 'ready',
                project_name: `pria-app-${sessionId.slice(0, 8)}`,
                template_type: 'fallback',
                created_at: new Date().toISOString()
              }
            })
            .eq('id', sessionId)

          console.log(`[SANDBOX MANAGER] Updated database with fallback project info`)
        } catch (error) {
          console.error('[SANDBOX MANAGER] Failed to update database:', error)
        }

        this.sandboxes.set(sessionId, fallbackEnvironment)
        console.log(`[SANDBOX MANAGER] Fallback PRIA project ready: ${workingDirectory}`)
        return fallbackEnvironment
      }

    } catch (error) {
      console.error('[SANDBOX MANAGER] Failed to create sandbox:', error)
      
      const errorEnvironment: SandboxEnvironment = {
        id: sessionId,
        sandbox: null as any,
        workingDirectory: '',
        status: 'error',
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
        createdAt: new Date(),
        lastActivity: new Date()
      }
      
      this.sandboxes.set(sessionId, errorEnvironment)
      throw error
    }
  }

  async getSandbox(sessionId: string): Promise<SandboxEnvironment | null> {
    console.log(`[SANDBOX MANAGER] getSandbox called for session: ${sessionId}`)
    
    // First check in-memory cache
    let environment = this.sandboxes.get(sessionId)
    if (environment) {
      console.log(`[SANDBOX MANAGER] Found environment in cache: ${environment.id}`)
      environment.lastActivity = new Date()
      return environment
    }

    console.log(`[SANDBOX MANAGER] No environment in cache, checking database...`)
    // If not in cache, check database for existing sandbox
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const serviceSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      console.log(`[SANDBOX MANAGER] Querying database for session data...`)
      const { data: session } = await serviceSupabase
        .from('sessions')
        .select('e2b_sandbox_id, target_directory, metadata')
        .eq('id', sessionId)
        .single()

      console.log(`[SANDBOX MANAGER] Database session data:`, session)
      const sandboxId = session?.e2b_sandbox_id
      const workingDirectory = session?.target_directory

      if (sandboxId) {
        console.log(`[SANDBOX MANAGER] Found existing sandbox ID in database: ${sandboxId}`)
        console.log(`[SANDBOX MANAGER] Attempting to reconnect to sandbox...`)
        
        try {
          // Reconnect to existing E2B sandbox
          const sandbox = await Sandbox.reconnect(sandboxId)
          console.log(`[SANDBOX MANAGER] Sandbox reconnection successful`)
          
          // Create environment object and add to cache
          environment = {
            id: sandboxId,
            sandbox,
            workingDirectory: workingDirectory || `~/session-${sessionId}`,
            status: 'ready',
            metadata: session?.metadata || {},
            createdAt: new Date(),
            lastActivity: new Date()
          }

          // Test if sandbox is still alive
          await sandbox.commands.run('echo "test"', { timeout: 5000 })
          this.sandboxes.set(sessionId, environment)
          console.log(`[SANDBOX MANAGER] Successfully reconnected to sandbox: ${sandboxId}`)
          return environment
        } catch (error) {
          console.warn(`[SANDBOX MANAGER] Sandbox ${sandboxId} appears to be dead:`, error)
          // Clear the dead sandbox from database
          await serviceSupabase
            .from('sessions')
            .update({
              e2b_sandbox_id: null,
              metadata: {
                ...session?.metadata,
                sandbox_status: 'terminated'
              }
            })
            .eq('id', sessionId)
        }
      } else {
        console.log(`[SANDBOX MANAGER] No existing sandbox ID found in database`)
      }
    } catch (error) {
      console.error('[SANDBOX MANAGER] Error checking for existing sandbox:', error)
    }

    console.log(`[SANDBOX MANAGER] No existing sandbox found, returning null`)
    return null
  }

  async executeCommand(
    sessionId: string, 
    command: string, 
    options: { cwd?: string; env?: Record<string, string> } = {}
  ): Promise<{
    stdout: string
    stderr: string
    exitCode: number
    duration: number
  }> {
    const environment = await this.getSandbox(sessionId)
    if (!environment || environment.status !== 'ready') {
      throw new Error('Sandbox not available')
    }

    const startTime = Date.now()
    
    try {
      console.log(`[SANDBOX MANAGER] Executing command: ${command}`)
      
      const result = await environment.sandbox.commands.run(command, {
        cwd: options.cwd || environment.workingDirectory,
        env: options.env,
        timeout: 30000 // 30 second timeout
      })

      return {
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        exitCode: result.exitCode || 0,
        duration: Date.now() - startTime
      }
    } catch (error) {
      console.error('[SANDBOX MANAGER] Command execution error:', error)
      throw error
    }
  }

  async executeClaudeCommand(
    sessionId: string,
    prompt: string,
    options: {
      workspaceId?: string
      phase?: number
      requirements?: any[]
      specifications?: any[]
      artifacts?: any[]
      maxTurns?: number
    } = {}
  ): Promise<{
    response: string
    duration: number
    artifacts?: any[]
    toolUse?: any[]
    filesModified?: string[]
  }> {
    const environment = await this.getSandbox(sessionId)
    if (!environment || environment.status !== 'ready') {
      throw new Error('Sandbox not available')
    }

    console.log(`[SANDBOX MANAGER] Executing Claude Code SDK query for session: ${sessionId}`)
    console.log(`[SANDBOX MANAGER] Prompt length: ${prompt.length} characters`)
    
    try {
      // Get workspace ID from session data if not provided
      let workspaceId = options.workspaceId
      if (!workspaceId) {
        try {
          const { createClient } = await import('@supabase/supabase-js')
          const serviceSupabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          )

          const { data: session } = await serviceSupabase
            .from('sessions')
            .select('workspace_id')
            .eq('id', sessionId)
            .single()

          workspaceId = session?.workspace_id
        } catch (error) {
          console.warn('[SANDBOX MANAGER] Failed to get workspace ID from session:', error)
          workspaceId = 'unknown'
        }
      }

      // Update executor with correct project path
      this.claudeExecutor = getUnifiedClaudeExecutor(environment.workingDirectory)

      // Execute using unified Claude Code SDK integration
      const executionResult = await this.claudeExecutor.executeQuery(
        prompt,
        {
          sessionId,
          workspaceId: workspaceId || 'unknown',
          phase: options.phase || 1,
          requirements: options.requirements,
          specifications: options.specifications,
          artifacts: options.artifacts,
          projectPath: environment.workingDirectory
        },
        {
          maxTurns: options.maxTurns || 10,
          timeout: 120000, // 2 minutes
          tools: ['write-file', 'read-file', 'run-command', 'list-files']
        }
      )

      console.log(`[SANDBOX MANAGER] Claude Code SDK execution completed`)
      console.log(`[SANDBOX MANAGER] Response length: ${executionResult.response.length} characters`)
      console.log(`[SANDBOX MANAGER] Artifacts generated: ${executionResult.artifacts.length}`)
      console.log(`[SANDBOX MANAGER] Files modified: ${executionResult.filesModified?.length || 0}`)

      return {
        response: executionResult.response,
        duration: executionResult.duration,
        artifacts: executionResult.artifacts,
        toolUse: executionResult.toolUse,
        filesModified: executionResult.filesModified
      }
    } catch (error) {
      console.error('[SANDBOX MANAGER] Claude Code SDK execution error:', error)
      throw new Error(`Claude Code SDK execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async getProjectState(sessionId: string): Promise<{
    files: Array<{ path: string; size: number; modified: string }>
    status: string
  }> {
    const environment = await this.getSandbox(sessionId)
    if (!environment || environment.status !== 'ready') {
      return { files: [], status: 'unavailable' }
    }

    try {
      const result = await environment.sandbox.commands.run(
        `find "${environment.workingDirectory}" -type f -exec ls -la {} + | grep -v node_modules`,
        { timeout: 10000 }
      )

      const files = result.stdout.split('\n')
        .filter(line => line.trim())
        .map(line => {
          const parts = line.split(/\s+/)
          const path = parts[parts.length - 1]
          const size = parseInt(parts[4]) || 0
          const modified = `${parts[5]} ${parts[6]} ${parts[7]}`
          return { path, size, modified }
        })

      return { files, status: 'ready' }
    } catch (error) {
      console.error('[SANDBOX MANAGER] Failed to get project state:', error)
      return { files: [], status: 'error' }
    }
  }

  private async writeFile(sandbox: Sandbox, filePath: string, content: string, workingDirectory: string): Promise<void> {
    console.log(`[SANDBOX MANAGER] Writing file: ${filePath} (${content.length} characters)`)
    try {
      const command = `cat > "${filePath}" << 'EOF'
${content}
EOF`
      
      const startTime = Date.now()
      await sandbox.commands.run(command, {
        cwd: workingDirectory,
        timeout: 10000 // 10 second timeout for file operations
      })
      const duration = Date.now() - startTime
      console.log(`[SANDBOX MANAGER] Successfully created file: ${filePath} (${duration}ms)`)
    } catch (error) {
      console.error(`[SANDBOX MANAGER] Failed to create file ${filePath}:`, error)
      throw error
    }
  }

  private cleanupInactiveSandboxes(): void {
    const now = new Date()
    const maxInactiveTime = 30 * 60 * 1000 // 30 minutes

    for (const [sessionId, environment] of this.sandboxes.entries()) {
      if (now.getTime() - environment.lastActivity.getTime() > maxInactiveTime) {
        console.log(`[SANDBOX MANAGER] Cleaning up inactive sandbox for session: ${sessionId}`)
        try {
          environment.sandbox?.close()
        } catch (error) {
          console.warn(`[SANDBOX MANAGER] Error closing sandbox:`, error)
        }
        this.sandboxes.delete(sessionId)
      }
    }
  }

  async terminateSandbox(sessionId: string): Promise<void> {
    const environment = this.sandboxes.get(sessionId)
    if (environment) {
      console.log(`[SANDBOX MANAGER] Terminating sandbox for session: ${sessionId}`)
      try {
        await environment.sandbox.close()
      } catch (error) {
        console.warn(`[SANDBOX MANAGER] Error closing sandbox:`, error)
      }
      this.sandboxes.delete(sessionId)
    }
  }
}