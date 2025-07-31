/**
 * Optimized E2B Sandbox Manager - Custom Template Approach
 * Relies on pre-configured PRIA custom template for fast initialization
 */

import { Sandbox } from 'e2b'
import { performanceMonitor } from '@/lib/monitoring/performance-monitor'
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

interface InitializationResult {
  success: boolean
  workingDirectory: string
  projectName: string
  templateVersion?: string
  errors?: string[]
  duration: number
}

export class OptimizedE2BSandboxManager {
  private sandboxes: Map<string, SandboxEnvironment> = new Map()
  private config: E2BSandboxConfig
  private cleanupInterval: NodeJS.Timeout

  constructor(config: Partial<E2BSandboxConfig> = {}) {
    // Use centralized template configuration
    this.config = {
      ...getE2BSandboxConfig(),
      ...config
    }
    
    // Log template configuration for debugging
    console.log(`[E2B] Using template: ${this.config.template} v${E2B_TEMPLATE_CONFIG.TEMPLATE_VERSION}`)

    // Cleanup inactive sandboxes every 10 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveSandboxes()
    }, 10 * 60 * 1000)
  }

  async createSandbox(sessionId: string, metadata: Record<string, any> = {}): Promise<SandboxEnvironment> {
    console.log(`[OPTIMIZED SANDBOX] Creating sandbox for session: ${sessionId}`)
    
    // Check if sandbox already exists
    const existing = this.sandboxes.get(sessionId)
    if (existing && existing.status !== 'terminated') {
      console.log(`[OPTIMIZED SANDBOX] Reusing existing sandbox: ${existing.id}`)
      existing.lastActivity = new Date()
      return existing
    }

    const metricId = performanceMonitor.startMetric(
      sessionId,
      metadata.workspaceId || 'unknown',
      'sandbox_operation',
      'create_sandbox'
    )

    try {
      // Create E2B sandbox from custom template
      const stringMetadata: Record<string, string> = {
        sessionId,
        purpose: 'pria-app-development',
        template: this.config.template
      }
      
      // Convert metadata to strings
      for (const [key, value] of Object.entries(metadata)) {
        stringMetadata[key] = String(value)
      }
      
      console.log(`[OPTIMIZED SANDBOX] Creating sandbox with custom template: ${this.config.template}`)
      const sandbox = await Sandbox.create({
        template: this.config.template,
        apiKey: this.config.apiKey,
        timeoutMs: this.config.timeoutMs,
        metadata: stringMetadata
      })
      
      console.log(`[OPTIMIZED SANDBOX] Sandbox created: ${sandbox.id}`)

      // Initialize PRIA project using optimized flow
      const initResult = await this.initializePRIAProject(sandbox, sessionId, metadata)
      
      if (!initResult.success) {
        throw new Error(`Project initialization failed: ${initResult.errors?.join(', ')}`)
      }

      // Create environment object
      const environment: SandboxEnvironment = {
        id: sessionId,
        sandbox,
        workingDirectory: initResult.workingDirectory,
        status: 'ready',
        metadata: {
          ...metadata,
          sandboxId: sandbox.id,
          projectName: initResult.projectName,
          templateVersion: initResult.templateVersion,
          initializationDuration: initResult.duration
        },
        createdAt: new Date(),
        lastActivity: new Date()
      }

      // Single database update with all information
      await this.updateSessionDatabase(sessionId, environment)

      this.sandboxes.set(sessionId, environment)
      
      performanceMonitor.finishMetric(metricId, true)
      console.log(`[OPTIMIZED SANDBOX] Sandbox ready: ${initResult.workingDirectory}`)
      
      return environment

    } catch (error) {
      console.error('[OPTIMIZED SANDBOX] Sandbox creation failed:', error)
      
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
      performanceMonitor.finishMetric(metricId, false, error instanceof Error ? error.message : 'Unknown error')
      throw error
    }
  }

  async getSandbox(sessionId: string): Promise<SandboxEnvironment | null> {
    // Check in-memory cache first
    let environment = this.sandboxes.get(sessionId)
    if (environment) {
      environment.lastActivity = new Date()
      return environment
    }

    // Check database for existing sandbox
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const serviceSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      const { data: session } = await serviceSupabase
        .from('sessions')
        .select('e2b_sandbox_id, target_directory, metadata')
        .eq('id', sessionId)
        .single()

      const sandboxId = session?.e2b_sandbox_id
      if (!sandboxId) return null

      console.log(`[OPTIMIZED SANDBOX] Reconnecting to sandbox: ${sandboxId}`)
      
      try {
        const sandbox = await Sandbox.reconnect(sandboxId)
        
        // Quick health check
        await sandbox.commands.run('echo "health_check"', { timeout: 5000 })
        
        environment = {
          id: sandboxId,
          sandbox,
          workingDirectory: session.target_directory || `~/session-${sessionId}`,
          status: 'ready',
          metadata: session.metadata || {},
          createdAt: new Date(),
          lastActivity: new Date()
        }

        this.sandboxes.set(sessionId, environment)
        console.log(`[OPTIMIZED SANDBOX] Successfully reconnected to sandbox: ${sandboxId}`)
        return environment
        
      } catch (reconnectError) {
        console.warn(`[OPTIMIZED SANDBOX] Sandbox ${sandboxId} is dead, clearing from database`)
        
        // Clear dead sandbox from database
        await serviceSupabase
          .from('sessions')
          .update({ 
            e2b_sandbox_id: null,
            metadata: { 
              ...session?.metadata, 
              sandbox_status: 'terminated',
              terminated_at: new Date().toISOString()
            }
          })
          .eq('id', sessionId)
      }
    } catch (error) {
      console.error('[OPTIMIZED SANDBOX] Error checking for existing sandbox:', error)
    }

    return null
  }

  async executeCommand(
    sessionId: string, 
    command: string, 
    options: { cwd?: string; env?: Record<string, string>; timeout?: number } = {}
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
      const result = await environment.sandbox.commands.run(command, {
        cwd: options.cwd || environment.workingDirectory,
        env: options.env,
        timeout: options.timeout || 30000
      })

      environment.lastActivity = new Date()
      
      return {
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        exitCode: result.exitCode || 0,
        duration: Date.now() - startTime
      }
    } catch (error) {
      console.error('[OPTIMIZED SANDBOX] Command execution failed:', error)
      throw error
    }
  }

  async getProjectState(sessionId: string): Promise<{
    files: Array<{ path: string; size: number; modified: string }>
    status: string
    projectInfo?: {
      name: string
      version: string
      dependencies: Record<string, string>
    }
  }> {
    const environment = await this.getSandbox(sessionId)
    if (!environment || environment.status !== 'ready') {
      return { files: [], status: 'unavailable' }
    }

    try {
      // Get file list
      const filesResult = await environment.sandbox.commands.run(
        `find "${environment.workingDirectory}" -type f -not -path "*/node_modules/*" -not -path "*/.git/*" -exec ls -la {} +`,
        { timeout: 10000 }
      )

      const files = filesResult.stdout.split('\n')
        .filter(line => line.trim())
        .map(line => {
          const parts = line.trim().split(/\s+/)
          if (parts.length < 9) return null
          
          return {
            path: parts[parts.length - 1],
            size: parseInt(parts[4]) || 0,
            modified: `${parts[5]} ${parts[6]} ${parts[7]}`
          }
        })
        .filter(Boolean) as Array<{ path: string; size: number; modified: string }>

      // Get project info from package.json if available
      let projectInfo: any = undefined
      try {
        const packageResult = await environment.sandbox.commands.run(
          `cat "${environment.workingDirectory}/package.json"`,
          { timeout: 5000 }
        )
        
        if (packageResult.exitCode === 0) {
          const packageJson = JSON.parse(packageResult.stdout)
          projectInfo = {
            name: packageJson.name,
            version: packageJson.version,
            dependencies: packageJson.dependencies || {}
          }
        }
      } catch (error) {
        // package.json doesn't exist or is invalid - not an error
      }

      return { files, status: 'ready', projectInfo }
      
    } catch (error) {
      console.error('[OPTIMIZED SANDBOX] Failed to get project state:', error)
      return { files: [], status: 'error' }
    }
  }

  async terminateSandbox(sessionId: string): Promise<void> {
    const environment = this.sandboxes.get(sessionId)
    if (environment?.sandbox) {
      console.log(`[OPTIMIZED SANDBOX] Terminating sandbox: ${sessionId}`)
      try {
        await environment.sandbox.close()
      } catch (error) {
        console.warn('[OPTIMIZED SANDBOX] Error closing sandbox:', error)
      }
    }
    this.sandboxes.delete(sessionId)
  }

  // Private methods

  private async initializePRIAProject(
    sandbox: Sandbox, 
    sessionId: string, 
    metadata: Record<string, any>
  ): Promise<InitializationResult> {
    const startTime = Date.now()
    const projectName = `pria-app-${sessionId.slice(0, 8)}`
    const workingDirectory = `~/projects/${projectName}`

    console.log(`[OPTIMIZED SANDBOX] Initializing PRIA project: ${projectName}`)

    try {
      // Single comprehensive initialization using custom template script
      // API key passed via environment for security
      const initCommand = [
        '/home/user/scripts/init-pria-project.sh',
        `"${workingDirectory}"`,
        `"${projectName}"`,
        `"${metadata.workspaceId || ''}"`,
        `"${sessionId}"`
      ].join(' ')

      console.log(`[OPTIMIZED SANDBOX] Running initialization script...`)
      const initResult = await sandbox.commands.run(initCommand, { 
        timeout: 90000, // 1.5 minutes - longer timeout for comprehensive setup
        cwd: '/home/user'
      })

      if (initResult.exitCode !== 0) {
        throw new Error(`Initialization script failed: ${initResult.stderr}`)
      }

      console.log(`[OPTIMIZED SANDBOX] Initialization completed successfully`)
      console.log(`[OPTIMIZED SANDBOX] Script output: ${initResult.stdout}`)

      // Verify the project was created successfully
      const verifyResult = await sandbox.commands.run(
        `test -f "${workingDirectory}/package.json" && test -f "${workingDirectory}/.claude.json" && echo "verification_passed"`,
        { timeout: 10000 }
      )

      if (!verifyResult.stdout.includes('verification_passed')) {
        throw new Error('Project verification failed - required files not found')
      }

      // Extract template version from initialization output if available
      const templateVersionMatch = initResult.stdout.match(/TEMPLATE_VERSION:(\S+)/)
      const templateVersion = templateVersionMatch?.[1] || 'unknown'

      return {
        success: true,
        workingDirectory,
        projectName,
        templateVersion,
        duration: Date.now() - startTime
      }

    } catch (error) {
      console.error('[OPTIMIZED SANDBOX] Project initialization failed:', error)
      
      return {
        success: false,
        workingDirectory: '',
        projectName,
        errors: [error instanceof Error ? error.message : 'Unknown initialization error'],
        duration: Date.now() - startTime
      }
    }
  }

  private async updateSessionDatabase(sessionId: string, environment: SandboxEnvironment): Promise<void> {
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const serviceSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      await serviceSupabase
        .from('sessions')
        .update({
          e2b_sandbox_id: environment.metadata.sandboxId,
          target_directory: environment.workingDirectory,
          metadata: {
            sandbox_status: 'ready',
            project_name: environment.metadata.projectName,
            template_version: environment.metadata.templateVersion,
            initialization_duration_ms: environment.metadata.initializationDuration,
            created_at: environment.createdAt.toISOString(),
            last_activity_at: environment.lastActivity.toISOString()
          }
        })
        .eq('id', sessionId)

      console.log(`[OPTIMIZED SANDBOX] Database updated for session: ${sessionId}`)
    } catch (error) {
      console.error('[OPTIMIZED SANDBOX] Failed to update database:', error)
      // Don't throw - database update failure shouldn't kill the sandbox
    }
  }

  private cleanupInactiveSandboxes(): void {
    const now = new Date()
    const maxInactiveTime = 45 * 60 * 1000 // 45 minutes

    for (const [sessionId, environment] of this.sandboxes.entries()) {
      if (now.getTime() - environment.lastActivity.getTime() > maxInactiveTime) {
        console.log(`[OPTIMIZED SANDBOX] Cleaning up inactive sandbox: ${sessionId}`)
        this.terminateSandbox(sessionId)
      }
    }
  }

  async cleanup(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    
    const promises = Array.from(this.sandboxes.keys()).map(sessionId =>
      this.terminateSandbox(sessionId)
    )
    
    await Promise.allSettled(promises)
    this.sandboxes.clear()
  }

  getActiveSandboxes(): Array<{
    sessionId: string
    status: string
    createdAt: Date
    lastActivity: Date
    projectName?: string
  }> {
    return Array.from(this.sandboxes.entries()).map(([sessionId, env]) => ({
      sessionId,
      status: env.status,
      createdAt: env.createdAt,
      lastActivity: env.lastActivity,
      projectName: env.metadata.projectName
    }))
  }
}