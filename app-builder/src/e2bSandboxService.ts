import { Sandbox } from 'e2b'
import { logger } from './logger'
import { supabase } from './supabase'
import { SandboxEventService } from './sandboxEventService'

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
      const sandbox = await Sandbox.create(this.templateId, {
        timeoutMs: 1200000, // 20 minutes timeout
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

      // Note: shadcn components are installed by start-sandbox.sh startup script
      // No need to install them here as it causes redundant installation failures

      // Start the development server
      await this.startDevServer(sandbox)

      const host = sandbox.getHost(3000)
      const sandboxUrl = `https://${host}`
      
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
        error: error instanceof Error ? error.message : String(error),
        conversationId: config.conversationId,
        templateId: this.templateId
      }, 'Failed to create E2B sandbox')

      // Broadcast sandbox failed event
      await this.eventService.broadcastSandboxFailed(
        config.conversationId,
        config.workspaceId,
        error instanceof Error ? error.message : String(error),
        'Live preview creation failed'
      )

      throw new Error(`Failed to create E2B sandbox: ${error instanceof Error ? error.message : String(error)}`)
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
          error: error instanceof Error ? error.message : String(error),
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
        error: error instanceof Error ? error.message : String(error),
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

      const result = await sandbox.commands.run('npm install --legacy-peer-deps', {
        cwd: '/code',
        timeoutMs: 180000 // 3 minutes for better compatibility
      })

      if (result.exitCode !== 0) {
        logger.warn({ 
          event: 'e2b.dependencies.warning', 
          exitCode: result.exitCode,
          stderr: result.stderr,
          stdout: result.stdout,
          sandboxId: sandbox.sandboxId
        }, 'Dependencies installation completed with warnings')
      } else {
        logger.info({ 
          event: 'e2b.dependencies.success', 
          sandboxId: sandbox.sandboxId
        }, 'Dependencies installed successfully')
      }

    } catch (error) {
      logger.error({ 
        event: 'e2b.dependencies.install.error', 
        error: error instanceof Error ? error.message : String(error),
        sandboxId: sandbox.sandboxId
      }, 'Failed to install dependencies')
      
      // Don't throw error, continue with other setup steps
    }
  }


  /**
   * Starts the development server with health checks and monitoring
   */
  private async startDevServer(sandbox: Sandbox): Promise<void> {
    try {
      logger.info({ 
        event: 'e2b.server.starting', 
        sandboxId: sandbox.sandboxId
      }, 'Starting development server')

      // Start dev server in background with logging
      const devProcess = await sandbox.commands.start('cd /code && npm run dev > /tmp/dev-server.log 2>&1', {
        background: true
      })

      // Monitor for infinite loops and validate server health
      await this.validateDevServer(sandbox, devProcess)

    } catch (error) {
      logger.error({ 
        event: 'e2b.server.error', 
        error: error instanceof Error ? error.message : String(error),
        sandboxId: sandbox.sandboxId
      }, 'Failed to start development server')
      throw error
    }
  }

  /**
   * Validates dev server is healthy and accessible
   */
  private async validateDevServer(sandbox: Sandbox, devProcess: any): Promise<void> {
    const maxAttempts = 30 // 30 seconds max wait
    const checkInterval = 1000
    let attempts = 0

    while (attempts < maxAttempts) {
      attempts++

      // Check for infinite loops (high CPU usage)
      const cpuUsage = await this.checkCpuUsage(sandbox, devProcess)
      if (cpuUsage > 90) {
        logger.warn({ 
          event: 'e2b.server.high_cpu', 
          sandboxId: sandbox.sandboxId,
          cpuUsage
        }, 'High CPU usage detected, checking for infinite loop')

        if (await this.detectInfiniteLoop(sandbox, devProcess)) {
          throw new Error('Infinite loop detected in dev server process')
        }
      }

      // Check dev server logs for errors
      const logCheck = await this.checkDevServerLogs(sandbox)
      if (logCheck.hasErrors) {
        logger.warn({ 
          event: 'e2b.server.compilation_errors', 
          sandboxId: sandbox.sandboxId,
          errors: logCheck.errors,
          attempt: attempts
        }, 'Compilation errors detected, attempting auto-fix')

        // Attempt to auto-fix compilation errors
        const fixAttempted = await this.attemptErrorFix(sandbox, logCheck.errors, logCheck.errorContext)
        if (!fixAttempted) {
          throw new Error(`Dev server compilation errors: ${logCheck.errors.join(', ')}`)
        }
        
        // Continue monitoring after fix attempt
        continue
      }

      // Health check - verify server responds
      if (await this.healthCheckDevServer(sandbox)) {
        logger.info({ 
          event: 'e2b.server.ready', 
          sandboxId: sandbox.sandboxId,
          attempts
        }, 'Development server is healthy and accessible')
        return
      }

      await new Promise(resolve => setTimeout(resolve, checkInterval))
    }

    throw new Error('Dev server failed to become accessible within timeout period')
  }

  /**
   * Checks if dev server responds on port 3000
   */
  private async healthCheckDevServer(sandbox: Sandbox): Promise<boolean> {
    try {
      const result = await sandbox.commands.run('curl -f -s http://localhost:3000 > /dev/null 2>&1 && echo "OK" || echo "FAIL"', {
        cwd: '/code'
      })
      return result.stdout.trim() === 'OK'
    } catch {
      return false
    }
  }

  /**
   * Monitors CPU usage of dev server process
   */
  private async checkCpuUsage(sandbox: Sandbox, devProcess: any): Promise<number> {
    try {
      const result = await sandbox.commands.run('ps aux | grep "npm run dev" | grep -v grep | awk \'{print $3}\'', {
        cwd: '/code'
      })
      const cpuUsage = parseFloat(result.stdout.trim()) || 0
      return cpuUsage
    } catch {
      return 0
    }
  }

  /**
   * Detects infinite loops by checking CPU usage over time
   */
  private async detectInfiniteLoop(sandbox: Sandbox, devProcess: any): Promise<boolean> {
    const samples = 3
    const highCpuThreshold = 85
    let highCpuCount = 0

    for (let i = 0; i < samples; i++) {
      const cpuUsage = await this.checkCpuUsage(sandbox, devProcess)
      if (cpuUsage > highCpuThreshold) {
        highCpuCount++
      }
      await new Promise(resolve => setTimeout(resolve, 2000))
    }

    // If CPU is consistently high, likely an infinite loop
    if (highCpuCount >= samples - 1) {
      logger.error({ 
        event: 'e2b.server.infinite_loop', 
        sandboxId: sandbox.sandboxId,
        highCpuCount,
        samples
      }, 'Infinite loop detected - killing process')

      // Kill the hanging process
      await sandbox.commands.run('pkill -f "npm run dev"', { cwd: '/code' })
      return true
    }

    return false
  }

  /**
   * Checks dev server logs for compilation errors with context
   */
  private async checkDevServerLogs(sandbox: Sandbox): Promise<{ hasErrors: boolean; errors: string[]; errorContext?: any }> {
    try {
      const result = await sandbox.commands.run('tail -n 50 /tmp/dev-server.log 2>/dev/null || echo ""', {
        cwd: '/code'
      })

      const logs = result.stdout
      const errors: string[] = []
      let errorContext: any = null
      
      // Check for common error patterns with context extraction
      const errorPatterns = [
        { pattern: /Error: (.+)/gi, type: 'error' },
        { pattern: /SyntaxError: (.+)/gi, type: 'syntax' },
        { pattern: /TypeError: (.+)/gi, type: 'type' },
        { pattern: /Module not found: (.+)/gi, type: 'module' },
        { pattern: /Failed to compile/gi, type: 'compile' },
        { pattern: /webpack\.Error: (.+)/gi, type: 'webpack' }
      ]

      for (const { pattern, type } of errorPatterns) {
        const matches = [...logs.matchAll(pattern)]
        if (matches.length > 0) {
          errors.push(...matches.map(m => m[0]))
          
          // Extract error context for fixing
          if (!errorContext) {
            errorContext = {
              type,
              message: matches[0][1] || matches[0][0],
              fullLogs: logs,
              affectedFile: this.extractAffectedFile(logs),
              lineNumber: this.extractLineNumber(logs)
            }
          }
        }
      }

      return { hasErrors: errors.length > 0, errors, errorContext }
    } catch {
      return { hasErrors: false, errors: [] }
    }
  }

  /**
   * Extracts the affected file from error logs
   */
  private extractAffectedFile(logs: string): string | null {
    const filePatterns = [
      /at (.+\.tsx?):(\d+):(\d+)/g,
      /in (.+\.tsx?)/g,
      /Module not found.*'(.+)'/g,
      /Error in (.+\.tsx?)/g
    ]

    for (const pattern of filePatterns) {
      const match = pattern.exec(logs)
      if (match && match[1]) {
        return match[1].replace('/code/', '')
      }
    }
    return null
  }

  /**
   * Extracts line number from error logs
   */
  private extractLineNumber(logs: string): number | null {
    const linePattern = /at .+:(\d+):(\d+)/g
    const match = linePattern.exec(logs)
    return match ? parseInt(match[1]) : null
  }

  /**
   * Attempts to automatically fix compilation errors using Gemini
   */
  private async attemptErrorFix(sandbox: Sandbox, errors: string[], errorContext: any): Promise<boolean> {
    if (!errorContext || !errorContext.affectedFile) {
      logger.info({ 
        event: 'e2b.fix.skip', 
        reason: 'no_file_context',
        errors 
      }, 'Skipping auto-fix: cannot identify affected file')
      return false
    }

    try {
      logger.info({ 
        event: 'e2b.fix.attempt', 
        file: errorContext.affectedFile,
        errorType: errorContext.type,
        sandboxId: sandbox.sandboxId
      }, 'Attempting to fix compilation error')

      // Read the current file content
      const fileResult = await sandbox.commands.run(`cat /code/${errorContext.affectedFile} 2>/dev/null || echo "FILE_NOT_FOUND"`, {
        cwd: '/code'
      })

      if (fileResult.stdout.trim() === 'FILE_NOT_FOUND') {
        logger.warn({ 
          event: 'e2b.fix.file_not_found', 
          file: errorContext.affectedFile 
        }, 'Cannot fix: file not found')
        return false
      }

      // Generate fix using Gemini (simplified for now - would need proper integration)
      const fixedContent = await this.generateErrorFix(
        errorContext.affectedFile,
        fileResult.stdout,
        errorContext
      )

      if (!fixedContent) {
        return false
      }

      // Write the fixed content back to the file
      await sandbox.commands.run(`cat > /code/${errorContext.affectedFile} << 'AUTOFIX_EOF'
${fixedContent}
AUTOFIX_EOF`, {
        cwd: '/code'
      })

      logger.info({ 
        event: 'e2b.fix.applied', 
        file: errorContext.affectedFile,
        sandboxId: sandbox.sandboxId
      }, 'Applied auto-fix to file')

      return true

    } catch (error) {
      logger.error({ 
        event: 'e2b.fix.error', 
        error: error instanceof Error ? error.message : String(error),
        file: errorContext.affectedFile
      }, 'Failed to apply auto-fix')
      return false
    }
  }

  /**
   * Generates error fix using Gemini (placeholder for now)
   */
  private async generateErrorFix(filePath: string, content: string, errorContext: any): Promise<string | null> {
    // This would integrate with Gemini API to generate fixes
    // For now, implement basic fixes for common errors
    
    const { type, message } = errorContext
    
    // Simple fixes for common patterns
    if (type === 'module' && message.includes('Module not found')) {
      // Try to add missing import or fix import path
      logger.info({ 
        event: 'e2b.fix.module_not_found', 
        message 
      }, 'Attempting module resolution fix')
      
      // Extract missing module name
      const moduleMatch = message.match(/Module not found.*['"](.+)['"]/i)
      if (moduleMatch) {
        const missingModule = moduleMatch[1]
        
        // Basic fixes for common missing imports
        const commonFixes: { [key: string]: string } = {
          'react': "import React from 'react'",
          'next/link': "import Link from 'next/link'",
          'next/image': "import Image from 'next/image'",
          'next/router': "import { useRouter } from 'next/router'",
          'react/jsx-runtime': '' // JSX runtime is auto-imported
        }
        
        if (commonFixes[missingModule] !== undefined) {
          const importStatement = commonFixes[missingModule]
          if (importStatement && !content.includes(importStatement)) {
            // Add import at the top
            const lines = content.split('\n')
            const importIndex = lines.findIndex(line => line.startsWith('import ')) || 0
            lines.splice(importIndex, 0, importStatement)
            return lines.join('\n')
          }
        }
      }
    }
    
    // For now, return null to indicate no fix available
    // In full implementation, this would call Gemini API
    logger.info({ 
      event: 'e2b.fix.not_implemented', 
      errorType: type 
    }, 'Auto-fix not implemented for this error type')
    
    return null
  }

  /**
   * Stores sandbox information in Supabase
   */
  private async storeSandboxInfo(config: E2BSandboxConfig, sandboxInfo: SandboxInfo): Promise<void> {
    if (!supabase) {
      logger.warn({ 
        event: 'e2b.storage.skipped', 
        reason: 'Supabase not configured',
        sandboxId: sandboxInfo.sandboxId
      }, 'Skipping sandbox info storage - Supabase not configured');
      return;
    }

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
          error: error instanceof Error ? error.message : String(error),
          sandboxId: sandboxInfo.sandboxId
        }, 'Failed to store sandbox info')
      }

    } catch (error) {
      logger.error({ 
        event: 'e2b.storage.error', 
        error: error instanceof Error ? error.message : String(error),
        sandboxId: sandboxInfo.sandboxId
      }, 'Failed to store sandbox info')
    }
  }

  /**
   * Retrieves sandbox information from Supabase
   */
  async getSandboxInfo(conversationId: string, workspaceId: string): Promise<SandboxInfo | null> {
    if (!supabase) {
      logger.warn({ 
        event: 'e2b.retrieval.skipped', 
        reason: 'Supabase not configured',
        conversationId
      }, 'Skipping sandbox info retrieval - Supabase not configured');
      return null;
    }

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
        error: error instanceof Error ? error.message : String(error),
        conversationId
      }, 'Failed to retrieve sandbox info')
      return null
    }
  }
}