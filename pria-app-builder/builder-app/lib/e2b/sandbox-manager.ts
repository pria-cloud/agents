import { Sandbox } from 'e2b'

export interface SandboxConfig {
  template: string
  apiKey: string
  timeoutMs?: number
  metadata?: Record<string, any>
}

export interface SandboxEnvironment {
  id: string
  sandbox: Sandbox
  workingDirectory: string
  status: 'initializing' | 'ready' | 'error' | 'terminated'
  metadata: Record<string, any>
  createdAt: Date
  lastActivity: Date
}

export interface FileEvent {
  type: 'create' | 'modify' | 'delete'
  path: string
  content?: string
}

// Use global to persist singleton across Next.js hot reloads in development
declare global {
  var __E2BSandboxManager__: E2BSandboxManager | undefined
}

export class E2BSandboxManager {
  private static instance: E2BSandboxManager | null = null
  private sandboxes: Map<string, SandboxEnvironment> = new Map()
  private config: SandboxConfig
  private cleanupInterval: NodeJS.Timeout | null = null

  private constructor(config: SandboxConfig) {
    this.config = {
      template: 'nodejs',
      timeoutMs: 1800000, // 30 minutes
      ...config
    }

    console.log('[SANDBOX MANAGER] Initialized with template:', this.config.template)

    // Cleanup inactive sandboxes every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveSandboxes()
    }, 5 * 60 * 1000)
  }

  /**
   * Get singleton instance of E2BSandboxManager
   * This ensures cache is shared across all API calls and persists across Next.js hot reloads
   */
  public static getInstance(config?: SandboxConfig): E2BSandboxManager {
    // In development, try to use global instance to persist across hot reloads
    if (process.env.NODE_ENV === 'development' && globalThis.__E2BSandboxManager__) {
      E2BSandboxManager.instance = globalThis.__E2BSandboxManager__
      
      // Update config if provided
      if (config) {
        console.log('[SANDBOX MANAGER] Updating config for existing global singleton instance')
        E2BSandboxManager.instance.config = {
          ...E2BSandboxManager.instance.config,
          ...config
        }
      }
      return E2BSandboxManager.instance
    }
    
    if (!E2BSandboxManager.instance) {
      if (!config) {
        throw new Error('E2BSandboxManager config is required for first initialization')
      }
      console.log('[SANDBOX MANAGER] Creating singleton instance')
      E2BSandboxManager.instance = new E2BSandboxManager(config)
      
      // Store in global for development persistence
      if (process.env.NODE_ENV === 'development') {
        globalThis.__E2BSandboxManager__ = E2BSandboxManager.instance
      }
    } else if (config) {
      // Update config if provided (but keep existing instance)
      console.log('[SANDBOX MANAGER] Updating config for existing singleton instance')
      E2BSandboxManager.instance.config = {
        ...E2BSandboxManager.instance.config,
        ...config
      }
    }
    return E2BSandboxManager.instance
  }

  /**
   * Reset singleton instance (useful for testing)
   */
  public static resetInstance(): void {
    if (E2BSandboxManager.instance) {
      E2BSandboxManager.instance.cleanup()
      E2BSandboxManager.instance = null
    }
    
    // Also clear global in development
    if (process.env.NODE_ENV === 'development') {
      globalThis.__E2BSandboxManager__ = undefined
    }
  }

  async createSandbox(sessionId: string, metadata: Record<string, any> = {}): Promise<SandboxEnvironment> {
    console.log(`[SANDBOX MANAGER] createSandbox called for session: ${sessionId}`)
    console.log(`[SANDBOX MANAGER] Input metadata:`, metadata)
    
    try {
      // Check if sandbox already exists
      const existing = this.sandboxes.get(sessionId)
      if (existing && existing.status !== 'terminated') {
        console.log(`[SANDBOX MANAGER] Existing sandbox found in cache:`, existing.id)
        existing.lastActivity = new Date()
        return existing
      }

      // Create new sandbox using corrected SDK syntax
      console.log(`[SANDBOX MANAGER] Creating sandbox with template: ${this.config.template}`)
      console.log(`[SANDBOX MANAGER] Preparing sandbox metadata...`)
      
      const stringMetadata: Record<string, string> = {
        sessionId,
        purpose: 'pria-app-development'
      }
      
      // Convert all metadata values to strings
      for (const [key, value] of Object.entries(metadata)) {
        stringMetadata[key] = String(value)
      }
      
      console.log(`[SANDBOX MANAGER] Creating E2B sandbox with config:`, {
        template: this.config.template,
        timeoutMs: this.config.timeoutMs,
        metadata: stringMetadata
      })
      
      // Use correct E2B SDK syntax: template ID as first parameter, options as second
      // Pass ANTHROPIC_API_KEY as environment variable to the sandbox
      const sandbox = await Sandbox.create(this.config.template, {
        apiKey: this.config.apiKey,
        timeoutMs: this.config.timeoutMs,
        metadata: stringMetadata,
        envs: {
          ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || ''
        }
      })
      
      console.log(`[SANDBOX MANAGER] E2B sandbox created successfully with ID: ${sandbox.id}`)
      console.log(`[SANDBOX MANAGER] Alternative sandbox ID: ${sandbox.sandboxId}`)

      console.log('Sandbox object structure:', Object.keys(sandbox))
      
      // First, let's see what directories are available and test basic commands
      try {
        const pwdResult = await sandbox.commands.run('pwd')
        console.log('Current directory:', pwdResult.stdout)
        
        const lsResult = await sandbox.commands.run('ls -la /')
        console.log('Root directory contents:', lsResult.stdout)
        
        const homeResult = await sandbox.commands.run('ls -la ~')
        console.log('Home directory contents:', homeResult.stdout)
      } catch (error) {
        console.log('Failed to run basic commands:', error)
      }
      
      // Use a safer working directory in the user's home or a writable location  
      const workingDirectory = `/home/user/session-${sessionId}`
      console.log('Using working directory:', workingDirectory)
      
      // Set up working directory using commands API with better error handling
      try {
        const mkdirResult = await sandbox.commands.run(`mkdir -p "${workingDirectory}"`)
        console.log('mkdir result:', mkdirResult)
      } catch (error) {
        console.error('Failed to create working directory:', error)
        if (error.result) {
          console.error('Command stdout:', error.result.stdout)
          console.error('Command stderr:', error.result.stderr)
          console.error('Command exitCode:', error.result.exitCode)
        }
        throw error
      }
      
      // Verify the template setup (PRIA custom template includes all necessary files)
      console.log(`[SANDBOX MANAGER] Verifying template setup for: ${this.config.template}`)
      
      try {
        // Check Node.js version to confirm custom template is working
        const nodeResult = await sandbox.commands.run('node --version', { timeout: 10000 })
        const nodeVersion = nodeResult.stdout.trim()
        console.log(`[SANDBOX MANAGER] Node.js version: ${nodeVersion}`)
        
        // Check if PRIA template files are available
        const priaCheck = await sandbox.commands.run('ls -la /home/user/template/ 2>/dev/null | wc -l', { timeout: 10000 })
        const priaFileCount = parseInt(priaCheck.stdout.trim()) || 0
        console.log(`[SANDBOX MANAGER] PRIA template files: ${priaFileCount}`)
        
        if (nodeVersion.startsWith('v22.') && priaFileCount > 5) {
          console.log(`[SANDBOX MANAGER] ✅ Custom PRIA template confirmed - Node.js v22 + ${priaFileCount} PRIA files`)
        } else {
          console.log(`[SANDBOX MANAGER] ⚠️  Using base template - Node.js ${nodeVersion}, ${priaFileCount} PRIA files`)
        }
        
      } catch (error) {
        console.log(`[SANDBOX MANAGER] Could not verify template setup:`, error.message)
      }

      const environment: SandboxEnvironment = {
        id: sessionId,
        sandbox,
        workingDirectory,
        status: 'ready',
        metadata: { ...metadata, sandboxId: sandbox.sandboxId || sandbox.id },
        createdAt: new Date(),
        lastActivity: new Date()
      }

      // Store sandbox ID in database for persistence
      try {
        const { createClient } = await import('@supabase/supabase-js')
        const serviceSupabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          {
            db: {
              schema: 'app_builder'
            }
          }
        )

        // First get existing session to preserve metadata
        const { data: existingSession } = await serviceSupabase
          .from('sessions')
          .select('metadata')
          .eq('id', sessionId)
          .single()
        
        const { data: updateResult, error: updateError } = await serviceSupabase
          .from('sessions')
          .update({
            e2b_sandbox_id: sandbox.sandboxId || sandbox.id,
            target_directory: workingDirectory, // Already absolute path now
            metadata: {
              ...existingSession?.metadata, // Preserve existing metadata
              ...metadata,
              template: this.config.template, // Store current template ID
              sandbox_status: 'ready',
              created_at: new Date().toISOString()
            }
          })
          .eq('id', sessionId)
          .select()

        if (updateError) {
          console.error('Failed to store sandbox ID in database - Error details:', {
            code: updateError.code,
            message: updateError.message,
            details: updateError.details,
            hint: updateError.hint
          })
          throw updateError
        }

        console.log(`Successfully stored sandbox ID ${sandbox.sandboxId || sandbox.id} in database for session ${sessionId}`)
        console.log(`Database update result:`, updateResult)
      } catch (error) {
        console.error('Failed to store sandbox ID in database - Full error:', JSON.stringify(error, null, 2))
        console.error('Error type:', typeof error)
        console.error('Error constructor:', error?.constructor?.name)
        if (error instanceof Error) {
          console.error('Error message:', error.message)
          console.error('Error stack:', error.stack)
        }
        // Don't fail the sandbox creation if database update fails
      }

      this.sandboxes.set(sessionId, environment)
      return environment

    } catch (error) {
      console.error('Failed to create sandbox:', error)
      
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
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          db: {
            schema: 'app_builder'
          }
        }
      )

      console.log(`[SANDBOX MANAGER] Querying database for session data for session: ${sessionId}`)
      const { data: session, error: queryError } = await serviceSupabase
        .from('sessions')
        .select('e2b_sandbox_id, target_directory, metadata, workspace_id')
        .eq('id', sessionId)
        .single()

      console.log(`[SANDBOX MANAGER] Database session data:`, session)
      if (queryError) {
        console.error(`[SANDBOX MANAGER] Database query error:`, queryError)
        
        // Try to see if session exists at all
        const { data: allSessions } = await serviceSupabase
          .from('sessions')
          .select('id, workspace_id, e2b_sandbox_id')
          .limit(5)
        console.log(`[SANDBOX MANAGER] Sample sessions in database:`, allSessions)
      }
      const sandboxId = session?.e2b_sandbox_id
      const workingDirectory = session?.target_directory

      if (sandboxId) {
        console.log(`[SANDBOX MANAGER] Found existing sandbox ID in database: ${sandboxId}`)
        console.log(`[SANDBOX MANAGER] Attempting to reconnect to sandbox...`)
        
        // Reconnect to sandbox using E2B SDK
        const sandbox = await Sandbox.connect(sandboxId)
        console.log(`[SANDBOX MANAGER] Sandbox reconnection successful`)
        
        // Create environment object and add to cache
        environment = {
          id: sandboxId,
          sandbox,
          workingDirectory: workingDirectory || `/home/user/session-${sessionId}`,
          status: 'ready',
          metadata: session?.metadata || {},
          createdAt: new Date(),
          lastActivity: new Date()
        }

        // Test if sandbox is still alive
        try {
          console.log(`[SANDBOX MANAGER] Testing sandbox connectivity...`)
          await sandbox.commands.run('echo "test"', { timeout: 5000 })
          this.sandboxes.set(sessionId, environment)
          console.log(`[SANDBOX MANAGER] Successfully reconnected to sandbox: ${sandboxId}`)
          return environment
        } catch (error) {
          console.warn(`[SANDBOX MANAGER] Sandbox ${sandboxId} appears to be dead, will create new one:`, error)
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
      console.log('Available sandbox methods:', Object.keys(environment.sandbox))
      
      // Check if sandbox has the expected commands API
      if (!environment.sandbox.commands) {
        throw new Error('Sandbox commands API not available')
      }
      
      // Expand ~ to home directory if present in cwd
      const cwd = options.cwd || environment.workingDirectory
      const expandedCwd = cwd.startsWith('~') 
        ? cwd.replace('~', '/home/user')
        : cwd
        
      // Use the correct commands API with extended timeout for Claude Code commands
      const isClaudeCommand = command.includes('/home/user/.npm-global/bin/claude')
      const timeout = isClaudeCommand ? 300000 : (options.timeout || 120000) // 5 minutes for Claude, 2 minutes for others
      
      console.log(`[SANDBOX MANAGER] Executing command with timeout: ${timeout}ms`)
      console.log(`[SANDBOX MANAGER] Is Claude command: ${isClaudeCommand}`)
      
      const result = await environment.sandbox.commands.run(command, {
        cwd: expandedCwd,
        env: options.env,
        timeout: timeout
      })

      return {
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        exitCode: result.exitCode || 0,
        duration: Date.now() - startTime
      }
    } catch (error) {
      console.error('Command execution error:', error)
      
      // Extract detailed error information
      let stderr = 'Command execution failed'
      let exitCode = 1
      
      if (error && typeof error === 'object') {
        if (error.result) {
          stderr = error.result.stderr || error.result.stdout || error.message || stderr
          exitCode = error.result.exitCode || exitCode
          console.error('Detailed error - stdout:', error.result.stdout)
          console.error('Detailed error - stderr:', error.result.stderr)
          console.error('Detailed error - exitCode:', error.result.exitCode)
        } else if (error.message) {
          stderr = error.message
        }
      }
      
      return {
        stdout: '',
        stderr,
        exitCode,
        duration: Date.now() - startTime
      }
    }
  }

  async writeFile(sessionId: string, filePath: string, content: string): Promise<void> {
    const environment = await this.getSandbox(sessionId)
    if (!environment || environment.status !== 'ready') {
      throw new Error('Sandbox not available')
    }

    const fullPath = filePath.startsWith('/') ? filePath : `${environment.workingDirectory}/${filePath}`
    
    // Expand ~ to home directory if present
    const expandedPath = fullPath.startsWith('~') 
      ? fullPath.replace('~', '/home/user')
      : fullPath
    
    // Use cat command to write file since filesystem API may not be available
    const writeCommand = `cat > "${expandedPath}" << 'EOF'\n${content}\nEOF`
    await environment.sandbox.commands.run(writeCommand, {
      cwd: environment.workingDirectory
    })
  }

  async readFile(sessionId: string, filePath: string): Promise<string> {
    const environment = await this.getSandbox(sessionId)
    if (!environment || environment.status !== 'ready') {
      throw new Error('Sandbox not available')
    }

    const fullPath = filePath.startsWith('/') ? filePath : `${environment.workingDirectory}/${filePath}`
    
    // Expand ~ to home directory if present
    const expandedPath = fullPath.startsWith('~') 
      ? fullPath.replace('~', '/home/user')
      : fullPath
    
    // Use cat command to read file since filesystem API is unavailable
    const catResult = await environment.sandbox.commands.run(`cat "${expandedPath}"`, {
      cwd: environment.workingDirectory
    })
    
    return catResult.stdout
  }

  async listFiles(sessionId: string, directory?: string): Promise<Array<{
    name: string
    path: string
    type: 'file' | 'directory'
    size?: number
  }>> {
    const environment = await this.getSandbox(sessionId)
    if (!environment || environment.status !== 'ready') {
      throw new Error('Sandbox not available')
    }

    const targetDir = directory || environment.workingDirectory
    
    // Expand ~ to home directory if present
    const expandedDir = targetDir.startsWith('~') 
      ? targetDir.replace('~', '/home/user')
      : targetDir
    
    // Use command-based approach to list files since filesystem API is unavailable
    const lsResult = await environment.sandbox.commands.run(`ls -la "${expandedDir}"`, {
      cwd: environment.workingDirectory
    })
    
    // Parse ls output to create file items
    const lines = lsResult.stdout.split('\n').filter(line => line.trim() && !line.startsWith('total'))
    const items = lines.map(line => {
      const parts = line.trim().split(/\s+/)
      const name = parts[parts.length - 1]
      const isDirectory = line.startsWith('d')
      return {
        name,
        isDirectory,
        size: isDirectory ? 0 : parseInt(parts[4]) || 0
      }
    }).filter(item => item.name !== '.' && item.name !== '..')
    
    return items.map(item => ({
      name: item.name,
      path: `${targetDir}/${item.name}`,
      type: item.isDirectory ? 'directory' : 'file',
      size: item.isDirectory ? undefined : item.size
    }))
  }

  async watchFiles(
    sessionId: string, 
    callback: (event: FileEvent) => void,
    directory?: string
  ): Promise<() => void> {
    const environment = await this.getSandbox(sessionId)
    if (!environment || environment.status !== 'ready') {
      throw new Error('Sandbox not available')
    }

    const targetDir = directory || environment.workingDirectory
    
    const watcher = await environment.sandbox.filesystem.watchDir(targetDir, {
      recursive: true,
      onChange: async (event) => {
        try {
          let content: string | undefined
          
          if (event.type !== 'delete') {
            try {
              content = await environment.sandbox.filesystem.read(event.path)
            } catch (error) {
              // File might be binary or not readable
              content = undefined
            }
          }

          callback({
            type: event.type as 'create' | 'modify' | 'delete',
            path: event.path,
            content
          })
        } catch (error) {
          console.error('File watcher error:', error)
        }
      }
    })

    return () => {
      watcher.close()
    }
  }

  async terminateSandbox(sessionId: string): Promise<void> {
    const environment = this.sandboxes.get(sessionId)
    if (environment && environment.sandbox) {
      try {
        await environment.sandbox.close()
      } catch (error) {
        console.error('Error closing sandbox:', error)
      }
      environment.status = 'terminated'
    }
    this.sandboxes.delete(sessionId)
  }

  async getProjectState(sessionId: string): Promise<{
    files: Array<{ name: string; path: string; type: 'file' | 'directory' }>
    packageJson?: any
    status: string
  }> {
    const environment = await this.getSandbox(sessionId)
    if (!environment || environment.status !== 'ready') {
      return { files: [], status: 'not_ready' }
    }

    try {
      const files = await this.listFiles(sessionId)
      
      let packageJson: any = undefined
      try {
        const packageContent = await this.readFile(sessionId, 'package.json')
        packageJson = JSON.parse(packageContent)
      } catch (error) {
        // package.json doesn't exist or is invalid
      }

      return {
        files: files.filter(f => !f.name.startsWith('.') && f.name !== 'node_modules'),
        packageJson,
        status: environment.status
      }
    } catch (error) {
      console.error('Failed to get project state:', error)
      return { files: [], status: 'error' }
    }
  }

  // Helper method to write files using commands since filesystem API is unavailable
  private async writeFileToSandbox(sandbox: Sandbox, filePath: string, content: string, workingDirectory: string): Promise<void> {
    console.log(`[SANDBOX MANAGER] Writing file: ${filePath} (${content.length} characters)`)
    try {
      // Use cat with here document to write file content
      const command = `cat > "${filePath}" << 'EOF'
${content}
EOF`
      
      const startTime = Date.now()
      await sandbox.commands.run(command, {
        cwd: workingDirectory,
        timeout: 15000 // 15 second timeout for file operations
      })
      const duration = Date.now() - startTime
      console.log(`[SANDBOX MANAGER] Successfully created file: ${filePath} (${duration}ms)`)
    } catch (error) {
      console.error(`[SANDBOX MANAGER] Failed to create file ${filePath}:`, error)
      if (error instanceof Error && error.message.includes('timeout')) {
        console.error(`[SANDBOX MANAGER] File creation timed out - this may indicate E2B performance issues`)
      }
      throw error
    }
  }

  private async initializePRIAProject(
    sandbox: Sandbox,
    workingDirectory: string,
    sessionId: string,
    metadata: Record<string, any>
  ): Promise<void> {
    try {
      console.log(`[SANDBOX MANAGER] Initializing PRIA project using template script`)
      
      // Extract project details from metadata
      const projectName = metadata.projectName || `pria-app-${sessionId.substring(0, 8)}`
      const workspaceId = metadata.workspaceId || 'default-workspace'
      
      // Set up environment variables for the initialization script
      const envVars = {
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
        PRIA_SESSION_ID: sessionId,
        PRIA_WORKSPACE_ID: workspaceId,
        PRIA_PROJECT_NAME: projectName
      }
      
      console.log(`[SANDBOX MANAGER] Project details:`, {
        projectName,
        workspaceId,
        sessionId,
        workingDirectory
      })
      
      // Check if the initialization script exists
      const scriptCheck = await sandbox.commands.run('ls -la /home/user/scripts/init-pria-project.sh')
      if (scriptCheck.exitCode !== 0) {
        throw new Error('PRIA initialization script not found in template')
      }
      console.log(`[SANDBOX MANAGER] PRIA initialization script found`)
      
      // Run the PRIA project initialization script
      const initCommand = `/home/user/scripts/init-pria-project.sh "${workingDirectory}" "${projectName}" "${workspaceId}" "${sessionId}"`
      console.log(`[SANDBOX MANAGER] Running init command:`, initCommand)
      
      const initResult = await sandbox.commands.run(initCommand, {
        env: envVars,
        timeout: 120000 // 2 minutes timeout for initialization
      })
      
      if (initResult.exitCode !== 0) {
        console.error(`[SANDBOX MANAGER] PRIA initialization failed:`)
        console.error(`stdout:`, initResult.stdout)
        console.error(`stderr:`, initResult.stderr)
        throw new Error(`PRIA initialization script failed with exit code ${initResult.exitCode}: ${initResult.stderr}`)
      }
      
      console.log(`[SANDBOX MANAGER] PRIA initialization script completed successfully`)
      console.log(`[SANDBOX MANAGER] Script output:`, initResult.stdout)
      
      // Verify the initialization was successful by checking for key files
      const verificationChecks = [
        'package.json',
        'TARGET_APP_SPECIFICATION.md', 
        '.pria/session-context.json',
        '.claude.json'
      ]
      
      for (const file of verificationChecks) {
        try {
          const checkResult = await sandbox.commands.run(`test -f "${workingDirectory}/${file}" && echo "✅ ${file} exists" || echo "❌ ${file} missing"`)
          console.log(`[SANDBOX MANAGER] Verification:`, checkResult.stdout.trim())
          
          if (checkResult.stdout.includes('missing')) {
            console.warn(`[SANDBOX MANAGER] Warning: Expected file ${file} was not created`)
          }
        } catch (error) {
          console.warn(`[SANDBOX MANAGER] Could not verify file ${file}:`, error.message)
        }
      }
      
      // List the final project structure
      try {
        const finalStructure = await sandbox.commands.run(`find "${workingDirectory}" -maxdepth 2 -type f | head -20`)
        console.log(`[SANDBOX MANAGER] Final project structure (first 20 files):`)
        console.log(finalStructure.stdout)
      } catch (error) {
        console.log(`[SANDBOX MANAGER] Could not list final project structure:`, error.message)
      }
      
    } catch (error) {
      console.error(`[SANDBOX MANAGER] PRIA project initialization failed:`, error)
      throw error
    }
  }

  private async initializeProjectStructure(
    sandbox: Sandbox, 
    workingDirectory: string, 
    sessionId: string
  ): Promise<void> {
    try {
      console.log('Creating minimal project structure for Claude Code SDK...')
      
      // Create only the most essential files for Next.js + Claude Code to work

      // Create base directory only
      console.log(`[SANDBOX MANAGER] Creating base directory: ${workingDirectory}`)
      await sandbox.commands.run(`mkdir -p "${workingDirectory}"`, { timeout: 10000 })

      // Create PRIA-compliant package.json
      const packageJson = {
        name: `pria-generated-app-${sessionId.slice(0, 8)}`,
        version: '0.1.0',
        private: true,
        scripts: {
          dev: 'next dev',
          build: 'next build',
          start: 'next start',
          lint: 'next lint',
          test: 'vitest',
          'test:ui': 'vitest --ui'
        },
        dependencies: {
          'next': '15.4.4',
          'react': '^19.0.0',
          'react-dom': '^19.0.0',
          '@supabase/ssr': '^0.6.1',
          '@supabase/supabase-js': '^2.48.0',
          '@anthropic-ai/claude-code': '^1.0.60',
          'lucide-react': '^0.468.0',
          'tailwindcss': '^3.4.0',
          'class-variance-authority': '^0.7.1',
          'clsx': '^2.1.1',
          'tailwind-merge': '^2.5.4'
        },
        devDependencies: {
          '@types/node': '^22.0.0',
          '@types/react': '^18.3.12',
          '@types/react-dom': '^18.3.1',
          'typescript': '^5.6.3',
          'eslint': '^8.57.1',
          'eslint-config-next': '15.4.4',
          'autoprefixer': '^10.4.20',
          'postcss': '^8.4.49',
          'vitest': '^2.1.5',
          '@testing-library/react': '^16.0.1',
          'jsdom': '^25.0.1',
          'tailwindcss-animate': '^1.0.7'
        }
      }

      // Create package.json using command-based approach
      console.log(`[SANDBOX MANAGER] Creating package.json...`)
      try {
        await this.writeFileToSandbox(
          sandbox,
          `${workingDirectory}/package.json`,
          JSON.stringify(packageJson, null, 2),
          workingDirectory
        )
        console.log(`[SANDBOX MANAGER] package.json created successfully`)
      } catch (error) {
        console.error('[SANDBOX MANAGER] Failed to create package.json:', error)
        // Don't throw - continue with other files
      }

      // Create TypeScript config
      const tsConfig = {
        compilerOptions: {
          lib: ['dom', 'dom.iterable', 'es6'],
          allowJs: true,
          skipLibCheck: true,
          strict: true,
          noEmit: true,
          esModuleInterop: true,
          module: 'esnext',
          moduleResolution: 'bundler',
          resolveJsonModule: true,
          isolatedModules: true,
          jsx: 'preserve',
          incremental: true,
          plugins: [
            {
              name: 'next'
            }
          ],
          baseUrl: '.',
          paths: {
            '@/*': ['./*']
          }
        },
        include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
        exclude: ['node_modules']
      }

      try {
        await this.writeFileToSandbox(
          sandbox,
          `${workingDirectory}/tsconfig.json`,
          JSON.stringify(tsConfig, null, 2),
          workingDirectory
        )
      } catch (error) {
        console.error('Failed to create tsconfig.json:', error)
      }

      // Create Tailwind config
      const tailwindConfig = `import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;

export default config;`

      try {
        await this.writeFileToSandbox(
          sandbox,
          `${workingDirectory}/tailwind.config.ts`,
          tailwindConfig,
          workingDirectory
        )
      } catch (error) {
        console.error('Failed to create tailwind.config.ts:', error)
      }

      // Create PostCSS config
      const postcssConfig = `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`

      try {
        await this.writeFileToSandbox(
          sandbox,
          `${workingDirectory}/postcss.config.js`,
          postcssConfig,
          workingDirectory
        )
      } catch (error) {
        console.error('Failed to create postcss.config.js:', error)
      }

      // Create next.config.js
      const nextConfig = `/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000", "*.vercel.app"],
    },
  },
}

module.exports = nextConfig`

      try {
        await this.writeFileToSandbox(
          sandbox,
          `${workingDirectory}/next.config.js`,
          nextConfig,
          workingDirectory
        )
      } catch (error) {
        console.error('Failed to create next.config.js:', error)
      }

      // Create Supabase client files
      await this.createSupabaseClients(sandbox, workingDirectory)
      
      // Create basic App Router structure
      await this.createAppRouterStructure(sandbox, workingDirectory)

      // Create middleware
      await this.createMiddleware(sandbox, workingDirectory)

      // Create utils
      await this.createUtils(sandbox, workingDirectory)

      // Create global styles
      await this.createGlobalStyles(sandbox, workingDirectory)

      // Create .gitignore
      const gitignore = `# Dependencies
node_modules/
.pnp
.pnp.js

# Production
/build
/dist
/.next/
/out/

# Environment variables
.env.local
.env.development.local
.env.test.local
.env.production.local

# Testing
/coverage

# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.pnpm-debug.log*

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Claude Code
.claude/`

      try {
        await this.writeFileToSandbox(
          sandbox,
          `${workingDirectory}/.gitignore`,
          gitignore,
          workingDirectory
        )
      } catch (error) {
        console.error('Failed to create .gitignore:', error)
      }

      // Install dependencies (optional - may fail in E2B environment)
      try {
        console.log('Installing npm dependencies...')
        // Use npm ci for faster, more reliable installs in sandbox
        const npmResult = await sandbox.commands.run('npm ci --silent', {
          cwd: workingDirectory
        })
        console.log('npm install completed successfully')
      } catch (error) {
        console.log('npm install failed, continuing without dependencies (expected in E2B environment)')
        // This is expected - we can continue without npm install
      }

      // Initialize Claude Code SDK manually by creating .claude directory
      try {
        console.log('Setting up Claude Code SDK structure...')
        
        // Create .claude directory structure
        await sandbox.commands.run(`mkdir -p "${workingDirectory}/.claude"`, {
          cwd: workingDirectory
        })
        
        // Create basic claude config
        const claudeConfig = {
          "version": "1.0",
          "name": `pria-generated-app-${sessionId.slice(0, 8)}`,
          "description": "PRIA generated Next.js application",
          "prompts": {},
          "tools": ["write-file", "read-file", "list-files", "run-command"]
        }
        
        await this.writeFileToSandbox(
          sandbox,
          `${workingDirectory}/.claude/config.json`,
          JSON.stringify(claudeConfig, null, 2),
          workingDirectory
        )
        
        console.log('Claude Code SDK structure created successfully')
      } catch (error) {
        console.error('Failed to setup Claude Code SDK structure:', error)
      }

    } catch (error) {
      console.error('Failed to initialize project structure:', error)
      // Don't throw here, let the sandbox continue even if initialization partially fails
    }
  }

  private async createSupabaseClients(sandbox: Sandbox, workingDirectory: string): Promise<void> {
    // lib/supabase/client.ts
    const clientTs = `import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}`

    try {
      await this.writeFileToSandbox(
        sandbox,
        `${workingDirectory}/lib/supabase/client.ts`,
        clientTs,
        workingDirectory
      )
    } catch (error) {
      console.error('Failed to create Supabase client.ts:', error)
    }

    // lib/supabase/server.ts
    const serverTs = `import { createServerClient as createSupabaseServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export default async function createServerClient() {
  const cookieStore = await cookies()
  
  return createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The \`setAll\` method was called from a Server Component.
          }
        },
      },
    }
  )
}`

    try {
      await this.writeFileToSandbox(
        sandbox,
        `${workingDirectory}/lib/supabase/server.ts`,
        serverTs,
        workingDirectory
      )
    } catch (error) {
      console.error('Failed to create Supabase server.ts:', error)
    }

    // lib/supabase/middleware.ts
    const middlewareTs = `import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Protected routes check
  const protectedPaths = ['/dashboard', '/admin', '/settings']
  const isProtectedPath = protectedPaths.some(path => 
    request.nextUrl.pathname.startsWith(path)
  )
  
  if (isProtectedPath) {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/login'
      redirectUrl.searchParams.set(\`redirectedFrom\`, request.nextUrl.pathname)
      return NextResponse.redirect(redirectUrl)
    }
  }

  return supabaseResponse
}`

    try {
      await this.writeFileToSandbox(
        sandbox,
        `${workingDirectory}/lib/supabase/middleware.ts`,
        middlewareTs,
        workingDirectory
      )
    } catch (error) {
      console.error('Failed to create Supabase middleware.ts:', error)
    }
  }

  private async createAppRouterStructure(sandbox: Sandbox, workingDirectory: string): Promise<void> {
    // app/layout.tsx
    const layoutTsx = `import './globals.css'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'PRIA Generated App',
  description: 'Generated with PRIA App Builder',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
      </body>
    </html>
  )
}`

    try {
      await this.writeFileToSandbox(
        sandbox,
        `${workingDirectory}/app/layout.tsx`,
        layoutTsx,
        workingDirectory
      )
    } catch (error) {
      console.error('Failed to create app/layout.tsx:', error)
    }

    // app/page.tsx
    const pageTsx = `export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex">
        <p className="fixed left-0 top-0 flex w-full justify-center border-b border-gray-300 bg-gradient-to-b from-zinc-200 pb-6 pt-8 backdrop-blur-2xl dark:border-neutral-800 dark:bg-zinc-800/30 dark:from-inherit lg:static lg:w-auto lg:rounded-xl lg:border lg:bg-gray-200 lg:p-4 lg:dark:bg-zinc-800/30">
          Welcome to your PRIA generated application!
        </p>
      </div>

      <div className="relative flex place-items-center before:absolute before:h-[300px] before:w-full sm:before:w-[480px] before:-translate-x-1/2 before:rounded-full before:bg-gradient-radial before:from-white before:to-transparent before:blur-2xl before:content-[''] after:absolute after:-z-20 after:h-[180px] after:w-full sm:after:w-[240px] after:translate-x-1/3 after:bg-gradient-conic after:from-sky-200 after:via-blue-200 after:blur-2xl after:content-[''] before:dark:bg-gradient-to-br before:dark:from-transparent before:dark:to-blue-700 before:dark:opacity-10 after:dark:from-sky-900 after:dark:via-[#0141ff] after:dark:opacity-40 before:lg:h-[360px] z-[-1]">
        <h1 className="text-4xl font-bold text-center">
          PRIA Generated App
        </h1>
      </div>

      <div className="mb-32 grid text-center lg:max-w-5xl lg:w-full lg:mb-0 lg:grid-cols-4 lg:text-left">
        <div className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30">
          <h2 className="mb-3 text-2xl font-semibold">
            Build{' '}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              -&gt;
            </span>
          </h2>
          <p className="m-0 max-w-[30ch] text-sm opacity-50">
            Build your application with Claude Code assistance.
          </p>
        </div>

        <div className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30">
          <h2 className="mb-3 text-2xl font-semibold">
            Learn{' '}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              -&gt;
            </span>
          </h2>
          <p className="m-0 max-w-[30ch] text-sm opacity-50">
            Learn about PRIA platform architecture and best practices.
          </p>
        </div>

        <div className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30">
          <h2 className="mb-3 text-2xl font-semibold">
            Deploy{' '}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              -&gt;
            </span>
          </h2>
          <p className="m-0 max-w-[30ch] text-sm opacity-50">
            Deploy your application instantly with Vercel integration.
          </p>
        </div>

        <div className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30">
          <h2 className="mb-3 text-2xl font-semibold">
            Scale{' '}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              -&gt;
            </span>
          </h2>
          <p className="m-0 max-w-[30ch] text-sm opacity-50">
            Scale with multi-tenant architecture and enterprise features.
          </p>
        </div>
      </div>
    </main>
  )
}`

    try {
      await this.writeFileToSandbox(
        sandbox,
        `${workingDirectory}/app/page.tsx`,
        pageTsx,
        workingDirectory
      )
    } catch (error) {
      console.error('Failed to create app/page.tsx:', error)
    }
  }

  private async createMiddleware(sandbox: Sandbox, workingDirectory: string): Promise<void> {
    const middlewareTs = `import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}`

    try {
      await this.writeFileToSandbox(
        sandbox,
        `${workingDirectory}/middleware.ts`,
        middlewareTs,
        workingDirectory
      )
    } catch (error) {
      console.error('Failed to create middleware.ts:', error)
    }
  }

  private async createUtils(sandbox: Sandbox, workingDirectory: string): Promise<void> {
    const utilsTs = `import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}`

    try {
      await this.writeFileToSandbox(
        sandbox,
        `${workingDirectory}/lib/utils/cn.ts`,
        utilsTs,
        workingDirectory
      )
    } catch (error) {
      console.error('Failed to create lib/utils/cn.ts:', error)
    }

    // Also create types directory
    const indexTs = `// Generated types for this PRIA application
export interface AppMetadata {
  workspace_id: string
  user_role: 'admin' | 'developer' | 'viewer'
}

export interface User {
  id: string
  email: string
  app_metadata: AppMetadata
}

export interface Workspace {
  id: string
  name: string
  owner_id: string
  created_at: string
  updated_at: string
}`

    try {
      await this.writeFileToSandbox(
        sandbox,
        `${workingDirectory}/lib/types/index.ts`,
        indexTs,
        workingDirectory
      )
    } catch (error) {
      console.error('Failed to create lib/types/index.ts:', error)
    }
  }

  private async createGlobalStyles(sandbox: Sandbox, workingDirectory: string): Promise<void> {
    const globalsCss = `@tailwind base;
@tailwind components;
@tailwind utilities;
 
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;

    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
 
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
 
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
 
    --secondary: 210 40% 96%;
    --secondary-foreground: 222.2 47.4% 11.2%;
 
    --muted: 210 40% 96%;
    --muted-foreground: 215.4 16.3% 46.9%;
 
    --accent: 210 40% 96%;
    --accent-foreground: 222.2 47.4% 11.2%;
 
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;

    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
 
    --radius: 0.5rem;
  }
 
  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
 
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
 
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
 
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
 
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
 
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
 
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
 
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
 
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
  }
}
 
@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}`

    try {
      await this.writeFileToSandbox(
        sandbox,
        `${workingDirectory}/app/globals.css`,
        globalsCss,
        workingDirectory
      )
    } catch (error) {
      console.error('Failed to create app/globals.css:', error)
    }
  }

  private cleanupInactiveSandboxes(): void {
    const now = new Date()
    const timeoutMs = this.config.timeoutMs || 1800000 // 30 minutes

    for (const [sessionId, environment] of this.sandboxes.entries()) {
      const inactiveTime = now.getTime() - environment.lastActivity.getTime()
      
      if (inactiveTime > timeoutMs) {
        console.log(`Cleaning up inactive sandbox for session ${sessionId}`)
        this.terminateSandbox(sessionId)
      }
    }
  }

  async cleanup(): Promise<void> {
    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    
    // Terminate all sandboxes
    const promises = Array.from(this.sandboxes.keys()).map(sessionId =>
      this.terminateSandbox(sessionId)
    )
    
    await Promise.allSettled(promises)
    this.sandboxes.clear()
  }

  getActiveSandboxes(): Array<{ sessionId: string; status: string; createdAt: Date; lastActivity: Date }> {
    return Array.from(this.sandboxes.entries()).map(([sessionId, env]) => ({
      sessionId,
      status: env.status,
      createdAt: env.createdAt,
      lastActivity: env.lastActivity
    }))
  }

}

// Export both named and default for backward compatibility
export default E2BSandboxManager