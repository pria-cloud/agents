import { Sandbox } from 'e2b'
import pino from 'pino'
import { supabase } from './supabase'
import { SandboxEventService } from './sandboxEventService'

const logger = pino({
  name: 'app-builder-claude-e2b',
  level: process.env.LOG_LEVEL || 'info',
})

export interface GeneratedFile {
  filePath: string
  content: string
  operation?: string
}

export interface E2BSandboxConfig {
  templateId: string
  teamId: string
  workspaceId: string
  conversationId: string
}

export interface SandboxInfo {
  sandboxId: string
  sandboxUrl: string
  status: 'creating' | 'ready' | 'failed'
  createdAt: string
}

export class E2BSandboxService {
  private readonly templateId: string
  private readonly teamId: string
  private readonly eventService: SandboxEventService

  constructor(templateId?: string, teamId?: string) {
    this.templateId = templateId || process.env.E2B_TEMPLATE_ID || 'bslm087lozmkvjz6nwle'
    this.teamId = teamId || process.env.E2B_TEAM_ID || 'd9ae965a-2a35-4a01-bc6e-6ff76faaa12c'
    this.eventService = new SandboxEventService()
    
    logger.info({
      event: 'e2b.service.init',
      templateId: this.templateId,
      teamId: this.teamId,
      usingEnvVars: {
        template: !!process.env.E2B_TEMPLATE_ID,
        team: !!process.env.E2B_TEAM_ID
      }
    }, 'E2B Sandbox Service initialized')
  }

  /**
   * Creates a new E2B sandbox and injects the generated files
   */
  async createSandbox(
    files: GeneratedFile[],
    dependencies: string[],
    config: E2BSandboxConfig
  ): Promise<SandboxInfo> {
    const startTime = Date.now()
    
    try {
      logger.info({ 
        event: 'e2b.sandbox.creating', 
        conversationId: config.conversationId,
        filesCount: files.length,
        templateId: this.templateId
      }, 'Creating E2B sandbox')

      // Broadcast sandbox creation started event
      await this.eventService.broadcastSandboxCreating(
        config.conversationId,
        config.workspaceId,
        'Creating live preview sandbox...'
      )

      // Create sandbox instance
      const sandbox = await Sandbox.create({
        template: this.templateId,
        timeoutMs: 300000, // 5 minutes timeout
      })

      const sandboxId = sandbox.sandboxId
      
      logger.info({ 
        event: 'e2b.sandbox.created', 
        sandboxId,
        conversationId: config.conversationId,
        creationTime: Date.now() - startTime
      }, 'E2B sandbox created')

      // Inject files into sandbox
      await this.injectFiles(sandbox, files)

      // Update package.json dependencies if needed
      await this.updateDependencies(sandbox, dependencies)

      // Install dependencies
      await this.installDependencies(sandbox)

      // Install shadcn components
      await this.installShadcnComponents(sandbox)

      // Start the development server
      await this.startDevServer(sandbox)

      const sandboxUrl = `https://${sandboxId}.e2b.dev`
      
      const sandboxInfo: SandboxInfo = {
        sandboxId,
        sandboxUrl,
        status: 'ready',
        createdAt: new Date().toISOString()
      }

      // Store sandbox info in Supabase
      await this.storeSandboxInfo(config, sandboxInfo)

      // Broadcast sandbox ready event
      await this.eventService.broadcastSandboxReady(
        config.conversationId,
        config.workspaceId,
        sandboxId,
        sandboxUrl,
        'Live preview ready'
      )

      logger.info({ 
        event: 'e2b.sandbox.ready', 
        sandboxId,
        sandboxUrl,
        conversationId: config.conversationId,
        totalTime: Date.now() - startTime
      }, 'E2B sandbox ready')

      return sandboxInfo

    } catch (error) {
      logger.error({ 
        event: 'e2b.sandbox.error', 
        error: error.message,
        conversationId: config.conversationId,
        templateId: this.templateId
      }, 'Failed to create E2B sandbox')

      // Broadcast sandbox failed event
      await this.eventService.broadcastSandboxFailed(
        config.conversationId,
        config.workspaceId,
        error.message,
        'Live preview creation failed'
      )

      throw new Error(`Failed to create E2B sandbox: ${error.message}`)
    }
  }

  /**
   * Injects generated files into the sandbox
   */
  private async injectFiles(sandbox: Sandbox, files: GeneratedFile[]): Promise<void> {
    logger.info({ 
      event: 'e2b.files.injecting', 
      filesCount: files.length,
      sandboxId: sandbox.sandboxId
    }, 'Injecting files into sandbox')

    for (const file of files) {
      try {
        // Ensure directory exists
        const dirPath = file.filePath.split('/').slice(0, -1).join('/')
        if (dirPath) {
          await sandbox.files.makeDir(dirPath)
        }

        // Write file content
        await sandbox.files.write(file.filePath, file.content)
        
        logger.debug({ 
          event: 'e2b.file.injected', 
          filePath: file.filePath,
          sandboxId: sandbox.sandboxId
        }, 'File injected')

      } catch (error) {
        logger.error({ 
          event: 'e2b.file.error', 
          filePath: file.filePath,
          error: error.message,
          sandboxId: sandbox.sandboxId
        }, 'Failed to inject file')
        
        // Continue with other files even if one fails
      }
    }
  }

  /**
   * Updates package.json with additional dependencies
   */
  private async updateDependencies(sandbox: Sandbox, dependencies: string[]): Promise<void> {
    if (dependencies.length === 0) return

    try {
      logger.info({ 
        event: 'e2b.dependencies.updating', 
        dependencies,
        sandboxId: sandbox.sandboxId
      }, 'Updating dependencies')

      // Read existing package.json
      const packageJsonContent = await sandbox.files.read('/code/package.json')
      const packageJson = JSON.parse(packageJsonContent)

      // Add new dependencies
      for (const dep of dependencies) {
        const [name, version] = dep.includes('@') ? dep.split('@') : [dep, 'latest']
        packageJson.dependencies[name] = version
      }

      // Write updated package.json
      await sandbox.files.write('/code/package.json', JSON.stringify(packageJson, null, 2))

    } catch (error) {
      logger.error({ 
        event: 'e2b.dependencies.error', 
        error: error.message,
        sandboxId: sandbox.sandboxId
      }, 'Failed to update dependencies')
    }
  }

  /**
   * Installs dependencies in the sandbox
   */
  private async installDependencies(sandbox: Sandbox): Promise<void> {
    try {
      logger.info({ 
        event: 'e2b.dependencies.installing', 
        sandboxId: sandbox.sandboxId
      }, 'Installing dependencies')

      const result = await sandbox.commands.run({
        cmd: 'npm install',
        cwd: '/code',
        timeout: 120000 // 2 minutes
      })

      if (result.exitCode !== 0) {
        logger.warn({ 
          event: 'e2b.dependencies.warning', 
          exitCode: result.exitCode,
          stderr: result.stderr,
          sandboxId: sandbox.sandboxId
        }, 'Dependencies installation completed with warnings')
      }

    } catch (error) {
      logger.error({ 
        event: 'e2b.dependencies.install.error', 
        error: error.message,
        sandboxId: sandbox.sandboxId
      }, 'Failed to install dependencies')
    }
  }

  /**
   * Installs all shadcn components
   */
  private async installShadcnComponents(sandbox: Sandbox): Promise<void> {
    try {
      logger.info({ 
        event: 'e2b.shadcn.installing', 
        sandboxId: sandbox.sandboxId
      }, 'Installing shadcn components')

      // Install all shadcn components
      const result = await sandbox.commands.run({
        cmd: 'npx shadcn@latest add --all --yes',
        cwd: '/code',
        timeout: 180000 // 3 minutes timeout
      })

      if (result.exitCode !== 0) {
        logger.warn({ 
          event: 'e2b.shadcn.warning', 
          exitCode: result.exitCode,
          stderr: result.stderr,
          sandboxId: sandbox.sandboxId
        }, 'Shadcn installation completed with warnings')
      }

    } catch (error) {
      logger.error({ 
        event: 'e2b.shadcn.error', 
        error: error.message,
        sandboxId: sandbox.sandboxId
      }, 'Failed to install shadcn components')
    }
  }

  /**
   * Starts the development server
   */
  private async startDevServer(sandbox: Sandbox): Promise<void> {
    try {
      logger.info({ 
        event: 'e2b.server.starting', 
        sandboxId: sandbox.sandboxId
      }, 'Starting development server')

      // Start dev server in background
      sandbox.commands.run({
        cmd: 'npm run dev',
        cwd: '/code',
        background: true
      })

      // Wait a bit for server to start
      await new Promise(resolve => setTimeout(resolve, 5000))

    } catch (error) {
      logger.error({ 
        event: 'e2b.server.error', 
        error: error.message,
        sandboxId: sandbox.sandboxId
      }, 'Failed to start development server')
    }
  }

  /**
   * Stores sandbox information in Supabase
   */
  private async storeSandboxInfo(config: E2BSandboxConfig, sandboxInfo: SandboxInfo): Promise<void> {
    try {
      const { error } = await supabase
        .from('sandbox_instances')
        .insert({
          workspace_id: config.workspaceId,
          conversation_id: config.conversationId,
          sandbox_id: sandboxInfo.sandboxId,
          sandbox_url: sandboxInfo.sandboxUrl,
          status: sandboxInfo.status,
          template_id: this.templateId,
          created_at: sandboxInfo.createdAt
        })

      if (error) {
        logger.error({ 
          event: 'e2b.storage.error', 
          error: error.message,
          sandboxId: sandboxInfo.sandboxId
        }, 'Failed to store sandbox info')
      }

    } catch (error) {
      logger.error({ 
        event: 'e2b.storage.error', 
        error: error.message,
        sandboxId: sandboxInfo.sandboxId
      }, 'Failed to store sandbox info')
    }
  }

  /**
   * Retrieves sandbox information from Supabase
   */
  async getSandboxInfo(conversationId: string, workspaceId: string): Promise<SandboxInfo | null> {
    try {
      const { data, error } = await supabase
        .from('sandbox_instances')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error || !data) {
        return null
      }

      return {
        sandboxId: data.sandbox_id,
        sandboxUrl: data.sandbox_url,
        status: data.status,
        createdAt: data.created_at
      }

    } catch (error) {
      logger.error({ 
        event: 'e2b.retrieval.error', 
        error: error.message,
        conversationId
      }, 'Failed to retrieve sandbox info')
      return null
    }
  }
}